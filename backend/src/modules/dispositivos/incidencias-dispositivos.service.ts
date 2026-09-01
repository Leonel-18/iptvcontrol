import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  AccionAuditoria,
  Dispositivo,
  EntidadAuditada,
  EstadoClienteFinal,
  EstadoDispositivo,
  EstadoIncidenciaDispositivo,
  EstadoVinculacionDispositivo,
  TipoDispositivo,
} from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { RequestContextService } from '../../common/context/request-context.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ProveedorService } from '../../proveedor/proveedor.service';
import { ColaProveedorService } from '../../queues/cola-proveedor.service';
import {
  CuentasProvisioningService,
  SincronizacionContadoresPendienteError,
} from '../cuentas/cuentas-provisioning.service';

@Injectable()
export class IncidenciasDispositivosService {
  private readonly logger = new Logger(IncidenciasDispositivosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly contexto: RequestContextService,
    private readonly proveedor: ProveedorService,
    private readonly audit: AuditService,
    private readonly provisioning: CuentasProvisioningService,
    private readonly cola: ColaProveedorService,
  ) {}

  async listarPendientes() {
    const incidencias = await this.prisma.db.incidenciaDispositivoProveedor.findMany({
      where: { estado: EstadoIncidenciaDispositivo.pendiente },
      select: {
        id: true,
        cuentaId: true,
        proveedorDeviceId: true,
        mac: true,
        tipoProveedor: true,
        cantidadDetecciones: true,
        primeraDeteccionEn: true,
        ultimaDeteccionEn: true,
      },
      orderBy: { primeraDeteccionEn: 'asc' },
    });
    return incidencias.map((incidencia) => ({
      id: incidencia.id,
      cuenta_id: incidencia.cuentaId,
      proveedor_device_id: incidencia.proveedorDeviceId,
      mac: incidencia.mac,
      tipo_proveedor: incidencia.tipoProveedor,
      cantidad_detecciones: incidencia.cantidadDetecciones,
      primera_deteccion_en: incidencia.primeraDeteccionEn,
      ultima_deteccion_en: incidencia.ultimaDeteccionEn,
    }));
  }

