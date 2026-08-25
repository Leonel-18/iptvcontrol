import { cn } from '@/lib/utils';
import type { AccountCapacity } from '@/lib/types';
import { Tooltip } from './ui/overlays';

// Alturas crecientes para hasta 6 barras (Cuenta exclusiva: 3 fijos + 3
// móviles). Una Cuenta compartida usa sólo las primeras 3 (tope de ventas).
const ALTURAS_BARRA = ['h-1.5', 'h-2', 'h-2.5', 'h-3', 'h-3.5', 'h-4'] as const;

/** Ocupación comercial de una Cuenta (ventas en compartida, Dispositivos en exclusiva). */
export type OcupacionCuenta = AccountCapacity;

/**
 * Medidor de capacidad de una Cuenta.
 *
 * La cantidad de segmentos es dinámica: 3 en una Cuenta compartida (tope de
 * ventas) y 6 en una exclusiva (3 fijos + 3 móviles). Los segmentos retoman
 * las barras crecientes del isotipo de IPTVControl: azure para lugares
 * ocupados, ámbar para bloqueados y vacío para libres.
 */
export const CapacityMeter = ({
  capacidad,
  bloqueados = 0,
  compacto = false,
  className,
}: {
  capacidad: OcupacionCuenta;
  bloqueados?: number;
  compacto?: boolean;
  className?: string;
}) => {
  const bloqueadosVisibles = Math.min(Math.max(bloqueados, 0), capacidad.ocupados);
  const detalle = `Ocupados: ${capacidad.ocupados} · Libres: ${capacidad.libres} · Tope: ${capacidad.limite}`;
  const cantidadBarras = Math.max(1, capacidad.limite);

  return (
    <Tooltip contenido={detalle}>
      <span
        className={cn(
          'inline-flex items-center gap-2 rounded border px-2 py-1',
          capacidad.cerca_del_tope
            ? 'border-warn/40 bg-warn/10'
            : 'border-transparent superficie-2',
          className,
        )}
      >
        <span className="inline-flex items-end gap-[3px]" aria-hidden="true">
          {Array.from({ length: cantidadBarras }).map((_, indice) => {
            const ocupado = indice < capacidad.ocupados;
            const esBloqueado = ocupado && indice >= capacidad.ocupados - bloqueadosVisibles;
            const altura = ALTURAS_BARRA[Math.floor((indice / cantidadBarras) * ALTURAS_BARRA.length)];

            return (
              <span
                key={indice}
                className={cn(
                  'w-[5px] rounded-[1px] transition-colors',
                  altura,
                  !ocupado && 'bg-navy-200 dark:bg-navy-700',
                  ocupado && !esBloqueado && 'bg-azure-500',
                  esBloqueado && 'bg-warn',
                )}
              />
            );
          })}
        </span>
        {!compacto ? (
          <span className="font-mono text-2xs tabular-nums">
            {capacidad.ocupados}/{capacidad.limite}
          </span>
        ) : null}
        <span className="sr-only">Capacidad: {detalle}.</span>
      </span>
    </Tooltip>
  );
};
