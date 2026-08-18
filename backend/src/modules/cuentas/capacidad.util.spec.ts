import { EstadoDispositivo, TipoDispositivo } from '@prisma/client';
import {
  calcularCapacidad,
  capacidadDe,
  contarOcupados,
  habilitadosNecesariosParaAlta,
  habilitadosTrasBaja,
  tieneLugarPara,
} from './capacidad.util';

/**
 * Tests de las reglas de capacidad de una Cuenta.
 *
 * Es la lógica que decide si un alta entra en una Cuenta existente, si hay que
 * ampliar la parametrización en el Proveedor o si hace falta crear una Cuenta
 * nueva. Un error acá se traduce en plata: Cuentas de más facturadas, o Clientes
 * Finales sin servicio.
 */
describe('capacidad de Cuenta', () => {
  const dispositivo = (tipo: TipoDispositivo, estado: EstadoDispositivo) => ({ tipo, estado });

  describe('contarOcupados', () => {
    it('cuenta los activos y los bloqueados por suspensión', () => {
      const dispositivos = [
        dispositivo(TipoDispositivo.fijo, EstadoDispositivo.activo),
        dispositivo(TipoDispositivo.fijo, EstadoDispositivo.bloqueado_por_suspension),
        dispositivo(TipoDispositivo.fijo, EstadoDispositivo.disponible),
        dispositivo(TipoDispositivo.fijo, EstadoDispositivo.dado_de_baja),
      ];

      // Los `disponible` y `dado_de_baja` NO ocupan lugar: el liberado por una
      // baja definitiva puede tomarlo un Cliente Final nuevo.
      expect(contarOcupados(dispositivos, TipoDispositivo.fijo)).toBe(2);
    });

    it('no mezcla categorías: fijos y móviles tienen topes independientes', () => {
      const dispositivos = [
        dispositivo(TipoDispositivo.fijo, EstadoDispositivo.activo),
        dispositivo(TipoDispositivo.movil, EstadoDispositivo.activo),
        dispositivo(TipoDispositivo.movil, EstadoDispositivo.activo),
      ];

      expect(contarOcupados(dispositivos, TipoDispositivo.fijo)).toBe(1);
      expect(contarOcupados(dispositivos, TipoDispositivo.movil)).toBe(2);
    });
  });

  describe('calcularCapacidad', () => {
    it('arranca en 1 fijo + 1 móvil sin dispositivos: hay cupo libre en las dos', () => {
      const capacidad = calcularCapacidad({
        dispositivosFijosHabilitados: 1,
        dispositivosMovilesHabilitados: 1,
        dispositivos: [],
      });

      expect(capacidad.fijo.libres).toBe(1);
      expect(capacidad.movil.libres).toBe(1);
      expect(capacidad.completa).toBe(false);
    });

    it('detecta la Cuenta en el tope 3+3 como completa', () => {
      const dispositivos = [
        ...Array(3).fill(dispositivo(TipoDispositivo.fijo, EstadoDispositivo.activo)),
        ...Array(3).fill(dispositivo(TipoDispositivo.movil, EstadoDispositivo.activo)),
      ];

      const capacidad = calcularCapacidad({
        dispositivosFijosHabilitados: 3,
        dispositivosMovilesHabilitados: 3,
        dispositivos,
      });

      expect(capacidad.completa).toBe(true);
      expect(tieneLugarPara(capacidad.fijo)).toBe(false);
      expect(tieneLugarPara(capacidad.movil)).toBe(false);
    });

    it('un Dispositivo bloqueado por suspensión sigue ocupando lugar', () => {
      // Regla 3: el Dispositivo del cliente suspendido queda reservado, no se
      // puede ofrecer a otro Cliente Final.
      const capacidad = calcularCapacidad({
        dispositivosFijosHabilitados: 1,
        dispositivosMovilesHabilitados: 1,
        dispositivos: [
          dispositivo(TipoDispositivo.fijo, EstadoDispositivo.bloqueado_por_suspension),
        ],
      });

      expect(capacidad.fijo.ocupados).toBe(1);
      expect(capacidad.fijo.libres).toBe(0);
      // Todavía puede ampliar hasta 3, así que la Cuenta no está completa.
      expect(capacidad.fijo.puedeAmpliar).toBe(true);
    });

    it('avisa "cerca del tope" al llegar al umbral configurado (2 de 3 por defecto)', () => {
      const capacidad = calcularCapacidad({
        dispositivosFijosHabilitados: 2,
        dispositivosMovilesHabilitados: 1,
        dispositivos: [
          dispositivo(TipoDispositivo.fijo, EstadoDispositivo.activo),
          dispositivo(TipoDispositivo.fijo, EstadoDispositivo.activo),
        ],
      });

      expect(capacidad.fijo.cercaDelTope).toBe(true);
      expect(capacidad.movil.cercaDelTope).toBe(false);
    });

    it('respeta un umbral distinto si el Operador Principal lo cambia', () => {
      const conUmbral3 = calcularCapacidad(
        {
          dispositivosFijosHabilitados: 2,
          dispositivosMovilesHabilitados: 1,
          dispositivos: [dispositivo(TipoDispositivo.fijo, EstadoDispositivo.activo)],
        },
        3,
      );

      expect(conUmbral3.fijo.cercaDelTope).toBe(false);
    });

    it('acota los habilitados al tope de 3 aunque la base traiga un valor mayor', () => {
      const capacidad = calcularCapacidad({
        dispositivosFijosHabilitados: 7,
        dispositivosMovilesHabilitados: 0,
        dispositivos: [],
      });

      expect(capacidad.fijo.habilitados).toBe(3);
      expect(capacidad.fijo.puedeAmpliar).toBe(false);
    });
  });

  describe('habilitadosNecesariosParaAlta', () => {
    it('no toca el Proveedor si ya hay un cupo habilitado y libre', () => {
      const capacidad = calcularCapacidad({
        dispositivosFijosHabilitados: 2,
        dispositivosMovilesHabilitados: 1,
        dispositivos: [dispositivo(TipoDispositivo.fijo, EstadoDispositivo.activo)],
      });

      // Habilitados = 2, ocupados = 1 → entra sin cambiar la parametrización.
      expect(habilitadosNecesariosParaAlta(capacidad, TipoDispositivo.fijo)).toBe(2);
    });

    it('pide +1 dispositivo cuando no hay cupo libre pero se puede ampliar', () => {
      const capacidad = calcularCapacidad({
        dispositivosFijosHabilitados: 1,
        dispositivosMovilesHabilitados: 1,
        dispositivos: [dispositivo(TipoDispositivo.fijo, EstadoDispositivo.activo)],
      });

      // De a uno por vez, nunca en bloque (regla 2.1, punto 3).
      expect(habilitadosNecesariosParaAlta(capacidad, TipoDispositivo.fijo)).toBe(2);
    });

    it('devuelve null cuando la categoría está en el tope', () => {
      const capacidad = calcularCapacidad({
        dispositivosFijosHabilitados: 3,
        dispositivosMovilesHabilitados: 1,
        dispositivos: Array(3).fill(dispositivo(TipoDispositivo.fijo, EstadoDispositivo.activo)),
      });

      expect(habilitadosNecesariosParaAlta(capacidad, TipoDispositivo.fijo)).toBeNull();
      // Pero la categoría móvil sigue teniendo lugar.
      expect(habilitadosNecesariosParaAlta(capacidad, TipoDispositivo.movil)).toBe(1);
    });
  });

  describe('habilitadosTrasBaja', () => {
    it('resta 1 dispositivo habilitado (lógica inversa exacta al alta)', () => {
      expect(habilitadosTrasBaja(3, TipoDispositivo.fijo)).toBe(2);
      expect(habilitadosTrasBaja(2, TipoDispositivo.movil)).toBe(1);
    });

    it('no baja de 1 en móviles, porque el proveedor exige entre 1 y 3', () => {
      expect(habilitadosTrasBaja(1, TipoDispositivo.movil)).toBe(1);
    });

    it('permite llegar a 0 en fijos, que sí admiten 0', () => {
      expect(habilitadosTrasBaja(1, TipoDispositivo.fijo)).toBe(0);
      expect(habilitadosTrasBaja(0, TipoDispositivo.fijo)).toBe(0);
    });
  });

  describe('capacidadDe', () => {
    it('devuelve la categoría que corresponde al tipo', () => {
      const capacidad = calcularCapacidad({
        dispositivosFijosHabilitados: 3,
        dispositivosMovilesHabilitados: 1,
        dispositivos: [],
      });

      expect(capacidadDe(capacidad, TipoDispositivo.fijo).habilitados).toBe(3);
      expect(capacidadDe(capacidad, TipoDispositivo.movil).habilitados).toBe(1);
    });
  });
});
