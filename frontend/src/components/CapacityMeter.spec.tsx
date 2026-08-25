import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TooltipProvider } from './ui/overlays';
import { CapacityMeter } from './CapacityMeter';
import type { OcupacionCuenta } from './CapacityMeter';

describe('CapacityMeter', () => {
  const capacidad = (ocupados: number): OcupacionCuenta => ({
    ocupados,
    libres: Math.max(0, 3 - ocupados),
    limite: 3,
    cerca_del_tope: ocupados >= 2,
    resumen: `${ocupados} de 3`,
  });

  const montar = (ocupados: number) =>
    render(
      <TooltipProvider>
        <CapacityMeter capacidad={capacidad(ocupados)} />
      </TooltipProvider>,
    );

  it('muestra la ocupación global de la Cuenta', () => {
    montar(2);

    expect(screen.getByText('2/3')).toBeInTheDocument();
  });

  it('describe ocupados, libres y tope para lectores de pantalla', () => {
    montar(1);

    expect(screen.getByText(/Capacidad: Ocupados: 1 · Libres: 2 · Tope: 3/)).toBeInTheDocument();
  });

  it('refleja el tope alcanzado', () => {
    montar(3);

    expect(screen.getByText('3/3')).toBeInTheDocument();
  });

  it('renderiza 6 segmentos para una Cuenta exclusiva (3 fijos + 3 móviles)', () => {
    render(
      <TooltipProvider>
        <CapacityMeter
          capacidad={{
            ocupados: 4,
            libres: 2,
            limite: 6,
            cerca_del_tope: true,
            resumen: '4 de 6',
          }}
        />
      </TooltipProvider>,
    );

    expect(screen.getByText('4/6')).toBeInTheDocument();
  });
});
