import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { CuriosityDurationInput } from "@/components/CuriosityDurationInput";
import { sharedCapacityLabels } from "@/i18n/entityLabels";
import type {
  AccountDetail as AccountDetailData,
  CuriosityWindowSettings,
  CustomerDetail,
  SharedCapacity,
} from "@/lib/types";
import { Alert, Button, Field, Input, Skeleton } from "@/components/ui/primitives";
import { Dialog, DialogContent } from "@/components/ui/overlays";

/**
 * Carga manual del primer Cliente Final de una Cuenta compartida ya existente
 * y vacía (ej. importada de SENSA, que no informa esa relación). Reusa el
 * endpoint normal de alta (`POST /customers`) forzando `cuenta_id`: usa la
 * firma de servicios que la Cuenta ya tiene fijada, no una elegida acá.
 */
export const AddManualCustomerDialog = ({
  cuenta,
  abierto,
  onCambio,
}: {
  cuenta: AccountDetailData;
  abierto: boolean;
  onCambio: (abierto: boolean) => void;
}) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [dni, setDni] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [direccion, setDireccion] = useState("");
  const [cuposPorCategoria, setCuposPorCategoria] = useState<SharedCapacity>(1);
  const [duracion, setDuracion] = useState(0);
  const [error, setError] = useState("");

  const settings = useQuery({
    queryKey: ["settings-curiosity-window"],
    queryFn: () => api<CuriosityWindowSettings>("/settings/curiosity-window"),
    enabled: abierto,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (abierto && settings.data) {
      setDuracion(settings.data.duracion_predeterminada_minutos);
    }
  }, [abierto, settings.data]);

  const crear = useMutation({
    mutationFn: () =>
      api<{ cliente: CustomerDetail }>("/customers", {
        metodo: "POST",
        body: {
          nombre: nombre.trim(),
          apellido: apellido.trim() || undefined,
          dni: dni.trim(),
          telefono: telefono.trim() || undefined,
          email: email.trim() || undefined,
          direccion: direccion.trim() || undefined,
          tipo_alta: "dispositivo_compartido",
          cuenta_id: cuenta.id,
          cupos_por_categoria: cuposPorCategoria,
          duracion_ventana_curiosidad_minutos: duracion,
          dispositivo: {},
        },
      }),
    onSuccess: (resultado) => {
      toast.success("Cliente cargado en la Cuenta.");
      onCambio(false);
      void queryClient.invalidateQueries({ queryKey: ["account", cuenta.id] });
      void queryClient.invalidateQueries({ queryKey: ["customers"] });
      navigate(`/customers/${resultado.cliente.id}`);
    },
    onError: (causa: ApiError) => toast.error(causa.message),
  });

  const confirmar = () => {
    if (nombre.trim().length < 2) {
      setError("Ingrese el nombre del cliente.");
      return;
    }
    if (!/^\d{6,10}$/.test(dni.trim())) {
      setError("Ingrese un DNI válido (6 a 10 dígitos, sin puntos).");
      return;
    }
    setError("");
    crear.mutate();
  };

  return (
    <Dialog open={abierto} onOpenChange={onCambio}>
      <DialogContent
        titulo="Cargar cliente en esta Cuenta"
        descripcion="Para Cuentas compartidas vacías (ej. importadas), donde el proveedor no informó sus clientes."
      >
        <div className="space-y-4">
          {cuenta.servicios_nombres ? (
            <Alert tone="info">
              Esta Cuenta ya tiene fijados los servicios: {cuenta.servicios_nombres.join(", ")}.
            </Alert>
          ) : null}

          {error ? <Alert tone="danger">{error}</Alert> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre" htmlFor="manual-nombre" required>
              <Input id="manual-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
            </Field>
            <Field label="Apellido" htmlFor="manual-apellido">
              <Input id="manual-apellido" value={apellido} onChange={(e) => setApellido(e.target.value)} />
            </Field>
            <Field label="DNI" htmlFor="manual-dni" required>
              <Input
                id="manual-dni"
                inputMode="numeric"
                value={dni}
                onChange={(e) => setDni(e.target.value.replace(/\D/g, "").slice(0, 10))}
              />
            </Field>
            <Field label="Teléfono" htmlFor="manual-telefono">
              <Input id="manual-telefono" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
            </Field>
            <Field label="Correo" htmlFor="manual-email" className="sm:col-span-2">
              <Input id="manual-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Dirección" htmlFor="manual-direccion" className="sm:col-span-2">
              <Input
                id="manual-direccion"
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
              />
            </Field>
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">Dispositivos autorizados</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {([1, 2] as SharedCapacity[]).map((cantidad) => (
                <button
                  key={cantidad}
                  type="button"
                  onClick={() => setCuposPorCategoria(cantidad)}
                  className={cn(
                    "rounded-lg border px-4 py-3 text-left transition-colors",
                    cuposPorCategoria === cantidad
                      ? "border-azure-500 bg-azure-50 dark:bg-azure-900/30"
                      : "hover:bg-navy-50 dark:hover:bg-navy-800",
                  )}
                >
                  <span className="block font-medium">{sharedCapacityLabels[cantidad]}</span>
                </button>
              ))}
            </div>
          </fieldset>

          {settings.isPending ? (
            <Skeleton className="h-28" />
          ) : settings.isError ? (
            <Alert tone="danger" titulo="No se pudo cargar la duración predeterminada">
              <Button variant="secondary" size="sm" onClick={() => void settings.refetch()}>
                Reintentar
              </Button>
            </Alert>
          ) : (
            <CuriosityDurationInput
              value={duracion}
              maxMinutes={settings.data.duracion_predeterminada_minutos}
              onChange={setDuracion}
              help="Ponga 0 días, 0 horas y 0 minutos si no quiere bloquear la Cuenta para otro cliente."
            />
          )}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => onCambio(false)} disabled={crear.isPending}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={confirmar} disabled={crear.isPending || !settings.isSuccess}>
              {crear.isPending ? "Cargando…" : "Cargar cliente"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
