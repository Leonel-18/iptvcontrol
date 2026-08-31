import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import {
  AccionAuditoria,
  EntidadAuditada,
  EstadoCuenta,
  EstadoDispositivo,
  EstadoIncidenciaDispositivo,
  EstadoSolicitudVinculacion,
  EstadoVinculacionDispositivo,
  TipoDispositivo,
  MotivoFinVentanaCuriosidad,
} from '@prisma/client';
import { Job } from 'bullmq';
import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { ProveedorService } from '../proveedor/proveedor.service';
import { CuentasProvisioningService } from '../modules/cuentas/cuentas-provisioning.service';
import {
  COLA_PROVEEDOR,
  DatosCerrarCuenta,
  DatosEliminarDispositivo,
  DatosReconciliarDispositivos,
  DatosSondearVinculacion,
  DatosSincronizarContadoresVenta,
  TRABAJOS_PROVEEDOR,
} from './cola-proveedor.constants';
import { ColaProveedorService } from './cola-proveedor.service';

/**
 * Worker de las operaciones pendientes contra el Proveedor.
 *
 * Todos los trabajos son **idempotentes**: se recalcula el estado deseado a
 * partir de la base local y se lo empuja al Proveedor. Si el trabajo corre dos
 * veces, el resultado es el mismo. Eso es lo que hace seguro reintentar.
 *
 * Los jobs corren fuera de un request HTTP, así que no hay contexto de tenant:
 * se usa `transactionComoOperador`, que fija explícitamente el Operador
 * Principal dueño de la operación para que Row-Level Security siga aplicando.
 */
