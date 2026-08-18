import { ChevronDown, ChevronRight } from 'lucide-react';
import { formatearFechaHora } from '@/lib/utils';
import type { AuditEntry } from '@/lib/types';
import { auditEntityLabels, roleLabels, traducir } from '@/i18n/entityLabels';
import { CopyableId } from '@/components/common';
import { Badge, Button } from '@/components/ui/primitives';
import { TD, TR } from '@/components/ui/table';

/**
 * Fila del registro de auditoría, con el detalle desplegable.
 *
 * El `detalle` se muestra como pares clave/valor legibles en lugar de JSON crudo:
 * el registro lo consulta gente de negocio, no sólo el equipo técnico. Cuando el
 * valor es un objeto (por ejemplo el "anterior/nuevo" de un cambio de precio) se
 * indenta un nivel, que alcanza para leerlo sin volverse un visor de JSON.
 */
export const AuditLogEntry = ({
  registro,
  esOperador,
  expandido,
  onAlternar,
}: {
  registro: AuditEntry;
  esOperador: boolean;
  expandido: boolean;
  onAlternar: () => void;
}) => {
  const tieneDetalle = registro.detalle && Object.keys(registro.detalle).length > 0;

  return (
    <>
      <TR>
        <TD>
          <span className="whitespace-nowrap text-sm">{formatearFechaHora(registro.creado_en)}</span>
        </TD>
        <TD>
          <span className="text-sm font-medium">{registro.accion_etiqueta}</span>
        </TD>
        <TD>
          <div className="flex items-center gap-2">
            <Badge tone="neutral">{traducir(auditEntityLabels, registro.entidad)}</Badge>
            {registro.entidad_id ? (
              <CopyableId valor={registro.entidad_id.slice(0, 8)} etiqueta="ID de entidad" />
            ) : null}
          </div>
        </TD>
        <TD>
          {registro.ejecutado_por ? (
            <div className="flex flex-col gap-0.5">
              <span className="text-sm">{registro.ejecutado_por.email}</span>
              <span className="text-2xs texto-suave">
                {traducir(roleLabels, registro.ejecutado_por.rol)}
              </span>
            </div>
          ) : (
            <span className="text-sm texto-suave">Sistema</span>
          )}
        </TD>
        {esOperador ? (
          <TD>
            <span className="text-sm texto-suave">
              {registro.empresa_revendedora?.razon_social ?? 'Operador principal'}
            </span>
          </TD>
        ) : null}
        <TD align="right">
          {tieneDetalle ? (
            <Button variant="ghost" size="sm" onClick={onAlternar}>
              {expandido ? <ChevronDown /> : <ChevronRight />}
              Detalle
            </Button>
          ) : null}
        </TD>
      </TR>

      {expandido && tieneDetalle ? (
        <TR className="superficie-2">
          <TD colSpan={esOperador ? 6 : 5}>
            <dl className="grid gap-1.5 py-1 sm:grid-cols-2">
              {Object.entries(registro.detalle ?? {}).map(([clave, valor]) => (
                <DetalleItem key={clave} clave={clave} valor={valor} />
              ))}
            </dl>
          </TD>
        </TR>
      ) : null}
    </>
  );
};

const humanizar = (clave: string): string =>
  clave.replace(/_/g, ' ').replace(/^./, (letra) => letra.toUpperCase());

const formatearValor = (valor: unknown): string => {
  if (valor === null || valor === undefined) return '—';
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  return String(valor);
};

const DetalleItem = ({ clave, valor }: { clave: string; valor: unknown }) => {
  if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
    return (
      <div className="sm:col-span-2">
        <dt className="eyebrow">{humanizar(clave)}</dt>
        <dd className="mt-0.5 space-y-0.5 border-l-2 border-[rgb(var(--borde))] pl-3">
          {Object.entries(valor as Record<string, unknown>).map(([subclave, subvalor]) => (
            <p key={subclave} className="text-xs">
              <span className="texto-suave">{humanizar(subclave)}: </span>
              <span className="font-mono">{formatearValor(subvalor)}</span>
            </p>
          ))}
        </dd>
      </div>
    );
  }

  return (
    <div className="flex gap-2 text-xs">
      <dt className="texto-suave">{humanizar(clave)}:</dt>
      <dd className="font-mono">{formatearValor(valor)}</dd>
    </div>
  );
};
