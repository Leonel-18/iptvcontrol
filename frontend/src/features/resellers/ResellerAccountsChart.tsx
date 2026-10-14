import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { cn, formatearNumero } from '@/lib/utils';
import type { AgrupacionMetricas, ResellerMetrics } from '@/lib/types';
import { Alert, Card, CardContent, CardHeader, CardTitle, Skeleton } from '@/components/ui/primitives';
import { Select } from '@/components/ui/overlays';

/**
 * Evolución de Cuentas de una Empresa Revendedora.
 *
 * Reconstruye la serie con datos reales (fechas de Cuenta + Audit Log), no con
 * snapshots inventados. Ver `RevendedorasService.metricas` para el detalle de qué
 * representa cada punto.
 */

type Rango = '7d' | '30d' | '90d' | '6m' | '12m' | 'todo';
type SerieVisible = 'activas' | 'total' | 'altas';

const RANGOS: Array<{ value: Rango; label: string; agrupacion: AgrupacionMetricas }> = [
  { value: '7d', label: 'Últimos 7 días', agrupacion: 'dia' },
  { value: '30d', label: 'Últimos 30 días', agrupacion: 'dia' },
  { value: '90d', label: 'Últimos 90 días', agrupacion: 'semana' },
  { value: '6m', label: 'Últimos 6 meses', agrupacion: 'mes' },
  { value: '12m', label: 'Últimos 12 meses', agrupacion: 'mes' },
  { value: 'todo', label: 'Histórico', agrupacion: 'mes' },
];

const COLOR_SERIE: Record<SerieVisible, string> = {
  activas: '#17B26A',
  total: '#1E88E5',
  altas: '#7FBEF6',
};

const ETIQUETA_SERIE: Record<SerieVisible, string> = {
  activas: 'Cuentas activas',
  total: 'Cuentas registradas',
  altas: 'Altas del período',
};

const desdeParaRango = (rango: Rango): string | undefined => {
  if (rango === 'todo') return undefined;
  const fecha = new Date();
  if (rango === '7d') fecha.setDate(fecha.getDate() - 7);
  if (rango === '30d') fecha.setDate(fecha.getDate() - 30);
  if (rango === '90d') fecha.setDate(fecha.getDate() - 90);
  if (rango === '6m') fecha.setMonth(fecha.getMonth() - 6);
  if (rango === '12m') fecha.setMonth(fecha.getMonth() - 12);
  return fecha.toISOString().slice(0, 10);
};

const agrupacionParaRango = (rango: Rango): AgrupacionMetricas =>
  RANGOS.find((opcion) => opcion.value === rango)?.agrupacion ?? 'mes';

const etiquetaEje = (
  iso: string,
  agrupacion: AgrupacionMetricas,
  soloDia = false,
): string => {
  const fecha = new Date(iso);
  if (agrupacion === 'mes') {
    return fecha.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });
  }
  if (soloDia) return fecha.toLocaleDateString('es-AR', { day: '2-digit' });
  return fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
};

