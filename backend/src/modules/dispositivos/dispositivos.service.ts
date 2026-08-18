import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  AccionAuditoria,
  ClienteFinal,
  Cuenta,
  Dispositivo,
  EntidadAuditada,
  EstadoCuenta,
  EstadoDispositivo,
  TipoDispositivo,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { RequestContextService } from '../../common/context/request-context.service';
import { ProveedorService } from '../../proveedor/proveedor.service';
import {
  CuentasProvisioningService,
  SinCapacidadEnCuentaError,
} from '../cuentas/cuentas-provisioning.service';
import { calcularCapacidad, capacidadDe } from '../cuentas/capacidad.util';
import { SensaAdapter } from '../../proveedor/sensa/sensa.adapter';
import { ColaProveedorService } from '../../queues/cola-proveedor.service';

export interface AltaDispositivoParams {
  clienteFinal: ClienteFinal;
  tipo: TipoDispositivo;
  /** MAC del equipo, si la Empresa Revendedora la conoce. */
  mac?: string;
  notaDescriptiva?: string;
  /** true para crear una Cuenta exclusiva para este Cliente Final. */
  cuentaExclusiva?: boolean;
  /** Fuerza el uso de una Cuenta puntual (migración, o agregar a la misma Cuenta). */
  cuentaIdForzada?: string;
  operadorPrincipalId: string;
}

export interface ResultadoAltaDispositivo {
  dispositivo: Dispositivo;
  cuenta: Cuenta;
  /** true si hubo que crear una Cuenta nueva en el Proveedor. */
  cuentaCreada: boolean;
  /** true si el ID del dispositivo queda pendiente de captura por polling. */
  pendienteDeAutoprovision: boolean;
}

/**
 * =============================================================================
 * Ciclo de vida de los Dispositivos
 * =============================================================================
 * Implementa los flujos 4.1 a 4.4 de docs/04_Esqueleto_Tecnico_Inicial.md.
 *
 * Orden de las operaciones, y el razonamiento detrás:
 *
 *  - **Altas**: primero se reserva local, después se llama al Proveedor, y al
 *    final se confirma. Si el Proveedor falla, se revierte la reserva. El peor
 *    caso posible es una fila local sin dispositivo en el Proveedor, que no
 *    cuesta plata y la reconciliación detecta.
 *
 *  - **Bajas y suspensiones**: primero el Proveedor, después lo local. Si el
 *    Proveedor falla, no se cambió nada localmente y el usuario ve el mensaje de
 *    "sistema congestionado". Al revés se correría el riesgo de dar de baja a un
 *    Cliente Final en IPTVControl mientras sigue mirando TV.
 *
 * En ambos casos, cuando la falla es transitoria y el estado local ya se
 * confirmó, la operación pendiente se encola en BullMQ para reintentar.
 * =============================================================================
 */
@Injectable()
export class DispositivosService {
  private readonly logger = new Logger(DispositivosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly contexto: RequestContextService,
    private readonly proveedor: ProveedorService,
    private readonly provisioning: CuentasProvisioningService,
    private readonly cola: ColaProveedorService,
  ) {}

  // ---------------------------------------------------------------------------
  // Alta (flujos 4.1 y 4.4)
  // ---------------------------------------------------------------------------

