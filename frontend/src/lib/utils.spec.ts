import { describe, expect, it } from 'vitest';
import { cn, formatearFecha, formatearImporte, formatearMac, formatearNumero } from './utils';

describe('utilidades de formato', () => {
  describe('cn', () => {
    it('resuelve clases de Tailwind en conflicto quedándose con la última', () => {
      expect(cn('px-2', 'px-4')).toBe('px-4');
    });

    it('descarta valores falsos', () => {
      const oculto = false;
      expect(cn('base', oculto && 'oculto', undefined, 'visible')).toBe('base visible');
    });
  });

  describe('formatearFecha', () => {
    it('usa el formato argentino dd/mm/aaaa', () => {
      expect(formatearFecha('2026-08-14T10:00:00.000Z')).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    });

    it('muestra un guion cuando no hay fecha o es inválida', () => {
      expect(formatearFecha(null)).toBe('—');
      expect(formatearFecha(undefined)).toBe('—');
      expect(formatearFecha('no-es-fecha')).toBe('—');
    });
  });

  describe('formatearImporte', () => {
    it('muestra pesos con dos decimales', () => {
      const resultado = formatearImporte(4500);
      expect(resultado).toContain('4.500');
      expect(resultado).toMatch(/\$/);
    });

    it('distingue el cero de la ausencia de dato', () => {
      // Importante en reportes: "0" es información, "—" es que no hay modalidad.
      expect(formatearImporte(0)).toMatch(/0/);
      expect(formatearImporte(null)).toBe('—');
    });
  });

  describe('formatearNumero', () => {
    it('agrupa los miles', () => {
      expect(formatearNumero(9000)).toBe('9.000');
    });

    it('muestra un guion sin dato', () => {
      expect(formatearNumero(null)).toBe('—');
    });
  });

  describe('formatearMac', () => {
    it('separa la MAC en pares para poder leerla en voz alta', () => {
      expect(formatearMac('03AC1AE60CA7')).toBe('03:AC:1A:E6:0C:A7');
    });

    it('muestra un guion cuando no se informó', () => {
      expect(formatearMac(null)).toBe('—');
      expect(formatearMac('')).toBe('—');
    });
  });
});
