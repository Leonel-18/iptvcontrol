import { useQuery } from '@tanstack/react-query';
import { Building2, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, descargarCsv, type Paginado } from '@/lib/api';
import { formatearImporte } from '@/lib/utils';
import type { Reseller } from '@/lib/types';
import { commercialPlanTypeLabels, resellerStatusLabels, traducir } from '@/i18n/entityLabels';
import {
  CopyableId,
  ExportCsvButton,
  PageHeader,
  ResellerStatusBadge,
} from '@/components/common';
import { ResellerForm } from './ResellerForm';
import { Button, Card, EmptyState, Input } from '@/components/ui/primitives';
import { Select } from '@/components/ui/overlays';
import { Paginacion, Table, TableSkeleton, TBody, TD, TH, THead, TR } from '@/components/ui/table';

/**
 * Empresas Revendedoras — `/resellers`.
 * Sección exclusiva del Operador Principal.
 */
export const ResellerList = () => {
  const [params, setParams] = useSearchParams();
  const [alta, setAlta] = useState(false);

  const pagina = Number(params.get('page') ?? 1);
  const estado = params.get('status') ?? '';
  const busqueda = params.get('q') ?? '';

  const filtros = {
    page: pagina,
    per_page: 25,
    status: estado || undefined,
    q: busqueda || undefined,
  };

  const { data, isLoading } = useQuery({
    queryKey: ['resellers', filtros],
    queryFn: () => api<Paginado<Reseller>>('/resellers', { params: filtros }),
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
        eyebrow="Red de reventa"
        titulo="Empresas revendedoras"
        descripcion="Cada empresa opera con su propio panel y no ve datos de las demás."
        acciones={
          <>
            <ExportCsvButton
              onExportar={() => descargarCsv('/resellers', filtros, 'empresas-revendedoras')}
            />
            <Button variant="primary" size="sm" onClick={() => setAlta(true)}>
              <Plus />
              Nueva empresa
            </Button>
          </>
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <Input
            placeholder="Buscar por razón social, CUIT o correo…"
            defaultValue={busqueda}
            onKeyDown={(evento) => {
              if (evento.key === 'Enter') actualizar('q', evento.currentTarget.value.trim());
            }}
            className="max-w-sm"
            aria-label="Buscar empresas revendedoras"
          />
          <Select
            value={estado || 'todas'}
            onChange={(valor) => actualizar('status', valor === 'todas' ? '' : valor)}
            className="max-w-40"
            opciones={[
              { value: 'todas', label: 'Todos los estados' },
              ...Object.entries(resellerStatusLabels).map(([value, label]) => ({ value, label })),
            ]}
          />
        </div>

        <Table>
          <THead>
            <TR>
              <TH>Razón social</TH>
              <TH>CUIT</TH>
              <TH>Modalidad</TH>
              <TH>Precio por cuenta</TH>
              <TH>Estado</TH>
              <TH align="right">Cuentas</TH>
              <TH align="right">Clientes</TH>
            </TR>
          </THead>

          {isLoading ? (
            <TableSkeleton columnas={7} />
          ) : (
            <TBody>
              {data?.data.map((empresa) => (
                <TR key={empresa.id}>
                  <TD>
                    <div className="flex flex-col gap-0.5">
                      <Link
                        to={`/resellers/${empresa.id}`}
                        className="font-medium text-azure-600 hover:underline dark:text-azure-400"
                      >
                        {empresa.razon_social}
                      </Link>
                      <span className="text-xs texto-suave">{empresa.email_contacto}</span>
                    </div>
                  </TD>
                  <TD>
                    <CopyableId valor={empresa.cuit} etiqueta="CUIT" />
                  </TD>
                  <TD>
                    <span className="text-sm">
                      {empresa.modalidad_comercial
                        ? `${traducir(commercialPlanTypeLabels, empresa.modalidad_comercial.tipo)} · ${empresa.modalidad_comercial.escala}`
                        : 'Sin asignar'}
                    </span>
                  </TD>
                  <TD>
                    <span className="tabular-nums">
                      {formatearImporte(empresa.modalidad_comercial?.precio_por_cuenta)}
                    </span>
                  </TD>
                  <TD>
                    <ResellerStatusBadge estado={empresa.estado} />
                  </TD>
                  <TD align="right">
                    <span className="tabular-nums">{empresa.cantidad_cuentas}</span>
                  </TD>
                  <TD align="right">
                    <span className="tabular-nums">{empresa.cantidad_clientes}</span>
                  </TD>
                </TR>
              ))}

              {data && data.data.length === 0 ? (
                <TR>
                  <TD colSpan={7}>
                    <EmptyState
                      icono={<Building2 className="size-8" />}
                      titulo="Todavía no hay empresas revendedoras"
                      descripcion="Dé de alta la primera: el sistema le envía la invitación de acceso a su correo de contacto."
                      accion={
                        <Button variant="primary" size="sm" onClick={() => setAlta(true)}>
                          Dar de alta una empresa
                        </Button>
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

      {alta ? <ResellerForm abierto={alta} onCambio={setAlta} /> : null}
    </>
  );
};