  /**
   * Alta de un Dispositivo para un Cliente Final.
   *
   * Resolución de la Cuenta:
   *  - `cuentaIdForzada` → se usa esa (agregar Dispositivo a la Cuenta actual).
   *  - `cuentaExclusiva`  → siempre se crea una Cuenta nueva, sin buscar lugar
   *    en las existentes.
   *  - por defecto (dispositivo compartido) → se busca una Cuenta propia con
   *    lugar del tipo pedido; si no hay, se crea una nueva parametrizada en
   *    1 fijo + 1 móvil.
   */
  async alta(params: AltaDispositivoParams): Promise<ResultadoAltaDispositivo> {
    const { clienteFinal, tipo, operadorPrincipalId } = params;
    const empresaRevendedora = await this.prisma.db.empresaRevendedora.findUniqueOrThrow({
      where: { id: clienteFinal.empresaRevendedoraId },
    });
    const umbral = await this.umbralAlerta(operadorPrincipalId);

    let cuentaCreada = false;
    let cuentaId = params.cuentaIdForzada ?? null;

    if (!cuentaId && !params.cuentaExclusiva) {
      cuentaId = await this.provisioning.buscarCuentaConLugar(empresaRevendedora.id, tipo, umbral);
    }

    if (!cuentaId) {
      const cuentaNueva = await this.provisioning.crearCuenta({
        empresaRevendedora,
        operadorPrincipalId,
        esExclusiva: Boolean(params.cuentaExclusiva),
      });
      cuentaId = cuentaNueva.id;
      cuentaCreada = true;
    }

    // Ampliación de la parametrización en el Proveedor si hace falta (+1).
    let cuenta: Cuenta;
    try {
      cuenta = await this.provisioning.asegurarCapacidadParaAlta(
        cuentaId,
        tipo,
        operadorPrincipalId,
        umbral,
      );
    } catch (error) {
      if (error instanceof SinCapacidadEnCuentaError) {
        throw new BadRequestException(
          'La cuenta seleccionada llegó al tope de dispositivos de esa categoría. ' +
            'Elija otra cuenta o dé de alta el cliente en una cuenta nueva.',
        );
      }
      throw error;
    }

    // --- Reserva local -------------------------------------------------------
    // Si en esa Cuenta quedó un Dispositivo liberado por una baja definitiva, se
    // reutiliza la fila en lugar de crear otra: es exactamente el caso de
    // "reasignar un Dispositivo liberado a un Cliente Final nuevo" (regla 3).
    const dispositivoReservado = await this.prisma.transaction(async (tx) => {
      const liberado = await tx.dispositivo.findFirst({
        where: { cuentaId: cuenta.id, tipo, estado: EstadoDispositivo.disponible },
        orderBy: { actualizadoEn: 'asc' },
      });

      if (liberado) {
        return tx.dispositivo.update({
          where: { id: liberado.id },
          data: {
            clienteFinalId: clienteFinal.id,
            estado: EstadoDispositivo.activo,
            mac: params.mac ? SensaAdapter.normalizarMac(params.mac) : liberado.mac,
            notaDescriptiva: params.notaDescriptiva ?? null,
            proveedorDeviceId: null,
          },
        });
      }

      return tx.dispositivo.create({
        data: {
          cuentaId: cuenta.id,
          empresaRevendedoraId: empresaRevendedora.id,
          clienteFinalId: clienteFinal.id,
          tipo,
          estado: EstadoDispositivo.activo,
          mac: params.mac ? SensaAdapter.normalizarMac(params.mac) : null,
          notaDescriptiva: params.notaDescriptiva ?? null,
        },
      });
    });

    // --- Activación en el Proveedor -----------------------------------------
    try {
      const activado = await this.proveedor.activarDispositivo(operadorPrincipalId, {
        proveedorCuentaId: cuenta.proveedorCuentaId!,
        mac: dispositivoReservado.mac ?? undefined,
      });

      const dispositivo = await this.prisma.transaction(async (tx) => {
        const actualizado = await tx.dispositivo.update({
          where: { id: dispositivoReservado.id },
          data: { proveedorDeviceId: activado?.proveedorDeviceId ?? null },
        });

        await this.audit.registrarEnTx(tx, {
          accion: AccionAuditoria.alta_dispositivo,
          entidad: EntidadAuditada.Dispositivo,
          entidadId: actualizado.id,
          empresaRevendedoraId: empresaRevendedora.id,
          detalle: {
            cuenta_id: cuenta.id,
            tipo,
            proveedor_device_id: activado?.proveedorDeviceId ?? null,
            cuenta_creada: cuentaCreada,
            numero_cliente: clienteFinal.numeroCliente,
          },
        });

        return actualizado;
      });

      return {
        dispositivo,
        cuenta,
        cuentaCreada,
        pendienteDeAutoprovision: !activado,
      };
    } catch (error) {
      // Compensación: se libera la reserva local para no dejar ocupado un cupo
      // que el Proveedor nunca activó.
      await this.revertirReserva(dispositivoReservado.id);
      throw error;
    }
  }

