import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw, Trash2, UserPlus } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { toast } from "sonner";
import { api, ApiError, type Paginado } from "@/lib/api";
import { formatearFecha, formatearMac } from "@/lib/utils";
import type {
  AccountProviderDevice,
  AccountProviderInventory,
  Customer,
} from "@/lib/types";
import { ProviderDeviceClassBadge } from "@/components/common";
import {
  Alert,
  Button,
  Field,
  Input,
  Skeleton,
} from "@/components/ui/primitives";
import {
  ConfirmDialog,
  Dialog,
  DialogContent,
  Select,
} from "@/components/ui/overlays";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

/**
 * =============================================================================
 * Inventario real de la Cuenta en SENSA
 * =============================================================================
 * SENSA no tiene webhooks: si alguien inicia sesión por el reproductor web con
 * las credenciales de la Cuenta (compartida o no), IPTVControl no se entera
 * solo. Este botón es la única forma de ver, bajo pedido, qué Dispositivos hay
 * realmente en el Proveedor en este momento — más allá de los que se dieron de
 * alta desde el panel.
 *
 * Un Dispositivo "No autorizado" no se elimina automáticamente ni siquiera acá:
 * queda registrado como incidencia y la Empresa Revendedora decide, mirando la
 * fecha y el tipo, si lo elimina.
 * =============================================================================
 */
