import { ConfigService } from '@nestjs/config';
import { CryptoService } from './crypto.service';

/**
 * Tests del cifrado de credenciales (AES-256-GCM).
 *
 * Lo que se protege acá son el usuario/contraseña/PIN de las Cuentas en SENSA y
 * el token de la configuración del Proveedor.
 */
describe('CryptoService', () => {
  const claveValida = 'a'.repeat(64);

  const crearServicio = (clave = claveValida) =>
    new CryptoService({
      get: (ruta: string) => (ruta === 'encryption.masterKeyHex' ? clave : undefined),
    } as unknown as ConfigService);

  it('rechaza arrancar con una clave maestra inválida', () => {
    // Mejor no levantar el sistema que levantarlo sin poder cifrar.
    expect(() => crearServicio('clave-corta')).toThrow(/ENCRYPTION_MASTER_KEY inválida/);
    expect(() => crearServicio('')).toThrow(/ENCRYPTION_MASTER_KEY inválida/);
  });

  it('cifra y descifra devolviendo el valor original', () => {
    const crypto = crearServicio();
    const original = '1234567890';

    const cifrado = crypto.encrypt(original);
    expect(cifrado).not.toContain(original);
    expect(crypto.decrypt(cifrado)).toBe(original);
  });

  it('produce un resultado distinto cada vez (IV aleatorio)', () => {
    const crypto = crearServicio();

    // Dos Cuentas con la misma contraseña no deben verse iguales en la base.
    expect(crypto.encrypt('12345678')).not.toBe(crypto.encrypt('12345678'));
  });

  it('incluye el prefijo de versión, para poder rotar el algoritmo a futuro', () => {
    expect(crearServicio().encrypt('hola')).toMatch(/^v1:/);
  });

  it('detecta un valor manipulado en la base (cifrado autenticado)', () => {
    const crypto = crearServicio();
    const cifrado = crypto.encrypt('12345678');
    const partes = cifrado.split(':');
    // Se altera el texto cifrado, como haría alguien tocando la base a mano.
    partes[3] = Buffer.from('otro-contenido').toString('base64');

    expect(() => crypto.decrypt(partes.join(':'))).toThrow();
  });

  it('tryDecrypt devuelve null en lugar de romper el listado', () => {
    const crypto = crearServicio();
    expect(crypto.tryDecrypt('v1:formato:invalido:xx')).toBeNull();
    expect(crypto.tryDecrypt(null)).toBeNull();
    expect(crypto.tryDecrypt(undefined)).toBeNull();
  });

  it('no puede descifrar lo cifrado con otra clave maestra', () => {
    const cifrado = crearServicio('a'.repeat(64)).encrypt('12345678');
    expect(crearServicio('b'.repeat(64)).tryDecrypt(cifrado)).toBeNull();
  });

  describe('generación de credenciales para el proveedor', () => {
    it('la contraseña es numérica y de longitud admitida (8 a 20)', () => {
      const crypto = crearServicio();
      const password = crypto.generarPasswordNumerica(10);

      expect(password).toMatch(/^\d{10}$/);
      // Se acotan los extremos al rango que admite la API.
      expect(crypto.generarPasswordNumerica(3)).toMatch(/^\d{8}$/);
      expect(crypto.generarPasswordNumerica(50)).toMatch(/^\d{20}$/);
    });

    it('el PIN es numérico de 4 a 8 dígitos', () => {
      const crypto = crearServicio();
      expect(crypto.generarPinNumerico()).toMatch(/^\d{6}$/);
      expect(crypto.generarPinNumerico(2)).toMatch(/^\d{4}$/);
      expect(crypto.generarPinNumerico(12)).toMatch(/^\d{8}$/);
    });
  });

  describe('comparacionSegura', () => {
    it('compara sin filtrar información por tiempo de respuesta', () => {
      const crypto = crearServicio();
      expect(crypto.comparacionSegura('abc123', 'abc123')).toBe(true);
      expect(crypto.comparacionSegura('abc123', 'abc124')).toBe(false);
      expect(crypto.comparacionSegura('abc', 'abcdef')).toBe(false);
    });
  });
});
