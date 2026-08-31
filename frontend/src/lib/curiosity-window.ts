import type { CuriosityWindow } from './types';

interface DurationParts {
  days: number;
  hours: number;
  minutes: number;
}

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

const normalizeMinutes = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

export const splitDurationMinutes = (totalMinutes: number): DurationParts => {
  const normalized = normalizeMinutes(totalMinutes);
  return {
    days: Math.floor(normalized / MINUTES_PER_DAY),
    hours: Math.floor((normalized % MINUTES_PER_DAY) / MINUTES_PER_HOUR),
    minutes: normalized % MINUTES_PER_HOUR,
  };
};

export const formatDurationMinutes = (totalMinutes: number): string => {
  const { days, hours, minutes } = splitDurationMinutes(totalMinutes);
  if (days === 0 && hours === 0 && minutes === 0) return 'Sin ventana';

  return [
    days > 0 ? `${days} ${days === 1 ? 'día' : 'días'}` : null,
    hours > 0 ? `${hours} h` : null,
    minutes > 0 ? `${minutes} min` : null,
  ]
    .filter(Boolean)
    .join(' ');
};

export const isCuriosityWindowActive = (
  window: CuriosityWindow | null | undefined,
  now = Date.now(),
): boolean => {
  if (!window?.activa) return false;
  const expectedEnd = new Date(window.fin_previsto_en).getTime();
  return Number.isFinite(expectedEnd) && expectedEnd > now;
};

export const formatCuriosityAvailability = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
