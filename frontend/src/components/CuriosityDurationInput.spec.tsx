import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { formatDurationMinutes, splitDurationMinutes } from '@/lib/curiosity-window';
import { CuriosityDurationInput } from './CuriosityDurationInput';

describe('CuriosityDurationInput', () => {
  it('descompone minutos en días, horas y minutos', () => {
    expect(splitDurationMinutes(1_563)).toEqual({ days: 1, hours: 2, minutes: 3 });
    expect(formatDurationMinutes(1_563)).toBe('1 día 2 h 3 min');
    expect(formatDurationMinutes(0)).toBe('Sin ventana');
  });

  it('devuelve el total de minutos al cambiar una parte', () => {
    const onChange = vi.fn();
    render(<CuriosityDurationInput value={1_440} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Horas'), { target: { value: '2' } });

    expect(onChange).toHaveBeenCalledWith(1_560);
  });

  it('impide superar la duración predeterminada', () => {
    const onChange = vi.fn();
    render(
      <CuriosityDurationInput value={60} maxMinutes={1_500} onChange={onChange} />,
    );

    fireEvent.change(screen.getByLabelText('Días'), { target: { value: '2' } });

    expect(onChange).toHaveBeenCalledWith(1_500);
  });

  it('normaliza horas y minutos a sus rangos', () => {
    const onChange = vi.fn();
    const { rerender } = render(<CuriosityDurationInput value={0} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Horas'), { target: { value: '30' } });
    expect(onChange).toHaveBeenLastCalledWith(23 * 60);

    rerender(<CuriosityDurationInput value={0} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Minutos'), { target: { value: '80' } });
    expect(onChange).toHaveBeenLastCalledWith(59);
  });
});
