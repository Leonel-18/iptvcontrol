import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';

/**
 * Cifrado simétrico de datos sensibles con AES-256-GCM.
 *
 * Qué se cifra (docs/01_Instrucciones_del_Proyecto.md → "Encriptación"):
 *  - usuario/password/PIN de las Cuentas en SENSA,
 *  - token de Basic Auth de la configuración del Proveedor.
 *
 * Por qué GCM y no CBC: GCM es cifrado *autenticado*. Además de ocultar el
 * dato, genera un "tag" que permite detectar si alguien lo modificó en la base.
 * Analogía: CBC es un sobre cerrado; GCM es un sobre cerrado con faja de
 * seguridad — si la faja está cortada, sabés que lo abrieron.
 *
 * Formato almacenado: `v1:<iv_base64>:<tag_base64>:<ciphertext_base64>`.
 * El prefijo de versión deja la puerta abierta a rotar la clave o el algoritmo
 * más adelante sin tener que adivinar cómo se cifró cada fila.
 */
@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);
  private readonly masterKey: Buffer;
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly VERSION = 'v1';
  private static readonly IV_BYTES = 12; // 96 bits, recomendado para GCM

  constructor(private readonly config: ConfigService) {
    const hex = this.config.get<string>('encryption.masterKeyHex') ?? '';
    if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
      throw new Error(
        'ENCRYPTION_MASTER_KEY inválida: se espera hexadecimal de 64 caracteres (32 bytes).',
      );
    }
    this.masterKey = Buffer.from(hex, 'hex');
  }

  /** Cifra un texto en claro. Devuelve el string listo para guardar en la base. */
  encrypt(plaintext: string): string {
    const iv = randomBytes(CryptoService.IV_BYTES);
    const cipher = createCipheriv(CryptoService.ALGORITHM, this.masterKey, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [
      CryptoService.VERSION,
      iv.toString('base64'),
      tag.toString('base64'),
      ciphertext.toString('base64'),
    ].join(':');
  }

  /** Descifra un valor previamente producido por `encrypt`. */
  decrypt(stored: string): string {
    const partes = stored.split(':');
    if (partes.length !== 4 || partes[0] !== CryptoService.VERSION) {
      throw new Error('Valor cifrado con formato desconocido: no se puede descifrar.');
    }
    const [, ivB64, tagB64, dataB64] = partes;
    const decipher = createDecipheriv(
      CryptoService.ALGORITHM,
      this.masterKey,
      Buffer.from(ivB64, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }

  /**
   * Descifra tolerando errores. Útil en listados donde una fila corrupta no
   * debería tumbar toda la respuesta: se loguea y se devuelve null.
   */
  tryDecrypt(stored: string | null | undefined): string | null {
    if (!stored) return null;
    try {
      return this.decrypt(stored);
    } catch (error) {
      this.logger.error(
        `No se pudo descifrar un valor almacenado: ${(error as Error).message}. ` +
          '¿Cambió ENCRYPTION_MASTER_KEY?',
      );
      return null;
    }
  }

  /**
   * Contraseña numérica para una Cuenta en SENSA.
   * La API exige sólo dígitos, longitud entre 8 y 20 (ver Add User).
   */
  generarPasswordNumerica(longitud = 8): string {
    return this.digitosAleatorios(Math.min(Math.max(longitud, 8), 20));
  }

  /**
   * PIN de control parental. La API exige entre 4 y 8 dígitos numéricos.
   */
  generarPinNumerico(longitud = 6): string {
    return this.digitosAleatorios(Math.min(Math.max(longitud, 4), 8));
  }

  /** Comparación en tiempo constante, para no filtrar información por timing. */
  comparacionSegura(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }

  private digitosAleatorios(cantidad: number): string {
    let salida = '';
    for (let i = 0; i < cantidad; i += 1) {
      salida += randomInt(0, 10).toString();
    }
    return salida;
  }
}
