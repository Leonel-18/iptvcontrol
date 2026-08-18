import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from './primitives';

/**
 * Tabla de datos.
 *
 * En mobile no se transforma en tarjetas: se hace scroll horizontal con la
 * primera columna fija. El panel de la Empresa Revendedora se opera mucho desde
 * el celular, y para comparar dispositivos de una cuenta la grilla sirve más que
 * una pila de tarjetas — lo que hace falta es no perder de vista de qué fila se
 * está hablando.
 */
export const Table = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn('scrollbar-fina w-full overflow-x-auto', className)}>
    <table className="w-full border-collapse text-sm">{children}</table>
  </div>
);

export const THead = ({ children }: { children: ReactNode }) => (
  <thead className="superficie-2">{children}</thead>
);

export const TBody = ({ children }: { children: ReactNode }) => (
  <tbody className="divide-y divide-[rgb(var(--borde))]">{children}</tbody>
);

export const TR = ({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) => (
  <tr
    className={cn(
      onClick && 'cursor-pointer hover:bg-navy-50 dark:hover:bg-navy-800/60',
      className,
    )}
    onClick={onClick}
  >
    {children}
  </tr>
);

export const TH = ({
  children,
  className,
  align = 'left',
}: {
  children?: ReactNode;
  className?: string;
  align?: 'left' | 'right' | 'center';
}) => (
  <th
    scope="col"
    className={cn(
      'whitespace-nowrap border-b px-3 py-2.5 font-mono text-2xs uppercase tracking-[0.1em] texto-suave',
      align === 'right' && 'text-right',
      align === 'center' && 'text-center',
      align === 'left' && 'text-left',
      className,
    )}
  >
    {children}
  </th>
);

export const TD = ({
  children,
  className,
  align = 'left',
  colSpan,
}: {
  children?: ReactNode;
  className?: string;
  align?: 'left' | 'right' | 'center';
  colSpan?: number;
}) => (
  <td
    colSpan={colSpan}
    className={cn(
      'px-3 py-2.5 align-middle',
      align === 'right' && 'text-right',
      align === 'center' && 'text-center',
      className,
    )}
  >
    {children}
  </td>
);

/** Filas fantasma mientras carga, para que la tabla no salte de alto. */
export const TableSkeleton = ({ columnas, filas = 5 }: { columnas: number; filas?: number }) => (
  <TBody>
    {Array.from({ length: filas }).map((_, fila) => (
      <TR key={fila}>
        {Array.from({ length: columnas }).map((__, columna) => (
          <TD key={columna}>
            <Skeleton className="h-4 w-full max-w-[160px]" />
          </TD>
        ))}
      </TR>
    ))}
  </TBody>
);

/** Paginación simple: número de página y total, sin numeritos infinitos. */
export const Paginacion = ({
  pagina,
  totalPaginas,
  total,
  onCambiar,
}: {
  pagina: number;
  totalPaginas: number;
  total: number;
  onCambiar: (pagina: number) => void;
}) => (
  <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm">
    <p className="texto-suave">
      {total.toLocaleString('es-AR')} {total === 1 ? 'registro' : 'registros'}
    </p>
    <div className="flex items-center gap-2">
      <button
        type="button"
        className="rounded border px-3 py-1 disabled:opacity-40"
        disabled={pagina <= 1}
        onClick={() => onCambiar(pagina - 1)}
      >
        Anterior
      </button>
      <span className="font-mono text-xs texto-suave">
        {pagina} / {Math.max(1, totalPaginas)}
      </span>
      <button
        type="button"
        className="rounded border px-3 py-1 disabled:opacity-40"
        disabled={pagina >= totalPaginas}
        onClick={() => onCambiar(pagina + 1)}
      >
        Siguiente
      </button>
    </div>
  </div>
);