  /**
   * Alta de un Dispositivo adicional para un Cliente Final que ya tiene otros
   * (flujo 4.4). Si su Cuenta actual llegó al tope, se le asigna una Cuenta
   * nueva con capacidad suficiente y se migran los Dispositivos existentes.
   */
  async altaAdicional(
    clienteFinalId: string,
    tipo: TipoDispositivo,
    opciones: { mac?: string; notaDescriptiva?: string; operadorPrincipalId: string },
  ): Promise<ResultadoAltaDispositivo & { migro: boolean }> {
    const clienteFinal = await this.prisma.db.clienteFinal.findUniqueOrThrow({
      where: { id: clienteFinalId },
      include: {
        dispositivos: {
          where: {
            estado: { in: [EstadoDispositivo.activo, EstadoDispositivo.bloqueado_por_suspension] },
          },
        },
      },
    });

    if (clienteFinal.estado !== 'activo') {
      throw new BadRequestException(
        'Sólo se pueden agregar dispositivos a un cliente activo. Reactive el cliente primero.',
      );
    }

    const umbral = await this.umbralAlerta(opciones.operadorPrincipalId);
    const cuentaActualId = clienteFinal.dispositivos[0]?.cuentaId;

    // ¿La Cuenta actual del Cliente Final tiene lugar del tipo pedido?
    if (cuentaActualId) {
      const cuentaActual = await this.prisma.db.cuenta.findUniqueOrThrow({
        where: { id: cuentaActualId },
        include: { dispositivos: { select: { tipo: true, estado: true } } },
      });
      const capacidad = calcularCapacidad(cuentaActual, umbral);

      if (capacidadDe(capacidad, tipo).libres > 0 || capacidadDe(capacidad, tipo).puedeAmpliar) {
        const resultado = await this.alta({
          clienteFinal,
          tipo,
          mac: opciones.mac,
          notaDescriptiva: opciones.notaDescriptiva,
          cuentaIdForzada: cuentaActualId,
          operadorPrincipalId: opciones.operadorPrincipalId,
        });
        return { ...resultado, migro: false };
      }

      // Sin lugar: se migra el Cliente Final completo a una Cuenta con capacidad.
      const migracion = await this.migrarAcuentaConCapacidad(
        clienteFinal,
        tipo,
        opciones.operadorPrincipalId,
      );
      const resultado = await this.alta({
        clienteFinal,
        tipo,
        mac: opciones.mac,
        notaDescriptiva: opciones.notaDescriptiva,
        cuentaIdForzada: migracion.cuentaDestinoId,
        operadorPrincipalId: opciones.operadorPrincipalId,
      });
      return { ...resultado, migro: true };
    }

    // El Cliente Final no tiene Dispositivos activos: es un alta normal.
    const resultado = await this.alta({
      clienteFinal,
      tipo,
      mac: opciones.mac,
      notaDescriptiva: opciones.notaDescriptiva,
      operadorPrincipalId: opciones.operadorPrincipalId,
    });
    return { ...resultado, migro: false };
  }

