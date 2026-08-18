import { IdentificadoresService } from './identificadores.service';

/**
 * Tests de la generación de identificadores exigidos por el Proveedor
 * (docs/03_Reglas_de_Negocio.md, sección 2.3).
 */
describe('IdentificadoresService', () => {
  describe('derivarEmail', () => {
    it('agrega el número creciente antes de la arroba', () => {
      // El ejemplo textual de la regla 2.3.
      expect(IdentificadoresService.derivarEmail('contacto@isp.com', 1)).toBe('contacto1@isp.com');
      expect(IdentificadoresService.derivarEmail('contacto@isp.com', 2)).toBe('contacto2@isp.com');
      expect(IdentificadoresService.derivarEmail('contacto@isp.com', 57)).toBe(
        'contacto57@isp.com',
      );
    });

    it('conserva subdominios y puntos del dominio', () => {
      expect(IdentificadoresService.derivarEmail('ventas.iptv@mi.isp.com.ar', 3)).toBe(
        'ventas.iptv3@mi.isp.com.ar',
      );
    });

    it('genera un email válido igual si el de la Empresa Revendedora está mal formado', () => {
      // No puede trabar el alta por un dato de contacto: es un email técnico.
      expect(IdentificadoresService.derivarEmail('sin-arroba', 4)).toBe(
        'cuenta4@iptvcontrol.local',
      );
      expect(IdentificadoresService.derivarEmail('', 5)).toBe('cuenta5@iptvcontrol.local');
    });
  });

  describe('formatearDni', () => {
    it('deja pasar los valores de 7 y 8 dígitos que admite el proveedor', () => {
      expect(IdentificadoresService.formatearDni(1234567)).toBe('1234567');
      expect(IdentificadoresService.formatearDni(30000000)).toBe('30000000');
      expect(IdentificadoresService.formatearDni(99999999)).toBe('99999999');
    });

    it('completa a 7 dígitos si el contador quedó corto', () => {
      expect(IdentificadoresService.formatearDni(1234)).toHaveLength(7);
    });

    it('corta con un error claro si se pasa de 8 dígitos', () => {
      // Preferible fallar acá que mandar un dato que el proveedor va a rechazar
      // con código 701 (INVALID_CUSTOMER_ID).
      expect(() => IdentificadoresService.formatearDni(100000000)).toThrow(/excede los 8 dígitos/);
    });
  });
});