export const AccountProviderInventoryTab = ({
  cuentaId,
  esOperador,
  clienteExclusivo,
}: {
  cuentaId: string;
  esOperador: boolean;
  clienteExclusivo?: {
    id: string;
    numero_cliente: number;
    nombre: string;
  } | null;
}) => {
  const queryClient = useQueryClient();
  const [inventario, setInventario] = useState<AccountProviderInventory | null>(
    null,
  );
  const [aEliminar, setAEliminar] = useState<AccountProviderDevice | null>(
    null,
  );
  const [aVincular, setAVincular] = useState<AccountProviderDevice | null>(
    null,
  );
  const [clienteFinalId, setClienteFinalId] = useState("");
  const [busquedaCliente, setBusquedaCliente] = useState("");
  const busquedaDiferida = useDeferredValue(busquedaCliente);

  const clientes = useQuery({
    queryKey: ["customers", "incident-link", busquedaDiferida],
    queryFn: () =>
      api<Paginado<Customer>>("/customers", {
        params: { status: "activo", q: busquedaDiferida, per_page: 100 },
      }),
    enabled: Boolean(aVincular) && !clienteExclusivo,
  });

  const sincronizar = useMutation({
    mutationFn: () =>
      api<AccountProviderInventory>(`/accounts/${cuentaId}/sync-devices`, {
        metodo: "POST",
      }),
    onSuccess: (resultado) => {
      setInventario(resultado);
      const desconocidos = resultado.dispositivos.filter(
        (dispositivo) => dispositivo.clasificacion === "desconocido",
      );
      if (desconocidos.length > 0) {
        toast.warning(
          `Se ${desconocidos.length === 1 ? "detectó" : "detectaron"} ${desconocidos.length} ` +
            `Dispositivo${desconocidos.length === 1 ? "" : "s"} no autorizado${desconocidos.length === 1 ? "" : "s"}.`,
        );
      } else {
        toast.success(
          "El inventario coincide con lo esperado: nada para revisar.",
        );
      }
    },
    onError: (causa: ApiError) => toast.error(causa.message),
  });

  const eliminar = useMutation({
    mutationFn: (incidenciaId: string) =>
      api(`/device-incidents/${incidenciaId}/resolve`, {
        metodo: "POST",
        body: { accion: "eliminar" },
      }),
    onSuccess: () => {
      toast.success("Dispositivo eliminado del proveedor.");
      setAEliminar(null);
      void queryClient.invalidateQueries({ queryKey: ["account", cuentaId] });
      sincronizar.mutate();
    },
    onError: (causa: ApiError) => toast.error(causa.message),
  });

  const vincular = useMutation({
    mutationFn: ({
      incidenciaId,
      clienteId,
    }: {
      incidenciaId: string;
      clienteId: string;
    }) =>
      api(`/device-incidents/${incidenciaId}/resolve`, {
        metodo: "POST",
        body: { accion: "vincular", cliente_final_id: clienteId },
      }),
    onSuccess: () => {
      toast.success("Dispositivo agregado al Cliente Final.");
      setAVincular(null);
      setClienteFinalId("");
      setBusquedaCliente("");
      void queryClient.invalidateQueries({ queryKey: ["account", cuentaId] });
      void queryClient.invalidateQueries({ queryKey: ["customers"] });
      sincronizar.mutate();
    },
    onError: (causa: ApiError) => toast.error(causa.message),
  });

  const abrirVinculacion = (dispositivo: AccountProviderDevice) => {
    setAVincular(dispositivo);
    setClienteFinalId(clienteExclusivo?.id ?? "");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm texto-suave">
          Trae el inventario real del Proveedor. Es la única forma de ver qué
          equipo se auto- provisionó al iniciar sesión por el reproductor web.
        </p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => sincronizar.mutate()}
          disabled={sincronizar.isPending}
        >
          <RefreshCw />
          {sincronizar.isPending ? "Consultando…" : "Consultar al proveedor"}
        </Button>
      </div>

      {sincronizar.isPending ? <Skeleton className="h-32" /> : null}

      {inventario ? (
        <>
          <p className="text-2xs texto-suave">
            Consultado {formatearFecha(inventario.sincronizado_en)}
          </p>
          {inventario.dispositivos.length === 0 ? (
            <p className="py-6 text-center text-sm texto-suave">
              El Proveedor todavía no reporta ningún Dispositivo para esta
              Cuenta.
            </p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>ID en proveedor</TH>
                  <TH>Clasificación</TH>
                  {!esOperador ? <TH>Cliente / equipo</TH> : null}
                  <TH>Último inicio</TH>
                  <TH align="right">Acción</TH>
                </TR>
              </THead>
              <TBody>
                {inventario.dispositivos.map((dispositivo) => (
                  <TR key={dispositivo.proveedor_device_id}>
                    <TD>
                      <span className="id-tecnico">
                        {dispositivo.proveedor_device_id}
                      </span>
                    </TD>
                    <TD>
                      <ProviderDeviceClassBadge
                        clasificacion={dispositivo.clasificacion}
                      />
                      {dispositivo.clasificacion === "desconocido" &&
                      dispositivo.ventana_activa ? (
                        <span className="mt-1 block text-2xs text-warn">
                          Hay una vinculación en curso: puede ser el equipo
                          legítimo.
                        </span>
                      ) : null}
                    </TD>
                    {!esOperador ? (
                      <TD>
                        {dispositivo.cliente_final ? (
                          <span className="text-sm">
                            {dispositivo.cliente_final.nombre}
                          </span>
                        ) : dispositivo.mac ? (
                          <span className="id-tecnico">
                            {formatearMac(dispositivo.mac)}
                          </span>
                        ) : (
                          <span className="text-sm texto-suave">—</span>
                        )}
                      </TD>
                    ) : null}
                    <TD>
                      <span className="text-sm texto-suave">
                        {dispositivo.ultimo_inicio
                          ? formatearFecha(dispositivo.ultimo_inicio)
                          : "—"}
                      </span>
                    </TD>
                    <TD align="right">
                      {!esOperador &&
                      dispositivo.clasificacion === "desconocido" &&
                      dispositivo.incidencia_id ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => abrirVinculacion(dispositivo)}
                          >
                            <UserPlus />
                            Agregar a
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => setAEliminar(dispositivo)}
                          >
                            <Trash2 />
                            Eliminar
                          </Button>
                        </div>
                      ) : null}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </>
      ) : !sincronizar.isPending ? (
        <Alert tone="info">
          Todavía no consultó el inventario real. Use el botón de arriba para
          traerlo.
        </Alert>
      ) : null}

      <ConfirmDialog
        abierto={Boolean(aEliminar)}
        onCambio={(abierto) => !abierto && setAEliminar(null)}
        titulo="Eliminar Dispositivo no autorizado"
        descripcion="Se elimina del Proveedor. No es un Dispositivo vendido ni una reserva técnica."
        etiquetaConfirmar="Eliminar"
        tono="danger"
        cargando={eliminar.isPending}
        onConfirmar={() =>
          aEliminar?.incidencia_id && eliminar.mutate(aEliminar.incidencia_id)
        }
      >
        <Alert tone="warning">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              Verifique antes de eliminar: si hay una vinculación en curso, este
              equipo podría ser el legítimo de la venta.
            </span>
          </div>
        </Alert>
      </ConfirmDialog>

      <Dialog
        open={Boolean(aVincular)}
        onOpenChange={(abierto) => {
          if (!abierto) {
            setAVincular(null);
            setClienteFinalId("");
            setBusquedaCliente("");
          }
        }}
      >
        <DialogContent
          titulo="Agregar Dispositivo a un cliente"
          descripcion="La vinculación se valida contra el tenant, el tipo de Cuenta y los cupos disponibles."
        >
          <div className="space-y-4">
            {clienteExclusivo ? (
              <Alert tone="info">
                Esta Cuenta exclusiva pertenece a {clienteExclusivo.nombre}{" "}
                (cliente N° {clienteExclusivo.numero_cliente}).
              </Alert>
            ) : (
              <Field
                label="Buscar Cliente Final"
                htmlFor="buscar-cliente-incidencia"
              >
                <Input
                  id="buscar-cliente-incidencia"
                  value={busquedaCliente}
                  onChange={(evento) => setBusquedaCliente(evento.target.value)}
                  placeholder="Nombre, teléfono o ID de gestión"
                />
              </Field>
            )}

            {!clienteExclusivo && clientes.isPending ? (
              <Skeleton className="h-9" />
            ) : !clienteExclusivo && clientes.isError ? (
              <Alert tone="danger">
                No se pudo cargar el listado de clientes.
              </Alert>
            ) : !clienteExclusivo ? (
              <Field
                label="Cliente Final"
                htmlFor="cliente-incidencia"
                required
              >
                <Select
                  id="cliente-incidencia"
                  value={clienteFinalId || undefined}
                  onChange={setClienteFinalId}
                  opciones={(clientes.data?.data ?? []).map((cliente) => ({
                    value: cliente.id,
                    label: cliente.nombre_completo,
                    help: `Cliente N° ${cliente.numero_cliente}`,
                  }))}
                  placeholder="Seleccione un cliente activo"
                />
              </Field>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setAVincular(null)}
                disabled={vincular.isPending}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                disabled={!clienteFinalId || vincular.isPending}
                onClick={() =>
                  aVincular?.incidencia_id &&
                  vincular.mutate({
                    incidenciaId: aVincular.incidencia_id,
                    clienteId: clienteFinalId,
                  })
                }
              >
                {vincular.isPending ? "Agregando…" : "Agregar Dispositivo"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
