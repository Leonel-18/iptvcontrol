import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  Building2,
  CreditCard,
  MonitorPlay,
  RefreshCw,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useSesion } from '@/lib/session';
import { formatearImporte, formatearNumero, tiempoRelativo } from '@/lib/utils';
import type { Dashboard as DashboardData, IntegrationHealth } from '@/lib/types';
import { commercialPlanTypeLabels, traducir } from '@/i18n/entityLabels';
import { HealthBadge, Metric, PageHeader } from '@/components/common';
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@/components/ui/primitives';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';

/**
 * Dashboard — `/dashboard`.
 *
 * Un solo componente para los dos paneles, porque la ruta es la misma y el
 * backend ya devuelve lo que corresponde según el token. Lo que cambia es qué
 * necesita ver cada uno:
 *  - Operador Principal: cuentas vendidas / disponibles / bloqueadas + salud de
 *    la integración con el proveedor.
 *  - Empresa Revendedora: sus números y, sobre todo, el aviso de cuentas cerca
 *    del tope, que es lo que le anticipa que el próximo alta le va a costar una
 *    cuenta nueva.
 */
export const Dashboard = () => {
  const { sesion, esOperador } = useSesion();

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api<DashboardData>('/dashboard'),
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <>
        <PageHeader eyebrow="Inicio" titulo="Panel" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <PageHeader eyebrow="Inicio" titulo="Panel" />
        <Alert tone="danger" titulo="No pudimos cargar el panel">
          {(error as Error)?.message ?? 'Intente nuevamente en unos minutos.'}
        </Alert>
      </>
    );
  }

  const saludo = esOperador
    ? (sesion?.operador_principal?.nombre ?? 'Operador Principal')
    : (sesion?.empresa_revendedora?.razon_social ?? 'Su empresa');

  return (
    <>
      <PageHeader
        eyebrow={esOperador ? 'Panel del operador' : 'Panel de la empresa'}
        titulo={saludo}
        descripcion={
          esOperador
            ? 'Estado general de las cuentas vendidas y de la integración con el proveedor.'
            : 'Sus cuentas, clientes y dispositivos, y los avisos de capacidad.'
        }
      />

      {data.rol === 'operator' ? <PanelOperador data={data} /> : <PanelRevendedora data={data} />}
    </>
  );
};

// -----------------------------------------------------------------------------
// Panel del Operador Principal
// -----------------------------------------------------------------------------

const PanelOperador = ({ data }: { data: Extract<DashboardData, { rol: 'operator' }> }) => (
  <div className="space-y-5">
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric
        etiqueta="Cuentas vendidas"
        valor={formatearNumero(data.cuentas.vendidas)}
        detalle="Con al menos un dispositivo ocupando lugar"
        tono="azure"
        icono={<CreditCard className="size-4" />}
      />
      <Metric
        etiqueta="Cuentas disponibles"
        valor={formatearNumero(data.cuentas.disponibles)}
        detalle="Con capacidad libre para un alta"
        tono="signal"
      />
      <Metric
        etiqueta="Cuentas bloqueadas"
        valor={formatearNumero(data.cuentas.bloqueadas)}
        detalle="Con dispositivos reservados por suspensión"
        tono="warn"
      />
      <Metric
        etiqueta="Total de cuentas activas"
        valor={formatearNumero(data.cuentas.total)}
        detalle="En el proveedor"
      />
    </section>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric
        etiqueta="Empresas revendedoras"
        valor={formatearNumero(data.empresas_revendedoras.activas)}
        detalle={`${data.empresas_revendedoras.suspendidas} suspendidas`}
        icono={<Building2 className="size-4" />}
      />
      <Metric
        etiqueta="Clientes finales activos"
        valor={formatearNumero(data.clientes_finales.activos)}
        detalle={`${data.clientes_finales.suspendidos} suspendidos · ${data.clientes_finales.dados_de_baja} de baja`}
        icono={<Users className="size-4" />}
      />
      <Metric
        etiqueta="Dispositivos activos"
        valor={formatearNumero(data.dispositivos.activos)}
        icono={<MonitorPlay className="size-4" />}
      />
      <Metric
        etiqueta="Dispositivos liberados"
        valor={formatearNumero(data.dispositivos.disponibles)}
        detalle={`${data.dispositivos.bloqueados} bloqueados por suspensión`}
      />
    </section>

    <IntegrationHealthPanel salud={data.salud_integracion} />
  </div>
);

