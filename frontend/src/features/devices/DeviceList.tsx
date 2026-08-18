import { useQuery } from '@tanstack/react-query';
import { MonitorPlay } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, descargarCsv, type Paginado } from '@/lib/api';
import { useSesion } from '@/lib/session';
import { formatearFecha, formatearMac } from '@/lib/utils';
import type { AccountDevice } from '@/lib/types';
import { deviceStatusLabels, deviceTypeLabels } from '@/i18n/entityLabels';
import {
  CopyableId,
  DeviceStatusBadge,
  DeviceTypeBadge,
  ExportCsvButton,
  PageHeader,
} from '@/components/common';
import { Alert, Card, EmptyState, Input } from '@/components/ui/primitives';
import { Select } from '@/components/ui/overlays';
import { Paginacion, Table, TableSkeleton, TBody, TD, TH, THead, TR } from '@/components/ui/table';

/**
 * Listado de Dispositivos — `/devices`.
 *
 * La jerarquía Cuenta → Dispositivo se resuelve por query param
 * (`?account_id=`, `?customer_id=`) y no anidando rutas: un dispositivo puede
 * migrar de cuenta, y con URLs profundas los enlaces guardados se romperían
 * (convención de rutas, sección 1.2).
 */
export const DeviceList = () => {
  const { esOperador } = useSesion();
  const [params, setParams] = useSearchParams();

  const pagina = Number(params.get('page') ?? 1);
  const estado = params.get('status') ?? '';
  const tipo = params.get('type') ?? '';
  const busqueda = params.get('q') ?? '';
  const accountId = params.get('account_id') ?? '';
  const customerId = params.get('customer_id') ?? '';

  const filtros = {
    page: pagina,
    per_page: 25,
    status: estado || undefined,
    type: tipo || undefined,
    q: busqueda || undefined,
    account_id: accountId || undefined,
    customer_id: customerId || undefined,
  };

  const { data, isLoading } = useQuery({
    queryKey: ['devices', filtros],
    queryFn: () => api<Paginado<AccountDevice>>('/devices', { params: filtros }),
  });

  const actualizar = (clave: string, valor: string) => {
    const siguiente = new URLSearchParams(params);
    if (valor) siguiente.set(clave, valor);
    else siguiente.delete(clave);
    if (clave !== 'page') siguiente.delete('page');
    setParams(siguiente);
  };

  const soloDisponibles = estado === 'disponible';

  return (
    <>
      <PageHeader
        eyebrow="Parque instalado"
        titulo="Dispositivos"
        descripcion="Cada dispositivo ocupa un lugar en una cuenta. Los liberados por una baja se pueden reasignar."
        acciones={
          <ExportCsvButton
            onExportar={() => descargarCsv('/devices', filtros, 'dispositivos')}
          />
        }
      />

      {soloDisponibles ? (
        <Alert tone="info" className="mb-4" titulo="Dispositivos liberados">
          Estos dispositivos quedaron libres por una baja definitiva. Al reasignarlos, el cliente
          nuevo recibe las mismas credenciales de esa cuenta.
        </Alert>
      ) : null}

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <Input
            placeholder="Buscar por ID de proveedor, MAC o nota…"
            defaultValue={busqueda}
            onKeyDown={(evento) => {
              if (evento.key === 'Enter') actualizar('q', evento.currentTarget.value.trim());
            }}
            className="max-w-xs"
            aria-label="Buscar dispositivos"
          />
          <Select
            value={estado || 'todos'}
            onChange={(valor) => actualizar('status', valor === 'todos' ? '' : valor)}
            className="max-w-44"
            opciones={[
              { value: 'todos', label: 'Todos los estados' },
              ...Object.entries(deviceStatusLabels).map(([value, label]) => ({ value, label })),
            ]}
          />
          <Select
            value={tipo || 'todos'}
            onChange={(valor) => actualizar('type', valor === 'todos' ? '' : valor)}
            className="max-w-36"
            opciones={[
              { value: 'todos', label: 'Fijos y móviles' },
              ...Object.entries(deviceTypeLabels).map(([value, label]) => ({ value, label })),
            ]}
          />
        </div>

        <Table>
          <THead>
            <TR>
              <TH>ID en proveedor</TH>
              <TH>Cuenta</TH>
              <TH>Tipo</TH>
              <TH>Estado</TH>
              {!esOperador ? <TH>Cliente</TH> : null}
              {!esOperador ? <TH>Equipo</TH> : null}
              <TH align="right">Alta</TH>
            </TR>
          </THead>

          {isLoading ? (
            <TableSkeleton columnas={esOperador ? 5 : 7} />
          ) : (
            <TBody>
              {data?.data.map((dispositivo) => (
                <TR key={dispositivo.id}>
                  <TD>
                    <Link
                      to={`/devices/${dispositivo.id}`}
                      className="id-tecnico font-medium text-azure-600 hover:underline dark:text-azure-400"
                    >
                      {dispositivo.proveedor_device_id ?? 'Pendiente'}
                    </Link>
                  </TD>
                  <TD>
                    <Link
                      to={`/accounts/${dispositivo.cuenta_id}`}
                      className="id-tecnico texto-suave hover:underline"
                    >
                      {dispositivo.proveedor_cuenta_id ?? dispositivo.cuenta_id.slice(0, 8)}
                    </Link>
                  </TD>
                  <TD>
                    <DeviceTypeBadge tipo={dispositivo.tipo} />
                  </TD>
                  <TD>
                    <DeviceStatusBadge estado={dispositivo.estado} />
                  </TD>
                  {!esOperador ? (
                    <TD>
                      {dispositivo.cliente_final ? (
                        <Link
                          to={`/customers/${dispositivo.cliente_final.id}`}
                          className="text-sm text-azure-600 hover:underline dark:text-azure-400"
                        >
                          {dispositivo.cliente_final.nombre}
                        </Link>
                      ) : (
                        <span className="text-sm texto-suave">Sin cliente</span>
                      )}
                    </TD>
                  ) : null}
                  {!esOperador ? (
                    <TD>
                      <div className="flex flex-col gap-0.5">
                        {dispositivo.mac ? (
                          <CopyableId valor={formatearMac(dispositivo.mac)} etiqueta="MAC" />
                        ) : null}
                        {dispositivo.nota_descriptiva ? (
                          <span className="text-xs texto-suave">
                            {dispositivo.nota_descriptiva}
                          </span>
                        ) : null}
                        {!dispositivo.mac && !dispositivo.nota_descriptiva ? (
                          <span className="texto-suave">—</span>
                        ) : null}
                      </div>
                    </TD>
                  ) : null}
                  <TD align="right">
                    <span className="text-sm texto-suave">
                      {formatearFecha(dispositivo.creado_en)}
                    </span>
                  </TD>
                </TR>
              ))}

              {data && data.data.length === 0 ? (
                <TR>
                  <TD colSpan={esOperador ? 5 : 7}>
                    <EmptyState
                      icono={<MonitorPlay className="size-8" />}
                      titulo="No hay dispositivos con esos filtros"
                      descripcion="Pruebe quitando filtros. Los dispositivos se crean al dar de alta clientes."
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
