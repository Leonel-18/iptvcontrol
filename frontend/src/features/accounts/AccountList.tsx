import { useQuery } from '@tanstack/react-query';
import { CreditCard } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, descargarCsv, type Paginado } from '@/lib/api';
import { useSesion } from '@/lib/session';
import { formatearFecha } from '@/lib/utils';
import type { Account } from '@/lib/types';
import { accountStatusLabels } from '@/i18n/entityLabels';
import { AccountStatusBadge, CopyableId, ExportCsvButton, PageHeader } from '@/components/common';
import { CapacityMeter } from '@/components/CapacityMeter';
import { Badge, Card, EmptyState, Input } from '@/components/ui/primitives';
import { Select } from '@/components/ui/overlays';
import { Paginacion, Table, TableSkeleton, TBody, TD, TH, THead, TR } from '@/components/ui/table';

/**
 * Listado de Cuentas — `/accounts`.
 *
 * El Operador Principal ve todas las de sus Empresas Revendedoras; una Empresa
 * Revendedora ve sólo las propias. La diferencia no está en esta pantalla: está
 * en el token y en las políticas de la base.
 */
export const AccountList = () => {
  const { esOperador } = useSesion();
  const [params, setParams] = useSearchParams();

  const pagina = Number(params.get('page') ?? 1);
  // Por defecto se muestran sólo las activas: las cerradas (creadas por error o
  // abandonadas) no tienen por qué aparecer en el día a día, pero se pueden ver
  // eligiendo "Todos los estados" — no se borran de la base, sólo se filtran.
  const estado = params.get('status') ?? 'activa';
  const busqueda = params.get('q') ?? '';
  const resellerId = params.get('reseller_id') ?? '';

  const filtros = {
    page: pagina,
    per_page: 25,
    status: estado === 'todas' ? undefined : estado,
    q: busqueda || undefined,
    reseller_id: resellerId || undefined,
  };

  const { data, isLoading } = useQuery({
    queryKey: ['accounts', filtros],
    queryFn: () => api<Paginado<Account>>('/accounts', { params: filtros }),
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
        eyebrow="Proveedor"
        titulo="Cuentas"
        descripcion={
          esOperador
            ? 'Cuentas creadas en el proveedor. Se identifican por ID; las credenciales las administra cada empresa revendedora.'
            : 'Sus cuentas en el proveedor, con la ocupación de dispositivos de cada una.'
        }
        acciones={
          <ExportCsvButton onExportar={() => descargarCsv('/accounts', filtros, 'cuentas')} />
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <Input
            placeholder="Buscar por ID de proveedor, usuario o correo…"
            defaultValue={busqueda}
            onKeyDown={(evento) => {
              if (evento.key === 'Enter') actualizar('q', evento.currentTarget.value.trim());
            }}
            className="max-w-xs"
            aria-label="Buscar cuentas"
          />
          <Select
            value={estado}
            onChange={(valor) => actualizar('status', valor)}
            className="max-w-40"
            opciones={[
              { value: 'todas', label: 'Todos los estados' },
              ...Object.entries(accountStatusLabels).map(([value, label]) => ({ value, label })),
            ]}
          />
        </div>

        <Table>
          <THead>
            <TR>
              <TH>ID en proveedor</TH>
              <TH>Ocupación</TH>
              <TH>Tipo</TH>
              <TH>Estado</TH>
              {esOperador ? <TH>Empresa</TH> : <TH>Correo de contacto</TH>}
              <TH align="right">Alta</TH>
            </TR>
          </THead>

          {isLoading ? (
            <TableSkeleton columnas={6} />
          ) : (
            <TBody>
              {data?.data.map((cuenta) => (
                <TR key={cuenta.id}>
                  <TD>
                    <div className="flex flex-col gap-0.5">
                      <Link
                        to={`/accounts/${cuenta.id}`}
                        className="id-tecnico font-medium text-azure-600 hover:underline dark:text-azure-400"
                      >
                        {cuenta.proveedor_cuenta_id ?? 'Sin confirmar'}
                      </Link>
                      {!cuenta.proveedor_cuenta_id ? (
                        <span className="text-2xs text-warn">Pendiente de confirmación</span>
                      ) : null}
                    </div>
                  </TD>
                  <TD>
                    <CapacityMeter capacidad={cuenta.capacidad} />
                  </TD>
                  <TD>
                    <Badge tone={cuenta.es_exclusiva ? 'info' : 'neutral'}>
                      {cuenta.es_exclusiva ? 'Exclusiva' : 'Compartida'}
                    </Badge>
                  </TD>
                  <TD>
                    <AccountStatusBadge estado={cuenta.estado} />
                  </TD>
                  <TD>
                    {esOperador ? (
                      <CopyableId
                        valor={cuenta.empresa_revendedora_id.slice(0, 8)}
                        etiqueta="ID de empresa"
                      />
                    ) : (
                      <span className="text-sm texto-suave">{cuenta.email_contacto ?? '—'}</span>
                    )}
                  </TD>
                  <TD align="right">
                    <span className="text-sm texto-suave">{formatearFecha(cuenta.creado_en)}</span>
                  </TD>
                </TR>
              ))}
              {data && data.data.length === 0 ? (
                <TR>
                  <TD colSpan={6}>
                    <EmptyState
                      icono={<CreditCard className="size-8" />}
                      titulo="Todavía no hay cuentas"
                      descripcion={
                        esOperador
                          ? 'Las cuentas se crean solas cuando una empresa revendedora da de alta su primer cliente.'
                          : 'Dé de alta su primer cliente y el sistema va a crear la cuenta en el proveedor automáticamente.'
                      }
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
    </>
  );
};