  /**
   * Migración de Cuenta (flujo 4.4, paso 4).
   *
   * Se busca/crea una Cuenta con capacidad para TODOS los Dispositivos que el
   * Cliente Final va a tener (los actuales + el nuevo), y se mueven los
   * existentes: se eliminan del Proveedor en la Cuenta vieja (restando su
   * parametrización) y se vuelven a activar en la nueva.
   */
  async migrarAcuentaConCapacidad(
    clienteFinal: ClienteFinal & { dispositivos: Dispositivo[] },
    tipoNuevo: TipoDispositivo,
    operadorPrincipalId: string,
  ): Promise<{ cuentaDestinoId: string; dispositivosMigrados: number }> {
    const empresaRevendedora = await this.prisma.db.empresaRevendedora.findUniqueOrThrow({
      where: { id: clienteFinal.empresaRevendedoraId },
    });

    const fijosNecesarios =
      clienteFinal.dispositivos.filter((d) => d.tipo === TipoDispositivo.fijo).length +
      (tipoNuevo === TipoDispositivo.fijo ? 1 : 0);
    const movilesNecesarios =
      clienteFinal.dispositivos.filter((d) => d.tipo === TipoDispositivo.movil).length +
      (tipoNuevo === TipoDispositivo.movil ? 1 : 0);

    if (fijosNecesarios > 3 || movilesNecesarios > 3) {
      throw new BadRequestException(
        'El cliente superaría el tope de 3 dispositivos fijos + 3 móviles que admite una cuenta. ' +
          'No es posible agregar otro dispositivo de esa categoría.',
      );
    }

    // Cuenta destino: una propia con capacidad suficiente para el total, o nueva.
    const cuentaDestinoId = await this.buscarCuentaParaMigracion(
      empresaRevendedora.id,
      fijosNecesarios,
      movilesNecesarios,
      clienteFinal.dispositivos.map((d) => d.cuentaId),
    );

    let destinoId = cuentaDestinoId;
    if (!destinoId) {
      const nueva = await this.provisioning.crearCuenta({
        empresaRevendedora,
        operadorPrincipalId,
        esExclusiva: false,
        dispositivosFijos: Math.max(1, fijosNecesarios),
        dispositivosMoviles: Math.max(1, movilesNecesarios),
      });
      destinoId = nueva.id;
    }

    let migrados = 0;
    for (const dispositivo of clienteFinal.dispositivos) {
      if (dispositivo.cuentaId === destinoId) continue;

      // Baja en la Cuenta vieja (Proveedor primero).
      if (dispositivo.proveedorDeviceId) {
        await this.proveedor.eliminarDispositivo(
          operadorPrincipalId,
          dispositivo.proveedorDeviceId,
        );
      }
      await this.prisma.transaction(async (tx) => {
        await this.provisioning.reducirCapacidad(
          tx,
          dispositivo.cuentaId,
          dispositivo.tipo,
          operadorPrincipalId,
        );
      });

      // Alta en la Cuenta destino.
      const cuentaDestino = await this.provisioning.asegurarCapacidadParaAlta(
        destinoId,
        dispositivo.tipo,
        operadorPrincipalId,
      );
      const activado = await this.proveedor.activarDispositivo(operadorPrincipalId, {
        proveedorCuentaId: cuentaDestino.proveedorCuentaId!,
        mac: dispositivo.mac ?? undefined,
      });

      await this.prisma.transaction(async (tx) => {
        await tx.dispositivo.update({
          where: { id: dispositivo.id },
          data: {
            cuentaId: destinoId!,
            proveedorDeviceId: activado?.proveedorDeviceId ?? null,
          },
        });
        await this.audit.registrarEnTx(tx, {
          accion: AccionAuditoria.migracion_cuenta,
          entidad: EntidadAuditada.Dispositivo,
          entidadId: dispositivo.id,
          empresaRevendedoraId: empresaRevendedora.id,
          detalle: {
            cuenta_origen: dispositivo.cuentaId,
            cuenta_destino: destinoId,
            motivo: 'La cuenta anterior llegó al tope de capacidad',
          },
        });
      });

      migrados += 1;
    }

    this.logger.log(
      `Cliente Final ${clienteFinal.id} migrado a la Cuenta ${destinoId} (${migrados} dispositivos).`,
    );
    return { cuentaDestinoId: destinoId!, dispositivosMigrados: migrados };
  }

  // ---------------------------------------------------------------------------
  // Baja y suspensión (flujos 4.2 y 4.3)
  // ---------------------------------------------------------------------------

