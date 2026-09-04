import { useId } from 'react';
import { formatDurationMinutes, splitDurationMinutes } from '@/lib/curiosity-window';
import { Field, Input } from './ui/primitives';

interface DurationParts {
  days: number;
  hours: number;
  minutes: number;
}

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

const normalizeMinutes = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

/** Si el predeterminado es 0 (funcionalidad sin configurar), no se aplica tope. */
const maxEfectivo = (maxMinutes?: number): number | undefined => {
  const normalizado = normalizeMinutes(maxMinutes ?? 0);
  return normalizado > 0 ? normalizado : undefined;
};

export const CuriosityDurationInput = ({
  value,
  onChange,
  maxMinutes,
  disabled = false,
  label = 'Duración de la Ventana de Alta',
  help,
}: {
  value: number;
  onChange: (minutes: number) => void;
  maxMinutes?: number;
  disabled?: boolean;
  label?: string;
  help?: string;
}) => {
  const id = useId();
  const parts = splitDurationMinutes(value);
  const tope = maxEfectivo(maxMinutes);

  const updatePart = (part: keyof DurationParts, rawValue: string) => {
    // Permitir vaciar el campo mientras se escribe sin que salte a 0 al instante.
    const texto = rawValue.replace(/[^\d]/g, '');
    if (texto === '') {
      onChange(0);
      return;
    }
    const parsed = normalizeMinutes(Number(texto));
    const numericValue = part === 'days' ? parsed : Math.min(parsed, part === 'hours' ? 23 : 59);
    const next = { ...parts, [part]: numericValue };
    const total =
      next.days * MINUTES_PER_DAY + next.hours * MINUTES_PER_HOUR + next.minutes;
    onChange(tope === undefined ? total : Math.min(total, tope));
  };

  return (
    <fieldset disabled={disabled} className="space-y-2">
      <legend className="text-sm font-medium">{label}</legend>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Días" htmlFor={`${id}-days`}>
          <Input
            id={`${id}-days`}
            type="number"
            min="0"
            inputMode="numeric"
            value={parts.days}
            onChange={(event) => updatePart('days', event.target.value)}
            className="tabular-nums"
          />
        </Field>
        <Field label="Horas" htmlFor={`${id}-hours`}>
          <Input
            id={`${id}-hours`}
            type="number"
            min="0"
            max="23"
            inputMode="numeric"
            value={parts.hours}
            onChange={(event) => updatePart('hours', event.target.value)}
            className="tabular-nums"
          />
        </Field>
        <Field label="Minutos" htmlFor={`${id}-minutes`}>
          <Input
            id={`${id}-minutes`}
            type="number"
            min="0"
            max="59"
            inputMode="numeric"
            value={parts.minutes}
            onChange={(event) => updatePart('minutes', event.target.value)}
            className="tabular-nums"
          />
        </Field>
      </div>
      <p className="text-xs texto-suave">
        {help ?? `Duración seleccionada: ${formatDurationMinutes(value)}.`}
      </p>
    </fieldset>
  );
};
