import { useQuery } from '@tanstack/react-query';
import { UserPlus, Users } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, descargarCsv, type Paginado } from '@/lib/api';
import { useSesion } from '@/lib/session';
import { formatearFecha } from '@/lib/utils';
import type { Customer, CustomerOperatorView } from '@/lib/types';
import { customerIntakeLabels, customerStatusLabels, traducir } from '@/i18n/entityLabels';
import {
  CopyableId,
  CustomerStatusBadge,
  ExportCsvButton,
  PageHeader,
} from '@/components/common';
import { Button, Card, EmptyState, Input } from '@/components/ui/primitives';
import { Select } from '@/components/ui/overlays';
import { Paginacion, Table, TableSkeleton, TBody, TD, TH, THead, TR } from '@/components/ui/table';

/**
 * Listado de Clientes Finales — `/customers`.
 *
 * Para el Operador Principal la misma ruta devuelve la vista por ID: número de
 * cliente, estado y dispositivos, sin nombre ni datos de contacto (regla 4.2).
 * Por eso la tabla se arma en dos variantes según el rol.
 */
export const CustomerList = () => {
  const { esOperador } = useSesion();
  const [params, setParams] = useSearchParams();

  const pagina = Number(params.get('page') ?? 1);
  const estado = params.get('status') ?? '';
  const busqueda = params.get('q') ?? '';
  const accountId = params.get('account_id') ?? '';

  const filtros = {
    page: pagina,
    per_page: 25,
    status: estado || undefined,
    q: busqueda || undefined,
    account_id: accountId || undefined,
  };

  const { data, isLoading } = useQuery({
    queryKey: ['customers', filtros],
    queryFn: () => api<Paginado<Customer | CustomerOperatorView>>('/customers', { params: filtros }),
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
        eyebrow="Cartera"
        titulo="Clientes finales"
        descripcion={
          esOperador
            ? 'Se listan por número de cliente y estado. Los datos de contacto los administra cada empresa revendedora.'
            : 'Sus clientes, con el estado de su servicio y la cantidad de dispositivos.'
        }
        acciones={
          <>
            <ExportCsvButton
              onExportar={() => descargarCsv('/customers', filtros, 'clientes-finales')}
            />
            {!esOperador ? (
              <Button asChild variant="primary" size="sm">
                <Link to="/customers/new">
                  <UserPlus />
                  Nuevo cliente
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          {!esOperador ? (
            <Input
              placeholder="Buscar por nombre, correo, teléfono o ID de gestión…"
              defaultValue={busqueda}
              onKeyDown={(evento) => {
                if (evento.key === 'Enter') actualizar('q', evento.currentTarget.value.trim());
              }}
              className="max-w-sm"
              aria-label="Buscar clientes"
            />
          ) : null}
          <Select
            value={estado || 'todos'}
            onChange={(valor) => actualizar('status', valor === 'todos' ? '' : valor)}
            className="max-w-44"
            opciones={[
              { value: 'todos', label: 'Todos los estados' },
              ...Object.entries(customerStatusLabels).map(([value, label]) => ({ value, label })),
            ]}
          />
        </div>

        <Table>
          <THead>
            <TR>
              <TH>N° cliente</TH>
              {!esOperador ? <TH>Cliente</TH> : null}
              {!esOperador ? <TH>ID de gestión</TH> : null}
              <TH>Estado</TH>
              <TH>Método de alta</TH>
              <TH align="right">Dispositivos</TH>
              <TH align="right">Alta</TH>
            </TR>
          </THead>

          {isLoading ? (
            <TableSkeleton columnas={esOperador ? 5 : 7} />
          ) : (
            <TBody>
              {data?.data.map((cliente) => {
                const completo = 'nombre_completo' in cliente ? cliente : null;
                const dispositivos =
                  'cantidad_dispositivos' in cliente
                    ? cliente.cantidad_dispositivos
                    : cliente.dispositivos.filter(
                        (dispositivo) =>
                          dispositivo.estado === 'activo' ||
                          dispositivo.estado === 'bloqueado_por_suspension',
                      ).length;

                return (
                  <TR key={cliente.id}>
                    <TD>
                      <Link
                        to={`/customers/${cliente.id}`}
                        className="id-tecnico font-medium text-azure-600 hover:underline dark:text-azure-400"
                      >
                        {cliente.numero_cliente}
                      </Link>
                    </TD>
                    {!esOperador ? (
                      <TD>
                        <Link to={`/customers/${cliente.id}`} className="text-sm hover:underline">
                          {completo?.nombre_completo ?? '—'}
                        </Link>
                      </TD>
                    ) : null}
                    {!esOperador ? (
                      <TD>
                        {completo?.id_gestion_externo ? (
                          <CopyableId
                            valor={completo.id_gestion_externo}
                            etiqueta="ID de gestión"
                          />
                        ) : (
                          <span className="texto-suave">—</span>
                        )}
                      </TD>
                    ) : null}
                    <TD>
                      <CustomerStatusBadge estado={cliente.estado} />
                    </TD>
                    <TD>
                      <span className="text-sm texto-suave">
                        {traducir(customerIntakeLabels, cliente.tipo_alta)}
                      </span>
                    </TD>
                    <TD align="right">
                      <span className="tabular-nums">{dispositivos}</span>
                    </TD>
                    <TD align="right">
                      <span className="text-sm texto-suave">
                        {formatearFecha(cliente.creado_en)}
                      </span>
                    </TD>
                  </TR>
                );
              })}

              {data && data.data.length === 0 ? (
                <TR>
                  <TD colSpan={esOperador ? 5 : 7}>
                    <EmptyState
                      icono={<Users className="size-8" />}
                      titulo="Todavía no hay clientes"
                      descripcion={
                        esOperador
                          ? 'Cuando las empresas revendedoras empiecen a dar de alta clientes, van a aparecer acá.'
                          : 'Dé de alta su primer cliente final: el asistente se encarga de buscar o crear la cuenta.'
                      }
                      accion={
                        !esOperador ? (
                          <Button asChild variant="primary" size="sm">
                            <Link to="/customers/new">Dar de alta un cliente</Link>
                          </Button>
                        ) : undefined
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