  /**
   * Libera un Dispositivo en el Proveedor y lo deja en el estado local que
   * corresponda:
   *  - `disponible`               → baja definitiva: queda libre para reasignar.
   *  - `bloqueado_por_suspension` → suspensión: reservado para su titular, NO
   *                                 se le puede dar a otro Cliente Final.
   */
  async liberar(
    dispositivoId: string,
    // Prisma genera los enums como objetos constantes, así que el tipo se
    // expresa con los literales en lugar de `EstadoDispositivo.disponible`.
    estadoFinal: 'disponible' | 'bloqueado_por_suspension',
    operadorPrincipalId: string,
    motivo: AccionAuditoria,
  ): Promise<Dispositivo> {
    const dispositivo = await this.prisma.db.dispositivo.findUnique({
      where: { id: dispositivoId },
      include: { cuenta: true },
    });
    if (!dispositivo) throw new NotFoundException('El dispositivo no existe.');

    // Proveedor primero: si falla, no se toca nada local.
    if (dispositivo.proveedorDeviceId) {
      await this.proveedor.eliminarDispositivo(operadorPrincipalId, dispositivo.proveedorDeviceId);
    }

    const actualizado = await this.prisma.transaction(async (tx) => {
      const resultado = await tx.dispositivo.update({
        where: { id: dispositivoId },
        data: {
          estado: estadoFinal,
          proveedorDeviceId: null,
          // En la baja definitiva se desvincula del Cliente Final; en la
          // suspensión se conserva el titular, porque el Dispositivo queda
          // reservado para él hasta que se resuelva su situación.
          clienteFinalId:
            estadoFinal === EstadoDispositivo.disponible ? null : dispositivo.clienteFinalId,
        },
      });

      await this.audit.registrarEnTx(tx, {
        accion: motivo,
        entidad: EntidadAuditada.Dispositivo,
        entidadId: dispositivoId,
        empresaRevendedoraId: dispositivo.empresaRevendedoraId,
        detalle: {
          cuenta_id: dispositivo.cuentaId,
          tipo: dispositivo.tipo,
          estado_final: estadoFinal,
        },
      });

      return resultado;
    });

    // Resta 1 dispositivo habilitado en la Cuenta (lógica inversa al alta). Si
    // el Proveedor falla acá, el estado local ya está bien y la corrección de la
    // parametrización se reintenta en segundo plano.
    try {
      await this.prisma.transaction(async (tx) => {
        await this.provisioning.reducirCapacidad(
          tx,
          dispositivo.cuentaId,
          dispositivo.tipo,
          operadorPrincipalId,
        );
      });
    } catch (error) {
      this.logger.warn(
        `No se pudo actualizar la parametrización de la Cuenta ${dispositivo.cuentaId} tras liberar ` +
          `el Dispositivo ${dispositivoId}: ${(error as Error).message}. Se encola un reintento.`,
      );
      await this.cola.encolarSincronizacionCapacidad({
        cuentaId: dispositivo.cuentaId,
        operadorPrincipalId,
      });
    }

    return actualizado;
  }

  /** Baja individual de un Dispositivo, sin tocar al Cliente Final ni al resto. */
  async bajaIndividual(dispositivoId: string, operadorPrincipalId: string): Promise<Dispositivo> {
    const dispositivo = await this.prisma.db.dispositivo.findUnique({
      where: { id: dispositivoId },
    });
    if (!dispositivo) throw new NotFoundException('El dispositivo no existe.');

    if (dispositivo.estado === EstadoDispositivo.bloqueado_por_suspension) {
      throw new BadRequestException(
        'El dispositivo está bloqueado por la suspensión de su cliente. La única vía para liberarlo ' +
          'es pasar ese cliente a baja definitiva.',
      );
    }

    return this.liberar(
      dispositivoId,
      EstadoDispositivo.disponible,
      operadorPrincipalId,
      AccionAuditoria.baja_dispositivo,
    );
  }

  /** Actualiza la nota descriptiva (dato interno, no se envía al Proveedor). */
  async actualizarNota(dispositivoId: string, nota: string | null): Promise<Dispositivo> {
    return this.prisma.db.dispositivo.update({
      where: { id: dispositivoId },
      data: { notaDescriptiva: nota },
    });
  }

  /**
   * Reasigna un Dispositivo liberado (estado `disponible`) a un Cliente Final.
   *
   * Riesgo de negocio aceptado y confirmado por Bruno (regla 6): el Cliente Final
   * nuevo recibe las MISMAS credenciales de Cuenta que tenía el saliente, y el
   * sistema no rota la contraseña ni notifica a los demás Clientes Finales de esa
   * Cuenta. No es un pendiente: es una decisión tomada.
   */
  async reasignar(
    dispositivoId: string,
    clienteFinalId: string,
    operadorPrincipalId: string,
    opciones?: { mac?: string; notaDescriptiva?: string },
  ): Promise<ResultadoAltaDispositivo> {
    const dispositivo = await this.prisma.db.dispositivo.findUnique({
      where: { id: dispositivoId },
    });
    if (!dispositivo) throw new NotFoundException('El dispositivo no existe.');

    if (dispositivo.estado !== EstadoDispositivo.disponible) {
      throw new BadRequestException(
        dispositivo.estado === EstadoDispositivo.bloqueado_por_suspension
          ? 'El dispositivo está bloqueado por suspensión: no se puede reasignar hasta que su cliente ' +
              'pase a baja definitiva.'
          : 'Sólo se pueden reasignar dispositivos liberados.',
      );
    }

    const clienteFinal = await this.prisma.db.clienteFinal.findUniqueOrThrow({
      where: { id: clienteFinalId },
    });

    const resultado = await this.alta({
      clienteFinal,
      tipo: dispositivo.tipo,
      mac: opciones?.mac ?? dispositivo.mac ?? undefined,
      notaDescriptiva: opciones?.notaDescriptiva,
      cuentaIdForzada: dispositivo.cuentaId,
      operadorPrincipalId,
    });

    await this.audit.registrar({
      accion: AccionAuditoria.reasignacion_dispositivo,
      entidad: EntidadAuditada.Dispositivo,
      entidadId: resultado.dispositivo.id,
      empresaRevendedoraId: dispositivo.empresaRevendedoraId,
      detalle: {
        dispositivo_origen: dispositivoId,
        cliente_final_id: clienteFinalId,
        cuenta_id: dispositivo.cuentaId,
      },
    });

    return resultado;
  }

