import { useQuery } from '@tanstack/react-query';
import { ClipboardList, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Paginado } from '@/lib/api';
import type { AuditEntry } from '@/lib/types';
import { AuditLogEntry } from '@/features/audit-log/AuditLogEntry';
import { Alert, Button, EmptyState, Skeleton } from '@/components/ui/primitives';
import { Paginacion, Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';

/**
 * Actividad de una Cuenta, para mostrar dentro del drawer de `/accounts/:id`.
 *
 * Reutiliza el registro de auditoría filtrando por Cuenta: el backend devuelve
 * los eventos propios de la Cuenta y los de sus Dispositivos y Clientes Finales
 * (que referencian la Cuenta en el detalle). Es de sólo lectura.
 */
export const AccountActivityPanel = ({ cuentaId }: { cuentaId: string }) => {
  const [pagina, setPagina] = useState(1);
  const [expandido, setExpandido] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['account-activity', cuentaId, pagina],
    queryFn: () =>
      api<Paginado<AuditEntry>>('/audit-log', {
        params: { account_id: cuentaId, page: pagina, per_page: 10 },
      }),
    enabled: Boolean(cuentaId),
  });

  if (isLoading) {
    return (
      <div className="px-5 py-4">
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-5 py-4">
        <Alert tone="danger" titulo="No pudimos cargar la actividad">
          {(error as Error).message}
        </Alert>
      </div>
    );
  }

  return (
    <>
      <Table>
        <THead>
          <TR>
            <TH>Fecha</TH>
            <TH>Acción</TH>
            <TH>Ejecutado por</TH>
            <TH align="right" />
          </TR>
        </THead>
        <TBody>
          {data?.data.map((registro) => (
            <AuditLogEntry
              key={registro.id}
              registro={registro}
              esOperador={false}
              mostrarEntidad={false}
              expandido={expandido === registro.id}
              onAlternar={() =>
                setExpandido((actual) => (actual === registro.id ? null : registro.id))
              }
            />
          ))}

          {data && data.data.length === 0 ? (
            <TR>
              <TD colSpan={4}>
                <EmptyState
                  icono={<ClipboardList className="size-8" />}
                  titulo="Todavía no hay actividad"
                  descripcion="Cuando se realicen acciones sobre esta cuenta, sus dispositivos o sus clientes, van a aparecer acá."
                />
              </TD>
            </TR>
          ) : null}
        </TBody>
      </Table>

      {data && data.meta.total > 0 ? (
        <>
          <Paginacion
            pagina={data.meta.page}
            totalPaginas={data.meta.total_pages}
            total={data.meta.total}
            onCambiar={(nueva) => setPagina(nueva)}
          />
          <div className="flex justify-end border-t px-4 py-2">
            <Button asChild variant="ghost" size="sm">
              <Link to={`/audit-log?account_id=${cuentaId}`}>
                <ExternalLink />
                Ver todo en Auditoría
              </Link>
            </Button>
          </div>
        </>
      ) : null}
    </>
  );
};
