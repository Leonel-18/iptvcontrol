import { useQuery } from '@tanstack/react-query';
import { ClipboardList } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, descargarCsv, type Paginado } from '@/lib/api';
import { useSesion } from '@/lib/session';
import type { AuditEntry } from '@/lib/types';
import { auditEntityLabels, roleLabels, traducir } from '@/i18n/entityLabels';
import { ExportCsvButton, PageHeader } from '@/components/common';
import { AuditLogEntry } from './AuditLogEntry';
import { Card, EmptyState, Input } from '@/components/ui/primitives';
import { Select } from '@/components/ui/overlays';
import { Paginacion, Table, TableSkeleton, TBody, TD, TH, THead, TR } from '@/components/ui/table';

/**
 * Registro de auditoría — `/audit-log`.
 *
 * El Operador Principal ve el historial completo de sus Empresas Revendedoras,
 * pero con la misma restricción de campos que en clientes y dispositivos: el
 * detalle se filtra en el backend para que no viajen nombres ni datos de contacto
 * (regla de negocio 11 + 4.2). Cada Empresa Revendedora ve sólo lo propio.
 */
export const AuditLogList = () => {
  const { esOperador } = useSesion();
  const [params, setParams] = useSearchParams();
  const [expandido, setExpandido] = useState<string | null>(null);

  const pagina = Number(params.get('page') ?? 1);
  const accion = params.get('action') ?? '';
  const entidad = params.get('entity') ?? '';
  const desde = params.get('from') ?? '';
  const hasta = params.get('to') ?? '';

  const filtros = {
    page: pagina,
    per_page: 50,
    action: accion || undefined,
    entity: entidad || undefined,
    from: desde || undefined,
    to: hasta || undefined,
  };

  const catalogo = useQuery({
    queryKey: ['audit-actions'],
    queryFn: () =>
      api<{ acciones: { valor: string; etiqueta: string }[] }>('/audit-log/actions'),
    staleTime: Infinity,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['audit-log', filtros],
    queryFn: () => api<Paginado<AuditEntry>>('/audit-log', { params: filtros }),
  });

  const actualizar = (clave: string, valor: string) => {
    const siguiente = new URLSearchParams(params);
    if (valor) siguiente.set(clave, valor);
    else siguiente.delete(clave);
    if (clave !== 'page') siguiente.delete('page');
    setParams(siguiente);
  };

  return (
    <>
      <PageHeader
        eyebrow="Trazabilidad"
        titulo="Auditoría"
        descripcion="Quién hizo qué y cuándo: altas, suspensiones y bajas de clientes, cambios de modalidad y de precios, y configuración del proveedor."
        acciones={
          <ExportCsvButton onExportar={() => descargarCsv('/audit-log', filtros, 'auditoria')} />
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <Select
            value={accion || 'todas'}
            onChange={(valor) => actualizar('action', valor === 'todas' ? '' : valor)}
            className="max-w-64"
            opciones={[
              { value: 'todas', label: 'Todas las acciones' },
              ...(catalogo.data?.acciones ?? []).map((item) => ({
                value: item.valor,
                label: item.etiqueta,
              })),
            ]}
          />
          <Select
            value={entidad || 'todas'}
            onChange={(valor) => actualizar('entity', valor === 'todas' ? '' : valor)}
            className="max-w-52"
            opciones={[
              { value: 'todas', label: 'Todas las entidades' },
              ...Object.entries(auditEntityLabels).map(([value, label]) => ({ value, label })),
            ]}
          />
          <Input
            type="date"
            value={desde}
            onChange={(evento) => actualizar('from', evento.target.value)}
            className="max-w-40"
            aria-label="Desde"
          />
          <Input
            type="date"
            value={hasta}
            onChange={(evento) => actualizar('to', evento.target.value)}
            className="max-w-40"
            aria-label="Hasta"
          />
        </div>

        <Table>
          <THead>
            <TR>
              <TH>Fecha</TH>
              <TH>Acción</TH>
              <TH>Entidad</TH>
              <TH>Ejecutado por</TH>
              {esOperador ? <TH>Empresa</TH> : null}
              <TH align="right" />
            </TR>
          </THead>

          {isLoading ? (
            <TableSkeleton columnas={esOperador ? 6 : 5} />
          ) : (
            <TBody>
              {data?.data.map((registro) => (
                <AuditLogEntry
                  key={registro.id}
                  registro={registro}
                  esOperador={esOperador}
                  expandido={expandido === registro.id}
                  onAlternar={() =>
                    setExpandido((actual) => (actual === registro.id ? null : registro.id))
                  }
                />
              ))}

              {data && data.data.length === 0 ? (
                <TR>
                  <TD colSpan={esOperador ? 6 : 5}>
                    <EmptyState
                      icono={<ClipboardList className="size-8" />}
                      titulo="No hay registros con esos filtros"
                      descripcion="Pruebe ampliando el rango de fechas o quitando filtros."
                    />
                  </TD>
                </TR>
              ) : null}
            </TBody>
          )}
        </Table>

        {data && data.meta.total > 0 ? (
          <Paginacion
            pagina={data.meta.page}
            totalPaginas={data.meta.total_pages}
            total={data.meta.total}
            onCambiar={(nueva) => actualizar('page', String(nueva))}
          />
        ) : null}
      </Card>

      <p className="mt-3 text-xs texto-suave">
        Las alertas automáticas por correo sobre eventos del registro no están incluidas en esta
        etapa: la consulta es manual desde el panel.
        {' '}
        {esOperador
          ? 'Cuando un registro involucra a un cliente final, se identifica por ID y número de cliente.'
          : ''}
      </p>
      <p className="mt-1 text-xs texto-suave">
        Los roles se muestran como {traducir(roleLabels, 'operator_admin')} y{' '}
        {traducir(roleLabels, 'reseller_admin')} según quién ejecutó la acción.
      </p>
    </>
  );
};
