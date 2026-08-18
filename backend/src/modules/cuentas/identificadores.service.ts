import { Injectable, Logger } from '@nestjs/common';
import { TransactionClient } from '../../common/prisma/prisma.service';

/**
 * Generación de los identificadores que exige el Proveedor y de los
 * correlativos internos de IPTVControl.
 *
 * Reglas implementadas (docs/03_Reglas_de_Negocio.md, sección 2.3):
 *
 *  - **DNI de alta**: SENSA pide un número de DNI para crear una Cuenta. Como el
 *    sistema no gestiona DNIs reales de personas físicas, se generan solos:
 *    arrancan en `dni_inicial_sensa` (parametrizable por el Operador Principal) y
 *    se incrementan de a 1 en cada alta. Si SENSA responde "ID repetido", se
 *    suma 1 y se reintenta, sin mostrarle el error al usuario.
 *
 *  - **Correo de contacto**: se deriva del email de la Empresa Revendedora
 *    agregando un número creciente antes de la arroba
 *    (contacto@isp.com → contacto1@isp.com, contacto2@isp.com, ...). Así cada
 *    Cuenta tiene un email único en SENSA sin que la Empresa Revendedora tenga
 *    que administrar casillas reales.
 *
 *  - **Número de cliente**: correlativo interno por Empresa Revendedora.
 *
 * Los tres correlativos se incrementan con un `UPDATE ... RETURNING` dentro de
 * la transacción, que en Postgres bloquea la fila: si dos altas ocurren al mismo
 * tiempo, una espera a la otra y nunca se repite el número. Hacerlo con
 * "leer, sumar 1 y guardar" desde la aplicación sí podría duplicar.
 */
@Injectable()
export class IdentificadoresService {
  private readonly logger = new Logger(IdentificadoresService.name);

  /**
   * Reserva el próximo identificador tipo DNI del Operador Principal.
   * SENSA valida que sean 7 u 8 dígitos numéricos (código 701).
   */
  async siguienteDni(tx: TransactionClient, operadorPrincipalId: string): Promise<string> {
    const filas = await tx.$queryRaw<{ dni_actual_sensa: number }[]>`
      UPDATE "operador_principal"
         SET "dni_actual_sensa" = GREATEST("dni_actual_sensa", "dni_inicial_sensa" - 1) + 1,
             "actualizado_en" = NOW()
       WHERE "id" = ${operadorPrincipalId}::uuid
      RETURNING "dni_actual_sensa"`;

    const valor = filas[0]?.dni_actual_sensa;
    if (!valor) {
      throw new Error(
        `No se pudo generar el identificador de alta: el Operador Principal ${operadorPrincipalId} no existe.`,
      );
    }
    return IdentificadoresService.formatearDni(valor);
  }

  /**
   * Avanza el contador de DNI cuando el Proveedor rechazó el anterior por
   * repetido, y devuelve el nuevo valor a intentar.
   */
  async avanzarDniPorColision(
    tx: TransactionClient,
    operadorPrincipalId: string,
    dniRechazado: string,
  ): Promise<string> {
    this.logger.warn(
      `El Proveedor rechazó el DNI ${dniRechazado} por repetido. Se incrementa y se reintenta.`,
    );
    return this.siguienteDni(tx, operadorPrincipalId);
  }

  /**
   * Próximo correo de contacto para una Cuenta de la Empresa Revendedora.
   * Devuelve también el correlativo usado, útil para la traza.
   */
  async siguienteEmailCuenta(
    tx: TransactionClient,
    empresaRevendedoraId: string,
  ): Promise<{ email: string; secuencia: number }> {
    const filas = await tx.$queryRaw<{ secuencia_email_cuenta: number; email_contacto: string }[]>`
      UPDATE "empresa_revendedora"
         SET "secuencia_email_cuenta" = "secuencia_email_cuenta" + 1,
             "actualizado_en" = NOW()
       WHERE "id" = ${empresaRevendedoraId}::uuid
      RETURNING "secuencia_email_cuenta", "email_contacto"`;

    const fila = filas[0];
    if (!fila) {
      throw new Error(`La Empresa Revendedora ${empresaRevendedoraId} no existe.`);
    }

    return {
      email: IdentificadoresService.derivarEmail(fila.email_contacto, fila.secuencia_email_cuenta),
      secuencia: fila.secuencia_email_cuenta,
    };
  }

  /** Próximo número de cliente interno de la Empresa Revendedora. */
  async siguienteNumeroCliente(
    tx: TransactionClient,
    empresaRevendedoraId: string,
  ): Promise<number> {
    const filas = await tx.$queryRaw<{ secuencia_numero_cliente: number }[]>`
      UPDATE "empresa_revendedora"
         SET "secuencia_numero_cliente" = "secuencia_numero_cliente" + 1,
             "actualizado_en" = NOW()
       WHERE "id" = ${empresaRevendedoraId}::uuid
      RETURNING "secuencia_numero_cliente"`;

    const valor = filas[0]?.secuencia_numero_cliente;
    if (!valor) {
      throw new Error(`La Empresa Revendedora ${empresaRevendedoraId} no existe.`);
    }
    return valor;
  }

  /**
   * `contacto@isp.com` + 3 → `contacto3@isp.com`.
   * Si el email viniera mal formado, se arma uno derivado igual válido, porque
   * es un dato técnico de la Cuenta y no puede trabar el alta.
   */
  static derivarEmail(emailBase: string, secuencia: number): string {
    const [local, dominio] = (emailBase ?? '').split('@');
    if (!local || !dominio) {
      return `cuenta${secuencia}@iptvcontrol.local`;
    }
    return `${local}${secuencia}@${dominio}`;
  }

  /**
   * SENSA exige 7 u 8 dígitos. Si el contador se pasara de 99.999.999 se corta
   * con un error explícito en lugar de mandar un dato que la API va a rechazar.
   */
  static formatearDni(valor: number): string {
    const texto = String(Math.trunc(valor));
    if (texto.length < 7) return texto.padStart(7, '1');
    if (texto.length > 8) {
      throw new Error(
        `El identificador de alta ${texto} excede los 8 dígitos que admite el proveedor. ` +
          'Revise el valor de "DNI inicial" en Configuración.',
      );
    }
    return texto;
  }
}
