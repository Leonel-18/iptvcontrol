import { useQuery } from '@tanstack/react-query';
import { FileBarChart, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Paginado } from '@/lib/api';
import { useSesion } from '@/lib/session';
import { formatearFecha, formatearImporte, formatearNumero } from '@/lib/utils';
import type { CommercialPlan, MyPricing } from '@/lib/types';
import { commercialPlanTypeHelp, commercialPlanTypeLabels, traducir } from '@/i18n/entityLabels';
import { Metric, PageHeader } from '@/components/common';
import { CommercialPlanForm } from './CommercialPlanForm';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Skeleton,
} from '@/components/ui/primitives';
import { Table, TableSkeleton, TBody, TD, TH, THead, TR } from '@/components/ui/table';

/**
 * Modalidades comerciales — `/commercial-plans`.
 *
 * El Operador Principal las administra; la Empresa Revendedora entra a la misma
 * ruta y ve sus precios vigentes, que es lo único que le corresponde
 * (regla de negocio 1.3). Los precios que ella le cobra a su cliente final no
 * pasan por IPTVControl.
 */
export const CommercialPlanList = () => {
  const { esOperador } = useSesion();
  const [alta, setAlta] = useState(false);
  const [editando, setEditando] = useState<CommercialPlan | null>(null);

  const planes = useQuery({
    queryKey: ['commercial-plans'],
    queryFn: () => api<Paginado<CommercialPlan>>('/commercial-plans', { params: { per_page: 100 } }),
    enabled: esOperador,
  });

  const misPrecios = useQuery({
    queryKey: ['my-pricing'],
    queryFn: () => api<MyPricing>('/commercial-plans/my-pricing'),
    enabled: !esOperador,
  });

  // -------------------------------------------------------------------------
  // Vista de la Empresa Revendedora: sus precios vigentes
  // -------------------------------------------------------------------------
  if (!esOperador) {
    if (misPrecios.isLoading) return <Skeleton className="h-48" />;

    const datos = misPrecios.data;

    return (
      <>
        <PageHeader
          eyebrow="Condiciones"
          titulo="Sus precios vigentes"
          descripcion="Lo que le factura el operador principal por cada cuenta."
        />

        {!datos?.modalidad ? (
          <Alert tone="warning" titulo="Todavía no tiene modalidad asignada">
            {datos?.mensaje ?? 'Comuníquese con el operador principal.'}
          </Alert>
        ) : (
          <div className="space-y-4">
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric
                etiqueta="Precio por cuenta"
                valor={formatearImporte(datos.modalidad.precio_por_cuenta)}
                tono="azure"
              />
              <Metric
                etiqueta="Cuentas activas"
                valor={formatearNumero(datos.cuentas_activas)}
                detalle="En el proveedor"
              />
              <Metric
                etiqueta="Cuentas facturables"
                valor={formatearNumero(datos.cuentas_facturables)}
                detalle={
                  datos.compromiso_del_mes
                    ? `Compromiso del mes: ${datos.compromiso_del_mes}`
                    : 'Sólo las utilizadas'
                }
              />
              <Metric
                etiqueta="Importe estimado"
                valor={formatearImporte(datos.importe_estimado)}
                detalle="Referencia, no es una factura"
              />
            </section>

            <Card>
              <CardHeader>
                <CardTitle>
                  {traducir(commercialPlanTypeLabels, datos.modalidad.tipo)} ·{' '}
                  {datos.modalidad.escala}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm texto-suave">
                  {traducir(commercialPlanTypeHelp, datos.modalidad.tipo)}
                </p>
                {datos.nota ? <Alert tone="info">{datos.nota}</Alert> : null}
                <p className="text-xs texto-suave">
                  Vigente desde {formatearFecha(datos.modalidad.vigente_desde)}
                  {datos.modalidad.vigente_hasta
                    ? ` hasta ${formatearFecha(datos.modalidad.vigente_hasta)}`
                    : ''}
                  . La modalidad y la escala las define el operador principal.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </>
    );
  }

  // -------------------------------------------------------------------------
  // Vista del Operador Principal: administración de modalidades
  // -------------------------------------------------------------------------
  return (
    <>
      <PageHeader
        eyebrow="Parametrización"
        titulo="Planes comerciales"
        descripcion="Modalidades, escalas y precios por cuenta. Cada cambio de precio queda auditado."
        acciones={
          <Button variant="primary" size="sm" onClick={() => setAlta(true)}>
            <Plus />
            Nueva modalidad
          </Button>
        }
      />

      <Card>
        <Table>
          <THead>
            <TR>
              <TH>Modalidad</TH>
              <TH>Escala</TH>
              <TH>Precio por cuenta</TH>
              <TH>Incremento</TH>
              <TH>Vigencia</TH>
              <TH align="right">Empresas</TH>
              <TH align="right" />
            </TR>
          </THead>

          {planes.isLoading ? (
            <TableSkeleton columnas={7} />
          ) : (
            <TBody>
              {planes.data?.data.map((plan) => {
                const vigente =
                  new Date(plan.vigente_desde) <= new Date() &&
                  (!plan.vigente_hasta || new Date(plan.vigente_hasta) >= new Date());

                return (
                  <TR key={plan.id}>
                    <TD>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {traducir(commercialPlanTypeLabels, plan.tipo)}
                        </span>
                        {vigente ? <Badge tone="success">Vigente</Badge> : null}
                      </div>
                    </TD>
                    <TD>
                      <Link
                        to={`/commercial-plans/${plan.id}`}
                        className="id-tecnico text-azure-600 hover:underline dark:text-azure-400"
                      >
                        {plan.escala}
                      </Link>
                    </TD>
                    <TD>
                      <span className="tabular-nums">
                        {formatearImporte(plan.precio_por_cuenta)}
                      </span>
                    </TD>
                    <TD>
                      <span className="text-sm texto-suave">
                        {plan.ritmo_incremento ? `+${plan.ritmo_incremento} por mes` : '—'}
                      </span>
                    </TD>
                    <TD>
                      <span className="text-xs texto-suave">
                        {formatearFecha(plan.vigente_desde)}
                        {plan.vigente_hasta ? ` → ${formatearFecha(plan.vigente_hasta)}` : ''}
                      </span>
                    </TD>
                    <TD align="right">
                      <span className="tabular-nums">{plan.cantidad_empresas ?? 0}</span>
                    </TD>
                    <TD align="right">
                      <Button variant="ghost" size="sm" onClick={() => setEditando(plan)}>
                        Editar
                      </Button>
                    </TD>
                  </TR>
                );
              })}

              {planes.data && planes.data.data.length === 0 ? (
                <TR>
                  <TD colSpan={7}>
                    <EmptyState
                      icono={<FileBarChart className="size-8" />}
                      titulo="No hay modalidades cargadas"
                      descripcion="Cree la primera para poder asignarla a una empresa revendedora."
                      accion={
                        <Button variant="primary" size="sm" onClick={() => setAlta(true)}>
                          Crear modalidad
                        </Button>
                      }
                    />
                  </TD>
                </TR>
              ) : null}
            </TBody>
          )}
        </Table>
      </Card>

      {alta ? <CommercialPlanForm abierto={alta} onCambio={setAlta} /> : null}
      {editando ? (
        <CommercialPlanForm
          abierto={Boolean(editando)}
          onCambio={(abierto) => !abierto && setEditando(null)}
          plan={editando}
        />
      ) : null}
    </>
  );
};
