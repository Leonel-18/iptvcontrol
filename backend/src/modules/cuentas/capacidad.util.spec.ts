import { EstadoDispositivo, TipoDispositivo } from '@prisma/client';
import {
  calcularCapacidad,
  contarDispositivosCliente,
  contarOcupados,
  contarVentasActivas,
} from './capacidad.util';

describe('capacidad de Cuenta', () => {
  const dispositivo = (
    tipo: TipoDispositivo | null,
    clienteFinalId: string | null,
    estado: EstadoDispositivo = EstadoDispositivo.activo,
  ) => ({ tipo, estado, clienteFinalId });

  describe('Cuenta compartida (por ventas)', () => {
    it('sin ventas, no hay categorías habilitadas', () => {
      const capacidad = calcularCapacidad({ esExclusiva: false, dispositivos: [] });
      expect(capacidad.ventas).toBe(0);
      expect(capacidad.libres).toBe(3);
      expect(capacidad.completa).toBe(false);
      expect(capacidad.fijo.limite).toBe(0);
      expect(capacidad.movil.limite).toBe(0);
    });

    it('una venta habilita 1 fijo + 1 móvil para ese cliente', () => {
      const capacidad = calcularCapacidad({
        esExclusiva: false,
        dispositivos: [dispositivo(TipoDispositivo.fijo, 'cliente-1')],
      });
      expect(capacidad.ventas).toBe(1);
      expect(capacidad.fijo.limite).toBe(1);
      expect(capacidad.fijo.ocupados).toBe(1);
      expect(capacidad.fijo.completa).toBe(true);
      expect(capacidad.movil.limite).toBe(1);
      expect(capacidad.movil.ocupados).toBe(0);
      expect(capacidad.movil.completa).toBe(false);
      expect(capacidad.libres).toBe(2);
    });

    it('tres ventas dejan la Cuenta completa aunque cada cliente tenga un solo Dispositivo', () => {
      const capacidad = calcularCapacidad({
        esExclusiva: false,
        dispositivos: [
          dispositivo(TipoDispositivo.fijo, 'cliente-1'),
          dispositivo(TipoDispositivo.movil, 'cliente-2'),
          dispositivo(TipoDispositivo.fijo, 'cliente-3'),
        ],
      });
      expect(capacidad.ventas).toBe(3);
      expect(capacidad.libres).toBe(0);
      expect(capacidad.completa).toBe(true);
    });

    it('un cliente con sus 2 Dispositivos (1 fijo + 1 móvil) sigue contando como 1 sola venta', () => {
      const capacidad = calcularCapacidad({
        esExclusiva: false,
        dispositivos: [
          dispositivo(TipoDispositivo.fijo, 'cliente-1'),
          dispositivo(TipoDispositivo.movil, 'cliente-1'),
        ],
      });
      expect(capacidad.ventas).toBe(1);
      expect(capacidad.libres).toBe(2);
    });

    it('los suspendidos siguen consumiendo la venta y los disponibles no', () => {
      const dispositivos = [
        dispositivo(TipoDispositivo.fijo, 'cliente-1', EstadoDispositivo.bloqueado_por_suspension),
        dispositivo(TipoDispositivo.movil, null, EstadoDispositivo.disponible),
      ];
      expect(contarOcupados(dispositivos)).toBe(1);
      expect(contarVentasActivas(dispositivos)).toBe(1);
    });

    it('contarDispositivosCliente sólo cuenta los del cliente indicado', () => {
      const dispositivos = [
        dispositivo(TipoDispositivo.fijo, 'cliente-1'),
        dispositivo(TipoDispositivo.movil, 'cliente-1'),
        dispositivo(TipoDispositivo.fijo, 'cliente-2'),
      ];
      expect(contarDispositivosCliente(dispositivos, 'cliente-1')).toBe(2);
      expect(contarDispositivosCliente(dispositivos, 'cliente-1', TipoDispositivo.fijo)).toBe(1);
      expect(contarDispositivosCliente(dispositivos, 'cliente-2')).toBe(1);
    });
  });

  describe('Cuenta exclusiva (por categoría)', () => {
    it('admite hasta 3 fijos y 3 móviles para el único cliente', () => {
      const capacidad = calcularCapacidad({
        esExclusiva: true,
        dispositivos: [
          dispositivo(TipoDispositivo.fijo, 'cliente-1'),
          dispositivo(TipoDispositivo.fijo, 'cliente-1'),
          dispositivo(TipoDispositivo.fijo, 'cliente-1'),
        ],
      });
      expect(capacidad.fijo.completa).toBe(true);
      expect(capacidad.movil.completa).toBe(false);
      expect(capacidad.movil.libres).toBe(3);
      expect(capacidad.completa).toBe(false);
    });

    it('está completa recién cuando ambas categorías llegan a 3', () => {
      const dispositivos = Array.from({ length: 3 }, () =>
        dispositivo(TipoDispositivo.fijo, 'cliente-1'),
      ).concat(Array.from({ length: 3 }, () => dispositivo(TipoDispositivo.movil, 'cliente-1')));
      const capacidad = calcularCapacidad({ esExclusiva: true, dispositivos });
      expect(capacidad.completa).toBe(true);
      expect(capacidad.ocupados).toBe(6);
    });
  });
});
