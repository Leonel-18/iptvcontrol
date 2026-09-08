import { Injectable } from '@nestjs/common';
import {
  EstadoClienteFinal,
  EstadoCuenta,
  EstadoDispositivo,
  EstadoEmpresaRevendedora,
  EstadoLlamadaProveedor,
  TipoAltaClienteFinal,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestContextService } from '../../common/context/request-context.service';
import { ColaProveedorService } from '../../queues/cola-proveedor.service';
import { CuentasService } from '../cuentas/cuentas.service';
import { calcularCapacidad, LIMITE_POR_CATEGORIA_EXCLUSIVA } from '../cuentas/capacidad.util';

/**
 * =============================================================================
 * Dashboard — `/dashboard`
 * =============================================================================
 * El contenido cambia según el rol, pero la ruta es la misma:
 *
 *  - **Operador Principal**: Cuentas vendidas, disponibles y bloqueadas, más el
 *    panel de salud de la integración con el Proveedor (llamadas exitosas y
 *    fallidas recientes + cola de reintentos). La idea es enterarse de un
 *    problema de integración antes de que una Empresa Revendedora llame a
 *    reportar el síntoma.
 *
 *  - **Empresa Revendedora**: sus propios números, más el aviso de Cuentas cerca
 *    del tope de capacidad.
 *
 * Definición de los tres números del Operador Principal:
 *   vendidas    → Cuentas activas con al menos un Dispositivo ocupando lugar.
 *   disponibles → Cuentas activas con lugar para otra venta (compartida) o
 *                 alguna categoría sin completar (exclusiva).
 *   bloqueadas  → Cuentas con al menos un Dispositivo bloqueado por suspensión.
 * =============================================================================
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contexto: RequestContextService,
    private readonly cola: ColaProveedorService,
    private readonly cuentas: CuentasService,
  ) {}

  async resumen() {
    return this.contexto.esOperador ? this.resumenOperador() : this.resumenRevendedora();
  }

  private async resumenOperador() {
    const [cuentas, dispositivos, empresas, clientes] = await Promise.all([
      this.prisma.db.cuenta.findMany({
        where: { estado: EstadoCuenta.activa },
        select: {
          id: true,
          esExclusiva: true,
          dispositivos: { select: { tipo: true, estado: true, clienteFinalId: true } },
          ventasCompartidas: { select: { cuposPorCategoria: true } },
          ventanasCuriosidad: {
            where: { finRealEn: null, finPrevistoEn: { gt: new Date() } },
            select: { id: true },
          },
        },
      }),
      this.prisma.db.dispositivo.groupBy({ by: ['estado'], _count: { _all: true } }),
      this.prisma.db.empresaRevendedora.groupBy({ by: ['estado'], _count: { _all: true } }),
      this.prisma.db.clienteFinal.groupBy({ by: ['estado'], _count: { _all: true } }),
    ]);

    let vendidas = 0;
    let disponibles = 0;
    let bloqueadas = 0;

    for (const cuenta of cuentas) {
      const capacidad = calcularCapacidad(cuenta);
      const tieneBloqueados = cuenta.dispositivos.some(
        (dispositivo) => dispositivo.estado === EstadoDispositivo.bloqueado_por_suspension,
      );

      if (capacidad.ocupados > 0) vendidas += 1;
      if (!capacidad.completa && (cuenta.esExclusiva || cuenta.ventanasCuriosidad.length === 0)) {
        disponibles += 1;
      }
      if (tieneBloqueados) bloqueadas += 1;
    }

    const contar = <T extends { _count: { _all: number } }>(
      grupos: T[],
      predicado: (grupo: T) => boolean,
    ) => grupos.filter(predicado).reduce((total, grupo) => total + grupo._count._all, 0);

    return {
      rol: 'operator',
      cuentas: {
        total: cuentas.length,
        vendidas,
        disponibles,
        bloqueadas,
      },
      dispositivos: {
        activos: contar(dispositivos, (grupo) => grupo.estado === EstadoDispositivo.activo),
        bloqueados: contar(
          dispositivos,
          (grupo) => grupo.estado === EstadoDispositivo.bloqueado_por_suspension,
        ),
        disponibles: contar(dispositivos, (grupo) => grupo.estado === EstadoDispositivo.disponible),
      },
      empresas_revendedoras: {
        activas: contar(empresas, (grupo) => grupo.estado === EstadoEmpresaRevendedora.activa),
        suspendidas: contar(
          empresas,
          (grupo) => grupo.estado === EstadoEmpresaRevendedora.suspendida,
        ),
      },
      clientes_finales: {
        activos: contar(clientes, (grupo) => grupo.estado === 'activo'),
        suspendidos: contar(clientes, (grupo) => grupo.estado === 'suspendido'),
        dados_de_baja: contar(clientes, (grupo) => grupo.estado === 'dado_de_baja'),
      },
      salud_integracion: await this.saludIntegracion(),
    };
  }

  private async resumenRevendedora() {
    const empresaRevendedoraId = this.contexto.empresaRevendedoraId!;

    const [cuentas, dispositivos, clientes, alertas, capacidad, empresa] = await Promise.all([
      this.prisma.db.cuenta.groupBy({
        by: ['estado'],
        where: { empresaRevendedoraId },
        _count: { _all: true },
      }),
      this.prisma.db.dispositivo.groupBy({
        by: ['estado', 'tipo'],
        where: { empresaRevendedoraId },
        _count: { _all: true },
      }),
      this.prisma.db.clienteFinal.groupBy({
        by: ['estado', 'tipoAlta'],
        where: { empresaRevendedoraId },
        _count: { _all: true },
      }),
      this.cuentas.alertasCapacidad(empresaRevendedoraId),
      this.capacidadGlobalRevendedora(empresaRevendedoraId),
      this.prisma.db.empresaRevendedora.findUnique({
        where: { id: empresaRevendedoraId },
        include: { modalidadComercial: true },
      }),
    ]);

    const contarDispositivos = (estado: EstadoDispositivo, tipo?: 'fijo' | 'movil') =>
      dispositivos
        .filter((grupo) => grupo.estado === estado && (!tipo || grupo.tipo === tipo))
        .reduce((total, grupo) => total + grupo._count._all, 0);

    // Clientes activos según cómo se dieron de alta (regla 2.1): exclusivos
    // (Cuenta completa) vs. de ventas en Cuentas compartidas.
    const contarClientesActivosPorTipo = (tipo: TipoAltaClienteFinal) =>
      clientes
        .filter((grupo) => grupo.estado === EstadoClienteFinal.activo && grupo.tipoAlta === tipo)
        .reduce((total, grupo) => total + grupo._count._all, 0);
    const contarClientesPorEstado = (estado: EstadoClienteFinal) =>
      clientes
        .filter((grupo) => grupo.estado === estado)
        .reduce((total, grupo) => total + grupo._count._all, 0);

    return {
      rol: 'reseller',
      cuentas: {
        activas: cuentas.find((grupo) => grupo.estado === EstadoCuenta.activa)?._count._all ?? 0,
        cerradas: cuentas.find((grupo) => grupo.estado === EstadoCuenta.cerrada)?._count._all ?? 0,
      },
      dispositivos: {
        activos: contarDispositivos(EstadoDispositivo.activo),
        activos_fijos: contarDispositivos(EstadoDispositivo.activo, 'fijo'),
        activos_moviles: contarDispositivos(EstadoDispositivo.activo, 'movil'),
        bloqueados: contarDispositivos(EstadoDispositivo.bloqueado_por_suspension),
        disponibles: contarDispositivos(EstadoDispositivo.disponible),
      },
      clientes_finales: {
        activos: contarClientesPorEstado(EstadoClienteFinal.activo),
        suspendidos: contarClientesPorEstado(EstadoClienteFinal.suspendido),
        dados_de_baja: contarClientesPorEstado(EstadoClienteFinal.dado_de_baja),
        activos_exclusivos: contarClientesActivosPorTipo(TipoAltaClienteFinal.cuenta_exclusiva),
        activos_compartidos: contarClientesActivosPorTipo(
          TipoAltaClienteFinal.dispositivo_compartido,
        ),
      },
      modalidad_comercial: empresa?.modalidadComercial
        ? {
            tipo: empresa.modalidadComercial.tipo,
            escala: empresa.modalidadComercial.escala,
            precio_por_cuenta: Number(empresa.modalidadComercial.precioPorCuenta),
          }
        : null,
      capacidad,
      alertas_capacidad: alertas,
    };
  }

  /**
   * Capacidad utilizada a nivel Empresa Revendedora, por categoría, sobre sus
   * Cuentas ACTIVAS (las cerradas no ocupan cupos).
   *
   * - Cuenta exclusiva: cada categoría habilita 3 asientos; ocupa un asiento por
   *   Dispositivo fijo/móvil activo o bloqueado por suspensión.
   * - Cuenta compartida: cada venta 1+1/2+2 compromete la misma cantidad de
   *   cupos en ambas categorías (una venta 2+2 = 2 cupos fijos + 2 móviles).
   *
   * Es un cálculo real (se suma lo que el resto del sistema ya cuenta por
   * Cuenta con `calcularCapacidad`), no un estimado.
   */
  private async capacidadGlobalRevendedora(empresaRevendedoraId: string) {
    const cuentas = await this.prisma.db.cuenta.findMany({
      where: { estado: EstadoCuenta.activa, empresaRevendedoraId },
      select: {
        esExclusiva: true,
        dispositivos: { select: { tipo: true, estado: true } },
        ventasCompartidas: { select: { cuposPorCategoria: true } },
      },
    });

    const fijos = { ocupados: 0, limite: 0 };
    const moviles = { ocupados: 0, limite: 0 };
    for (const cuenta of cuentas) {
      fijos.limite += LIMITE_POR_CATEGORIA_EXCLUSIVA;
      moviles.limite += LIMITE_POR_CATEGORIA_EXCLUSIVA;
      if (cuenta.esExclusiva) {
        const cap = calcularCapacidad(cuenta, 0);
        fijos.ocupados += cap.fijo.ocupados;
        moviles.ocupados += cap.movil.ocupados;
      } else {
        const cupos = (cuenta.ventasCompartidas ?? []).reduce(
          (total, venta) => total + venta.cuposPorCategoria,
          0,
        );
        fijos.ocupados += cupos;
        moviles.ocupados += cupos;
      }
    }

    return { fijos, moviles };
  }

  /**
   * Panel de salud de la integración: últimas llamadas exitosas/fallidas y
   * tamaño de la cola de reintentos pendientes.
   */
  async saludIntegracion() {
    const desde = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [porEstado, ultimasFallidas, ultimaExitosa, estadoCola] = await Promise.all([
      this.prisma.llamadaProveedor.groupBy({
        by: ['estado'],
        where: { creadoEn: { gte: desde }, operadorPrincipalId: this.contexto.operadorPrincipalId },
        _count: { _all: true },
      }),
      this.prisma.llamadaProveedor.findMany({
        where: {
          estado: EstadoLlamadaProveedor.fallida,
          operadorPrincipalId: this.contexto.operadorPrincipalId,
        },
        orderBy: { creadoEn: 'desc' },
        take: 10,
        select: {
          operacion: true,
          codigo: true,
          mensaje: true,
          duracionMs: true,
          creadoEn: true,
        },
      }),
      this.prisma.llamadaProveedor.findFirst({
        where: {
          estado: EstadoLlamadaProveedor.exitosa,
          operadorPrincipalId: this.contexto.operadorPrincipalId,
        },
        orderBy: { creadoEn: 'desc' },
        select: { operacion: true, creadoEn: true, duracionMs: true },
      }),
      this.cola.estado(),
    ]);

    const exitosas =
      porEstado.find((grupo) => grupo.estado === EstadoLlamadaProveedor.exitosa)?._count._all ?? 0;
    const fallidas =
      porEstado.find((grupo) => grupo.estado === EstadoLlamadaProveedor.fallida)?._count._all ?? 0;
    const total = exitosas + fallidas;

    return {
      ventana: 'últimas 24 horas',
      llamadas_exitosas: exitosas,
      llamadas_fallidas: fallidas,
      tasa_exito: total > 0 ? Math.round((exitosas / total) * 100) : null,
      ultima_exitosa: ultimaExitosa
        ? {
            operacion: ultimaExitosa.operacion,
            duracion_ms: ultimaExitosa.duracionMs,
            fecha: ultimaExitosa.creadoEn,
          }
        : null,
      ultimas_fallidas: ultimasFallidas.map((llamada) => ({
        operacion: llamada.operacion,
        codigo: llamada.codigo,
        mensaje: llamada.mensaje,
        duracion_ms: llamada.duracionMs,
        fecha: llamada.creadoEn,
      })),
      cola_reintentos: estadoCola,
      // Semáforo simple para el panel: verde si no hubo fallas ni pendientes.
      estado_general:
        !estadoCola.disponible || fallidas > exitosas
          ? 'critico'
          : fallidas > 0 || estadoCola.fallidos > 0 || estadoCola.pendientes > 0
            ? 'atencion'
            : 'ok',
    };
  }
}
