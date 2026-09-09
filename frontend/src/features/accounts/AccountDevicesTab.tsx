import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  RefreshCw,
  Trash2,
  UserCog,
  UserPlus,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { formatearFecha, formatearMac } from "@/lib/utils";
import type {
  AccountDetail,
  AccountProviderDevice,
  AccountProviderInventory,
} from "@/lib/types";
import {
  CopyableId,
  DeviceStatusBadge,
  DeviceTypeBadge,
  ProviderDeviceClassBadge,
} from "@/components/common";
import {
  Alert,
  Button,
  Field,
  Input,
} from "@/components/ui/primitives";
import {
  ConfirmDialog,
  Dialog,
  DialogContent,
  Select,
} from "@/components/ui/overlays";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { AddManualCustomerDialog } from "./AddManualCustomerDialog";
import { getUnlinkedProviderDevices } from "./account-devices.utils";
import { CorrectDeviceBindingDialog } from "./CorrectDeviceBindingDialog";

/** Una sola grilla para los Dispositivos locales y los detectados al consultar al Proveedor. */
export const AccountDevicesTab = ({
  cuenta,
  esOperador,
}: {
  cuenta: AccountDetail;
  esOperador: boolean;
}) => {
  const queryClient = useQueryClient();
  const [inventario, setInventario] = useState<AccountProviderInventory | null>(
    null,
  );
  const [aCorregir, setACorregir] = useState<
    AccountDetail["dispositivos"][number] | null
  >(null);
  const [aEliminar, setAEliminar] = useState<AccountProviderDevice | null>(null);
  const [aBajaDefinitiva, setABajaDefinitiva] = useState<
    AccountDetail["dispositivos"][number] | null
  >(null);
  const [aVincular, setAVincular] = useState<AccountProviderDevice | null>(null);
  const [clienteFinalId, setClienteFinalId] = useState("");
  const [busquedaCliente, setBusquedaCliente] = useState("");
  const [crearClienteAbierto, setCrearClienteAbierto] = useState(false);
  const dispositivosProveedor = getUnlinkedProviderDevices(cuenta, inventario);
  const clienteExclusivo = cuenta.cliente_final_exclusivo;

  // Al vincular un equipo detectado en esta Cuenta, el destinatario sólo puede
  // ser un Cliente Final que YA pertenezca a esta Cuenta (no cualquiera de la
  // Empresa): un equipo que aparece acá usó las credenciales de esta Cuenta.
  const terminoBusqueda = busquedaCliente.trim().toLowerCase();
  const clientesDeLaCuenta = (cuenta.clientes_finales ?? []).filter(
    (cliente) =>
      !terminoBusqueda ||
      (cliente.nombre ?? "").toLowerCase().includes(terminoBusqueda) ||
      String(cliente.numero_cliente).includes(terminoBusqueda),
  );

  const sincronizar = useMutation({
    mutationFn: () =>
      api<AccountProviderInventory>(`/accounts/${cuenta.id}/sync-devices`, {
        metodo: "POST",
      }),
    onSuccess: (resultado) => {
      setInventario(resultado);
      const desconocidos = getUnlinkedProviderDevices(cuenta, resultado);
      if (desconocidos.length > 0) {
        toast.warning(
          `Se ${desconocidos.length === 1 ? "detectó" : "detectaron"} ${desconocidos.length} ` +
            `Dispositivo${desconocidos.length === 1 ? "" : "s"} sin asociar.`,
        );
      } else {
        toast.success("Todos los dispositivos del proveedor ya están asociados.");
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
      void queryClient.invalidateQueries({ queryKey: ["account", cuenta.id] });
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
      cerrarVinculacion();
      void queryClient.invalidateQueries({ queryKey: ["account", cuenta.id] });
      void queryClient.invalidateQueries({ queryKey: ["customers"] });
      void queryClient.invalidateQueries({ queryKey: ["devices"] });
      sincronizar.mutate();
    },
    onError: (causa: ApiError) => toast.error(causa.message),
  });

  const bajaDefinitiva = useMutation({
    mutationFn: (dispositivoId: string) =>
      api(`/devices/${dispositivoId}/remove`, { metodo: "POST" }),
    onSuccess: () => {
      toast.success("Dispositivo eliminado definitivamente.");
      setABajaDefinitiva(null);
      void queryClient.invalidateQueries({ queryKey: ["account", cuenta.id] });
      void queryClient.invalidateQueries({ queryKey: ["devices"] });
      void queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (causa: ApiError) => toast.error(causa.message),
  });

  const cerrarVinculacion = () => {
    setAVincular(null);
    setClienteFinalId("");
    setBusquedaCliente("");
  };

  const abrirVinculacion = (dispositivo: AccountProviderDevice) => {
    setAVincular(dispositivo);
    setClienteFinalId(clienteExclusivo?.id ?? "");
  };

  const puedeCorregir =
    !esOperador &&
    cuenta.dispositivos.some(
      (dispositivo) =>
        dispositivo.estado === "activo" &&
        dispositivo.estado_vinculacion === "vinculado" &&
        dispositivo.cliente_final,
    );
  const mostrarAcciones =
    !esOperador &&
    (puedeCorregir ||
      dispositivosProveedor.length > 0 ||
      cuenta.dispositivos.length > 0);
  const sinDispositivos =
    cuenta.dispositivos.length === 0 && dispositivosProveedor.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm texto-suave">
          Administre los dispositivos asociados y consulte los equipos que el
          proveedor detectó para esta Cuenta.
        </p>
        <div className="flex flex-wrap gap-2">
          {!esOperador &&
          !cuenta.password_pendiente &&
          (!cuenta.es_exclusiva || !cuenta.cliente_final_exclusivo) ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setCrearClienteAbierto(true)}
            >
              <UserPlus />
              Agregar cliente
            </Button>
          ) : null}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => sincronizar.mutate()}
            disabled={sincronizar.isPending}
          >
            <RefreshCw />
            {sincronizar.isPending
              ? "Consultando…"
              : "Consultar dispositivos en el proveedor"}
          </Button>
        </div>
      </div>

      {sincronizar.isError ? (
        <Alert tone="danger" titulo="No se pudo consultar al proveedor">
          {(sincronizar.error as Error).message}
        </Alert>
      ) : null}

      {inventario ? (
        <p className="text-2xs texto-suave">
          Inventario consultado {formatearFecha(inventario.sincronizado_en)}. Los
          equipos sin asociar se muestran en esta misma tabla.
        </p>
      ) : null}

      {sinDispositivos ? (
        <p className="py-6 text-center text-sm texto-suave">
          {inventario
            ? "El proveedor todavía no reporta dispositivos para esta Cuenta."
            : "Esta Cuenta todavía no tiene dispositivos activados. Consulte al proveedor para buscar equipos sin asociar."}
        </p>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>ID en proveedor</TH>
              <TH>Tipo</TH>
              <TH>Estado</TH>
              {!esOperador ? <TH>Cliente</TH> : null}
              {!esOperador ? <TH>Equipo / nota</TH> : null}
              {mostrarAcciones ? <TH align="right">Acción</TH> : null}
            </TR>
          </THead>
          <TBody>
            {cuenta.dispositivos.map((dispositivo) => (
              <TR key={`local:${dispositivo.id}`}>
                <TD>
                  <div className="flex flex-col gap-0.5">
                    <Link
                      to={`/devices/${dispositivo.id}`}
                      className="id-tecnico text-azure-600 hover:underline dark:text-azure-400"
                    >
                      {dispositivo.proveedor_device_id ?? "Pendiente"}
                    </Link>
                    {!dispositivo.proveedor_device_id &&
                    dispositivo.estado === "activo" ? (
                      <span className="text-2xs text-warn">
                        Esperando primer inicio de sesión
                      </span>
                    ) : null}
                  </div>
                </TD>
                <TD>
                  <DeviceTypeBadge tipo={dispositivo.tipo} />
                </TD>
                <TD>
                  <DeviceStatusBadge
                    estado={dispositivo.estado}
                    vinculacion={dispositivo.estado_vinculacion}
                  />
                </TD>
                {!esOperador ? (
                  <TD>
                    {dispositivo.cliente_final ? (
                      <Link
                        to={`/customers/${dispositivo.cliente_final.id}`}
                        className="text-sm text-azure-600 hover:underline dark:text-azure-400"
                      >
                        {dispositivo.cliente_final.nombre}
                      </Link>
                    ) : (
                      <span className="text-sm texto-suave">Sin cliente</span>
                    )}
                  </TD>
                ) : null}
                {!esOperador ? (
                  <TD>
                    <div className="flex flex-col gap-0.5">
                      {dispositivo.mac ? (
                        <CopyableId
                          valor={formatearMac(dispositivo.mac)}
                          etiqueta="MAC"
                        />
                      ) : null}
                      {dispositivo.nota_descriptiva ? (
                        <span className="text-xs texto-suave">
                          {dispositivo.nota_descriptiva}
                        </span>
                      ) : null}
                      {!dispositivo.mac && !dispositivo.nota_descriptiva ? (
                        <span className="text-sm texto-suave">—</span>
                      ) : null}
                    </div>
                  </TD>
                ) : null}
                {mostrarAcciones ? (
                  <TD align="right">
                    <div className="flex justify-end gap-2">
                      {dispositivo.estado === "activo" &&
                      dispositivo.estado_vinculacion === "vinculado" &&
                      dispositivo.cliente_final ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setACorregir(dispositivo)}
                        >
                          <UserCog />
                          Corregir
                        </Button>
                      ) : null}
                      {dispositivo.estado !== "bloqueado_por_suspension" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-alert hover:bg-alert/10"
                          onClick={() => setABajaDefinitiva(dispositivo)}
                        >
                          <Trash2 />
                          Dar de baja
                        </Button>
                      ) : null}
                    </div>
                  </TD>
                ) : null}
              </TR>
            ))}

            {dispositivosProveedor.map((dispositivo) => (
              <TR key={`provider:${dispositivo.proveedor_device_id}`}>
                <TD>
                  <span className="id-tecnico">
                    {dispositivo.proveedor_device_id}
                  </span>
                </TD>
                <TD>
                  <span className="text-sm texto-suave">
                    {dispositivo.tipo_proveedor ?? "—"}
                  </span>
                </TD>
                <TD>
                  <ProviderDeviceClassBadge
                    clasificacion={dispositivo.clasificacion}
                  />
                  {dispositivo.ventana_activa ? (
                    <span className="mt-1 block text-2xs text-warn">
                      Hay una vinculación en curso: puede ser el equipo legítimo.
                    </span>
                  ) : null}
                </TD>
                {!esOperador ? (
                  <TD>
                    <span className="text-sm texto-suave">Sin asignar</span>
                  </TD>
                ) : null}
                {!esOperador ? (
                  <TD>
                    <div className="flex flex-col gap-0.5">
                      {dispositivo.mac ? (
                        <CopyableId
                          valor={formatearMac(dispositivo.mac)}
                          etiqueta="MAC"
                        />
                      ) : (
                        <span className="text-sm texto-suave">—</span>
                      )}
                      {dispositivo.ultimo_inicio ? (
                        <span className="text-2xs texto-suave">
                          Último inicio: {formatearFecha(dispositivo.ultimo_inicio)}
                        </span>
                      ) : null}
                    </div>
                  </TD>
                ) : null}
                {mostrarAcciones ? (
                  <TD align="right">
                    {!esOperador && dispositivo.incidencia_id ? (
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
                ) : null}
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      {aCorregir ? (
        <CorrectDeviceBindingDialog
          dispositivo={aCorregir}
          clientesFinales={cuenta.clientes_finales ?? []}
          cuentaId={cuenta.id}
          abierto={Boolean(aCorregir)}
          onCambio={(abierto) => !abierto && setACorregir(null)}
        />
      ) : null}

      <ConfirmDialog
        abierto={Boolean(aEliminar)}
        onCambio={(abierto) => !abierto && setAEliminar(null)}
        titulo="Eliminar Dispositivo no autorizado"
        descripcion="Se elimina del Proveedor. No es un Dispositivo asociado a un Cliente Final."
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

      <ConfirmDialog
        abierto={Boolean(aBajaDefinitiva)}
        onCambio={(abierto) => !abierto && setABajaDefinitiva(null)}
        titulo="Dar de baja definitiva al dispositivo"
        descripcion={
          aBajaDefinitiva?.proveedor_device_id
            ? "Se elimina en el proveedor y la fila se borra del sistema. Ya no aparecerá como dispositivo de esta Cuenta."
            : "La fila del dispositivo se borra del sistema (todavía no estaba en el proveedor)."
        }
        etiquetaConfirmar="Dar de baja"
        tono="danger"
        cargando={bajaDefinitiva.isPending}
        onConfirmar={() =>
          aBajaDefinitiva && bajaDefinitiva.mutate(aBajaDefinitiva.id)
        }
      >
        <Alert tone="danger">
          {aBajaDefinitiva?.cliente_final ? (
            <>
              Este equipo pertenece a {aBajaDefinitiva.cliente_final.nombre}. Al dar de baja el
              dispositivo, ese cliente deja de tenerlo activo.
            </>
          ) : (
            "Esta acción no se puede deshacer: la fila desaparece y no queda como dispositivo disponible."
          )}
        </Alert>
      </ConfirmDialog>

      <Dialog
        open={Boolean(aVincular)}
        onOpenChange={(abierto) => !abierto && cerrarVinculacion()}
      >
        <DialogContent
          titulo="Agregar Dispositivo a un cliente"
          descripcion="La vinculación se valida contra el tenant, el tipo de Cuenta y los cupos disponibles."
        >
          <div className="space-y-4">
            {clienteExclusivo ? (
              <Alert tone="info">
                Esta Cuenta exclusiva pertenece a {clienteExclusivo.nombre} (cliente
                N° {clienteExclusivo.numero_cliente}).
              </Alert>
            ) : (cuenta.clientes_finales ?? []).length === 0 ? (
              <Alert tone="warning">
                Esta Cuenta todavía no tiene clientes cargados. Agregue un cliente a la
                cuenta antes de vincular este dispositivo.
              </Alert>
            ) : (
              <>
                <Field
                  label="Buscar cliente de esta Cuenta"
                  htmlFor="buscar-cliente-cuenta"
                >
                  <Input
                    id="buscar-cliente-cuenta"
                    value={busquedaCliente}
                    onChange={(evento) => setBusquedaCliente(evento.target.value)}
                    placeholder="Buscar por nombre o número de cliente"
                  />
                </Field>
                <Field
                  label="Cliente Final"
                  htmlFor="cliente-incidencia"
                  required
                >
                  <Select
                    id="cliente-incidencia"
                    value={clienteFinalId || undefined}
                    onChange={setClienteFinalId}
                    opciones={clientesDeLaCuenta.map((cliente) => ({
                      value: cliente.id,
                      label: cliente.nombre,
                      help: `Cliente N° ${cliente.numero_cliente} · ${cliente.dispositivos} dispositivos`,
                    }))}
                    placeholder="Seleccione el cliente de esta Cuenta"
                  />
                </Field>
              </>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={cerrarVinculacion}
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

      {!cuenta.es_exclusiva ? (
        <AddManualCustomerDialog
          cuenta={cuenta}
          abierto={crearClienteAbierto}
          onCambio={setCrearClienteAbierto}
        />
      ) : null}
    </div>
  );
};