  // ---------------------------------------------------------------------------
  // Auxiliares
  // ---------------------------------------------------------------------------

  private async buscarCuentaParaMigracion(
    empresaRevendedoraId: string,
    fijosNecesarios: number,
    movilesNecesarios: number,
    excluir: string[],
  ): Promise<string | null> {
    const candidatas = await this.prisma.db.cuenta.findMany({
      where: {
        empresaRevendedoraId,
        estado: EstadoCuenta.activa,
        esExclusiva: false,
        id: { notIn: excluir },
      },
      include: { dispositivos: { select: { tipo: true, estado: true } } },
      orderBy: { creadoEn: 'asc' },
    });

    for (const candidata of candidatas) {
      const capacidad = calcularCapacidad(candidata);
      const fijosDisponibles = 3 - capacidad.fijo.ocupados;
      const movilesDisponibles = 3 - capacidad.movil.ocupados;
      if (fijosDisponibles >= fijosNecesarios && movilesDisponibles >= movilesNecesarios) {
        return candidata.id;
      }
    }
    return null;
  }

  private async revertirReserva(dispositivoId: string): Promise<void> {
    try {
      const dispositivo = await this.prisma.db.dispositivo.findUnique({
        where: { id: dispositivoId },
      });
      if (!dispositivo) return;

      // Si la fila venía de una baja previa (reutilización), se la devuelve al
      // estado `disponible` en lugar de borrarla, para no perder el historial.
      if (dispositivo.proveedorDeviceId === null && dispositivo.clienteFinalId) {
        const tieneHistorial = await this.prisma.db.auditLog.count({
          where: { entidadId: dispositivoId, accion: AccionAuditoria.baja_dispositivo },
        });
        if (tieneHistorial > 0) {
          await this.prisma.db.dispositivo.update({
            where: { id: dispositivoId },
            data: { estado: EstadoDispositivo.disponible, clienteFinalId: null },
          });
          return;
        }
      }

      await this.prisma.db.dispositivo.delete({ where: { id: dispositivoId } });
    } catch (error) {
      this.logger.error(
        `No se pudo revertir la reserva del Dispositivo ${dispositivoId}: ${(error as Error).message}`,
      );
    }
  }

  private async umbralAlerta(operadorPrincipalId: string): Promise<number> {
    const operador = await this.prisma.operadorPrincipal.findUnique({
      where: { id: operadorPrincipalId },
      select: { umbralAlertaCapacidad: true },
    });
    return operador?.umbralAlertaCapacidad ?? 2;
  }

  /** Operador Principal del request, o el de la Empresa Revendedora indicada. */
  async operadorPrincipalId(empresaRevendedoraId?: string): Promise<string> {
    const desdeContexto = this.contexto.operadorPrincipalId;
    if (desdeContexto) return desdeContexto;
    if (!empresaRevendedoraId) {
      throw new BadRequestException('No se pudo determinar el Operador Principal del request.');
    }
    const empresa = await this.prisma.empresaRevendedora.findUniqueOrThrow({
      where: { id: empresaRevendedoraId },
      select: { operadorPrincipalId: true },
    });
    return empresa.operadorPrincipalId;
  }
}