@Processor(COLA_PROVEEDOR)
export class ColaProveedorProcessor extends WorkerHost {
  private readonly logger = new Logger(ColaProveedorProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly proveedor: ProveedorService,
    private readonly audit: AuditService,
    private readonly cola: ColaProveedorService,
    private readonly provisioning: CuentasProvisioningService,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case TRABAJOS_PROVEEDOR.ELIMINAR_DISPOSITIVO:
        return this.eliminarDispositivo(job.data as DatosEliminarDispositivo);
      case TRABAJOS_PROVEEDOR.RECONCILIAR_DISPOSITIVOS:
        return this.reconciliarDispositivos(job.data as DatosReconciliarDispositivos);
      case TRABAJOS_PROVEEDOR.SONDEAR_VINCULACION:
        return this.sondearVinculacion(job.data as DatosSondearVinculacion);
      case TRABAJOS_PROVEEDOR.BARRER_VINCULACIONES:
        return this.barrerVinculaciones();
      case TRABAJOS_PROVEEDOR.SINCRONIZAR_CONTADORES_VENTA:
        return this.sincronizarContadoresVenta(job.data as DatosSincronizarContadoresVenta);
      case TRABAJOS_PROVEEDOR.BARRER_INVENTARIO_CUENTAS:
        return this.barrerInventarioCuentas();
      case TRABAJOS_PROVEEDOR.CERRAR_CUENTA:
        return this.cerrarCuenta(job.data as DatosCerrarCuenta);
      default:
        this.logger.warn(`Trabajo desconocido en la cola: ${job.name}`);
        return null;
    }
  }

  /** Reintenta sincronizar los contadores de cupos comprometidos de una Cuenta compartida. */
  private async sincronizarContadoresVenta(
    datos: DatosSincronizarContadoresVenta,
  ): Promise<unknown> {
    await this.provisioning.sincronizarContadoresVenta(datos.cuentaId, datos.operadorPrincipalId);
    return { sincronizado: true };
  }

  private async eliminarDispositivo(datos: DatosEliminarDispositivo): Promise<unknown> {
    await this.proveedor.eliminarDispositivo(datos.operadorPrincipalId, datos.proveedorDeviceId);

    if (datos.dispositivoId) {
      await this.prisma.transactionComoOperador(datos.operadorPrincipalId, async (tx) => {
        await tx.dispositivo.updateMany({
          where: { id: datos.dispositivoId, proveedorDeviceId: datos.proveedorDeviceId },
          data: { proveedorDeviceId: null },
        });
      });
    }

    return { eliminado: true };
  }

  /**
   * Captura los `device_id` de los dispositivos que se auto-provisionaron.
   *
   * Necesario porque la API del Proveedor no tiene webhooks: cuando el alta se
   * hace sin MAC, el dispositivo aparece recién cuando el Cliente Final inicia
   * sesión, y la única forma de enterarse es preguntar.
   */
  private async reconciliarDispositivos(datos: DatosReconciliarDispositivos): Promise<unknown> {
    const cuenta = await this.prisma.transactionComoOperador(datos.operadorPrincipalId, (tx) =>
      tx.cuenta.findUnique({
        where: { id: datos.cuentaId },
        include: {
          dispositivos: {
            where: { estado: EstadoDispositivo.activo, proveedorDeviceId: null },
          },
        },
      }),
    );

    if (!cuenta?.proveedorCuentaId || cuenta.dispositivos.length === 0) {
      return { reconciliados: 0 };
    }

    const enProveedor = await this.proveedor.listarDispositivos(
      datos.operadorPrincipalId,
      cuenta.proveedorCuentaId,
    );

    const yaConocidos = await this.prisma.transactionComoOperador(datos.operadorPrincipalId, (tx) =>
      tx.dispositivo.findMany({
        where: { cuentaId: cuenta.id, proveedorDeviceId: { not: null } },
        select: { proveedorDeviceId: true },
      }),
    );
    const conocidos = new Set(yaConocidos.map((d) => d.proveedorDeviceId));
    const sinAsignar = enProveedor.filter((d) => !conocidos.has(d.proveedorDeviceId));

    let reconciliados = 0;
    for (const pendiente of cuenta.dispositivos) {
      // Se busca primero por MAC (match exacto) y si no hay, por tipo.
      const indice = pendiente.mac
        ? sinAsignar.findIndex((d) => d.mac?.toUpperCase() === pendiente.mac?.toUpperCase())
        : pendiente.tipo
          ? sinAsignar.findIndex((d) => this.coincideTipo(d.tipo, pendiente.tipo!))
          : sinAsignar.length === 1
            ? 0
            : -1;

      if (indice < 0) continue;

      const [encontrado] = sinAsignar.splice(indice, 1);
      await this.prisma.transactionComoOperador(datos.operadorPrincipalId, async (tx) => {
        await tx.dispositivo.update({
          where: { id: pendiente.id },
          data: {
            proveedorDeviceId: encontrado.proveedorDeviceId,
            mac: encontrado.mac ?? pendiente.mac,
          },
        });
      });
      reconciliados += 1;
    }

    if (reconciliados > 0) {
      this.logger.log(
        `Reconciliados ${reconciliados} dispositivos de la Cuenta ${cuenta.id} con el Proveedor.`,
      );
    }
    return { reconciliados };
  }

  private async sondearVinculacion(datos: DatosSondearVinculacion): Promise<unknown> {
    const solicitud = await this.prisma.transactionComoOperador(datos.operadorPrincipalId, (tx) =>
      tx.solicitudVinculacionDispositivo.findUnique({
        where: { id: datos.solicitudId },
        include: { cuenta: true, dispositivo: true },
      }),
    );
    if (
      !solicitud ||
      (solicitud.estado !== EstadoSolicitudVinculacion.pendiente &&
        solicitud.estado !== EstadoSolicitudVinculacion.observando)
    ) {
      return { activa: false };
    }

    const ahora = new Date();
    if (ahora >= solicitud.expiraEn) {
      // Si esta fila puntual ya detectó su equipo antes de que venza la
      // ventana (ej. un fijo de una venta compartida, o alguno de los hasta 3
      // fijos/3 móviles de una Cuenta exclusiva), la venta quedó cumplida
      // igual: lo que expira es sólo la búsqueda de un candidato adicional.
      const equipoYaVinculado =
        solicitud.dispositivo.estadoVinculacion === EstadoVinculacionDispositivo.vinculado;
      await this.prisma.transactionComoOperador(datos.operadorPrincipalId, async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${solicitud.cuentaId}))`;
        if (equipoYaVinculado) {
          await tx.solicitudVinculacionDispositivo.update({
            where: { id: solicitud.id },
            data: { estado: EstadoSolicitudVinculacion.vinculado, ultimoSondeoEn: ahora },
          });
          return;
        }

        // Sin equipo detectado: el Dispositivo nunca se vendió.
        if (solicitud.cuenta.esExclusiva) {
          // La Cuenta es de este Cliente Final igual, sólo tardó más de 10
          // minutos en conectar el equipo: se conserva la fila (liberada,
          // pero SIN perder el vínculo) para que el próximo alta la
          // encuentre en vez de crear una Cuenta nueva (caso real: Usuario
          // 131, 24/08/2026).
          await tx.solicitudVinculacionDispositivo.update({
            where: { id: solicitud.id },
            data: { estado: EstadoSolicitudVinculacion.expirado, ultimoSondeoEn: ahora },
          });
          await tx.dispositivo.update({
            where: { id: solicitud.dispositivoId },
            data: {
              estado: EstadoDispositivo.disponible,
              estadoVinculacion: EstadoVinculacionDispositivo.expirado,
              clienteFinalId: solicitud.dispositivo.clienteFinalId,
            },
          });
        } else {
          // Cuenta compartida: esta fila nunca tuvo MAC ni proveedor_device_id
          // y no le pertenece a nadie (el cupo ya se libera solo al no contar
          // como venta activa) — dejarla como "disponible" vacía para siempre
          // sólo ensucia el listado de Dispositivos y la lista de "liberados
          // para reasignar" sin aportar nada real. Se borra directo (la
          // Solicitud cae con ella por `onDelete: Cascade`).
          if (solicitud.creaVentaCompartida && solicitud.dispositivo.clienteFinalId) {
            const otrosDispositivos = await tx.dispositivo.count({
              where: {
                cuentaId: solicitud.cuentaId,
                clienteFinalId: solicitud.dispositivo.clienteFinalId,
                id: { not: solicitud.dispositivoId },
                estado: {
                  in: [EstadoDispositivo.activo, EstadoDispositivo.bloqueado_por_suspension],
                },
              },
            });
            if (otrosDispositivos === 0) {
              await tx.ventanaCuriosidad.updateMany({
                where: {
                  cuentaId: solicitud.cuentaId,
                  clienteFinalId: solicitud.dispositivo.clienteFinalId,
                  finRealEn: null,
                },
                data: {
                  finRealEn: ahora,
                  motivoFin: MotivoFinVentanaCuriosidad.cancelacion_venta,
                },
              });
              await tx.ventaCompartida.deleteMany({
                where: {
                  cuentaId: solicitud.cuentaId,
                  clienteFinalId: solicitud.dispositivo.clienteFinalId,
                },
              });
            }
          }
          await tx.dispositivo.delete({ where: { id: solicitud.dispositivoId } });
        }
      });
      if (!equipoYaVinculado && !solicitud.cuenta.esExclusiva) {
        // Nadie se conectó: si esto era una venta nueva, el contador que se
        // había subido en el alta se revierte solo al recalcular contra la
        // base real (ya sin este Dispositivo).
        await this.provisioning
          .sincronizarContadoresVenta(solicitud.cuentaId, datos.operadorPrincipalId)
          .catch(async (error) => {
            this.logger.error(
              `No se pudo revertir el contador de la Cuenta ${solicitud.cuentaId} tras expirar ` +
                `la vinculación: ${(error as Error).message}`,
            );
            await this.cola.encolarSincronizacionContadoresVenta({
              cuentaId: solicitud.cuentaId,
              operadorPrincipalId: datos.operadorPrincipalId,
            });
          });
      }
      return { activa: false, expirada: true };
    }

    if (!solicitud.cuenta.proveedorCuentaId) return { activa: false };
    const inventario = await this.proveedor.listarDispositivos(
      datos.operadorPrincipalId,
      solicitud.cuenta.proveedorCuentaId,
    );
    const baseline = new Set(
      Array.isArray(solicitud.baselineDeviceIds)
        ? solicitud.baselineDeviceIds.filter((id): id is string => typeof id === 'string')
        : [],
    );
    const idsVinculados = await this.prisma.transactionComoOperador(
      datos.operadorPrincipalId,
      (tx) =>
        tx.dispositivo.findMany({
          where: { cuentaId: solicitud.cuentaId, proveedorDeviceId: { not: null } },
          select: { proveedorDeviceId: true },
        }),
    );
    const conocidos = new Set(idsVinculados.map((item) => item.proveedorDeviceId));
    const candidatos = inventario.filter(
      (item) => !baseline.has(item.proveedorDeviceId) && !conocidos.has(item.proveedorDeviceId),
    );

    if (candidatos.length > 0) {
      return this.vincularCandidatos(
        solicitud,
        candidatos,
        datos.operadorPrincipalId,
        ahora,
        datos.intento,
      );
    }

    const proximoSondeoEn = new Date(ahora.getTime() + 30_000);
    await this.prisma.transactionComoOperador(datos.operadorPrincipalId, (tx) =>
      tx.solicitudVinculacionDispositivo.update({
        where: { id: solicitud.id },
        data: {
          ultimoSondeoEn: ahora,
          proximoSondeoEn,
          cantidadIntentos: { increment: 1 },
        },
      }),
    );
    await this.cola.encolarSondeoVinculacion({
      ...datos,
      intento: datos.intento + 1,
    });
    return { activa: true, candidatos: 0 };
  }

  private async barrerVinculaciones(): Promise<{ encoladas: number }> {
    const operadores = await this.prisma.operadorPrincipal.findMany({ select: { id: true } });
    let encoladas = 0;
    for (const operador of operadores) {
      const pendientes = await this.prisma.transactionComoOperador(operador.id, (tx) =>
        tx.solicitudVinculacionDispositivo.findMany({
          where: {
            estado: {
              in: [EstadoSolicitudVinculacion.pendiente, EstadoSolicitudVinculacion.observando],
            },
            proximoSondeoEn: { lte: new Date() },
          },
          select: { id: true, cantidadIntentos: true },
          orderBy: { proximoSondeoEn: 'asc' },
          take: 50,
        }),
      );
      for (const solicitud of pendientes) {
        await this.cola.encolarSondeoVinculacion({
          solicitudId: solicitud.id,
          operadorPrincipalId: operador.id,
          intento: solicitud.cantidadIntentos + 1,
        });
        encoladas += 1;
      }
    }
    return { encoladas };
  }

  /**
   * Barrido periódico best-effort: revisa un lote al azar de Cuentas activas
   * por Operador Principal para detectar Dispositivos que se auto-provisionaron
   * por fuera de una venta (ej. alguien reutiliza las credenciales compartidas
   * en el reproductor web de SENSA semanas después de la venta original). No
   * depende de que la Empresa Revendedora abra el botón de sincronización
   * manual del panel — eso sigue disponible para una revisión inmediata.
   *
   * Con el tope de 60 llamadas/minuto de SENSA y un lote chico por corrida, el
   * costo es bajo y, con el tiempo, cubre todas las Cuentas de forma rotativa.
   */
  private async barrerInventarioCuentas(): Promise<{
    cuentasRevisadas: number;
    incidenciasNuevas: number;
  }> {
    const LOTE_POR_OPERADOR = 15;
    const operadores = await this.prisma.operadorPrincipal.findMany({ select: { id: true } });

    let cuentasRevisadas = 0;
    let incidenciasNuevas = 0;

    for (const operador of operadores) {
      const cuentas = await this.prisma.transactionComoOperador(
        operador.id,
        (tx) =>
          tx.$queryRaw<
            { id: string; empresa_revendedora_id: string; proveedor_cuenta_id: string }[]
          >`
          SELECT "id", "empresa_revendedora_id", "proveedor_cuenta_id"
            FROM "cuenta"
           WHERE "estado" = 'activa' AND "proveedor_cuenta_id" IS NOT NULL
           ORDER BY RANDOM()
           LIMIT ${LOTE_POR_OPERADOR}
        `,
      );

      for (const cuenta of cuentas) {
        try {
          const detectadas = await this.sincronizarInventarioCuenta(
            cuenta.id,
            cuenta.empresa_revendedora_id,
            cuenta.proveedor_cuenta_id,
            operador.id,
          );
          cuentasRevisadas += 1;
          incidenciasNuevas += detectadas;
        } catch (error) {
          this.logger.error(
            `No se pudo sincronizar el inventario de la Cuenta ${cuenta.id}: ${(error as Error).message}`,
          );
        }
      }
    }

    if (incidenciasNuevas > 0) {
      this.logger.warn(
        `Barrido de inventario: ${incidenciasNuevas} Dispositivo(s) no autorizados detectados ` +
          `en ${cuentasRevisadas} Cuenta(s) revisadas.`,
      );
    }
    return { cuentasRevisadas, incidenciasNuevas };
  }

  /**
   * Núcleo compartido del barrido: compara el inventario real de SENSA contra
   * lo que IPTVControl conoce (Dispositivos vendidos). Todo lo que no está en
   * esa lista queda como incidencia PENDIENTE — nunca se elimina desde acá;
   * eso es una decisión manual de la Empresa Revendedora vía
   * `/device-incidents/:id/resolve`.
   */
  private async sincronizarInventarioCuenta(
    cuentaId: string,
    empresaRevendedoraId: string,
    proveedorCuentaId: string,
    operadorPrincipalId: string,
  ): Promise<number> {
    const inventario = await this.proveedor.listarDispositivos(
      operadorPrincipalId,
      proveedorCuentaId,
    );
    if (inventario.length === 0) return 0;

    return this.prisma.transactionComoOperador(operadorPrincipalId, async (tx) => {
      const [conocidos, ventanasAbiertas] = await Promise.all([
        tx.dispositivo.findMany({
          where: { cuentaId, proveedorDeviceId: { not: null } },
          select: { proveedorDeviceId: true },
        }),
        tx.solicitudVinculacionDispositivo.count({
          where: {
            cuentaId,
            estado: {
              in: [
                EstadoSolicitudVinculacion.pendiente,
                EstadoSolicitudVinculacion.observando,
                EstadoSolicitudVinculacion.ambiguo,
              ],
            },
          },
        }),
      ]);

      const permitidos = new Set(conocidos.map((d) => d.proveedorDeviceId));

      // Autocuración: una incidencia pendiente cuyo Dispositivo ya está
      // vinculado quedó huérfana de una carrera anterior (la consulta manual o
      // este mismo barrido la detectaron como "desconocido" segundos antes de
      // que el sondeo normal la reclamara). Se cierra sola, no depende de que
      // haya o no una ventana abierta ahora — el equipo ya tiene dueño.
      const pendientesConDueno = await tx.incidenciaDispositivoProveedor.findMany({
        where: {
          cuentaId,
          estado: EstadoIncidenciaDispositivo.pendiente,
          proveedorDeviceId: { in: [...permitidos].filter((id): id is string => id !== null) },
        },
      });
      for (const incidencia of pendientesConDueno) {
        await tx.incidenciaDispositivoProveedor.update({
          where: { id: incidencia.id },
          data: { estado: EstadoIncidenciaDispositivo.reconocido, resueltaEn: new Date() },
        });
        await this.audit.registrarEnTx(tx, {
          accion: AccionAuditoria.resolucion_incidencia_dispositivo,
          entidad: EntidadAuditada.IncidenciaDispositivoProveedor,
          entidadId: incidencia.id,
          empresaRevendedoraId,
          operadorPrincipalId,
          detalle: {
            cuenta_id: cuentaId,
            proveedor_device_id: incidencia.proveedorDeviceId,
            resolucion: 'auto_vinculado',
            origen: 'barrido_periodico',
          },
        });
      }

      // Con una vinculación en curso, un candidato "desconocido" todavía puede
      // ser el equipo legítimo de la venta: el sondeo de esa solicitud ya lo
      // resuelve. Evita ruido duplicado durante los 10 minutos de la ventana.
      if (ventanasAbiertas > 0) return 0;

      const desconocidos = inventario.filter((item) => !permitidos.has(item.proveedorDeviceId));
      if (desconocidos.length === 0) return 0;

      let nuevas = 0;
      for (const item of desconocidos) {
        const existente = await tx.incidenciaDispositivoProveedor.findUnique({
          where: {
            cuentaId_proveedorDeviceId: { cuentaId, proveedorDeviceId: item.proveedorDeviceId },
          },
        });

        if (existente?.estado === EstadoIncidenciaDispositivo.pendiente) {
          await tx.incidenciaDispositivoProveedor.update({
            where: { id: existente.id },
            data: { cantidadDetecciones: { increment: 1 }, ultimaDeteccionEn: new Date() },
          });
          continue;
        }

        const registrada = existente
          ? await tx.incidenciaDispositivoProveedor.update({
              where: { id: existente.id },
              data: {
                estado: EstadoIncidenciaDispositivo.pendiente,
                mac: item.mac,
                tipoProveedor: item.tipo,
                cantidadDetecciones: { increment: 1 },
                ultimaDeteccionEn: new Date(),
                resueltaEn: null,
              },
            })
          : await tx.incidenciaDispositivoProveedor.create({
              data: {
                cuentaId,
                empresaRevendedoraId,
                proveedorDeviceId: item.proveedorDeviceId,
                mac: item.mac,
                tipoProveedor: item.tipo,
              },
            });

        nuevas += 1;
        await this.audit.registrarEnTx(tx, {
          accion: AccionAuditoria.deteccion_dispositivo_no_autorizado,
          entidad: EntidadAuditada.IncidenciaDispositivoProveedor,
          entidadId: registrada.id,
          empresaRevendedoraId,
          operadorPrincipalId,
          detalle: {
            cuenta_id: cuentaId,
            proveedor_device_id: item.proveedorDeviceId,
            origen: 'barrido_periodico',
          },
        });
      }
      return nuevas;
    });
  }

  /**
   * Vincula, dentro de una unica corrida de sondeo, todos los candidatos que
   * todavia tengan lugar segun el modo de la Cuenta:
   *
   *  - Exclusiva: hasta 3 fijos + 3 moviles para el unico Cliente Final.
   *  - Compartida: hasta el 1+1 o 2+2 reservado para esta venta puntual.
   *
   * Lo que no entra por categoria queda como incidencia pendiente de revision
   * manual (nunca se elimina solo) - cubre tanto un Dispositivo de mas de este
   * mismo cliente como el caso "Pepito/Marcelo" de un cliente ajeno que probo
   * sus credenciales durante la ventana.
   */
  private async vincularCandidatos(
    solicitud: {
      id: string;
      dispositivoId: string;
      cuentaId: string;
      empresaRevendedoraId: string;
      dispositivo: { clienteFinalId: string | null; notaDescriptiva: string | null };
      cuenta: { esExclusiva: boolean };
    },
    candidatos: {
      proveedorDeviceId: string;
      mac?: string;
      tipo?: string;
    }[],
    operadorPrincipalId: string,
    ahora: Date,
    intento: number,
  ): Promise<unknown> {
    const resultado = await this.prisma.transactionComoOperador(operadorPrincipalId, async (tx) => {
      const clienteFinalId = solicitud.dispositivo.clienteFinalId;
      const yaVinculados = await tx.dispositivo.findMany({
        where: {
          cuentaId: solicitud.cuentaId,
          // En una Cuenta exclusiva el tope es por Cuenta (un unico cliente);
          // en una compartida, el tope es por Cliente Final de esta venta.
          ...(solicitud.cuenta.esExclusiva ? {} : { clienteFinalId }),
          estado: { in: [EstadoDispositivo.activo, EstadoDispositivo.bloqueado_por_suspension] },
          proveedorDeviceId: { not: null },
        },
        select: { tipo: true },
      });

      const ventaCompartida = solicitud.cuenta.esExclusiva
        ? null
        : await tx.ventaCompartida.findUnique({
            where: {
              cuentaId_clienteFinalId: {
                cuentaId: solicitud.cuentaId,
                clienteFinalId: clienteFinalId!,
              },
            },
            select: { cuposPorCategoria: true },
          });
      const topePorCategoria = solicitud.cuenta.esExclusiva
        ? 3
        : (ventaCompartida?.cuposPorCategoria ?? 1);
      let ocupadosFijo = yaVinculados.filter((d) => d.tipo === TipoDispositivo.fijo).length;
      let ocupadosMovil = yaVinculados.filter((d) => d.tipo === TipoDispositivo.movil).length;

      const admitidos: typeof candidatos = [];
      const descartados: typeof candidatos = [];
      for (const candidato of candidatos) {
        const tipo = this.tipoLocal(candidato.tipo);
        if (tipo === TipoDispositivo.fijo && ocupadosFijo < topePorCategoria) {
          admitidos.push(candidato);
          ocupadosFijo += 1;
        } else if (tipo === TipoDispositivo.movil && ocupadosMovil < topePorCategoria) {
          admitidos.push(candidato);
          ocupadosMovil += 1;
        } else {
          descartados.push(candidato);
        }
      }

      const completa = ocupadosFijo >= topePorCategoria && ocupadosMovil >= topePorCategoria;

      if (admitidos.length > 0) {
        const [primero, ...adicionales] = admitidos;
        await tx.dispositivo.update({
          where: { id: solicitud.dispositivoId },
          data: {
            proveedorDeviceId: primero.proveedorDeviceId,
            mac: primero.mac ?? null,
            tipo: this.tipoLocal(primero.tipo),
            tipoProveedor: primero.tipo ?? null,
            estadoVinculacion: EstadoVinculacionDispositivo.vinculado,
          },
        });
        for (const adicional of adicionales) {
          await tx.dispositivo.create({
            data: {
              cuentaId: solicitud.cuentaId,
              empresaRevendedoraId: solicitud.empresaRevendedoraId,
              clienteFinalId: solicitud.dispositivo.clienteFinalId,
              proveedorDeviceId: adicional.proveedorDeviceId,
              mac: adicional.mac ?? null,
              tipo: this.tipoLocal(adicional.tipo),
              tipoProveedor: adicional.tipo ?? null,
              estado: EstadoDispositivo.activo,
              estadoVinculacion: EstadoVinculacionDispositivo.vinculado,
            },
          });
        }
        await tx.solicitudVinculacionDispositivo.update({
          where: { id: solicitud.id },
          data: {
            estado: completa
              ? EstadoSolicitudVinculacion.vinculado
              : EstadoSolicitudVinculacion.observando,
            proveedorDeviceIdCandidato: primero.proveedorDeviceId,
            ultimoSondeoEn: ahora,
            proximoSondeoEn: new Date(ahora.getTime() + 30_000),
            cantidadIntentos: { increment: 1 },
          },
        });
        await this.audit.registrarEnTx(tx, {
          accion: AccionAuditoria.vinculacion_dispositivo,
          entidad: EntidadAuditada.SolicitudVinculacionDispositivo,
          entidadId: solicitud.id,
          empresaRevendedoraId: solicitud.empresaRevendedoraId,
          operadorPrincipalId,
          detalle: {
            cuenta_id: solicitud.cuentaId,
            proveedor_device_ids: admitidos.map((item) => item.proveedorDeviceId),
            completa,
          },
        });
      }

      for (const descartado of descartados) {
        await tx.incidenciaDispositivoProveedor.upsert({
          where: {
            cuentaId_proveedorDeviceId: {
              cuentaId: solicitud.cuentaId,
              proveedorDeviceId: descartado.proveedorDeviceId,
            },
          },
          create: {
            cuentaId: solicitud.cuentaId,
            empresaRevendedoraId: solicitud.empresaRevendedoraId,
            proveedorDeviceId: descartado.proveedorDeviceId,
            mac: descartado.mac,
            tipoProveedor: descartado.tipo,
          },
          update: { cantidadDetecciones: { increment: 1 }, ultimaDeteccionEn: ahora },
        });
        await this.audit.registrarEnTx(tx, {
          accion: AccionAuditoria.deteccion_dispositivo_no_autorizado,
          entidad: EntidadAuditada.IncidenciaDispositivoProveedor,
          empresaRevendedoraId: solicitud.empresaRevendedoraId,
          operadorPrincipalId,
          detalle: {
            cuenta_id: solicitud.cuentaId,
            proveedor_device_id: descartado.proveedorDeviceId,
            motivo: solicitud.cuenta.esExclusiva
              ? 'Excede el limite de 3 fijos / 3 moviles de la Cuenta.'
              : `Excede el limite de ${topePorCategoria} fijo(s) / ${topePorCategoria} movil(es) de esta venta.`,
          },
        });
      }

      return { nuevos: admitidos.length, completa, descartados };
    });

    if (!resultado.completa) {
      await this.cola.encolarSondeoVinculacion({
        solicitudId: solicitud.id,
        operadorPrincipalId,
        intento: intento + 1,
      });
    }
    return {
      activa: !resultado.completa,
      vinculada: resultado.nuevos > 0,
      dispositivos: resultado.nuevos,
    };
  }

  /**
   * SENSA reporta el tipo como "phone", "tablet", "stationary", "STB" o
   * "cloud_client" (reproductor web, ej. una PC). `cloud_client` se
   * contabiliza como **móvil** junto con phone/tablet (confirmado por Bruno
   * el 24/08/2026, caso Valentín Alamo: una venta compartida necesita poder
   * tener 1 TV/stationary "fijo" + 1 PC/cloud_client "móvil" sin chocar
   * cupos). `stationary`/`STB` son fijos.
   */
  private tipoLocal(tipoProveedor?: string): TipoDispositivo | null {
    const tipo = (tipoProveedor ?? '').toLowerCase();
    if (['phone', 'tablet', 'cloud_client'].includes(tipo)) return TipoDispositivo.movil;
    if (['stationary', 'stb'].includes(tipo)) return TipoDispositivo.fijo;
    return null;
  }

  private async cerrarCuenta(datos: DatosCerrarCuenta): Promise<unknown> {
    await this.proveedor.cerrarCuenta(datos.operadorPrincipalId, datos.proveedorCuentaId);
    await this.prisma.transactionComoOperador(datos.operadorPrincipalId, async (tx) => {
      await tx.cuenta.update({
        where: { id: datos.cuentaId },
        data: { estado: EstadoCuenta.cerrada },
      });
    });
    return { cerrada: true };
  }

  /**
   * SENSA reporta el tipo como "phone", "tablet", "stationary", "STB" o
   * "cloud_client". Los tres primeros son móviles; stationary/STB, fijos.
   */
  private coincideTipo(tipoProveedor: string | undefined, tipoLocal: TipoDispositivo): boolean {
    const esMovil = ['phone', 'tablet', 'cloud_client'].includes(
      (tipoProveedor ?? '').toLowerCase(),
    );
    return tipoLocal === TipoDispositivo.movil ? esMovil : !esMovil;
  }
}
