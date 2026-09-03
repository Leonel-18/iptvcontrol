import { Injectable, Logger } from '@nestjs/common';
import {
  AccionAuditoria,
  ClienteFinal,
  Cuenta,
  EmpresaRevendedora,
  EntidadAuditada,
  EstadoCuenta,
  EstadoDispositivo,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { AuditService } from '../../common/audit/audit.service';
import { ProveedorService } from '../../proveedor/proveedor.service';
import { ConfiguracionProveedorService } from '../../proveedor/configuracion-proveedor.service';
import {
  DniRepetidoError,
  EmailRepetidoError,
  ReintentosDniAgotadosError,
} from '../../common/errors/proveedor.errors';
import { IdentificadoresService } from './identificadores.service';
import {
  calcularCapacidad,
  LIMITE_POR_CATEGORIA_COMPARTIDA,
  LIMITE_POR_CATEGORIA_EXCLUSIVA,
} from './capacidad.util';
import { VentanasCuriosidadService } from './ventanas-curiosidad.service';
import { inicioMesArgentina, finMesArgentina } from '../../common/time/calendario-comercial';
import { TransactionClient } from '../../common/prisma/prisma.service';

/** Señal interna: esta Cuenta no puede alojar la venta/Dispositivo pedido. */
export class SinCapacidadEnCuentaError extends Error {
  constructor(readonly cuentaId: string) {
    super(`La Cuenta ${cuentaId} llegó a su límite comercial.`);
    this.name = 'SinCapacidadEnCuentaError';
  }
}

/** SENSA confirmó el contador, pero todavía falta verificar su valor vigente. */
export class SincronizacionContadoresPendienteError extends Error {
  constructor(
    readonly cuentaId: string,
    readonly ventaCreada: boolean,
  ) {
    super(`La sincronización de contadores de la Cuenta ${cuentaId} requiere un reintento.`);
    this.name = 'SincronizacionContadoresPendienteError';
  }
}

/** La Empresa Revendedora superó su límite mensual de creación de Cuentas. */
export class LimiteCreacionMensualError extends Error {
  constructor(
    readonly empresaRevendedoraId: string,
    readonly limite: number,
  ) {
    super(`Esta Empresa Revendedora alcanzó su máximo de ${limite} Cuenta(s) nuevas en el mes.`);
    this.name = 'LimiteCreacionMensualError';
  }
}

export interface CrearCuentaOpciones {
  empresaRevendedora: EmpresaRevendedora;
  operadorPrincipalId: string;
  /** true si la Cuenta se crea para un único Cliente Final (cuenta exclusiva). */
  esExclusiva: boolean;
  clienteFinal?: Pick<ClienteFinal, 'id' | 'nombre' | 'apellido' | 'telefono' | 'direccion'>;
  /** Firma canónica de servicios. */
  servicios?: string;
  /**
   * Proyección técnica inicial de capacidad. Por defecto: 3/3 para una Cuenta
   * exclusiva y 1/1 para una Cuenta compartida. Una venta compartida 2+2
   * sobreescribe ambos valores con 2.
   */
  dispositivosFijos?: number;
  dispositivosMoviles?: number;
}

/**
 * =============================================================================
 * Aprovisionamiento de Cuentas en el Proveedor
 * =============================================================================
 * Acá vive la parte más delicada del sistema: coordinar una escritura local con
 * una llamada a un tercero que puede fallar. La regla de negocio es explícita:
 * "no se debe dejar la operación en un estado intermedio inconsistente"
 * (docs/03_Reglas_de_Negocio.md, sección 5).
 *
 * Orden elegido para las ALTAS, y por qué:
 *
 *   1. Se reserva todo lo local en una transacción corta (DNI, email, fila de
 *      Cuenta con `proveedor_cuenta_id` en null).
 *   2. Se llama al Proveedor FUERA de la transacción, para no dejar una
 *      transacción de base de datos abierta esperando una respuesta de red.
 *   3. Si el Proveedor confirma, se completa la fila local.
 *   4. Si el Proveedor falla de forma definitiva, se borra la reserva
 *      (compensación) y el error se traduce al mensaje de negocio.
 *
 * Elegimos este orden porque de los dos estados inconsistentes posibles, el
 * menos grave es "fila local sin Cuenta en SENSA": no consume licencias, no le
 * cuesta plata al Operador Principal y el job de reconciliación lo detecta. El
 * inverso —una Cuenta creada en SENSA que IPTVControl no conoce— sí costaría
 * plata y sería invisible.
 * =============================================================================
 */
@Injectable()
export class CuentasProvisioningService {
  private readonly logger = new Logger(CuentasProvisioningService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly proveedor: ProveedorService,
    private readonly configuracion: ConfiguracionProveedorService,
    private readonly identificadores: IdentificadoresService,
    private readonly audit: AuditService,
    private readonly ventanasCuriosidad: VentanasCuriosidadService,
  ) {}

  /**
   * Crea una Cuenta nueva en el Proveedor y la registra localmente.
   *
   * Una Cuenta exclusiva arranca con sus tres categorías al tope (3 fijos + 3
   * móviles) para su único Cliente Final. Una Cuenta compartida arranca en 1/1
   * (su primera venta); los contadores suben de a uno por cada venta nueva que
   * se suma, vía `reservarCapacidadPorNuevaVenta`.
   */
  async crearCuenta(opciones: CrearCuentaOpciones): Promise<Cuenta> {
    const { empresaRevendedora, operadorPrincipalId, esExclusiva } = opciones;
    const config = await this.configuracion.obtener(operadorPrincipalId);

    const limiteDispositivos = LIMITE_POR_CATEGORIA_COMPARTIDA;
    const dispositivosPorDefecto = esExclusiva ? LIMITE_POR_CATEGORIA_COMPARTIDA : 1;
    const dispositivosFijos = opciones.dispositivosFijos ?? dispositivosPorDefecto;
    const dispositivosMoviles = opciones.dispositivosMoviles ?? dispositivosPorDefecto;

    // Credenciales de la Cuenta en el Proveedor. SENSA exige contraseña
    // numérica (8-20) y PIN numérico (4-8).
    const password = this.crypto.generarPasswordNumerica(8);
    const pin = this.crypto.generarPinNumerico(6);

    // --- Paso 1: reserva local ------------------------------------------------
    const reserva = await this.prisma.transaction(async (tx) => {
      await this.validarCupoCreacionMensual(tx, empresaRevendedora);

      const dni = await this.identificadores.siguienteDni(tx, operadorPrincipalId);
      const { email } = await this.identificadores.siguienteEmailCuenta(tx, empresaRevendedora.id);

      const cuenta = await tx.cuenta.create({
        data: {
          empresaRevendedoraId: empresaRevendedora.id,
          proveedorId: config.proveedorId,
          dniAltaSensa: dni,
          // En SENSA el usuario de la Cuenta es su `customer_id`, que coincide
          // con el identificador tipo DNI generado por IPTVControl.
          usuario: dni,
          passwordCifrado: this.crypto.encrypt(password),
          pinCifrado: this.crypto.encrypt(pin),
          emailContacto: email,
          esExclusiva,
          clienteFinalExclusivoId: esExclusiva ? opciones.clienteFinal?.id : null,
          servicios: opciones.servicios ?? config.serviciosPorDefecto,
          limiteDispositivos,
          dispositivosFijosHabilitados: dispositivosFijos,
          dispositivosMovilesHabilitados: dispositivosMoviles,
          estado: EstadoCuenta.activa,
        },
      });
      return cuenta;
    });

    // --- Paso 2: alta en el Proveedor, con reintentos de DNI/email -----------
    let cuentaActual = reserva;
    const maxIntentos = Math.max(
      1,
      (
        await this.prisma.operadorPrincipal.findUnique({
          where: { id: operadorPrincipalId },
          select: { maxReintentosDni: true },
        })
      )?.maxReintentosDni ?? 25,
    );

    for (let intento = 1; intento <= maxIntentos; intento += 1) {
      try {
        const cuentaProveedor = await this.proveedor.crearCuenta(operadorPrincipalId, {
          dni: cuentaActual.dniAltaSensa,
          email: cuentaActual.emailContacto,
          password,
          pin,
          // En una Cuenta exclusiva (un único Cliente Final) se prioriza el
          // nombre y apellido cargados en el formulario del cliente: son los
          // datos reales del titular del servicio, y una Cuenta compartida no
          // podría usar este mismo criterio porque atañe a varios clientes
          // distintos (confirmado con Bruno, 26/08/2026). El contacto de la
          // Empresa Revendedora sigue siendo el fallback si el campo vino vacío.
          nombre: esExclusiva
            ? opciones.clienteFinal?.nombre ||
              empresaRevendedora.nombreContacto ||
              empresaRevendedora.razonSocial
            : empresaRevendedora.nombreContacto || empresaRevendedora.razonSocial,
          apellido: esExclusiva
            ? opciones.clienteFinal?.apellido || empresaRevendedora.apellidoContacto || 'Revendedor'
            : empresaRevendedora.apellidoContacto || 'Revendedor',
          direccion: opciones.clienteFinal?.direccion || empresaRevendedora.direccion,
          ciudad: config.ciudadPorDefecto,
          telefono: opciones.clienteFinal?.telefono || empresaRevendedora.telefonoContacto,
          servicios: cuentaActual.servicios,
          // El contador genérico de SENSA (`auto_provision_count`, STB) no se
          // usa como categoría propia del negocio: se manda siempre igual a
          // fijos/móviles para que los tres contadores avancen en lockstep
          // (1/1/1 en una Cuenta compartida nueva, 3/3/3 en una exclusiva).
          limiteDispositivos: dispositivosFijos,
          dispositivosFijos,
          dispositivosMoviles,
          // El external_customer_id debe coincidir con el DNI generado, no con
          // el UUID interno de la Cuenta: es el identificador que Bruno usa
          // para cruzar la Cuenta de SENSA con IPTVControl.
          referenciaExterna: cuentaActual.dniAltaSensa,
        });

        // --- Paso 3: confirmación local -------------------------------------
        const confirmada = await this.prisma.transaction(async (tx) => {
          const actualizada = await tx.cuenta.update({
            where: { id: cuentaActual.id },
            data: {
              proveedorCuentaId: cuentaProveedor.proveedorCuentaId,
              // La firma canónica siempre es la local: es la que permite
              // compartir Cuentas por igualdad exacta. El valor de SENSA se
              // conserva sólo como referencia en el detalle de auditoría.
              servicios: cuentaActual.servicios,
              dispositivosFijosHabilitados: cuentaProveedor.dispositivosFijos || dispositivosFijos,
              dispositivosMovilesHabilitados:
                cuentaProveedor.dispositivosMoviles || dispositivosMoviles,
            },
          });

          await this.audit.registrarEnTx(tx, {
            accion: AccionAuditoria.alta_cuenta,
            entidad: EntidadAuditada.Cuenta,
            entidadId: actualizada.id,
            empresaRevendedoraId: empresaRevendedora.id,
            detalle: {
              proveedor_cuenta_id: cuentaProveedor.proveedorCuentaId,
              es_exclusiva: esExclusiva,
              dispositivos_fijos: actualizada.dispositivosFijosHabilitados,
              dispositivos_moviles: actualizada.dispositivosMovilesHabilitados,
              intentos_dni: intento,
            },
          });

          return actualizada;
        });

        this.logger.log(
          `Cuenta ${confirmada.id} creada en el Proveedor (customer_id ${cuentaProveedor.proveedorCuentaId}) ` +
            `para la Empresa Revendedora ${empresaRevendedora.id}.`,
        );
        return confirmada;
      } catch (error) {
        // "ID (DNI) repetido": se incrementa el número y se reintenta sin
        // molestar al usuario (reglas de negocio 2.3 y 5).
        if (error instanceof DniRepetidoError) {
          cuentaActual = await this.prisma.transaction(async (tx) => {
            const nuevoDni = await this.identificadores.avanzarDniPorColision(
              tx,
              operadorPrincipalId,
              cuentaActual.dniAltaSensa,
            );
            return tx.cuenta.update({
              where: { id: cuentaActual.id },
              data: { dniAltaSensa: nuevoDni, usuario: nuevoDni },
            });
          });
          continue;
        }

        // El email derivado ya existía en el Proveedor: se avanza el correlativo
        // y se reintenta, con el mismo criterio que el DNI.
        if (error instanceof EmailRepetidoError) {
          cuentaActual = await this.prisma.transaction(async (tx) => {
            const { email } = await this.identificadores.siguienteEmailCuenta(
              tx,
              empresaRevendedora.id,
            );
            return tx.cuenta.update({
              where: { id: cuentaActual.id },
              data: { emailContacto: email },
            });
          });
          continue;
        }

        // Cualquier otro error es definitivo para esta operación: se borra la
        // reserva local para no dejar una Cuenta fantasma y se propaga.
        await this.eliminarReserva(cuentaActual.id);
        throw error;
      }
    }

    await this.eliminarReserva(cuentaActual.id);
    throw new ReintentosDniAgotadosError(maxIntentos);
  }

  /**
   * Reserva 1+1 o 2+2 para una venta compartida y, si la Cuenta ya existía,
   * sube los contadores de SENSA antes de abrir la ventana de vinculación.
   */
  async reservarCapacidadPorNuevaVenta(params: {
    cuentaId: string;
    clienteFinalId: string;
    empresaRevendedoraId: string;
    cuposPorCategoria: 1 | 2;
    operadorPrincipalId: string;
    actualizarProveedor: boolean;
    duracionVentanaCuriosidadMinutos?: number;
    teamMemberId?: string;
  }): Promise<boolean> {
    const { cuentaId, clienteFinalId, empresaRevendedoraId, cuposPorCategoria } = params;
    const reserva = await this.prisma.transaction(async (tx) => {
      // Serializa ventas concurrentes sobre la misma Cuenta: dos requests no
      // pueden observar el mismo último cupo y comprometerlo a la vez.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${cuentaId}))`;
      const cuenta = await tx.cuenta.findUniqueOrThrow({
        where: { id: cuentaId },
        include: { ventasCompartidas: true },
      });
      if (cuenta.esExclusiva) return null;

      const existente = cuenta.ventasCompartidas.find(
        (venta) => venta.clienteFinalId === clienteFinalId,
      );
      if (existente) {
        return { cuenta, nuevoValor: this.sumarCupos(cuenta.ventasCompartidas), creada: false };
      }

      const ocupados = this.sumarCupos(cuenta.ventasCompartidas);
      const nuevoValor = ocupados + cuposPorCategoria;
      if (nuevoValor > LIMITE_POR_CATEGORIA_COMPARTIDA) {
        throw new SinCapacidadEnCuentaError(cuentaId);
      }

      const venta = await tx.ventaCompartida.create({
        data: {
          cuentaId,
          clienteFinalId,
          empresaRevendedoraId,
          cuposPorCategoria,
        },
      });
      await this.ventanasCuriosidad.abrirPorNuevaVentaEnTx(tx, {
        cuentaId,
        clienteFinalId,
        empresaRevendedoraId,
        ventaCompartidaId: venta.id,
        duracionSolicitadaMinutos: params.duracionVentanaCuriosidadMinutos,
        teamMemberId: params.teamMemberId,
      });
      return { cuenta, nuevoValor, creada: true };
    });

    if (!reserva) return false;
    if (!params.actualizarProveedor || !reserva.cuenta.proveedorCuentaId) return reserva.creada;
    try {
      await this.aplicarContadoresVenta(
        reserva.cuenta,
        reserva.nuevoValor,
        params.operadorPrincipalId,
      );
    } catch (error) {
      if (error instanceof SincronizacionContadoresPendienteError) {
        throw new SincronizacionContadoresPendienteError(cuentaId, reserva.creada);
      }
      if (reserva.creada) {
        await this.liberarCapacidadDeVenta(cuentaId, clienteFinalId, params.operadorPrincipalId);
      }
      throw error;
    }
    return reserva.creada;
  }

  async liberarCapacidadDeVenta(
    cuentaId: string,
    clienteFinalId: string,
    operadorPrincipalId: string,
  ): Promise<boolean> {
    const eliminada = await this.prisma.transactionComoOperador(operadorPrincipalId, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${cuentaId}))`;
      const dispositivosVigentes = await tx.dispositivo.count({
        where: {
          cuentaId,
          clienteFinalId,
          estado: {
            in: [EstadoDispositivo.activo, EstadoDispositivo.bloqueado_por_suspension],
          },
        },
      });
      if (dispositivosVigentes > 0) return false;
      await this.ventanasCuriosidad.cerrarPorCancelacionEnTx(tx, cuentaId, clienteFinalId);
      const resultado = await tx.ventaCompartida.deleteMany({
        where: { cuentaId, clienteFinalId },
      });
      return resultado.count > 0;
    });
    if (eliminada) await this.sincronizarContadoresVenta(cuentaId, operadorPrincipalId);
    return eliminada;
  }

  /**
   * Recalcula los contadores de una Cuenta compartida a partir de sus ventas
   * activas reales y los sincroniza con el Proveedor si cambiaron. Se llama
   * DESPUÉS de dar de baja o suspender al último Dispositivo de un Cliente
   * Final en la Cuenta, para bajar el cupo que SENSA le habilita a esa Cuenta.
   */
  async sincronizarContadoresVenta(cuentaId: string, operadorPrincipalId: string): Promise<void> {
    const cuenta = await this.prisma.transactionComoOperador(operadorPrincipalId, (tx) =>
      tx.cuenta.findUniqueOrThrow({
        where: { id: cuentaId },
        include: { ventasCompartidas: { select: { cuposPorCategoria: true } } },
      }),
    );
    if (cuenta.esExclusiva || !cuenta.proveedorCuentaId) return;

    const ventas = this.sumarCupos(cuenta.ventasCompartidas);
    // Nunca menos de 1: SENSA exige al menos un dispositivo móvil habilitado
    // mientras la Cuenta siga activa, aunque momentáneamente no tenga ventas.
    const nuevoValor = Math.max(1, ventas);
    if (
      nuevoValor === cuenta.dispositivosFijosHabilitados &&
      nuevoValor === cuenta.dispositivosMovilesHabilitados
    ) {
      return;
    }
    await this.aplicarContadoresVenta(cuenta, nuevoValor, operadorPrincipalId);
  }

  /**
   * Empuja el tope fijo de una Cuenta exclusiva (3 fijos + 3 móviles) al
   * Proveedor. Se llama tras convertir una Cuenta compartida en exclusiva
   * (Actualizar propiedades de Cuenta), ya que esa Cuenta nunca vuelve a
   * variar sus contadores por ventas.
   */
  async aplicarLimiteExclusiva(cuentaId: string, operadorPrincipalId: string): Promise<void> {
    const cuenta = await this.prisma.transactionComoOperador(operadorPrincipalId, (tx) =>
      tx.cuenta.findUniqueOrThrow({ where: { id: cuentaId } }),
    );
    if (!cuenta.esExclusiva || !cuenta.proveedorCuentaId) return;
    if (
      cuenta.dispositivosFijosHabilitados === LIMITE_POR_CATEGORIA_EXCLUSIVA &&
      cuenta.dispositivosMovilesHabilitados === LIMITE_POR_CATEGORIA_EXCLUSIVA
    ) {
      return;
    }
    try {
      await this.proveedor.actualizarCapacidadDispositivos(operadorPrincipalId, {
        proveedorCuentaId: cuenta.proveedorCuentaId,
        limiteDispositivos: LIMITE_POR_CATEGORIA_EXCLUSIVA,
        dispositivosFijos: LIMITE_POR_CATEGORIA_EXCLUSIVA,
        dispositivosMoviles: LIMITE_POR_CATEGORIA_EXCLUSIVA,
      });
      await this.prisma.transactionComoOperador(operadorPrincipalId, (tx) =>
        tx.cuenta.update({
          where: { id: cuentaId },
          data: {
            dispositivosFijosHabilitados: LIMITE_POR_CATEGORIA_EXCLUSIVA,
            dispositivosMovilesHabilitados: LIMITE_POR_CATEGORIA_EXCLUSIVA,
          },
        }),
      );
    } catch {
      throw new SincronizacionContadoresPendienteError(cuentaId, false);
    }
  }

  private async aplicarContadoresVenta(
    cuenta: Pick<Cuenta, 'id' | 'proveedorCuentaId'>,
    _valorSolicitado: number,
    operadorPrincipalId: string,
  ): Promise<void> {
    if (!cuenta.proveedorCuentaId) return;
    let proveedorActualizado = false;
    try {
      await this.prisma.transactionComoOperador(operadorPrincipalId, async (tx) => {
        // La llamada externa queda serializada con reservas, altas, incidencias
        // y vencimientos de esta Cuenta. Así ninguna respuesta tardía de SENSA
        // puede sobrescribir un total más nuevo.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${cuenta.id}))`;
        const vigente = await tx.cuenta.findUniqueOrThrow({
          where: { id: cuenta.id },
          select: { ventasCompartidas: { select: { cuposPorCategoria: true } } },
        });
        const valorVigente = Math.max(1, this.sumarCupos(vigente.ventasCompartidas));
        await this.proveedor.actualizarCapacidadDispositivos(operadorPrincipalId, {
          proveedorCuentaId: cuenta.proveedorCuentaId!,
          // Los tres contadores de SENSA avanzan siempre juntos.
          limiteDispositivos: valorVigente,
          dispositivosFijos: valorVigente,
          dispositivosMoviles: valorVigente,
        });
        proveedorActualizado = true;
        await tx.cuenta.update({
          where: { id: cuenta.id },
          data: {
            dispositivosFijosHabilitados: valorVigente,
            dispositivosMovilesHabilitados: valorVigente,
          },
        });
      });
    } catch (error) {
      if (proveedorActualizado) {
        throw new SincronizacionContadoresPendienteError(cuenta.id, false);
      }
      throw error;
    }
  }

  /**
   * Busca una Cuenta compartida con la misma firma de servicios y lugar para
   * una venta nueva con los cupos pedidos.
   *
   * Quedan afuera: las Cuentas cerradas y las exclusivas (creadas para un único
   * Cliente Final, no se comparten). Se ordena por antigüedad para ir llenando
   * las Cuentas ya pagas antes de crear una nueva — es la lógica que le conviene
   * a la Empresa Revendedora, ya que la Cuenta es la unidad que se le factura.
   */
  async buscarCuentaConLugar(
    empresaRevendedoraId: string,
    umbralAlerta = 2,
    excluirCuentaIds: string[] = [],
    servicios?: string,
    cuposRequeridos: 1 | 2 = 1,
  ): Promise<string | null> {
    const candidatas = await this.prisma.db.cuenta.findMany({
      where: {
        empresaRevendedoraId,
        estado: EstadoCuenta.activa,
        esExclusiva: false,
        servicios,
        id: excluirCuentaIds.length ? { notIn: excluirCuentaIds } : undefined,
        // Las Cuentas importadas no participan de la búsqueda automática hasta
        // quedar preparadas: contraseña real cargada, inventario conciliado y
        // sin incidencias de Dispositivos sin resolver. Su primera venta se
        // carga de forma contextual desde la vista de Cuenta.
        AND: [
          {
            OR: [
              { procedencia: { not: 'importada_proveedor' } },
              {
                procedencia: 'importada_proveedor',
                passwordCifrado: { not: null },
                inventarioConciliadoEn: { not: null },
                incidenciasDispositivo: { none: { estado: { in: ['pendiente', 'reconocido'] } } },
              },
            ],
          },
        ],
        ventanasCuriosidad: {
          none: { finRealEn: null, finPrevistoEn: { gt: new Date() } },
        },
      },
      include: {
        dispositivos: { select: { tipo: true, estado: true, clienteFinalId: true } },
        ventasCompartidas: { select: { cuposPorCategoria: true } },
      },
      orderBy: { creadoEn: 'asc' },
    });

    for (const candidata of candidatas) {
      const capacidad = calcularCapacidad(candidata, umbralAlerta);
      if (capacidad.libres >= cuposRequeridos) return candidata.id;
    }

    return null;
  }

  /** Compensación: borra una reserva local que el Proveedor nunca confirmó. */
  private async eliminarReserva(cuentaId: string): Promise<void> {
    try {
      await this.prisma.db.cuenta.delete({ where: { id: cuentaId } });
      this.logger.warn(
        `Se revirtió la reserva local de la Cuenta ${cuentaId} porque el proveedor no confirmó el alta.`,
      );
    } catch (error) {
      this.logger.error(
        `No se pudo revertir la reserva de la Cuenta ${cuentaId}: ${(error as Error).message}. ` +
          'Queda como Cuenta sin confirmar para que la reconciliación la resuelva.',
      );
    }
  }

  private sumarCupos(ventas: { cuposPorCategoria: number }[]): number {
    return ventas.reduce((total, venta) => total + venta.cuposPorCategoria, 0);
  }

  /**
   * Valida el límite mensual de creación de Cuentas de la Empresa Revendedora
   * (`cuentas_max_crear_mensual`, default 10). Se evalúa por mes calendario AR
   * y sólo cuentan las Cuentas creadas por IPTVControl (`procedencia =
   * 'creada_en_sistema'`); las importadas del Proveedor no consumen cupo.
   *
   * Corre dentro de la misma transacción que crea la Cuenta, serializada con un
   * advisory lock por Empresa + mes, para que dos altas simultáneas no crucen
   * el último cupo.
   */
  private async validarCupoCreacionMensual(
    tx: TransactionClient,
    empresa: EmpresaRevendedora,
  ): Promise<void> {
    const ahora = new Date();
    const limite = empresa.cuentasMaxCrearMensual ?? 10;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`mes:${empresa.id}:${ahora.getFullYear()}-${ahora.getMonth() + 1}`}))`;

    const creadasEnMes = await tx.cuenta.count({
      where: {
        empresaRevendedoraId: empresa.id,
        procedencia: 'creada_en_sistema',
        creadoEn: { gte: inicioMesArgentina(ahora), lt: finMesArgentina(ahora) },
      },
    });

    if (creadasEnMes >= limite) {
      throw new LimiteCreacionMensualError(empresa.id, limite);
    }
  }
}
