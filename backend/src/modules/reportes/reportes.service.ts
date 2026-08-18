import { Injectable } from '@nestjs/common';
import { EstadoCuenta, EstadoDispositivo } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestContextService } from '../../common/context/request-context.service';
import { ProveedorService } from '../../proveedor/proveedor.service';
import { SENSA_SERVICIOS } from '../../proveedor/sensa/sensa.constants';

/**
 * =============================================================================
 * Reportes de consumo
 * =============================================================================
 * Objetivo (docs/01_Instrucciones_del_Proyecto.md): que el Operador Principal
 * pueda facturar manualmente, por fuera del sistema. IPTVControl no emite ni
 * gestiona pagos — eso está explícitamente fuera del alcance del MVP.
 *
 * Lo que sí hace es responder la pregunta "¿cuánto le corresponde facturarle a
 * cada Empresa Revendedora este mes?": licencias comprometidas según su modalidad
 * comercial vs. Cuentas efectivamente usadas.
 *
 * Alcanza con reportes tabulares/exportables: no se requiere un dashboard
 * analítico avanzado en esta etapa.
 * =============================================================================
 */
@Injectable()
export class ReportesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contexto: RequestContextService,
    private readonly proveedor: ProveedorService,
  ) {}

  /**
   * Consumo por Empresa Revendedora.
   *
   * - Menudeo: se factura por Cuentas efectivamente utilizadas.
   * - Obligación mensual: se factura el compromiso del mes (creciente y
   *   acumulativo), se use o no. Las Cuentas no usadas no se pierden: quedan
   *   disponibles para el mes siguiente.
   */
  async consumo() {
    const empresas = await this.prisma.db.empresaRevendedora.findMany({
      include: { modalidadComercial: true },
      orderBy: { razonSocial: 'asc' },
    });

    const filas = [];
    for (const empresa of empresas) {
      const [cuentasActivas, cuentasConUso, dispositivos, clientesActivos] = await Promise.all([
        this.prisma.db.cuenta.count({
          where: { empresaRevendedoraId: empresa.id, estado: EstadoCuenta.activa },
        }),
        this.prisma.db.cuenta.count({
          where: {
            empresaRevendedoraId: empresa.id,
            estado: EstadoCuenta.activa,
            dispositivos: {
              some: {
                estado: {
                  in: [EstadoDispositivo.activo, EstadoDispositivo.bloqueado_por_suspension],
                },
              },
            },
          },
        }),
        this.prisma.db.dispositivo.count({
          where: { empresaRevendedoraId: empresa.id, estado: EstadoDispositivo.activo },
        }),
        this.prisma.db.clienteFinal.count({
          where: { empresaRevendedoraId: empresa.id, estado: 'activo' },
        }),
      ]);

      const modalidad = empresa.modalidadComercial;
      const mesesVigencia = modalidad
        ? Math.max(
            1,
            Math.floor(
              (Date.now() - new Date(modalidad.vigenteDesde).getTime()) /
                (1000 * 60 * 60 * 24 * 30),
            ) + 1,
          )
        : 0;

      const comprometidas =
        modalidad?.tipo === 'obligacion_mensual' && modalidad.ritmoIncremento
          ? modalidad.ritmoIncremento * mesesVigencia
          : null;

      const facturables =
        modalidad?.tipo === 'obligacion_mensual' ? Math.max(comprometidas ?? 0, 0) : cuentasConUso;

      filas.push({
        empresa_revendedora_id: empresa.id,
        razon_social: empresa.razonSocial,
        cuit: empresa.cuit,
        estado: empresa.estado,
        modalidad: modalidad?.tipo ?? null,
        escala: modalidad?.escala ?? null,
        precio_por_cuenta: modalidad ? Number(modalidad.precioPorCuenta) : null,
        meses_vigencia: mesesVigencia,
        cuentas_activas: cuentasActivas,
        cuentas_en_uso: cuentasConUso,
        cuentas_comprometidas: comprometidas,
        cuentas_facturables: facturables,
        importe_estimado: modalidad ? Number(modalidad.precioPorCuenta) * facturables : null,
        dispositivos_activos: dispositivos,
        clientes_activos: clientesActivos,
        // Diferencia entre lo que paga y lo que usa: si es positiva, tiene
        // Cuentas compradas sin vender (le conviene salir a venderlas).
        cuentas_sin_usar:
          comprometidas !== null ? Math.max(0, comprometidas - cuentasConUso) : null,
      });
    }

    const totales = filas.reduce(
      (acumulado, fila) => ({
        cuentas_activas: acumulado.cuentas_activas + fila.cuentas_activas,
        cuentas_en_uso: acumulado.cuentas_en_uso + fila.cuentas_en_uso,
        cuentas_facturables: acumulado.cuentas_facturables + fila.cuentas_facturables,
        importe_estimado: acumulado.importe_estimado + (fila.importe_estimado ?? 0),
        dispositivos_activos: acumulado.dispositivos_activos + fila.dispositivos_activos,
        clientes_activos: acumulado.clientes_activos + fila.clientes_activos,
      }),
      {
        cuentas_activas: 0,
        cuentas_en_uso: 0,
        cuentas_facturables: 0,
        importe_estimado: 0,
        dispositivos_activos: 0,
        clientes_activos: 0,
      },
    );

    return {
      generado_en: new Date().toISOString(),
      nota:
        'IPTVControl no emite comprobantes ni gestiona cobranzas: este reporte existe para que la ' +
        'facturación se haga manualmente por fuera del sistema.',
      filas,
      totales,
    };
  }

  /**
   * Licencias del Proveedor: contratadas por el Operador Principal vs. en uso.
   * Complementa el reporte de consumo con el dato del lado del Proveedor.
   */
  async licencias() {
    const operadorPrincipalId = this.contexto.operadorPrincipalId;
    if (!operadorPrincipalId || !this.contexto.esOperador) {
      return { disponible: false, motivo: 'Reporte exclusivo del Operador Principal.' };
    }

    try {
      const licencias = await this.proveedor.consultarLicencias(operadorPrincipalId);
      const codigos = new Set([
        ...Object.keys(licencias.compradas),
        ...Object.keys(licencias.usadas),
      ]);

      return {
        disponible: true,
        consultado_en: new Date().toISOString(),
        detalle: [...codigos].sort().map((codigo) => ({
          codigo,
          paquete: SENSA_SERVICIOS[codigo] ?? `Servicio ${codigo}`,
          compradas: licencias.compradas[codigo] ?? 0,
          usadas: licencias.usadas[codigo] ?? 0,
          disponibles: (licencias.compradas[codigo] ?? 0) - (licencias.usadas[codigo] ?? 0),
        })),
      };
    } catch (error) {
      // El reporte no debe caerse si el Proveedor está caído: se informa.
      return {
        disponible: false,
        motivo:
          'No se pudieron consultar las licencias del proveedor en este momento. ' +
          'Intente nuevamente más tarde.',
        detalle_tecnico: (error as Error).message,
      };
    }
  }
}
