import { IdentidadCuentasService } from './identidad-cuentas.service';

describe('IdentidadCuentasService', () => {
  const servicio = new IdentidadCuentasService();

  it('genera DNI aleatorios dentro de 10.000.000 y 99.000.000 (8 dígitos)', () => {
    for (let i = 0; i < 200; i += 1) {
      const dni = servicio.dniAleatorio();
      expect(dni).toMatch(/^\d{8}$/);
      const numero = Number(dni);
      expect(numero).toBeGreaterThanOrEqual(10_000_000);
      expect(numero).toBeLessThanOrEqual(99_000_000);
    }
  });

  it('elige nombre y apellido de las listas del Excel Nombres.xlsx', async () => {
    const identidad = await servicio.elegirIdentidad();
    expect(identidad.nombre.trim().length).toBeGreaterThan(0);
    expect(identidad.apellido.trim().length).toBeGreaterThan(0);
  });

  it('las combinaciones provienen de listas distintas (1600x1600) y no se repiten necesariamente', async () => {
    const usados = new Set<string>();
    for (let i = 0; i < 50; i += 1) {
      const identidad = await servicio.elegirIdentidad();
      usados.add(`${identidad.nombre}|${identidad.apellido}`);
    }
    // Probabilísticamente casi seguro hay combinaciones distintas entre 50.
    expect(usados.size).toBeGreaterThan(1);
  });
});
