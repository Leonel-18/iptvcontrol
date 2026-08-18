import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Pencil } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { useSesion } from '@/lib/session';
import { formatearFecha, formatearImporte } from '@/lib/utils';
import type { CommercialPlan } from '@/lib/types';
import { commercialPlanTypeHelp, commercialPlanTypeLabels, traducir } from '@/i18n/entityLabels';
import { DetailRow, PageHeader } from '@/components/common';
import { CommercialPlanForm } from './CommercialPlanForm';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@/components/ui/primitives';

interface CommercialPlanDetailData extends CommercialPlan {
  empresas_revendedoras?: { id: string; razon_social: string }[];
}

/**
 * Detalle de una modalidad comercial — `/commercial-plans/:id`.
 *
 * Existe como ruta propia porque está en la tabla de rutas de
 * docs/IPTVControl_URL_Routing_Convention.md: así se puede compartir el enlace de
 * una modalidad puntual, por ejemplo al discutir un cambio de escala con una
 * Empresa Revendedora.
 */
export const CommercialPlanDetail = () => {
  const { id = '' } = useParams();
  const { esOperador } = useSesion();
  const [editando, setEditando] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['commercial-plan', id],
    queryFn: () => api<CommercialPlanDetailData>(`/commercial-plans/${id}`),
    enabled: Boolean(id),
  });

  if (isLoading) return <Skeleton className="h-64" />;

  if (error || !data) {
    return (
      <Alert tone="danger" titulo="No pudimos cargar la modalidad">
        {(error as Error)?.message ?? 'Verifique el enlace.'}
      </Alert>
    );
  }

  const vigente =
    new Date(data.vigente_desde) <= new Date() &&
    (!data.vigente_hasta || new Date(data.vigente_hasta) >= new Date());

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
        <Link to="/commercial-plans">
          <ArrowLeft />
          Volver a planes comerciales
        </Link>
      </Button>

      <PageHeader
        eyebrow={traducir(commercialPlanTypeLabels, data.tipo)}
        titulo={`Escala ${data.escala}`}
        descripcion={traducir(commercialPlanTypeHelp, data.tipo)}
        acciones={
          <>
            {vigente ? <Badge tone="success">Vigente</Badge> : <Badge tone="neutral">No vigente</Badge>}
            {esOperador ? (
              <Button variant="secondary" size="sm" onClick={() => setEditando(true)}>
                <Pencil />
                Editar
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Condiciones</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-[rgb(var(--borde))]">
              <DetailRow etiqueta="Modalidad">
                {traducir(commercialPlanTypeLabels, data.tipo)}
              </DetailRow>
              <DetailRow etiqueta="Escala">
                <span className="id-tecnico">{data.escala}</span>
              </DetailRow>
              <DetailRow etiqueta="Precio por cuenta">
                {formatearImporte(data.precio_por_cuenta)}
              </DetailRow>
              <DetailRow etiqueta="Incremento mensual">
                {data.ritmo_incremento ? `${data.ritmo_incremento} cuentas por mes` : '—'}
              </DetailRow>
              <DetailRow etiqueta="Tope de cuentas activas">
                {data.tope_cuentas_activas ?? 'Sin tope explícito'}
              </DetailRow>
              <DetailRow etiqueta="Vigencia">
                {formatearFecha(data.vigente_desde)}
                {data.vigente_hasta ? ` → ${formatearFecha(data.vigente_hasta)}` : ' → sin fin'}
              </DetailRow>
            </dl>

            {data.tipo === 'obligacion_mensual' ? (
              <Alert tone="info" className="mt-4">
                El compromiso es acumulativo. Las cuentas comprometidas se facturan se usen o no, y
                las no usadas quedan disponibles para el mes siguiente.
              </Alert>
            ) : null}
          </CardContent>
        </Card>

        {esOperador ? (
          <Card>
            <CardHeader>
              <CardTitle>Empresas con esta modalidad</CardTitle>
            </CardHeader>
            <CardContent>
              {data.empresas_revendedoras && data.empresas_revendedoras.length > 0 ? (
                <ul className="divide-y divide-[rgb(var(--borde))]">
                  {data.empresas_revendedoras.map((empresa) => (
                    <li key={empresa.id} className="py-2">
                      <Link
                        to={`/resellers/${empresa.id}`}
                        className="text-sm text-azure-600 hover:underline dark:text-azure-400"
                      >
                        {empresa.razon_social}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm texto-suave">
                  Todavía no hay empresas revendedoras con esta modalidad asignada.
                </p>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>

      {editando ? (
        <CommercialPlanForm
          abierto={editando}
          onCambio={(abierto) => !abierto && setEditando(false)}
          plan={data}
        />
      ) : null}
    </>
  );
};
