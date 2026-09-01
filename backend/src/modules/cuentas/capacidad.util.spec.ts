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

  describe('Cuenta compartida (por cupos reservados)', () => {
    it('sin ventas, no hay categorías habilitadas', () => {
      const capacidad = calcularCapacidad({ esExclusiva: false, dispositivos: [] });
      expect(capacidad.ventas).toBe(0);
      expect(capacidad.libres).toBe(3);
      expect(capacidad.completa).toBe(false);
      expect(capacidad.fijo.limite).toBe(0);
      expect(capacidad.movil.limite).toBe(0);
    });

    it('una venta 1+1 compromete un cupo por categoría', () => {
      const capacidad = calcularCapacidad({
        esExclusiva: false,
        dispositivos: [dispositivo(TipoDispositivo.fijo, 'cliente-1')],
        ventasCompartidas: [{ cuposPorCategoria: 1 }],
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

    it('una venta 2+2 deja un único cupo por categoría disponible', () => {
      const capacidad = calcularCapacidad({
        esExclusiva: false,
        dispositivos: [],
        ventasCompartidas: [{ cuposPorCategoria: 2 }],
      });
      expect(capacidad.ventas).toBe(1);
      expect(capacidad.ocupados).toBe(2);
      expect(capacidad.libres).toBe(1);
      expect(capacidad.fijo.limite).toBe(2);
      expect(capacidad.movil.limite).toBe(2);
    });

    it('una venta 2+2 más otra 1+1 completan los tres cupos', () => {
      const capacidad = calcularCapacidad({
        esExclusiva: false,
        dispositivos: [],
        ventasCompartidas: [{ cuposPorCategoria: 2 }, { cuposPorCategoria: 1 }],
      });
      expect(capacidad.ventas).toBe(2);
      expect(capacidad.ocupados).toBe(3);
      expect(capacidad.libres).toBe(0);
      expect(capacidad.completa).toBe(true);
    });

    it('mantiene compatibilidad con ventas históricas sin reserva explícita', () => {
      const capacidad = calcularCapacidad({
        esExclusiva: false,
        dispositivos: [
          dispositivo(TipoDispositivo.fijo, 'cliente-1'),
          dispositivo(TipoDispositivo.movil, 'cliente-1'),
        ],
      });
      expect(capacidad.ventas).toBe(1);
      expect(capacidad.ocupados).toBe(1);
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
    it('una Cuenta vacía informa 0 de 3 cupos 1+1', () => {
      const capacidad = calcularCapacidad({ esExclusiva: true, dispositivos: [] });

      expect(capacidad.ocupados).toBe(0);
      expect(capacidad.limite).toBe(3);
      expect(capacidad.libres).toBe(3);
    });

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
      expect(capacidad.ocupados).toBe(3);
      expect(capacidad.limite).toBe(3);
    });

    it('cada par fijo/móvil consume un único cupo 1+1', () => {
      const capacidad = calcularCapacidad({
        esExclusiva: true,
        dispositivos: [
          dispositivo(TipoDispositivo.fijo, 'cliente-1'),
          dispositivo(TipoDispositivo.movil, 'cliente-1'),
        ],
      });

      expect(capacidad.ocupados).toBe(1);
      expect(capacidad.libres).toBe(2);
    });
  });
});
