import {
  metadatosDispositivoProveedor,
  parsearUltimoInicioProveedor,
} from './metadatos-dispositivo.util';

describe('metadatos de Dispositivo del Proveedor', () => {
  it('interpreta turn_on_date de SENSA como hora argentina', () => {
    expect(parsearUltimoInicioProveedor('26/09/2026 13:07')).toEqual(
      new Date('2026-09-26T16:07:00.000Z'),
    );
  });

  it('acepta fechas ISO y descarta valores inválidos', () => {
    expect(parsearUltimoInicioProveedor('2026-09-26T16:07:00.000Z')).toEqual(
      new Date('2026-09-26T16:07:00.000Z'),
    );
    expect(parsearUltimoInicioProveedor('sin-fecha')).toBeUndefined();
  });

  it('no genera campos que borrarían metadatos cuando el Proveedor los omite', () => {
    expect(metadatosDispositivoProveedor({ proveedorDeviceId: '1', activo: true })).toEqual({});
  });
});
