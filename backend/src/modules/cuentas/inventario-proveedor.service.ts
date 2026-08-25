import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  AccionAuditoria,
  EntidadAuditada,
  EstadoIncidenciaDispositivo,
  EstadoSolicitudVinculacion,
} from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestContextService } from '../../common/context/request-context.service';
import { ProveedorService } from '../../proveedor/proveedor.service';
import { DispositivoProveedor } from '../../proveedor/proveedor-adapter.interface';

export type ClasificacionDispositivoProveedor = 'vinculado' | 'desconocido';

export interface DispositivoInventarioDto {
  proveedor_device_id: string;
  mac?: string | null;
  tipo_proveedor?: string | null;
  nombre?: string | null;
  modelo?: string | null;
  activo: boolean;
  ultimo_inicio?: string | null;
  clasificacion: ClasificacionDispositivoProveedor;
  dispositivo_id?: string | null;
  cliente_final?: { id: string; numero_cliente: number; nombre: string } | null;
  incidencia_id?: string | null;
  /** true si hay una vinculación en curso: el desconocido podría ser el candidato legítimo. */
  ventana_activa?: boolean;
}

export interface InventarioProveedorDto {
  cuenta_id: string;
  proveedor_cuenta_id: string | null;
  limite_dispositivos: number;
  sincronizado_en: string;
  dispositivos: DispositivoInventarioDto[];
}

/**
 * =============================================================================
 * Inventario real de una Cuenta en el Proveedor
 * =============================================================================
 * SENSA no tiene webhooks: si un Cliente Final (o cualquiera que tenga las
 * credenciales de una Cuenta compartida) inicia sesión por el reproductor web
 * fuera de una ventana de alta activa, IPTVControl no se entera solo. Este
 * servicio es la única forma de ver, bajo pedido, qué Dispositivos existen
 * realmente en SENSA para una Cuenta — sin esto, un Dispositivo auto-provisionado
 * por el reproductor web es invisible en el panel.
 *
 * Los Dispositivos que no son un Dispositivo vendido conocido quedan
 * registrados como incidencia PENDIENTE: nunca se eliminan solos acá.
 * La eliminación (o el reconocimiento como vinculación legítima) la resuelve
 * la Empresa Revendedora desde `/device-incidents/:id/resolve`.
 * =============================================================================
 */
@Injectable()
export class InventarioProveedorService {
  private readonly logger = new Logger(InventarioProveedorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly contexto: RequestContextService,
    private readonly proveedor: ProveedorService,
    private readonly audit: AuditService,
  ) {}

