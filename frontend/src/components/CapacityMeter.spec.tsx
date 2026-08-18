import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TooltipProvider } from './ui/overlays';
import { CapacityMeter } from './CapacityMeter';
import type { OcupacionCategoria } from './CapacityMeter';

/**
 * Tests del medidor de capacidad.
 *
 * Es el componente que resume la información más importante del sistema (cuánto
 * lugar queda en una Cuenta), así que además de mostrarse tiene que ser legible
 * por lector de pantalla: la versión textual va en un `sr-only`.
 */
describe('CapacityMeter', () => {
  const categoria = (ocupados: number, habilitados: number): OcupacionCategoria => ({
    habilitados,
    ocupados,
    libres: Math.max(0, habilitados - ocupados),
    tope: 3,
    cerca_del_tope: ocupados >= 2,
    resumen: `${ocupados} de 3`,
  });

  const montar = (fijos: OcupacionCategoria, moviles: OcupacionCategoria) =>
    render(
      <TooltipProvider>
        <CapacityMeter fijos={fijos} moviles={moviles} />
      </TooltipProvider>,
    );

  it('muestra la ocupación de las dos categorías', () => {
    montar(categoria(2, 3), categoria(1, 1));

    expect(screen.getByText('2/3')).toBeInTheDocument();
    expect(screen.getByText('1/3')).toBeInTheDocument();
  });

  it('describe la ocupación para lectores de pantalla', () => {
    montar(categoria(2, 3), categoria(0, 1));

    expect(screen.getByText(/Fijos: 2 de 3 en uso/)).toBeInTheDocument();
    expect(screen.getByText(/Móviles: 0 de 3 en uso/)).toBeInTheDocument();
  });

  it('funciona con una cuenta recién creada (1 fijo + 1 móvil, sin uso)', () => {
    montar(categoria(0, 1), categoria(0, 1));

    expect(screen.getAllByText('0/3')).toHaveLength(2);
  });

  it('refleja el tope alcanzado', () => {
    montar(categoria(3, 3), categoria(3, 3));

    expect(screen.getAllByText('3/3')).toHaveLength(2);
  });
});
