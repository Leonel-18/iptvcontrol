import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ResellerDetail as ResellerDetailData } from "@/lib/types";
import { Alert, Skeleton } from "@/components/ui/primitives";

/**
 * Panel de límites de Cuentas de la Empresa Revendedora (TAREA 1).
 *
 * Muestra ANTES de crear una Cuenta:
 *  - Cuántas Cuentas tiene actualmente, su límite total (cuentas máximas) y
 *    cuántas todavía puede crear.
 *  - Si aplica, el límite mensual de creación, cuántas creó en el mes y cuántas
 *    le quedan.
 *
 * "Cuentas máximas" = total que puede tener; "Máx. crear / mes" = las que puede
 * crear durante un mes. Son dos límites distintos y se muestran por separado.
 */
export const AccountLimitsPanel = ({ variante = "tarjeta" }: { variante?: "tarjeta" | "linea" }) => {
  const consulta = useQuery({
    queryKey: ["reseller", "me"],
    queryFn: () => api<ResellerDetailData>("/resellers/me"),
  });

  if (consulta.isLoading) return <Skeleton className="h-14" />;
  if (!consulta.data || consulta.isError) return null;

  const { comerciales, cuentas_max_crear_mensual, resumen } = consulta.data;
  const limite = comerciales.cuentas_maximas;
  // Las Cuentas cerradas (ya borradas en el proveedor) NO ocupan capacidad:
  // "actuales" son las que siguen activas.
  const actuales = resumen.cuentas_activas;
  const disponibles = Math.max(0, limite - actuales);

  const limiteMes = cuentas_max_crear_mensual;
  const disponiblesMes = Math.max(0, limiteMes - comerciales.creadas_mes);
  const alcanzoTotal = limite > 0 && actuales >= limite;
  const cercaTotal = !alcanzoTotal && limite > 0 && actuales >= limite - 2;
  const alcanzoMes = limiteMes > 0 && comerciales.creadas_mes >= limiteMes;
  const cercaMes = !alcanzoMes && limiteMes > 0 && comerciales.creadas_mes >= limiteMes - 2;

  const celdas = (label: string, valor: number) => (
    <div className="flex flex-col">
      <span className="font-mono text-2xs uppercase tracking-wide texto-suave">{label}</span>
      <span className="text-base font-semibold tabular-nums">{valor}</span>
    </div>
  );

  const contenido = (
    <>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        {celdas("Límite de cuentas", limite)}
        {celdas("Cuentas actuales", actuales)}
        {celdas("Disponibles", disponibles)}
        <div className="h-8 w-px bg-[rgb(var(--borde))]" aria-hidden />
        {celdas("Máx. crear / mes", limiteMes)}
        {celdas("Creadas este mes", comerciales.creadas_mes)}
        {celdas("Disponibles este mes", disponiblesMes)}
      </div>
      {(alcanzoTotal || cercaTotal) && (
        <Alert tone={alcanzoTotal ? "danger" : "warning"} className="mt-3">
          {alcanzoTotal
            ? `Alcanzaste el límite de cuentas. Actualmente tenés ${actuales} de ${limite} cuentas utilizadas.`
            : `Estás cerca del límite de cuentas. Tenés ${actuales} de ${limite} cuentas utilizadas.`}
        </Alert>
      )}
      {(alcanzoMes || cercaMes) && (
        <Alert tone={alcanzoMes ? "danger" : "warning"} className="mt-3">
          {alcanzoMes
            ? `Alcanzaste el límite mensual de creación (${limiteMes} por mes).`
            : `Estás cerca del límite mensual: creaste ${comerciales.creadas_mes} de ${limiteMes} cuentas este mes.`}
        </Alert>
      )}
    </>
  );

  if (variante === "linea") {
    return <div className="mb-3">{contenido}</div>;
  }

  return (
    <div className="rounded-lg border px-4 py-3 text-sm">
      <p className="mb-2 font-medium">Límites de cuentas</p>
      {contenido}
    </div>
  );
};
