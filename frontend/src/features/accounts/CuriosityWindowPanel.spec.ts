import { describe, expect, it } from 'vitest';
import { formatCuriosityAvailability, isCuriosityWindowActive } from '@/lib/curiosity-window';
import type { CuriosityWindow } from '@/lib/types';

const windowData: CuriosityWindow = {
  activa: true,
  inicio_en: '2026-08-31T10:00:00.000Z',
  fin_previsto_en: '2026-08-31T12:00:00.000Z',
  fin_real_en: null,
  duracion_predeterminada_minutos: 120,
  duracion_aplicada_minutos: 120,
  motivo_fin: null,
  iniciada_por: null,
  finalizada_por: null,
};

describe('ventana de curiosidad', () => {
  it('considera vencida una ventana aunque la respuesta todavía diga activa', () => {
    expect(isCuriosityWindowActive(windowData, new Date('2026-08-31T11:59:00.000Z').getTime())).toBe(true);
    expect(isCuriosityWindowActive(windowData, new Date('2026-08-31T12:00:00.000Z').getTime())).toBe(false);
  });

  it('muestra la disponibilidad sin año ni segundos', () => {
    expect(formatCuriosityAvailability(windowData.fin_previsto_en)).toMatch(/^\d{2}\/\d{2} \d{2}:\d{2}$/);
  });
});
