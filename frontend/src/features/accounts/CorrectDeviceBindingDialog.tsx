import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, UserCog } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { AccountDevice } from "@/lib/types";
import { Alert, Button } from "@/components/ui/primitives";
import { Dialog, DialogContent } from "@/components/ui/overlays";

interface ClienteDeLaCuenta {
  id: string;
  numero_cliente: number;
  nombre: string;
}

/**
 * =============================================================================
 * Corrección de un Dispositivo vinculado al Cliente Final equivocado
 * =============================================================================
 * Caso real en una Cuenta compartida: mientras la ventana de vinculación de un
 * Cliente Final está abierta, otro Cliente Final de la misma Cuenta prueba las
 * credenciales en un segundo equipo. SENSA no identifica de quién es cada
 * inicio de sesión, así que ese equipo termina vinculado a quien no
 * correspondía. Esta es la herramienta manual para arreglarlo.
 *
 * En los dos casos, el Cliente Final que se queda sin Dispositivo recibe una
 * ventana de vinculación nueva automáticamente.
 * =============================================================================
 */
export const CorrectDeviceBindingDialog = ({
  dispositivo,
  clientesFinales,
  cuentaId,
  abierto,
  onCambio,
}: {
  dispositivo: AccountDevice;
  /** Otros Clientes Finales de esta misma Cuenta, para elegir el dueño real. */
  clientesFinales: ClienteDeLaCuenta[];
  cuentaId: string;
  abierto: boolean;
  onCambio: (abierto: boolean) => void;
}) => {
  const queryClient = useQueryClient();
  const [accion, setAccion] = useState<"reasignar" | "eliminar">("reasignar");
  const [clienteDestinoId, setClienteDestinoId] = useState<string>("");

  const otrosClientes = clientesFinales.filter(
    (cliente) => cliente.id !== dispositivo.cliente_final?.id,
  );

  const corregir = useMutation({
    mutationFn: () =>
      api<{ cliente_final_afectado_id: string }>(
        `/devices/${dispositivo.id}/correct-binding`,
        {
          metodo: "POST",
          body: {
            accion,
            cliente_final_id:
              accion === "reasignar" ? clienteDestinoId : undefined,
          },
        },
      ),
    onSuccess: () => {
      toast.success(
        accion === "reasignar"
          ? "Dispositivo reasignado. El cliente que quedó sin equipo tiene una ventana nueva de 10 minutos."
          : "Dispositivo eliminado del proveedor. El cliente afectado tiene una ventana nueva de 10 minutos.",
        { duration: 7000 },
      );
      void queryClient.invalidateQueries({ queryKey: ["account", cuentaId] });
      void queryClient.invalidateQueries({ queryKey: ["devices"] });
      onCambio(false);
      setAccion("reasignar");
      setClienteDestinoId("");
    },
    onError: (causa: ApiError) => toast.error(causa.message),
  });

  const puedeConfirmar = accion === "eliminar" || Boolean(clienteDestinoId);

  return (
    <Dialog open={abierto} onOpenChange={onCambio}>
      <DialogContent
        titulo="Corregir vinculación"
        descripcion={`Este Dispositivo aparece vinculado a ${dispositivo.cliente_final?.nombre ?? "un cliente"}.`}
      >
        <div className="space-y-4">
          <Alert tone="info">
            SENSA no identifica de quién es cada inicio de sesión: si otro
            cliente de esta Cuenta probó las credenciales antes de tiempo, el
            equipo puede haber quedado vinculado al cliente equivocado.
          </Alert>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setAccion("reasignar")}
              className={cn(
                "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                accion === "reasignar"
                  ? "border-azure-500 bg-azure-50 dark:bg-azure-900/30"
                  : "hover:bg-navy-50 dark:hover:bg-navy-800",
              )}
            >
              <UserCog className="mt-0.5 size-4 shrink-0 texto-suave" />
              <div className="flex-1">
                <p className="text-sm font-medium">
                  Es de otro cliente de esta Cuenta
                </p>
                <p className="mt-0.5 text-xs texto-suave">
                  El equipo pasa a pertenecer al cliente que elija abajo.
                </p>
              </div>
              {accion === "reasignar" ? (
                <Check className="mt-0.5 size-4 shrink-0 text-azure-600" />
              ) : null}
            </button>

            {accion === "reasignar" ? (
              <div className="ml-7 space-y-1.5">
                {otrosClientes.length === 0 ? (
                  <p className="text-xs texto-suave">
                    No hay otro Cliente Final activo en esta Cuenta para elegir.
                  </p>
                ) : (
                  otrosClientes.map((cliente) => (
                    <button
                      key={cliente.id}
                      type="button"
                      onClick={() => setClienteDestinoId(cliente.id)}
                      className={cn(
                        "flex w-full items-center justify-between rounded border px-3 py-2 text-left text-sm transition-colors",
                        clienteDestinoId === cliente.id
                          ? "border-azure-500 bg-azure-50 dark:bg-azure-900/30"
                          : "hover:bg-navy-50 dark:hover:bg-navy-800",
                      )}
                    >
                      <span>{cliente.nombre}</span>
                      <span className="id-tecnico text-2xs texto-suave">
                        N° {cliente.numero_cliente}
                      </span>
                    </button>
                  ))
                )}
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => setAccion("eliminar")}
              className={cn(
                "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                accion === "eliminar"
                  ? "border-alert bg-alert/10"
                  : "hover:bg-navy-50 dark:hover:bg-navy-800",
              )}
            >
              <div className="flex-1">
                <p className="text-sm font-medium">
                  No pertenece a ningún cliente
                </p>
                <p className="mt-0.5 text-xs texto-suave">
                  Se elimina el equipo del proveedor directamente.
                </p>
              </div>
              {accion === "eliminar" ? (
                <Check className="mt-0.5 size-4 shrink-0 text-alert" />
              ) : null}
            </button>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => onCambio(false)}
              disabled={corregir.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant={accion === "eliminar" ? "danger" : "primary"}
              onClick={() => corregir.mutate()}
              disabled={corregir.isPending || !puedeConfirmar}
            >
              {corregir.isPending ? "Aplicando…" : "Confirmar corrección"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
