import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  CreditCard,
  MonitorPlay,
  RefreshCw,
  ShieldAlert,
  UserPlus,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useSesion } from '@/lib/session';
import { cn, formatearImporte, formatearNumero, tiempoRelativo } from '@/lib/utils';
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

type CategoriaCapacidad = { ocupados: number; limite: number };

/** Porcentaje redondeado; 0 cuando no hay límite definido. */
const porcentajeDe = (categoria: CategoriaCapacidad): number =>
  categoria.limite > 0 ? Math.round((categoria.ocupados / categoria.limite) * 100) : 0;

const barraCapacidadClase = (porcentaje: number): string =>
  porcentaje >= 100
    ? 'bg-warn'
    : 'bg-azure-500 dark:bg-azure-400';

const BarraCapacidad = ({
  etiqueta,
  dato,
}: {
  etiqueta: string;
  dato: CategoriaCapacidad;
}) => {
  const porcentaje = porcentajeDe(dato);
  if (dato.limite === 0) return null;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
        <span className="texto-suave">{etiqueta}</span>
        <span className="tabular-nums text-[0.8125rem] font-medium text-[rgb(var(--tinta))]">
          {dato.ocupados} de {dato.limite}
          <span className="texto-suave"> · {porcentaje}%</span>
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-navy-200/70 dark:bg-navy-800"
        role="progressbar"
        aria-valuenow={porcentaje}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${etiqueta}: ${porcentaje}% utilizado`}
      >
        <div
          className={cn('h-full rounded-full transition-[width]', barraCapacidadClase(porcentaje))}
          style={{ width: `${Math.max(porcentaje, porcentaje > 0 ? 4 : 0)}%` }}
        />
      </div>
    </div>
  );
};

/** Indicador compacto de tres cupos (como el isotipo de barras de IPTVControl). */
const MedidorDeCupos = ({ ocupados, limite }: { ocupados: number; limite: number }) => {
  const barras = Math.max(1, limite);
  const ocupadas = Math.min(Math.max(ocupados, 0), barras);
  return (
    <span className="inline-flex items-end gap-[3px]" aria-hidden="true">
      {Array.from({ length: barras }).map((_, indice) => {
        const ocupado = indice < ocupadas;
        return (
          <span
            key={indice}
            className={cn(
              'h-4 w-[5px] rounded-[1px]',
              ocupado ? 'bg-warn' : 'bg-navy-200 dark:bg-navy-700',
            )}
          />
        );
      })}
    </span>
  );
};

const PanelRevendedora = ({ data }: { data: Extract<DashboardData, { rol: 'reseller' }> }) => {
  const hayAlertas = data.alertas_capacidad.length > 0;

  return (
    <>
      {hayAlertas ? (
        <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-warn/40 bg-warn/10 px-3 py-2 text-sm">
          <AlertTriangle className="size-4 shrink-0 text-warn" />
          <span className="font-medium">
            {data.alertas_capacidad.length}{' '}
            {data.alertas_capacidad.length === 1 ? 'cuenta cerca del límite' : 'cuentas cerca del límite'}
          </span>
          <span className="texto-suave">
            · el próximo alta puede requerir buscar otra cuenta o crear una nueva.
          </span>
        </div>
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-12">
        {/* Columna principal: estado + capacidad + alertas */}
        <div className="space-y-4 lg:col-span-8">
          <Card>
            <CardContent className="p-5">
              {/* Tres números primarios, integrados y sin cards sueltas */}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 sm:divide-x sm:divide-[rgb(var(--borde))] sm:gap-0">
                <div className="sm:pr-5">
                  <p className="eyebrow">Clientes activos</p>
                  <p className="mt-1 font-display text-3xl font-bold tabular-nums text-azure-600 dark:text-azure-400">
                    {formatearNumero(data.clientes_finales.activos)}
                  </p>
                  <div className="mt-3 space-y-1 text-xs">
                    <p className="flex items-baseline justify-between gap-3">
                      <span className="texto-suave">En exclusivas</span>
                      <span className="font-medium tabular-nums">
                        {formatearNumero(data.clientes_finales.activos_exclusivos)}
                      </span>
                    </p>
                    <p className="flex items-baseline justify-between gap-3">
                      <span className="texto-suave">En compartidas</span>
                      <span className="font-medium tabular-nums">
                        {formatearNumero(data.clientes_finales.activos_compartidos)}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="sm:px-5">
                  <p className="eyebrow">Cuentas activas</p>
                  <p className="mt-1 font-display text-3xl font-bold tabular-nums text-azure-600 dark:text-azure-400">
                    {formatearNumero(data.cuentas.activas)}
                  </p>
                  <p className="mt-3 text-xs texto-suave">
                    {data.cuentas.cerradas > 0
                      ? `${formatearNumero(data.cuentas.cerradas)} cerradas`
                      : 'Ninguna cerrada'}
                  </p>
                </div>

                <div className="sm:pl-5">
                  <p className="eyebrow">Dispositivos activos</p>
                  <p className="mt-1 font-display text-3xl font-bold tabular-nums text-azure-600 dark:text-azure-400">
                    {formatearNumero(data.dispositivos.activos)}
                  </p>
                  <div className="mt-3 space-y-1 text-xs">
                    <p className="flex items-baseline justify-between gap-3">
                      <span className="texto-suave">Disponibles</span>
                      <span
                        className={cn(
                          'font-medium tabular-nums',
                          data.dispositivos.disponibles > 0 && 'text-signal',
                        )}
                      >
                        {formatearNumero(data.dispositivos.disponibles)}
                      </span>
                    </p>
                    <p className="flex items-baseline justify-between gap-3">
                      <span className="texto-suave">Bloqueados por suspensión</span>
                      <span className="font-medium tabular-nums">
                        {formatearNumero(data.dispositivos.bloqueados)}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="my-5 h-px bg-[rgb(var(--borde))]" />

              {/* Capacidad utilizada: barras reales por categoría */}
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <p className="text-sm font-semibold">Capacidad utilizada</p>
                <span className="text-2xs texto-suave">Sobre sus cuentas activas</span>
              </div>
              {data.capacidad.fijos.limite > 0 || data.capacidad.moviles.limite > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <BarraCapacidad etiqueta="Cupos fijos" dato={data.capacidad.fijos} />
                  <BarraCapacidad etiqueta="Cupos móviles" dato={data.capacidad.moviles} />
                </div>
              ) : (
                <p className="text-sm texto-suave">
                  Todavía no tiene cuentas activas: la capacidad aparece cuando cree la primera.
                </p>
              )}

              {!hayAlertas ? (
                <p className="mt-4 flex items-center gap-1.5 text-xs text-signal">
                  <CheckCircle2 className="size-3.5" />
                  Ninguna cuenta cerca del límite.
                </p>
              ) : null}
            </CardContent>
          </Card>

          {hayAlertas ? (
            <Card>
              <CardHeader className="flex-row items-center justify-between gap-2">
                <CardTitle className="text-base">Cuentas cerca del límite</CardTitle>
                <span className="rounded-full bg-warn/10 px-2 py-0.5 font-mono text-2xs text-warn">
                  {data.alertas_capacidad.length}
                </span>
              </CardHeader>
              <CardContent className="space-y-1">
                {data.alertas_capacidad.map((alerta) => (
                  <div
                    key={alerta.cuenta_id}
                    className="flex items-center justify-between gap-3 rounded-md px-2 py-2 transition-colors hover:bg-navy-100/60 dark:hover:bg-navy-800/50"
                  >
                    <div className="min-w-0">
                      <Link
                        to={`/accounts/${alerta.cuenta_id}`}
                        className="id-tecnico text-azure-600 hover:underline dark:text-azure-400"
                      >
                        {alerta.proveedor_cuenta_id ?? alerta.cuenta_id.slice(0, 8)}
                      </Link>
                      <p className="truncate text-xs texto-suave">{alerta.mensaje}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <MedidorDeCupos ocupados={alerta.ocupados} limite={alerta.limite} />
                      <span className="font-mono text-2xs tabular-nums">
                        {alerta.ocupados}/{alerta.limite}
                      </span>
                      <ArrowRight className="size-3.5 texto-suave" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>

        {/* Columna lateral: acciones + modalidad comercial en segundo plano */}
        <aside className="space-y-4 lg:col-span-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Acciones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button asChild variant="primary" className="w-full justify-start">
                <Link to="/customers/new">
                  <UserPlus />
                  Dar de alta un cliente
                </Link>
              </Button>
              <Button asChild variant="secondary" className="w-full justify-start">
                <Link to="/accounts">
                  <CreditCard />
                  Cuentas y credenciales
                </Link>
              </Button>
              <Button asChild variant="secondary" className="w-full justify-start">
                <Link to="/devices?status=disponible">
                  <MonitorPlay />
                  Reasignar disponibles ({formatearNumero(data.dispositivos.disponibles)})
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Modalidad comercial</CardTitle>
            </CardHeader>
            <CardContent className="text-xs">
              {data.modalidad_comercial ? (
                <dl className="space-y-1.5">
                  <div className="flex justify-between gap-3">
                    <dt className="texto-suave">Modalidad</dt>
                    <dd className="font-medium">
                      {traducir(commercialPlanTypeLabels, data.modalidad_comercial.tipo)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="texto-suave">Escala</dt>
                    <dd className="id-tecnico">{data.modalidad_comercial.escala}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="texto-suave">Precio por cuenta</dt>
                    <dd className="font-medium tabular-nums">
                      {formatearImporte(data.modalidad_comercial.precio_por_cuenta)}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="texto-suave">
                  Sin modalidad asignada. Comuníquese con el operador principal.
                </p>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
};