  /**
   * Resuelve una incidencia de Dispositivo no autorizado:
   *
   *  - `eliminar`: el equipo no pertenece a nadie, se da de baja en el Proveedor.
   *  - `vincular`: el equipo es en realidad de un Cliente Final de esta misma
   *    Cuenta (`clienteFinalId`, obligatorio). Se crea el Dispositivo local
   *    directamente como `vinculado`, respetando el 1+1/2+2 reservado. Es una
   *    decisión manual explícita de la Empresa Revendedora, pero nunca habilita
   *    superar los cupos comerciales de la venta.
   */
  async resolver(
    id: string,
    accion: 'vincular' | 'eliminar',
    clienteFinalId?: string,
  ): Promise<{
    id: string;
    estado: EstadoIncidenciaDispositivo;
    resolucion: 'eliminado' | 'vinculado';
    dispositivo_id?: string;
  }> {
    const operadorPrincipalId = this.contexto.operadorPrincipalId;
    if (!operadorPrincipalId) {
      throw new BadRequestException('No se pudo determinar el Operador Principal del request.');
    }
    const incidencia = await this.prisma.db.incidenciaDispositivoProveedor.findUnique({
      where: { id },
      include: { cuenta: true },
    });
    if (!incidencia || incidencia.estado !== EstadoIncidenciaDispositivo.pendiente) {
      throw new NotFoundException('La incidencia no existe o ya fue resuelta.');
    }

    if (accion === 'eliminar') {
      await this.proveedor.eliminarDispositivo(operadorPrincipalId, incidencia.proveedorDeviceId);
      await this.prisma.transaction(async (tx) => {
        await tx.incidenciaDispositivoProveedor.update({
          where: { id },
          data: { estado: EstadoIncidenciaDispositivo.resuelto, resueltaEn: new Date() },
        });
        await this.audit.registrarEnTx(tx, {
          accion: AccionAuditoria.resolucion_incidencia_dispositivo,
          entidad: EntidadAuditada.IncidenciaDispositivoProveedor,
          entidadId: id,
          empresaRevendedoraId: incidencia.empresaRevendedoraId,
          detalle: {
            cuenta_id: incidencia.cuentaId,
            proveedor_device_id: incidencia.proveedorDeviceId,
            resolucion: 'eliminado',
          },
        });
      });
      return { id, estado: EstadoIncidenciaDispositivo.resuelto, resolucion: 'eliminado' };
    }

    if (!clienteFinalId) {
      throw new BadRequestException(
        'Falta indicar a qué Cliente Final pertenece este Dispositivo.',
      );
    }
    const cliente = await this.prisma.db.clienteFinal.findUnique({
      where: { id: clienteFinalId },
    });
    if (!cliente || cliente.empresaRevendedoraId !== incidencia.empresaRevendedoraId) {
      throw new BadRequestException('El Cliente Final no pertenece a esta Empresa Revendedora.');
    }
    if (cliente.estado !== EstadoClienteFinal.activo) {
      throw new BadRequestException('Sólo se puede vincular a un Cliente Final activo.');
    }
    if (
      incidencia.cuenta.esExclusiva &&
      incidencia.cuenta.clienteFinalExclusivoId &&
      incidencia.cuenta.clienteFinalExclusivoId !== clienteFinalId
    ) {
      throw new BadRequestException(
        'La Cuenta exclusiva pertenece a otro Cliente Final: sólo se pueden agregar sus propios Dispositivos.',
      );
    }

    // Puede pasar que el sondeo normal (cada 30 s) ya haya reclamado este
    // mismo equipo entre que se detectó como "desconocido" y que alguien
    // apretó "Vincular éste" — la incidencia quedó huérfana apuntando a un
    // Dispositivo que ya existe (caso real: Martín Palermo, 25/08/2026). Sin
    // este chequeo, el alta explota contra la restricción de unicidad
    // (`cuentaId` + `proveedorDeviceId`) con un error críptico.
    const yaVinculado = await this.prisma.db.dispositivo.findUnique({
      where: {
        cuentaId_proveedorDeviceId: {
          cuentaId: incidencia.cuentaId,
          proveedorDeviceId: incidencia.proveedorDeviceId,
        },
      },
    });
    if (yaVinculado) {
      await this.prisma.db.incidenciaDispositivoProveedor.update({
        where: { id },
        data: { estado: EstadoIncidenciaDispositivo.reconocido, resueltaEn: new Date() },
      });
      if (yaVinculado.clienteFinalId === clienteFinalId) {
        return {
          id,
          estado: EstadoIncidenciaDispositivo.reconocido,
          resolucion: 'vinculado',
          dispositivo_id: yaVinculado.id,
        };
      }
      throw new BadRequestException(
        'Este equipo ya está vinculado a otro Cliente Final de esta Cuenta. Use "Corregir ' +
          'vinculación" desde la pestaña Dispositivos de la Cuenta si en realidad es de este cliente.',
      );
    }

    const tipo = this.tipoLocal(incidencia.tipoProveedor ?? undefined);
    if (!tipo) {
      throw new BadRequestException(
        'El Proveedor no informó una categoría reconocida para este Dispositivo.',
      );
    }
    let ventaReservada = false;
    if (!incidencia.cuenta.esExclusiva) {
      const venta = await this.prisma.db.ventaCompartida.findUnique({
        where: {
          cuentaId_clienteFinalId: { cuentaId: incidencia.cuentaId, clienteFinalId },
        },
      });
      if (!venta) {
        try {
          ventaReservada = await this.provisioning.reservarCapacidadPorNuevaVenta({
            cuentaId: incidencia.cuentaId,
            clienteFinalId,
            empresaRevendedoraId: incidencia.empresaRevendedoraId,
            cuposPorCategoria: 1,
            operadorPrincipalId,
            actualizarProveedor: true,
            teamMemberId: this.contexto.teamMemberId,
          });
        } catch (error) {
          if (!(error instanceof SincronizacionContadoresPendienteError)) throw error;
          ventaReservada = error.ventaCreada;
          await this.cola.encolarSincronizacionContadoresVenta({
            cuentaId: incidencia.cuentaId,
            operadorPrincipalId,
          });
        }
      }
    }

    let dispositivo: Dispositivo;
    try {
      dispositivo = await this.prisma.transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${incidencia.cuentaId}))`;
        if (incidencia.cuenta.esExclusiva && !incidencia.cuenta.clienteFinalExclusivoId) {
          const asignada = await tx.cuenta.updateMany({
            where: {
              id: incidencia.cuentaId,
              OR: [{ clienteFinalExclusivoId: null }, { clienteFinalExclusivoId: clienteFinalId }],
            },
            data: { clienteFinalExclusivoId: clienteFinalId },
          });
          if (asignada.count !== 1) {
            throw new BadRequestException('La Cuenta exclusiva pertenece a otro Cliente Final.');
          }
        }
        const vinculadoDuranteBloqueo = await tx.dispositivo.findUnique({
          where: {
            cuentaId_proveedorDeviceId: {
              cuentaId: incidencia.cuentaId,
              proveedorDeviceId: incidencia.proveedorDeviceId,
            },
          },
        });
        if (vinculadoDuranteBloqueo) {
          if (vinculadoDuranteBloqueo.clienteFinalId !== clienteFinalId) {
            throw new BadRequestException(
              'Este equipo ya está vinculado a otro Cliente Final de esta Cuenta.',
            );
          }
          await tx.incidenciaDispositivoProveedor.update({
            where: { id },
            data: { estado: EstadoIncidenciaDispositivo.reconocido, resueltaEn: new Date() },
          });
          return vinculadoDuranteBloqueo;
        }
        const venta = incidencia.cuenta.esExclusiva
          ? null
          : await tx.ventaCompartida.findUniqueOrThrow({
              where: {
                cuentaId_clienteFinalId: { cuentaId: incidencia.cuentaId, clienteFinalId },
              },
            });
        const ocupadosCategoria = await tx.dispositivo.count({
          where: {
            cuentaId: incidencia.cuentaId,
            ...(incidencia.cuenta.esExclusiva ? {} : { clienteFinalId }),
            tipo,
            estado: { in: [EstadoDispositivo.activo, EstadoDispositivo.bloqueado_por_suspension] },
          },
        });
        const limite = incidencia.cuenta.esExclusiva ? 3 : venta!.cuposPorCategoria;
        if (ocupadosCategoria >= limite) {
          throw new BadRequestException(
            incidencia.cuenta.esExclusiva
              ? 'La Cuenta exclusiva ya completó esta categoría.'
              : `La venta ${limite}+${limite} ya completó sus cupos para esta categoría.`,
          );
        }

        const creado = await tx.dispositivo.create({
          data: {
            cuentaId: incidencia.cuentaId,
            empresaRevendedoraId: incidencia.empresaRevendedoraId,
            clienteFinalId,
            proveedorDeviceId: incidencia.proveedorDeviceId,
            mac: incidencia.mac,
            tipo,
            tipoProveedor: incidencia.tipoProveedor,
            estado: EstadoDispositivo.activo,
            estadoVinculacion: EstadoVinculacionDispositivo.vinculado,
          },
        });
        await tx.incidenciaDispositivoProveedor.update({
          where: { id },
          data: { estado: EstadoIncidenciaDispositivo.reconocido, resueltaEn: new Date() },
        });
        await this.audit.registrarEnTx(tx, {
          accion: AccionAuditoria.resolucion_incidencia_dispositivo,
          entidad: EntidadAuditada.IncidenciaDispositivoProveedor,
          entidadId: id,
          empresaRevendedoraId: incidencia.empresaRevendedoraId,
          detalle: {
            cuenta_id: incidencia.cuentaId,
            proveedor_device_id: incidencia.proveedorDeviceId,
            resolucion: 'vinculado',
            cliente_final_id: clienteFinalId,
          },
        });
        return creado;
      });
    } catch (error) {
      if (ventaReservada) {
        try {
          await this.provisioning.liberarCapacidadDeVenta(
            incidencia.cuentaId,
            clienteFinalId,
            operadorPrincipalId,
          );
        } catch (cause) {
          this.logger.error(
            `No se pudo revertir la venta reservada en la Cuenta ${incidencia.cuentaId}: ${(cause as Error).message}`,
          );
          await this.cola.encolarSincronizacionContadoresVenta({
            cuentaId: incidencia.cuentaId,
            operadorPrincipalId,
          });
        }
      }
      throw error;
    }
    return {
      id,
      estado: EstadoIncidenciaDispositivo.reconocido,
      resolucion: 'vinculado',
      dispositivo_id: dispositivo.id,
    };
  }

  /** Ver la misma nota en `ColaProveedorProcessor.tipoLocal`. */
  private tipoLocal(tipoProveedor?: string): TipoDispositivo | null {
    const tipo = (tipoProveedor ?? '').toLowerCase();
    if (['phone', 'tablet', 'cloud_client'].includes(tipo)) return TipoDispositivo.movil;
    if (['stationary', 'stb'].includes(tipo)) return TipoDispositivo.fijo;
    return null;
  }
}