  async sincronizar(cuentaId: string): Promise<InventarioProveedorDto> {
    const cuenta = await this.prisma.db.cuenta.findUnique({
      where: { id: cuentaId },
      include: {
        dispositivos: {
          where: { proveedorDeviceId: { not: null } },
          include: {
            clienteFinal: {
              select: { id: true, numeroCliente: true, nombre: true, apellido: true },
            },
          },
        },
        solicitudesVinculacion: {
          where: {
            estado: {
              in: [
                EstadoSolicitudVinculacion.pendiente,
                EstadoSolicitudVinculacion.observando,
                EstadoSolicitudVinculacion.ambiguo,
              ],
            },
          },
          select: { id: true },
        },
      },
    });
    if (!cuenta) throw new NotFoundException('La cuenta no existe o no está disponible.');

    const sincronizadoEn = new Date().toISOString();
    if (!cuenta.proveedorCuentaId) {
      return {
        cuenta_id: cuentaId,
        proveedor_cuenta_id: null,
        limite_dispositivos: cuenta.limiteDispositivos,
        sincronizado_en: sincronizadoEn,
        dispositivos: [],
      };
    }

    const operadorPrincipalId = await this.operadorDeCuenta(cuenta.empresaRevendedoraId);
    const inventario = await this.proveedor.listarDispositivos(
      operadorPrincipalId,
      cuenta.proveedorCuentaId,
    );

    const vinculadosPorId = new Map(cuenta.dispositivos.map((d) => [d.proveedorDeviceId!, d]));
    const ventanaAbierta = cuenta.solicitudesVinculacion.length > 0;
    const esOperador = this.contexto.esOperador;

    // Autocuración: si una incidencia quedó pendiente de una sincronización
    // anterior pero el Dispositivo ya está vinculado ahora (típicamente porque
    // el sondeo normal lo reclamó unos segundos después de esa consulta), se
    // cierra sola — nunca debería quedar mostrando "sin asignar" un equipo que
    // ya tiene dueño (caso real: Martín Palermo, 25/08/2026).
    await this.autocurarIncidenciasVinculadas(cuenta.id, vinculadosPorId);

    const dispositivos: DispositivoInventarioDto[] = [];
    const desconocidos: DispositivoProveedor[] = [];

    for (const item of inventario) {
      const vinculado = vinculadosPorId.get(item.proveedorDeviceId);

      if (vinculado) {
        dispositivos.push({
          proveedor_device_id: item.proveedorDeviceId,
          mac: esOperador ? undefined : item.mac,
          tipo_proveedor: item.tipo,
          nombre: esOperador ? undefined : item.nombre,
          modelo: esOperador ? undefined : item.modelo,
          activo: item.activo,
          ultimo_inicio: item.ultimoInicio,
          clasificacion: 'vinculado',
          dispositivo_id: vinculado.id,
          cliente_final:
            !esOperador && vinculado.clienteFinal
              ? {
                  id: vinculado.clienteFinal.id,
                  numero_cliente: vinculado.clienteFinal.numeroCliente,
                  nombre: [vinculado.clienteFinal.nombre, vinculado.clienteFinal.apellido]
                    .filter(Boolean)
                    .join(' '),
                }
              : null,
        });
        continue;
      }

      desconocidos.push(item);
    }

    for (const item of desconocidos) {
      // Con una ventana de vinculación abierta, un "desconocido" todavía puede
      // ser el candidato legítimo de esa venta — el sondeo normal lo va a
      // reclamar en los próximos segundos. Registrar la incidencia ACÁ sería
      // la misma carrera que causó el caso Martín Palermo: se informa igual
      // (con `ventana_activa: true`), pero sin crearla todavía.
      const incidencia = ventanaAbierta
        ? null
        : await this.registrarIncidencia(cuenta.id, cuenta.empresaRevendedoraId, item);
      dispositivos.push({
        proveedor_device_id: item.proveedorDeviceId,
        mac: esOperador ? undefined : item.mac,
        tipo_proveedor: item.tipo,
        nombre: esOperador ? undefined : item.nombre,
        modelo: esOperador ? undefined : item.modelo,
        activo: item.activo,
        ultimo_inicio: item.ultimoInicio,
        clasificacion: 'desconocido',
        incidencia_id:
          incidencia && incidencia.estado === EstadoIncidenciaDispositivo.pendiente
            ? incidencia.id
            : null,
        ventana_activa: ventanaAbierta,
      });
    }

    if (desconocidos.length > 0 && !ventanaAbierta) {
      this.logger.warn(
        `Sincronización de la Cuenta ${cuenta.id}: ${desconocidos.length} Dispositivo(s) ` +
          'no autorizados detectados en el Proveedor.',
      );
    }

    return {
      cuenta_id: cuenta.id,
      proveedor_cuenta_id: cuenta.proveedorCuentaId,
      limite_dispositivos: cuenta.limiteDispositivos,
      sincronizado_en: sincronizadoEn,
      dispositivos,
    };
  }

  /**
   * Cierra solas las incidencias pendientes cuyo Dispositivo ya está
   * vinculado. Pasa cuando la consulta manual/el barrido detectan un equipo
   * como "desconocido" justo antes de que el sondeo normal (cada 30 s) lo
   * reclame — la incidencia queda huérfana apuntando a un equipo que en
   * realidad ya tiene dueño, y el botón "Vincular éste" termina chocando
   * contra la restricción de unicidad en vez de avisar algo útil.
   */
  private async autocurarIncidenciasVinculadas(
    cuentaId: string,
    vinculadosPorId: Map<string, { id: string }>,
  ): Promise<void> {
    if (vinculadosPorId.size === 0) return;
    const pendientes = await this.prisma.db.incidenciaDispositivoProveedor.findMany({
      where: {
        cuentaId,
        estado: EstadoIncidenciaDispositivo.pendiente,
        proveedorDeviceId: { in: [...vinculadosPorId.keys()] },
      },
    });
    for (const incidencia of pendientes) {
      const dispositivo = vinculadosPorId.get(incidencia.proveedorDeviceId);
      await this.prisma.transaction(async (tx) => {
        await tx.incidenciaDispositivoProveedor.update({
          where: { id: incidencia.id },
          data: { estado: EstadoIncidenciaDispositivo.reconocido, resueltaEn: new Date() },
        });
        await this.audit.registrarEnTx(tx, {
          accion: AccionAuditoria.resolucion_incidencia_dispositivo,
          entidad: EntidadAuditada.IncidenciaDispositivoProveedor,
          entidadId: incidencia.id,
          empresaRevendedoraId: incidencia.empresaRevendedoraId,
          detalle: {
            cuenta_id: cuentaId,
            proveedor_device_id: incidencia.proveedorDeviceId,
            resolucion: 'auto_vinculado',
            dispositivo_id: dispositivo?.id,
          },
        });
      });
      this.logger.log(
        `Incidencia ${incidencia.id} de la Cuenta ${cuentaId} se cerró sola: el Dispositivo ` +
          `${incidencia.proveedorDeviceId} ya está vinculado.`,
      );
    }
  }