/**
 * Panel de salud de la integración con el proveedor.
 *
 * Existe para enterarse de un problema antes de que una Empresa Revendedora
 * llame a reportar el síntoma: si la API de SENSA empieza a fallar, acá se ve
 * primero.
 */
const IntegrationHealthPanel = ({ salud }: { salud: IntegrationHealth }) => {
  const queryClient = useQueryClient();

  const reintentar = useMutation({
    mutationFn: () =>
      api<{ reintentados: number }>('/dashboard/integration-health/retry-failed', {
        metodo: 'POST',
      }),
    onSuccess: (resultado) => {
      toast.success(
        resultado.reintentados > 0
          ? `${resultado.reintentados} operaciones reencoladas`
          : 'No había operaciones fallidas para reintentar',
      );
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (causa: Error) => toast.error(causa.message),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Activity className="size-4 texto-suave" />
          <CardTitle>Integración con el proveedor</CardTitle>
          <HealthBadge estado={salud.estado_general} />
        </div>
        {salud.cola_reintentos.fallidos > 0 ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => reintentar.mutate()}
            disabled={reintentar.isPending}
          >
            <RefreshCw />
            Reintentar pendientes
          </Button>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <p className="eyebrow">Llamadas exitosas</p>
            <p className="mt-1 font-display text-lg font-bold tabular-nums text-signal">
              {formatearNumero(salud.llamadas_exitosas)}
            </p>
            <p className="text-2xs texto-suave">{salud.ventana}</p>
          </div>
          <div>
            <p className="eyebrow">Llamadas fallidas</p>
            <p
              className={`mt-1 font-display text-lg font-bold tabular-nums ${
                salud.llamadas_fallidas > 0 ? 'text-alert' : ''
              }`}
            >
              {formatearNumero(salud.llamadas_fallidas)}
            </p>
            <p className="text-2xs texto-suave">
              {salud.tasa_exito !== null ? `${salud.tasa_exito}% de éxito` : 'Sin llamadas aún'}
            </p>
          </div>
          <div>
            <p className="eyebrow">Cola de reintentos</p>
            <p className="mt-1 font-display text-lg font-bold tabular-nums">
              {formatearNumero(
                salud.cola_reintentos.pendientes +
                  salud.cola_reintentos.activos +
                  salud.cola_reintentos.demorados,
              )}
            </p>
            <p className="text-2xs texto-suave">
              {salud.cola_reintentos.disponible
                ? `${salud.cola_reintentos.fallidos} fallidos`
                : 'Cola no disponible'}
            </p>
          </div>
          <div>
            <p className="eyebrow">Última llamada exitosa</p>
            <p className="mt-1 text-sm">
              {salud.ultima_exitosa ? tiempoRelativo(salud.ultima_exitosa.fecha) : '—'}
            </p>
            <p className="font-mono text-2xs texto-suave">
              {salud.ultima_exitosa
                ? `${salud.ultima_exitosa.operacion} · ${salud.ultima_exitosa.duracion_ms} ms`
                : 'Sin registros'}
            </p>
          </div>
        </div>

        {!salud.cola_reintentos.disponible ? (
          <Alert tone="warning" titulo="No se pudo consultar la cola de reintentos">
            Verifique que el servicio de colas (Redis) esté funcionando: sin él, las operaciones que
            fallen contra el proveedor no se reintentan solas.
          </Alert>
        ) : null}

        {salud.ultimas_fallidas.length > 0 ? (
          <div className="rounded-lg border">
            <div className="flex items-center gap-2 border-b px-4 py-2.5">
              <ShieldAlert className="size-4 text-alert" />
              <p className="text-sm font-medium">Últimas llamadas fallidas</p>
            </div>
            <Table>
              <THead>
                <TR>
                  <TH>Operación</TH>
                  <TH>Código</TH>
                  <TH>Detalle</TH>
                  <TH align="right">Cuándo</TH>
                </TR>
              </THead>
              <TBody>
                {salud.ultimas_fallidas.map((llamada, indice) => (
                  <TR key={`${llamada.operacion}-${indice}`}>
                    <TD>
                      <span className="id-tecnico">{llamada.operacion}</span>
                    </TD>
                    <TD>
                      <span className="id-tecnico">{llamada.codigo ?? 'sin código'}</span>
                    </TD>
                    <TD className="max-w-md">
                      <span className="line-clamp-2 text-xs texto-suave">
                        {llamada.mensaje ?? '—'}
                      </span>
                    </TD>
                    <TD align="right">
                      <span className="text-xs texto-suave">{tiempoRelativo(llamada.fecha)}</span>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        ) : (
          <p className="text-sm texto-suave">
            No hubo llamadas fallidas al proveedor en {salud.ventana}.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

// -----------------------------------------------------------------------------
// Panel de la Empresa Revendedora
// -----------------------------------------------------------------------------

const PanelRevendedora = ({ data }: { data: Extract<DashboardData, { rol: 'reseller' }> }) => (
  <div className="space-y-5">
    {/* El aviso de capacidad va arriba de todo: es la información que le cambia
        la decisión del día (regla de negocio 12). */}
    {data.alertas_capacidad.length > 0 ? (
      <Card>
        <CardHeader className="flex-row items-center gap-2.5">
          <AlertTriangle className="size-4 text-warn" />
          <CardTitle>Cuentas cerca del tope</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm texto-suave">
            El próximo alta en estas cuentas puede requerir buscar otra con lugar o crear una nueva.
          </p>
          <ul className="divide-y divide-[rgb(var(--borde))]">
            {data.alertas_capacidad.map((alerta) => (
              <li
                key={alerta.cuenta_id}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5"
              >
                <div className="min-w-0">
                  <Link
                    to={`/accounts/${alerta.cuenta_id}`}
                    className="id-tecnico text-azure-600 hover:underline dark:text-azure-400"
                  >
                    {alerta.proveedor_cuenta_id ?? alerta.cuenta_id.slice(0, 8)}
                  </Link>
                  <p className="text-xs texto-suave">{alerta.mensaje}</p>
                </div>
                <div className="flex items-center gap-3 font-mono text-2xs">
                  <span>Fijos {alerta.fijos}</span>
                  <span>Móviles {alerta.moviles}</span>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    ) : null}

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric
        etiqueta="Clientes activos"
        valor={formatearNumero(data.clientes_finales.activos)}
        detalle={`${data.clientes_finales.suspendidos} suspendidos`}
        tono="azure"
        icono={<Users className="size-4" />}
      />
      <Metric
        etiqueta="Cuentas activas"
        valor={formatearNumero(data.cuentas.activas)}
        detalle="Unidad que le factura el operador"
        icono={<CreditCard className="size-4" />}
      />
      <Metric
        etiqueta="Dispositivos activos"
        valor={formatearNumero(data.dispositivos.activos)}
        detalle={`${data.dispositivos.activos_fijos} fijos · ${data.dispositivos.activos_moviles} móviles`}
        icono={<MonitorPlay className="size-4" />}
      />
      <Metric
        etiqueta="Dispositivos disponibles"
        valor={formatearNumero(data.dispositivos.disponibles)}
        detalle={`${data.dispositivos.bloqueados} bloqueados por suspensión`}
        tono={data.dispositivos.disponibles > 0 ? 'signal' : undefined}
      />
    </section>

    <div className="grid gap-3 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Su modalidad comercial</CardTitle>
        </CardHeader>
        <CardContent>
          {data.modalidad_comercial ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="texto-suave">Modalidad</dt>
                <dd className="font-medium">
                  {traducir(commercialPlanTypeLabels, data.modalidad_comercial.tipo)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="texto-suave">Escala</dt>
                <dd className="id-tecnico">{data.modalidad_comercial.escala}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="texto-suave">Precio por cuenta</dt>
                <dd className="font-medium tabular-nums">
                  {formatearImporte(data.modalidad_comercial.precio_por_cuenta)}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm texto-suave">
              Todavía no tiene una modalidad asignada. Comuníquese con el operador principal.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Próximos pasos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button asChild variant="primary" className="w-full justify-start">
            <Link to="/customers/new">Dar de alta un cliente</Link>
          </Button>
          <Button asChild variant="secondary" className="w-full justify-start">
            <Link to="/accounts">Ver mis cuentas y credenciales</Link>
          </Button>
          <Button asChild variant="secondary" className="w-full justify-start">
            <Link to="/devices?status=disponible">
              Reasignar dispositivos liberados ({data.dispositivos.disponibles})
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  </div>
);
