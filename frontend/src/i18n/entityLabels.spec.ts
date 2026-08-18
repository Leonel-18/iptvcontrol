import { describe, expect, it } from 'vitest';
import {
  accountStatusLabels,
  customerIntakeLabels,
  customerStatusLabels,
  deviceStatusHelp,
  deviceStatusLabels,
  deviceTypeLabels,
  entityLabels,
  traducir,
} from './entityLabels';

/**
 * Tests de la capa de traducción español ↔ inglés.
 *
 * No son cosmética: si a un estado le falta la etiqueta, el panel le muestra al
 * usuario el valor técnico (`bloqueado_por_suspension`), que es exactamente la
 * confusión que la convención de nombres busca evitar.
 */
describe('entityLabels', () => {
  it('nombra las entidades con el glosario oficial en español', () => {
    expect(entityLabels.reseller.singular).toBe('Empresa Revendedora');
    expect(entityLabels.customer.singular).toBe('Cliente Final');
    expect(entityLabels.device.singular).toBe('Dispositivo');
    expect(entityLabels.account.singular).toBe('Cuenta');
  });

  it('no usa la palabra "slot" en ninguna etiqueta', () => {
    // Prohibido por el glosario: el nombre oficial es "Dispositivo".
    const todas = JSON.stringify({
      entityLabels,
      deviceStatusLabels,
      deviceStatusHelp,
      deviceTypeLabels,
    }).toLowerCase();
    expect(todas).not.toContain('slot');
  });

  it('cubre todos los estados de Cliente Final', () => {
    expect(Object.keys(customerStatusLabels).sort()).toEqual([
      'activo',
      'dado_de_baja',
      'suspendido',
    ]);
  });

  it('cubre todos los estados de Dispositivo, con su explicación', () => {
    const estados = ['activo', 'bloqueado_por_suspension', 'disponible', 'dado_de_baja'];
    for (const estado of estados) {
      expect(deviceStatusLabels[estado]).toBeTruthy();
      expect(deviceStatusHelp[estado]).toBeTruthy();
    }
  });

  it('explica que un dispositivo bloqueado no se puede reasignar', () => {
    // Es la regla que más consultas genera, así que la ayuda tiene que decirlo.
    expect(deviceStatusHelp.bloqueado_por_suspension).toMatch(/baja definitiva/i);
  });

  it('cubre los dos estados de Cuenta y los dos métodos de alta', () => {
    expect(Object.keys(accountStatusLabels).sort()).toEqual(['activa', 'cerrada']);
    expect(Object.keys(customerIntakeLabels).sort()).toEqual([
      'cuenta_exclusiva',
      'dispositivo_compartido',
    ]);
  });

  describe('traducir', () => {
    it('devuelve la etiqueta cuando existe', () => {
      expect(traducir(customerStatusLabels, 'activo')).toBe('Activo');
    });

    it('cae en el valor técnico si falta la etiqueta, en lugar de mostrar vacío', () => {
      expect(traducir(customerStatusLabels, 'estado_nuevo')).toBe('estado_nuevo');
    });

    it('muestra un guion cuando no hay valor', () => {
      expect(traducir(customerStatusLabels, null)).toBe('—');
      expect(traducir(customerStatusLabels, undefined)).toBe('—');
    });
  });
});
