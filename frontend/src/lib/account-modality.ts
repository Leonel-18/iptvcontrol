import type { BadgeProps } from '@/components/ui/primitives';

type Tone = NonNullable<BadgeProps['tone']>;

/**
 * Etiqueta y tono de la modalidad de una Cuenta.
 *
 * La condición de "prueba" (HU-P04) no reemplaza a la modalidad base: se muestra
 * como `Compartida - Prueba` / `Exclusiva - Prueba`. Una cuenta de prueba nunca
 * se muestra como "Aislada" (y el backend tampoco informa ambas a la vez).
 */
export const accountModality = (cuenta: {
  es_exclusiva: boolean;
  es_prueba?: boolean;
  aislada?: boolean;
}): { label: string; tone: Tone } => {
  if (cuenta.es_prueba) {
    return {
      label: cuenta.es_exclusiva ? 'Exclusiva - Prueba' : 'Compartida - Prueba',
      tone: 'warning',
    };
  }
  if (cuenta.es_exclusiva) return { label: 'Exclusiva', tone: 'info' };
  if (cuenta.aislada) return { label: 'Compartida - Aislada', tone: 'warning' };
  return { label: 'Compartida', tone: 'neutral' };
};
