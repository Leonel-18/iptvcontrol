import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  AccionAuditoria,
  Cuenta,
  EmpresaRevendedora,
  EntidadAuditada,
  EstadoCuenta,
  TipoDispositivo,
} from '@prisma/client';
import { PrismaService, TransactionClient } from '../../common/prisma/prisma.service';
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
  capacidadDe,
  habilitadosNecesariosParaAlta,
  habilitadosTrasBaja,
} from './capacidad.util';

/** Señal interna: esta Cuenta no puede alojar el Dispositivo pedido. */
export class SinCapacidadEnCuentaError extends Error {
  constructor(readonly cuentaId: string) {
    super(`La Cuenta ${cuentaId} no tiene lugar disponible para el tipo pedido.`);
    this.name = 'SinCapacidadEnCuentaError';
  }
}

export interface CrearCuentaOpciones {
  empresaRevendedora: EmpresaRevendedora;
  operadorPrincipalId: string;
  /** true si la Cuenta se crea para un único Cliente Final (cuenta exclusiva). */
  esExclusiva: boolean;
  /** Capacidad inicial. Por defecto 1 fijo + 1 móvil (arranque mínimo). */
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
   * Arranca parametrizada en 1 fijo + 1 móvil (nunca 0+0 ni 3+3 de entrada), tal
   * como pide la regla 2.1.
   */
  async crearCuenta(opciones: CrearCuentaOpciones): Promise<Cuenta> {
    const { empresaRevendedora, operadorPrincipalId, esExclusiva } = opciones;
    const config = await this.configuracion.obtener(operadorPrincipalId);

    const dispositivosFijos = opciones.dispositivosFijos ?? 1;
    const dispositivosMoviles = opciones.dispositivosMoviles ?? 1;

    // Credenciales de la Cuenta en el Proveedor. SENSA exige contraseña
    // numérica (8-20) y PIN numérico (4-8).
    const password = this.crypto.generarPasswordNumerica(10);
    const pin = this.crypto.generarPinNumerico(4);

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
          servicios: config.serviciosPorDefecto,
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
          nombre: empresaRevendedora.razonSocial,
          apellido: empresaRevendedora.apellidoContacto || 'Revendedor',
          direccion: empresaRevendedora.direccion,
          ciudad: config.ciudadPorDefecto,
          telefono: empresaRevendedora.telefonoContacto,
          servicios: cuentaActual.servicios,
          dispositivosFijos,
          dispositivosMoviles,
          referenciaExterna: cuentaActual.id.replace(/-/g, '').slice(0, 40),
        });

        // --- Paso 3: confirmación local -------------------------------------
        const confirmada = await this.prisma.transaction(async (tx) => {
          const actualizada = await tx.cuenta.update({
            where: { id: cuentaActual.id },
            data: {
              proveedorCuentaId: cuentaProveedor.proveedorCuentaId,
              servicios: cuentaProveedor.servicios || cuentaActual.servicios,
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
   * Garantiza que la Cuenta tenga lugar para un Dispositivo más del tipo pedido,
   * ampliando la parametrización en el Proveedor si hace falta (+1 por vez).
   *
   * Devuelve la Cuenta con los contadores actualizados. Lanza
   * `SinCapacidadEnCuentaError` si la Cuenta ya está en el tope de esa categoría.
   */
  async asegurarCapacidadParaAlta(
    cuentaId: string,
    tipo: TipoDispositivo,
    operadorPrincipalId: string,
    umbralAlerta = 2,
  ): Promise<Cuenta> {
    const cuenta = await this.prisma.db.cuenta.findUniqueOrThrow({
      where: { id: cuentaId },
      include: { dispositivos: { select: { tipo: true, estado: true } } },
    });

    const capacidad = calcularCapacidad(cuenta, umbralAlerta);
    const objetivo = habilitadosNecesariosParaAlta(capacidad, tipo);

    if (objetivo === null) {
      throw new SinCapacidadEnCuentaError(cuentaId);
    }

    const actuales = capacidadDe(capacidad, tipo).habilitados;
    if (objetivo === actuales) {
      // Ya hay un cupo habilitado y sin usar: no se toca el Proveedor.
      return cuenta;
    }

    const fijos = tipo === TipoDispositivo.fijo ? objetivo : capacidad.fijo.habilitados;
    const moviles = tipo === TipoDispositivo.movil ? objetivo : capacidad.movil.habilitados;

    if (!cuenta.proveedorCuentaId) {
      throw new BadRequestException(
        'La Cuenta todavía no está confirmada en el proveedor. Intente nuevamente en unos minutos.',
      );
    }

    await this.proveedor.actualizarCapacidadDispositivos(operadorPrincipalId, {
      proveedorCuentaId: cuenta.proveedorCuentaId,
      dispositivosFijos: fijos,
      dispositivosMoviles: moviles,
    });

    return this.prisma.db.cuenta.update({
      where: { id: cuentaId },
      data: {
        dispositivosFijosHabilitados: fijos,
        dispositivosMovilesHabilitados: moviles,
      },
    });
  }

  /**
   * Resta 1 dispositivo habilitado de la Cuenta en el Proveedor (lógica inversa
   * exacta al alta) y actualiza el contador local.
   *
   * Se llama DESPUÉS de eliminar el dispositivo en el Proveedor.
   */
  async reducirCapacidad(
    tx: TransactionClient,
    cuentaId: string,
    tipo: TipoDispositivo,
    operadorPrincipalId: string,
  ): Promise<void> {
    const cuenta = await tx.cuenta.findUniqueOrThrow({ where: { id: cuentaId } });
    const actuales =
      tipo === TipoDispositivo.fijo
        ? cuenta.dispositivosFijosHabilitados
        : cuenta.dispositivosMovilesHabilitados;
    const objetivo = habilitadosTrasBaja(actuales, tipo);

    if (objetivo === actuales) return;

    const fijos = tipo === TipoDispositivo.fijo ? objetivo : cuenta.dispositivosFijosHabilitados;
    const moviles =
      tipo === TipoDispositivo.movil ? objetivo : cuenta.dispositivosMovilesHabilitados;

    if (cuenta.proveedorCuentaId) {
      await this.proveedor.actualizarCapacidadDispositivos(operadorPrincipalId, {
        proveedorCuentaId: cuenta.proveedorCuentaId,
        dispositivosFijos: fijos,
        dispositivosMoviles: moviles,
      });
    }

    await tx.cuenta.update({
      where: { id: cuentaId },
      data: {
        dispositivosFijosHabilitados: fijos,
        dispositivosMovilesHabilitados: moviles,
      },
    });
  }

  /**
   * Busca una Cuenta propia de la Empresa Revendedora con lugar para un
   * Dispositivo del tipo pedido (flujo 4.1, paso 4).
   *
   * Quedan afuera: las Cuentas cerradas y las exclusivas (creadas para un único
   * Cliente Final, no se comparten). Se ordena por antigüedad para ir llenando
   * las Cuentas ya pagas antes de crear una nueva — es la lógica que le conviene
   * a la Empresa Revendedora, ya que la Cuenta es la unidad que se le factura.
   */
  async buscarCuentaConLugar(
    empresaRevendedoraId: string,
    tipo: TipoDispositivo,
    umbralAlerta = 2,
    excluirCuentaIds: string[] = [],
  ): Promise<string | null> {
    const candidatas = await this.prisma.db.cuenta.findMany({
      where: {
        empresaRevendedoraId,
        estado: EstadoCuenta.activa,
        esExclusiva: false,
        id: excluirCuentaIds.length ? { notIn: excluirCuentaIds } : undefined,
      },
      include: { dispositivos: { select: { tipo: true, estado: true } } },
      orderBy: { creadoEn: 'asc' },
    });

    for (const candidata of candidatas) {
      const capacidad = calcularCapacidad(candidata, umbralAlerta);
      const categoria = capacidadDe(capacidad, tipo);
      // Se prioriza el cupo ya habilitado: es el alta que no requiere tocar la
      // parametrización en el Proveedor.
      if (categoria.libres > 0) return candidata.id;
    }

    for (const candidata of candidatas) {
      const capacidad = calcularCapacidad(candidata, umbralAlerta);
      if (capacidadDe(capacidad, tipo).puedeAmpliar) return candidata.id;
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
