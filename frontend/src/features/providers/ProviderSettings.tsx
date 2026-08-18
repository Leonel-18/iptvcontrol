import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Radio } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import type { LicenseReport, Provider, ServiceCatalogItem } from '@/lib/types';
import { formatearFechaHora, formatearNumero } from '@/lib/utils';
import { PageHeader } from '@/components/common';
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
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';

/**
 * Proveedores — `/providers`.
 *
 * Hoy hay un solo registro (SENSA). La sección existe desde el MVP porque el
 * sistema se diseñó con el conector desacoplado: sumar otro proveedor de
 * contenido tiene que ser agregar un adapter y una fila, no rehacer el modelo.
 */
export const ProviderSettings = () => {
  const queryClient = useQueryClient();

  const proveedores = useQuery({
    queryKey: ['providers'],
    queryFn: () => api<Provider[]>('/providers'),
  });

  const catalogo = useQuery({
    queryKey: ['providers-catalog'],
    queryFn: () => api<ServiceCatalogItem[]>('/providers/services-catalog'),
    staleTime: Infinity,
  });

  const licencias = useQuery({
    queryKey: ['providers-licenses'],
    queryFn: () => api<LicenseReport>('/providers/licenses'),
    retry: false,
  });

  const activar = useMutation({
    mutationFn: (id: string) => api(`/providers/${id}/activate`, { metodo: 'POST' }),
    onSuccess: () => {
      toast.success('Proveedor activo actualizado');
      void queryClient.invalidateQueries({ queryKey: ['providers'] });
    },
    onError: (causa: ApiError) => toast.error(causa.message),
  });

  return (
    <>
      <PageHeader
        eyebrow="Integración"
        titulo="Proveedores de contenido"
        descripcion="La plataforma sobre la que corre el servicio. El conector está desacoplado para poder sumar otros a futuro."
        acciones={
          <Button asChild variant="secondary" size="sm">
            <Link to="/settings">Configurar la conexión</Link>
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Proveedores registrados</CardTitle>
          </CardHeader>
          <CardContent>
            {proveedores.isLoading ? (
              <Skeleton className="h-20" />
            ) : (
              <ul className="divide-y divide-[rgb(var(--borde))]">
                {proveedores.data?.map((proveedor) => (
                  <li
                    key={proveedor.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 place-items-center rounded-lg border">
                        <Radio className="size-4 texto-suave" />
                      </span>
                      <div>
                        <p className="font-medium">{proveedor.nombre}</p>
                        <p className="font-mono text-2xs texto-suave">
                          conector: {proveedor.tipo_conector}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {proveedor.configurado ? (
                        <Badge tone="success">Configurado</Badge>
                      ) : (
                        <Badge tone="warning">Sin credenciales</Badge>
                      )}
                      {proveedor.activo ? (
                        <Badge tone="info">
                          <CheckCircle2 className="size-3" />
                          Activo
                        </Badge>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => activar.mutate(proveedor.id)}
                          disabled={activar.isPending}
                        >
                          Activar
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Paquetes de contenido</CardTitle>
          </CardHeader>
          <CardContent>
            {catalogo.isLoading ? (
              <Skeleton className="h-32" />
            ) : (
              <ul className="space-y-2">
                {catalogo.data?.map((servicio) => (
                  <li key={servicio.codigo} className="flex items-start gap-2">
                    <span className="id-tecnico mt-0.5 w-4 shrink-0 texto-suave">
                      {servicio.codigo}
                    </span>
                    <div>
                      <p className="text-sm">
                        {servicio.nombre}
                        {servicio.obligatorio ? (
                          <Badge tone="neutral" className="ml-2">
                            Obligatorio
                          </Badge>
                        ) : null}
                      </p>
                      {servicio.nota ? (
                        <p className="text-xs texto-suave">{servicio.nota}</p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Licencias contratadas</CardTitle>
        </CardHeader>
        <CardContent>
          {licencias.isLoading ? (
            <Skeleton className="h-24" />
          ) : !licencias.data?.disponible ? (
            <Alert tone="warning">
              {licencias.data?.motivo ??
                'No se pudieron consultar las licencias. Verifique la conexión con el proveedor.'}
            </Alert>
          ) : (
            <>
              <Table>
                <THead>
                  <TR>
                    <TH>Paquete</TH>
                    <TH align="right">Contratadas</TH>
                    <TH align="right">En uso</TH>
                    <TH align="right">Disponibles</TH>
                  </TR>
                </THead>
                <TBody>
                  {licencias.data.detalle?.map((item) => (
                    <TR key={item.codigo}>
                      <TD>{item.paquete}</TD>
                      <TD align="right">
                        <span className="tabular-nums">{formatearNumero(item.compradas)}</span>
                      </TD>
                      <TD align="right">
                        <span className="tabular-nums">{formatearNumero(item.usadas)}</span>
                      </TD>
                      <TD align="right">
                        <span
                          className={`tabular-nums ${item.disponibles <= 0 ? 'text-alert' : ''}`}
                        >
                          {formatearNumero(item.disponibles)}
                        </span>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
              <p className="mt-3 text-xs texto-suave">
                Consultado el {formatearFechaHora(licencias.data.consultado_en)}.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
};
