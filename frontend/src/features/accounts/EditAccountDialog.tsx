import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { AccountDetail as AccountDetailData, ServiceCatalogItem } from "@/lib/types";
import { Alert, Button, Skeleton } from "@/components/ui/primitives";
import { Dialog, DialogContent } from "@/components/ui/overlays";

/**
 * Edición de propiedades de una Cuenta ya creada: tipo (exclusiva ↔
 * compartida) y/o servicios. El backend valida las reglas de negocio (a lo
 * sumo un Cliente Final activo para cambiar de tipo, máximo 2 Dispositivos
 * por categoría al pasar a compartida); acá sólo se arma el pedido.
 */
export const EditAccountDialog = ({
  cuenta,
  abierto,
  onCambio,
}: {
  cuenta: AccountDetailData;
  abierto: boolean;
  onCambio: (abierto: boolean) => void;
}) => {
  const queryClient = useQueryClient();
  const serviciosActuales = (cuenta.servicios ?? "1")
    .split("|")
    .map((codigo) => codigo.trim())
    .filter(Boolean);

  const [esExclusiva, setEsExclusiva] = useState(cuenta.es_exclusiva);
  const [servicios, setServicios] = useState<string[]>(serviciosActuales);

  useEffect(() => {
    if (!abierto) return;
    setEsExclusiva(cuenta.es_exclusiva);
    setServicios(serviciosActuales);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, cuenta.id]);

  const catalogo = useQuery({
    queryKey: ["providers-catalog"],
    queryFn: () => api<ServiceCatalogItem[]>("/providers/services-catalog"),
    staleTime: Infinity,
    enabled: abierto,
  });
  const serviciosContratados = (catalogo.data ?? []).filter((servicio) => servicio.contratado);

  const guardar = useMutation({
    mutationFn: (body: { es_exclusiva?: boolean; servicios?: string[] }) =>
      api<AccountDetailData>(`/accounts/${cuenta.id}`, { metodo: "PATCH", body }),
    onSuccess: () => {
      toast.success("Cuenta actualizada.");
      onCambio(false);
      void queryClient.invalidateQueries({ queryKey: ["account", cuenta.id] });
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
    onError: (causa: ApiError) => toast.error(causa.message),
  });

  const cambioTipo = esExclusiva !== cuenta.es_exclusiva;
  const cambioServicios =
    !esExclusiva &&
    (servicios.length !== serviciosActuales.length ||
      servicios.some((codigo) => !serviciosActuales.includes(codigo)));
  const hayCambios = cambioTipo || cambioServicios;

  const confirmar = () => {
    const body: { es_exclusiva?: boolean; servicios?: string[] } = {};
    if (cambioTipo) body.es_exclusiva = esExclusiva;
    if (cambioServicios) body.servicios = servicios;
    guardar.mutate(body);
  };

  return (
    <Dialog open={abierto} onOpenChange={onCambio}>
      <DialogContent
        titulo="Editar propiedades de la Cuenta"
        descripcion="Cambiar el tipo sólo es posible con a lo sumo un Cliente Final activo."
      >
        <div className="space-y-4">
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Tipo de Cuenta</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  { valor: true, titulo: "Exclusiva", nota: "Hasta 3 fijos + 3 móviles, un único cliente." },
                  { valor: false, titulo: "Compartida", nota: "3 cupos por categoría, ventas 1+1 o 2+2." },
                ] as const
              ).map((opcion) => (
                <button
                  key={String(opcion.valor)}
                  type="button"
                  onClick={() => setEsExclusiva(opcion.valor)}
                  className={cn(
                    "rounded-lg border px-4 py-3 text-left transition-colors",
                    esExclusiva === opcion.valor
                      ? "border-azure-500 bg-azure-50 dark:bg-azure-900/30"
                      : "hover:bg-navy-50 dark:hover:bg-navy-800",
                  )}
                >
                  <span className="block font-medium">{opcion.titulo}</span>
                  <span className="mt-0.5 block text-xs texto-suave">{opcion.nota}</span>
                </button>
              ))}
            </div>
          </fieldset>

          {esExclusiva ? (
            <Alert tone="info">
              Una Cuenta exclusiva incluye automáticamente todos los servicios contratados.
            </Alert>
          ) : catalogo.isPending ? (
            <Skeleton className="h-28" />
          ) : catalogo.isError ? (
            <Alert tone="danger" titulo="No se pudo cargar el catálogo de servicios">
              <Button variant="secondary" size="sm" onClick={() => void catalogo.refetch()}>
                Reintentar
              </Button>
            </Alert>
          ) : (
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Servicios de la Cuenta</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {serviciosContratados.map((servicio) => {
                  const seleccionado = servicio.obligatorio || servicios.includes(servicio.codigo);
                  return (
                    <label
                      key={servicio.codigo}
                      className={cn(
                        "flex items-start gap-3 rounded-lg border p-3 transition-colors",
                        seleccionado
                          ? "border-azure-500 bg-azure-50 dark:bg-azure-900/30"
                          : "cursor-pointer hover:bg-navy-50 dark:hover:bg-navy-800",
                        servicio.obligatorio && "cursor-not-allowed",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={seleccionado}
                        disabled={servicio.obligatorio}
                        onChange={(evento) =>
                          setServicios((actual) =>
                            evento.target.checked
                              ? [...actual, servicio.codigo]
                              : actual.filter((codigo) => codigo !== servicio.codigo),
                          )
                        }
                        className="mt-0.5 size-4 shrink-0 accent-azure-500"
                      />
                      <span className="text-sm font-medium">{servicio.nombre}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => onCambio(false)} disabled={guardar.isPending}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={confirmar}
              disabled={guardar.isPending || !hayCambios}
            >
              {guardar.isPending ? "Guardando…" : "Guardar cambios"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
