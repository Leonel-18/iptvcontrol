import { Injectable, Logger } from '@nestjs/common';
import {
  AccionAuditoria,
  ClienteFinal,
  Cuenta,
  EmpresaRevendedora,
  EntidadAuditada,
  EstadoCuenta,
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
import { calcularCapacidad, contarVentasActivas, LIMITE_VENTAS_COMPARTIDA } from './capacidad.util';

/** Señal interna: esta Cuenta no puede alojar la venta/Dispositivo pedido. */
export class SinCapacidadEnCuentaError extends Error {
  constructor(readonly cuentaId: string) {
    super(`La Cuenta ${cuentaId} llegó a su límite comercial.`);
    this.name = 'SinCapacidadEnCuentaError';
  }
}

export interface CrearCuentaOpciones {
  empresaRevendedora: EmpresaRevendedora;
  operadorPrincipalId: string;
  /** true si la Cuenta se crea para un único Cliente Final (cuenta exclusiva). */
  esExclusiva: boolean;
  clienteFinal?: Pick<ClienteFinal, 'telefono' | 'direccion'>;
  /** Firma canónica de servicios. */
  servicios?: string;
  /**
   * Proyección técnica inicial de capacidad. Por defecto: 3/3 para una Cuenta
   * exclusiva (hasta 3 fijos + 3 móviles para su único cliente) y 1/1 para una
   * Cuenta compartida recién creada (arranca con 1 venta).
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
  ) {}

  /**
   * Crea una Cuenta nueva en el Proveedor y la registra localmente.
   *
   * Una Cuenta exclusiva arranca con sus tres categorías al tope (3 fijos + 3
   * móviles) para su único Cliente Final. Una Cuenta compartida arranca en 1/1
   * (su primera venta); los contadores suben de a uno por cada venta nueva que
   * se suma, vía `incrementarCapacidadPorNuevaVenta`.
   */
  async crearCuenta(opciones: CrearCuentaOpciones): Promise<Cuenta> {
    const { empresaRevendedora, operadorPrincipalId, esExclusiva } = opciones;
    const config = await this.configuracion.obtener(operadorPrincipalId);

    const limiteDispositivos = LIMITE_VENTAS_COMPARTIDA;
    const dispositivosPorDefecto = esExclusiva ? LIMITE_VENTAS_COMPARTIDA : 1;
    const dispositivosFijos = opciones.dispositivosFijos ?? dispositivosPorDefecto;
    const dispositivosMoviles = opciones.dispositivosMoviles ?? dispositivosPorDefecto;

    // Credenciales de la Cuenta en el Proveedor. SENSA exige contraseña
    // numérica (8-20) y PIN numérico (4-8).
    const password = this.crypto.generarPasswordNumerica(8);
    const pin = this.crypto.generarPinNumerico(6);

    // --- Paso 1: reserva local ------------------------------------------------
    const reserva = await this.prisma.transaction(async (tx) => {
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
          nombre: empresaRevendedora.nombreContacto || empresaRevendedora.razonSocial,
          apellido: empresaRevendedora.apellidoContacto || 'Revendedor',
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
   * Sube los contadores de una Cuenta compartida ya existente a la cantidad de
   * ventas activas + 1 (la venta nueva que se está por vincular). Se llama
   * ANTES de abrir la ventana de vinculación de un Cliente Final nuevo, para
   * que SENSA admita su primer inicio de sesión.
   *
   * No hace nada sobre Cuentas exclusivas: esas ya nacen con sus contadores en
   * el tope (3/3) y no varían con las bajas/altas de su único cliente.
   */
  async incrementarCapacidadPorNuevaVenta(
    cuentaId: string,
    operadorPrincipalId: string,
  ): Promise<void> {
    const cuenta = await this.prisma.db.cuenta.findUniqueOrThrow({
      where: { id: cuentaId },
      include: { dispositivos: { select: { estado: true, clienteFinalId: true } } },
    });
    if (cuenta.esExclusiva || !cuenta.proveedorCuentaId) return;

    const ventasActuales = contarVentasActivas(
      cuenta.dispositivos.map((dispositivo) => ({ ...dispositivo, tipo: null })),
    );
    const nuevoValor = Math.min(LIMITE_VENTAS_COMPARTIDA, ventasActuales + 1);
    await this.aplicarContadoresVenta(cuenta, nuevoValor, operadorPrincipalId);
  }

  /**
   * Recalcula los contadores de una Cuenta compartida a partir de sus ventas
   * activas reales y los sincroniza con el Proveedor si cambiaron. Se llama
   * DESPUÉS de dar de baja o suspender al último Dispositivo de un Cliente
   * Final en la Cuenta, para bajar el cupo que SENSA le habilita a esa Cuenta.
   */
  async sincronizarContadoresVenta(cuentaId: string, operadorPrincipalId: string): Promise<void> {
    const cuenta = await this.prisma.db.cuenta.findUniqueOrThrow({
      where: { id: cuentaId },
      include: { dispositivos: { select: { estado: true, clienteFinalId: true } } },
    });
    if (cuenta.esExclusiva || !cuenta.proveedorCuentaId) return;

    const ventas = contarVentasActivas(
      cuenta.dispositivos.map((dispositivo) => ({ ...dispositivo, tipo: null })),
    );
    // Nunca menos de 1: SENSA exige al menos un dispositivo móvil habilitado
    // mientras la Cuenta siga activa, aunque momentáneamente no tenga ventas.
    const nuevoValor = Math.max(1, ventas);
    if (nuevoValor === cuenta.dispositivosFijosHabilitados) return;
    await this.aplicarContadoresVenta(cuenta, nuevoValor, operadorPrincipalId);
  }

  private async aplicarContadoresVenta(
    cuenta: Pick<Cuenta, 'id' | 'proveedorCuentaId'>,
    valor: number,
    operadorPrincipalId: string,
  ): Promise<void> {
    if (!cuenta.proveedorCuentaId) return;
    await this.proveedor.actualizarCapacidadDispositivos(operadorPrincipalId, {
      proveedorCuentaId: cuenta.proveedorCuentaId,
      // Los tres contadores de SENSA avanzan siempre juntos (1/1/1 → 2/2/2 →
      // 3/3/3): `limiteDispositivos` es el genérico (`auto_provision_count`,
      // STB), sin uso de negocio propio, pero igual debe reflejar la cantidad
      // de ventas activas para no quedar desincronizado de fijos/móviles.
      limiteDispositivos: valor,
      dispositivosFijos: valor,
      dispositivosMoviles: valor,
    });
    await this.prisma.db.cuenta.update({
      where: { id: cuenta.id },
      data: { dispositivosFijosHabilitados: valor, dispositivosMovilesHabilitados: valor },
    });
  }

  /**
   * Busca una Cuenta compartida con la misma firma de servicios y lugar para
   * una venta nueva (menos de 3 ventas activas).
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
  ): Promise<string | null> {
    const candidatas = await this.prisma.db.cuenta.findMany({
      where: {
        empresaRevendedoraId,
        estado: EstadoCuenta.activa,
        esExclusiva: false,
        servicios,
        id: excluirCuentaIds.length ? { notIn: excluirCuentaIds } : undefined,
      },
      include: { dispositivos: { select: { tipo: true, estado: true, clienteFinalId: true } } },
      orderBy: { creadoEn: 'asc' },
    });

    for (const candidata of candidatas) {
      const capacidad = calcularCapacidad(candidata, umbralAlerta);
      if (capacidad.libres > 0) return candidata.id;
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
}
