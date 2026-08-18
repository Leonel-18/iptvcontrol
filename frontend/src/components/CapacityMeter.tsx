import { MonitorPlay, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip } from './ui/overlays';

/**
 * =============================================================================
 * CapacityMeter — el elemento distintivo del panel
 * =============================================================================
 * Una Cuenta admite 3 dispositivos fijos + 3 móviles, y toda la operación gira
 * alrededor de ese número: si hay lugar, el alta entra ahí; si no, hay que crear
 * una Cuenta nueva (que es lo que se factura).
 *
 * En vez de mostrar "2/3" en texto, se dibuja como barras segmentadas, tomando
 * prestado el vocabulario visual del propio logo de IPTVControl (las barras de
 * señal al lado del monitor). Se lee de un golpe de vista y se repite igual en
 * el listado, en el detalle y en el aviso de capacidad, así la persona aprende
 * un solo símbolo.
 *
 * Los tres estados de cada segmento:
 *   lleno azure  → dispositivo activo
 *   lleno ámbar  → bloqueado por suspensión (ocupa lugar pero no da servicio)
 *   vacío        → disponible para un alta
 * =============================================================================
 */

export interface OcupacionCategoria {
  habilitados: number;
  ocupados: number;
  libres: number;
  tope: number;
  cerca_del_tope: boolean;
  resumen: string;
}

const Barras = ({
  ocupados,
  bloqueados = 0,
  tope,
}: {
  ocupados: number;
  bloqueados?: number;
  tope: number;
}) => (
  <span className="inline-flex items-end gap-[3px]" aria-hidden="true">
    {Array.from({ length: tope }).map((_, indice) => {
      const ocupado = indice < ocupados;
      const esBloqueado = ocupado && indice >= ocupados - bloqueados;
      return (
        <span
          key={indice}
          className={cn(
            'w-[5px] rounded-[1px] transition-colors',
            // Las barras crecen en altura, como en el isotipo.
            indice === 0 && 'h-2',
            indice === 1 && 'h-3',
            indice === 2 && 'h-4',
            !ocupado && 'bg-navy-200 dark:bg-navy-700',
            ocupado && !esBloqueado && 'bg-azure-500',
            esBloqueado && 'bg-warn',
          )}
        />
      );
    })}
  </span>
);

/** Una categoría (fijos o móviles) con su ícono, barras y conteo. */
export const CapacityCategory = ({
  tipo,
  ocupacion,
  bloqueados,
  compacto = false,
}: {
  tipo: 'fijo' | 'movil';
  ocupacion: OcupacionCategoria;
  bloqueados?: number;
  compacto?: boolean;
}) => {
  const Icono = tipo === 'fijo' ? MonitorPlay : Smartphone;
  const etiqueta = tipo === 'fijo' ? 'Fijos' : 'Móviles';

  const detalle = [
    `${ocupacion.ocupados} de ${ocupacion.tope} ${etiqueta.toLowerCase()} en uso`,
    `${ocupacion.habilitados} habilitados en el proveedor`,
    ocupacion.libres > 0
      ? `${ocupacion.libres} cupo${ocupacion.libres === 1 ? '' : 's'} libre${ocupacion.libres === 1 ? '' : 's'} sin tocar la parametrización`
      : ocupacion.habilitados < ocupacion.tope
        ? 'El próximo alta amplía la parametrización en el proveedor'
        : 'Categoría en el tope: el próximo alta requiere otra cuenta',
  ].join(' · ');

  return (
    <Tooltip contenido={detalle}>
      <span
        className={cn(
          'inline-flex items-center gap-2 rounded border px-2 py-1',
          ocupacion.cerca_del_tope
            ? 'border-warn/40 bg-warn/10'
            : 'border-transparent superficie-2',
        )}
      >
        <Icono className="size-3.5 texto-suave" aria-hidden="true" />
        <Barras ocupados={ocupacion.ocupados} bloqueados={bloqueados} tope={ocupacion.tope} />
        {!compacto ? (
          <span className="font-mono text-2xs tabular-nums">
            {ocupacion.ocupados}/{ocupacion.tope}
          </span>
        ) : null}
        <span className="sr-only">
          {etiqueta}: {ocupacion.ocupados} de {ocupacion.tope} en uso.
        </span>
      </span>
    </Tooltip>
  );
};

/** Las dos categorías juntas: la ocupación completa de una Cuenta. */
export const CapacityMeter = ({
  fijos,
  moviles,
  bloqueadosFijos,
  bloqueadosMoviles,
  compacto,
  className,
}: {
  fijos: OcupacionCategoria;
  moviles: OcupacionCategoria;
  bloqueadosFijos?: number;
  bloqueadosMoviles?: number;
  compacto?: boolean;
  className?: string;
}) => (
  <div className={cn('flex items-center gap-1.5', className)}>
    <CapacityCategory
      tipo="fijo"
      ocupacion={fijos}
      bloqueados={bloqueadosFijos}
      compacto={compacto}
    />
    <CapacityCategory
      tipo="movil"
      ocupacion={moviles}
      bloqueados={bloqueadosMoviles}
      compacto={compacto}
    />
  </div>
);