const etiquetaPunto = (iso: string, agrupacion: AgrupacionMetricas): string => {
  const fecha = new Date(iso);
  if (agrupacion === 'mes') {
    return fecha.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  }
  if (agrupacion === 'semana') {
    return `Semana del ${fecha.toLocaleDateString('es-AR')}`;
  }
  return fecha.toLocaleDateString('es-AR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

/** Redondeo "lindo" hacia arriba para el eje Y (1, 2, 5, 10 × 10^k). */
const techoLindo = (valor: number): number => {
  if (valor <= 0) return 1;
  if (valor <= 5) return Math.ceil(valor);
  const paso = Math.pow(10, Math.floor(Math.log10(valor)) - 1) * 5;
  return Math.ceil(valor / paso) * paso;
};

const formatearCompacto = (valor: number): string =>
  valor >= 1000 ? `${(valor / 1000).toLocaleString('es-AR', { maximumFractionDigits: 1 })}k` : String(valor);

const ALTO = 300;
const PAD = { arriba: 16, derecha: 16, abajo: 30, izquierda: 44 };
// Franja inferior propia para las altas por período: mezclarlas con las líneas
// acumuladas obliga a una doble escala que confunde (8 altas parecían ~400).
const BANDA_ALTAS = 52;
const SEPARACION_BANDA = 12;

export const ResellerAccountsChart = ({ empresaId }: { empresaId: string }) => {
  const [rango, setRango] = useState<Rango>('90d');
  const [series, setSeries] = useState<Record<SerieVisible, boolean>>({
    activas: true,
    total: true,
    altas: true,
  });
  const [mostrarLimites, setMostrarLimites] = useState(true);
  const [hover, setHover] = useState<number | null>(null);

  const [ancho, setAncho] = useState(720);
  const observador = useRef<ResizeObserver | null>(null);

  // Callback ref: se engancha recién cuando el div del gráfico existe (aparece
  // después de cargar los datos, no en el primer render). Con un useEffect de
  // deps [] el observer corría con el skeleton montado, no encontraba el nodo y
  // el ancho quedaba congelado en el default: el SVG dibujaba solo una parte.
  const medirContenedor = useCallback((nodo: HTMLDivElement | null) => {
    observador.current?.disconnect();
    observador.current = null;
    if (!nodo) return;
    const actualizar = (medida: number) => {
      if (medida > 0) setAncho(Math.max(320, medida));
    };
    const ro = new ResizeObserver((entradas) => actualizar(entradas[0]?.contentRect.width ?? 0));
    ro.observe(nodo);
    actualizar(nodo.getBoundingClientRect().width);
    observador.current = ro;
  }, []);

  useEffect(() => () => observador.current?.disconnect(), []);

  const agrupacion = agrupacionParaRango(rango);
  const { data, isLoading, error } = useQuery({
    queryKey: ['reseller', empresaId, 'metrics', rango],
    queryFn: () =>
      api<ResellerMetrics>(`/resellers/${empresaId}/metrics`, {
        params: { desde: desdeParaRango(rango), agrupacion },
      }),
    enabled: Boolean(empresaId),
    placeholderData: (previo) => previo,
  });

  const puntos = useMemo(() => data?.puntos ?? [], [data]);
  const referencias = data?.referencias;
  const agrupacionEfectiva = data?.agrupacion ?? agrupacion;

  const geometria = useMemo(() => {
    const anchoPlot = Math.max(40, ancho - PAD.izquierda - PAD.derecha);
    const conBandas = series.altas;
    const altoLineas = conBandas
      ? ALTO - PAD.arriba - PAD.abajo - BANDA_ALTAS - SEPARACION_BANDA
      : ALTO - PAD.arriba - PAD.abajo;
    const yBaseLineas = PAD.arriba + altoLineas;
    const yTopeBanda = yBaseLineas + SEPARACION_BANDA;
    const yBaseBanda = yTopeBanda + BANDA_ALTAS;
    const n = puntos.length;

    const xEn = (indice: number): number =>
      PAD.izquierda + (n <= 1 ? anchoPlot / 2 : (indice / (n - 1)) * anchoPlot);

    const seriesLineas = (['activas', 'total'] as const).filter((serie) => series[serie]);
    const valoresLinea = seriesLineas.flatMap((serie) => puntos.map((punto) => punto[serie]));
    const maxLineaBase = valoresLinea.length ? Math.max(...valoresLinea) : 0;
    let maxPrimario = maxLineaBase;
    if (mostrarLimites && referencias) {
      maxPrimario = Math.max(maxPrimario, referencias.cuentas_maximas);
      if (referencias.tope_cuentas_activas) {
        maxPrimario = Math.max(maxPrimario, referencias.tope_cuentas_activas);
      }
    }
    const maxAltas = Math.max(0, ...puntos.map((punto) => punto.altas));
    const techoPrimario = Math.max(1, techoLindo(maxPrimario * 1.05));
    const techoAltas = Math.max(1, techoLindo(maxAltas * 1.1));

    const yLinea = (valor: number): number =>
      PAD.arriba + altoLineas - (valor / techoPrimario) * altoLineas;
    // La franja de altas arranca en su propia base y escala contra su techo.
    const yBarra = (valor: number): number => yBaseBanda - (valor / techoAltas) * BANDA_ALTAS;

    const ticksY = Array.from({ length: 5 }, (_, indice) =>
      Math.round((techoPrimario / 4) * indice),
    );

    return {
      anchoPlot,
      altoLineas,
      yBaseLineas,
      yTopeBanda,
      yBaseBanda,
      n,
      xEn,
      yLinea,
      yBarra,
      techoPrimario,
      techoAltas,
      ticksY,
    };
  }, [ancho, puntos, series, mostrarLimites, referencias]);

  // Densidad de etiquetas del eje X adaptada al ancho: si los puntos entran, se
  // rotulan todos (con el número del día, que ocupa menos); si no, se espacian
  // lo mínimo necesario en lugar de un salto fijo.
  const indicesX = useMemo(() => {
    const n = puntos.length;
    if (n === 0) return [] as number[];
    const minSpacing = agrupacionEfectiva === 'mes' ? 44 : 30;
    const capacidad = Math.max(1, Math.floor(geometria.anchoPlot / minSpacing));
    const salto = Math.max(1, Math.ceil(n / capacidad));
    const indices: number[] = [];
    for (let indice = 0; indice < n; indice += salto) indices.push(indice);
    if (indices[indices.length - 1] !== n - 1) {
      if (n - 1 - indices[indices.length - 1] < salto / 2) indices.pop();
      indices.push(n - 1);
    }
    return indices;
  }, [puntos.length, geometria.anchoPlot, agrupacionEfectiva]);

  const etiquetaDiaCorta =
    agrupacionEfectiva === 'dia' && puntos.length > 1 && indicesX.length === puntos.length;

  const togglear = (serie: SerieVisible) =>
    setSeries((actual) => ({ ...actual, [serie]: !actual[serie] }));

  const manejarMovimiento = (evento: React.MouseEvent<SVGSVGElement>) => {
    const rect = evento.currentTarget.getBoundingClientRect();
    const x = ((evento.clientX - rect.left) / rect.width) * ancho;
    const { n, anchoPlot } = geometria;
    if (n === 0) return;
    const relativas = Array.from({ length: n }, (_, indice) =>
      Math.abs(geometria.xEn(indice) - x),
    );
    const indice = relativas.indexOf(Math.min(...relativas));
    setHover(anchoPlot > 0 ? indice : null);
  };

  const hayDatos = puntos.length > 0 && puntos.some((punto) => punto.total > 0 || punto.altas > 0);
  const puntoHover = hover !== null ? puntos[hover] : undefined;

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-0.5">
          <CardTitle>Evolución de cuentas</CardTitle>
          <p className="text-xs texto-suave">
            Crecimiento reconstruido desde el alta de cada cuenta y sus cierres registrados.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="eyebrow hidden sm:inline">Período</span>
          <Select
            value={rango}
            onChange={(valor) => setRango(valor as Rango)}
            className="w-44"
            opciones={RANGOS.map((opcion) => ({ value: opcion.value, label: opcion.label }))}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
          {(['activas', 'total', 'altas'] as const).map((serie) => (
            <button
              key={serie}
              type="button"
              onClick={() => togglear(serie)}
              aria-pressed={series[serie]}
              className={cn(
                'flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                series[serie]
                  ? 'border-transparent superficie-2 text-[rgb(var(--tinta))]'
                  : 'border-dashed texto-suave opacity-70',
              )}
            >
              <span
                className="size-2.5 rounded-full"
                style={{
                  backgroundColor: series[serie] ? COLOR_SERIE[serie] : 'transparent',
                  border: series[serie] ? 'none' : `1px solid ${COLOR_SERIE[serie]}`,
                }}
              />
              {ETIQUETA_SERIE[serie]}
            </button>
          ))}
          {referencias ? (
            <button
              type="button"
              onClick={() => setMostrarLimites((valor) => !valor)}
              aria-pressed={mostrarLimites}
              className={cn(
                'flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                mostrarLimites
                  ? 'border-transparent superficie-2 text-[rgb(var(--tinta))]'
                  : 'border-dashed texto-suave opacity-70',
              )}
            >
              <span
                className="inline-block h-0 w-3 border-t-2 border-dashed border-warn"
                aria-hidden="true"
              />
              Límites
            </button>
          ) : null}
        </div>

        {isLoading && !data ? (
          <Skeleton className="h-[300px]" />
        ) : error ? (
          <Alert tone="danger" titulo="No pudimos cargar la evolución">
            {(error as Error).message}
          </Alert>
        ) : !hayDatos ? (
          <p className="flex h-[300px] items-center justify-center text-sm texto-suave">
            Todavía no hay cuentas registradas para graficar.
          </p>
        ) : (
          <div ref={medirContenedor} className="relative">
            <svg
              role="img"
              aria-label="Evolución de cuentas activas y registradas de la empresa"
              width={ancho}
              height={ALTO}
              className="block w-full"
              onMouseMove={manejarMovimiento}
              onMouseLeave={() => setHover(null)}
            >
              {/* Grilla y eje Y */}
              {geometria.ticksY.map((tick) => {
                const y = geometria.yLinea(tick);
                return (
                  <g key={tick}>
                    <line
                      x1={PAD.izquierda}
                      x2={ancho - PAD.derecha}
                      y1={y}
                      y2={y}
                      stroke="rgb(var(--borde))"
                      strokeWidth={1}
                    />
                    <text
                      x={PAD.izquierda - 8}
                      y={y + 3}
                      textAnchor="end"
                      fontSize={10}
                      fill="rgb(var(--tinta-suave))"
                    >
                      {formatearCompacto(tick)}
                    </text>
                  </g>
                );
              })}

              {/* Referencias comerciales (vigentes, no históricas) */}
              {mostrarLimites && referencias
                ? [
                    {
                      valor: referencias.cuentas_maximas,
                      color: '#E8A93A',
                      etiqueta: 'Máximo permitido',
                    },
                    referencias.tope_cuentas_activas
                      ? {
                          valor: referencias.tope_cuentas_activas,
                          color: '#6B7C99',
                          etiqueta: 'Tope de activas',
                        }
                      : null,
                  ]
                    .filter(
                      (referencia): referencia is { valor: number; color: string; etiqueta: string } =>
                        referencia !== null && referencia.valor <= geometria.techoPrimario,
                    )
                    .map((referencia) => {
                      const y = geometria.yLinea(referencia.valor);
                      return (
                        <g key={referencia.etiqueta}>
                          <line
                            x1={PAD.izquierda}
                            x2={ancho - PAD.derecha}
                            y1={y}
                            y2={y}
                            stroke={referencia.color}
                            strokeWidth={1.5}
                            strokeDasharray="5 4"
                          />
                          <text
                            x={ancho - PAD.derecha}
                            y={y - 4}
                            textAnchor="end"
                            fontSize={10}
                            fill={referencia.color}
                          >
                            {referencia.etiqueta} · {referencia.valor}
                          </text>
                        </g>
                      );
                    })
                : null}

              {/* Franja inferior: altas del período, con escala propia e independiente
                  de las líneas acumuladas (evita la doble escala confusa). */}
              {series.altas ? (
                <g>
                  <line
                    x1={PAD.izquierda}
                    x2={ancho - PAD.derecha}
                    y1={geometria.yBaseBanda}
                    y2={geometria.yBaseBanda}
                    stroke="rgb(var(--borde))"
                    strokeWidth={1}
                  />
                  <text
                    x={PAD.izquierda - 8}
                    y={(geometria.yTopeBanda + geometria.yBaseBanda) / 2 + 3}
                    textAnchor="end"
                    fontSize={10}
                    fill={COLOR_SERIE.altas}
                  >
                    Altas
                  </text>
                  {puntos.map((punto, indice) => {
                    if (punto.altas <= 0) return null;
                    const y = geometria.yBarra(punto.altas);
                    const anchoBarra = Math.max(
                      3,
                      Math.min(20, geometria.anchoPlot / geometria.n / 2),
                    );
                    return (
                      <rect
                        key={`altas-${punto.fecha}`}
                        x={geometria.xEn(indice) - anchoBarra / 2}
                        y={y}
                        width={anchoBarra}
                        height={geometria.yBaseBanda - y}
                        rx={2}
                        fill={COLOR_SERIE.altas}
                        opacity={hover === indice ? 0.95 : 0.6}
                      />
                    );
                  })}
                </g>
              ) : null}

              {/* Líneas: total y activas */}
              {(['total', 'activas'] as const).map((serie) => {
                if (!series[serie]) return null;
                const cadena = puntos
                  .map((punto, indice) => `${geometria.xEn(indice)},${geometria.yLinea(punto[serie])}`)
                  .join(' ');
                return (
                  <polyline
                    key={serie}
                    points={cadena}
                    fill="none"
                    stroke={COLOR_SERIE[serie]}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                );
              })}

              {/* Marcador del punto bajo el cursor */}
              {hover !== null && puntos[hover] ? (
                <g>
                  <line
                    x1={geometria.xEn(hover)}
                    x2={geometria.xEn(hover)}
                    y1={PAD.arriba}
                    y2={series.altas ? geometria.yBaseBanda : geometria.yBaseLineas}
                    stroke="rgb(var(--tinta-suave))"
                    strokeWidth={1}
                    strokeDasharray="3 3"
                  />
                  {(['total', 'activas'] as const).map((serie) =>
                    series[serie] ? (
                      <circle
                        key={serie}
                        cx={geometria.xEn(hover)}
                        cy={geometria.yLinea(puntos[hover][serie])}
                        r={3.5}
                        fill={COLOR_SERIE[serie]}
                      />
                    ) : null,
                  )}
                </g>
              ) : null}

              {/* Etiquetas X */}
              {indicesX.map((indice) => {
                const punto = puntos[indice];
                if (!punto) return null;
                return (
                  <text
                    key={`x-${punto.fecha}`}
                    x={geometria.xEn(indice)}
                    y={ALTO - 10}
                    textAnchor="middle"
                    fontSize={10}
                    fill="rgb(var(--tinta-suave))"
                  >
                    {etiquetaEje(punto.fecha, agrupacionEfectiva, etiquetaDiaCorta)}
                  </text>
                );
              })}
            </svg>

            {puntoHover ? (
              <div
                className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border superficie px-3 py-2 text-xs shadow-pop"
                style={{ left: geometria.xEn(hover ?? 0) }}
              >
                <p className="font-medium capitalize">
                  {etiquetaPunto(puntoHover.fecha, agrupacionEfectiva)}
                </p>
                <dl className="mt-1 space-y-0.5">
                  {([...(['activas', 'total', 'altas'] as const)] as SerieVisible[])
                    .filter((serie) => series[serie])
                    .map((serie) => (
                      <div key={serie} className="flex items-center justify-between gap-4">
                        <dt className="flex items-center gap-1.5 texto-suave">
                          <span
                            className="size-2 rounded-full"
                            style={{ backgroundColor: COLOR_SERIE[serie] }}
                          />
                          {ETIQUETA_SERIE[serie]}
                        </dt>
                        <dd className="font-medium tabular-nums">
                          {formatearNumero(puntoHover[serie])}
                        </dd>
                      </div>
                    ))}
                  {puntoHover.cierres > 0 ? (
                    <div className="flex items-center justify-between gap-4">
                      <dt className="texto-suave">Cierres</dt>
                      <dd className="font-medium tabular-nums">{formatearNumero(puntoHover.cierres)}</dd>
                    </div>
                  ) : null}
                </dl>
              </div>
            ) : null}

            {series.altas ? (
              <p className="text-2xs texto-suave">
                Las altas del período van en una franja aparte, con su propia escala.
                {referencias && referencias.cuentas_maximas > 0
                  ? ` El máximo permitido hoy es ${formatearNumero(referencias.cuentas_maximas)} cuentas.`
                  : ''}
              </p>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