  /**
   * Registra (o reabre) la incidencia de un Dispositivo desconocido. Nunca lo
   * elimina: eso es una decisión explícita de la Empresa Revendedora, siempre
   * manual (regla confirmada, ver docs/03_Reglas_de_Negocio.md).
   */
  private async registrarIncidencia(
    cuentaId: string,
    empresaRevendedoraId: string,
    item: DispositivoProveedor,
  ) {
    return this.prisma.transaction(async (tx) => {
      const existente = await tx.incidenciaDispositivoProveedor.findUnique({
        where: {
          cuentaId_proveedorDeviceId: { cuentaId, proveedorDeviceId: item.proveedorDeviceId },
        },
      });

      if (existente?.estado === EstadoIncidenciaDispositivo.pendiente) {
        return tx.incidenciaDispositivoProveedor.update({
          where: { id: existente.id },
          data: { cantidadDetecciones: { increment: 1 }, ultimaDeteccionEn: new Date() },
        });
      }

      // Si ya estaba resuelta (eliminada o reconocida) y vuelve a aparecer en
      // SENSA, la baja anterior no surtió efecto o es un dispositivo nuevo con
      // el mismo ID: se reabre para que la Empresa Revendedora la revise otra vez.
      if (existente) {
        this.logger.warn(
          `El Dispositivo ${item.proveedorDeviceId} de la Cuenta ${cuentaId} reapareció en el ` +
            `Proveedor tras estar "${existente.estado}"; se reabre la incidencia.`,
        );
        const reabierta = await tx.incidenciaDispositivoProveedor.update({
          where: { id: existente.id },
          data: {
            estado: EstadoIncidenciaDispositivo.pendiente,
            mac: item.mac,
            tipoProveedor: item.tipo,
            cantidadDetecciones: { increment: 1 },
            ultimaDeteccionEn: new Date(),
            resueltaEn: null,
          },
        });
        await this.audit.registrarEnTx(tx, {
          accion: AccionAuditoria.deteccion_dispositivo_no_autorizado,
          entidad: EntidadAuditada.IncidenciaDispositivoProveedor,
          entidadId: reabierta.id,
          empresaRevendedoraId,
          detalle: {
            cuenta_id: cuentaId,
            proveedor_device_id: item.proveedorDeviceId,
            origen: 'sincronizacion_manual',
            reabierta: true,
          },
        });
        return reabierta;
      }

      const creada = await tx.incidenciaDispositivoProveedor.create({
        data: {
          cuentaId,
          empresaRevendedoraId,
          proveedorDeviceId: item.proveedorDeviceId,
          mac: item.mac,
          tipoProveedor: item.tipo,
        },
      });
      await this.audit.registrarEnTx(tx, {
        accion: AccionAuditoria.deteccion_dispositivo_no_autorizado,
        entidad: EntidadAuditada.IncidenciaDispositivoProveedor,
        entidadId: creada.id,
        empresaRevendedoraId,
        detalle: {
          cuenta_id: cuentaId,
          proveedor_device_id: item.proveedorDeviceId,
          origen: 'sincronizacion_manual',
        },
      });
      return creada;
    });
  }

  private async operadorDeCuenta(empresaRevendedoraId: string): Promise<string> {
    const contexto = this.contexto.operadorPrincipalId;
    if (contexto) return contexto;
    const empresa = await this.prisma.empresaRevendedora.findUniqueOrThrow({
      where: { id: empresaRevendedoraId },
      select: { operadorPrincipalId: true },
    });
    return empresa.operadorPrincipalId;
  }
}
