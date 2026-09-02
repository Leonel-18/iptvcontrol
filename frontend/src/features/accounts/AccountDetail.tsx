import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  KeyRound,
  Lock,
  Pencil,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { useSesion } from "@/lib/session";
import { formatearFecha, formatearMac } from "@/lib/utils";
import type {
  AccountCredentials,
  AccountDetail as AccountDetailData,
} from "@/lib/types";
import {
  CopyableId,
  DetailRow,
  PageHeader,
  SecretValue,
  WhatsappTemplateButton,
} from "@/components/common";
import { AccountDevicesTab } from "./AccountDevicesTab";
import { CuriosityWindowPanel } from "./CuriosityWindowPanel";
import { EditAccountDialog } from "./EditAccountDialog";
import { CapacityMeter } from "@/components/CapacityMeter";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Skeleton,
} from "@/components/ui/primitives";
import {
  ConfirmDialog,
  Dialog,
  DialogContent,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/overlays";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { AccountStatusBadge } from "@/components/common";

/**
 * Vista por Cuenta — `/accounts/:id`.
 *
 * Es una de las dos vistas que pide la regla de negocio 8: usuario, contraseña y
 * PIN de la Cuenta, su parametrización de contenido, y el listado de Clientes
 * Finales y Dispositivos relacionados.
 *
 * Para el Operador Principal, la misma URL devuelve la versión recortada: sin
 * credenciales, sin nombres de clientes y sin notas descriptivas. Esos campos no
 * se ocultan en pantalla — no llegan.
 */
export const AccountDetail = () => {
  const { id = "" } = useParams();
  const { esOperador } = useSesion();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [credencialesVisibles, setCredencialesVisibles] = useState(false);
  const [confirmarCierre, setConfirmarCierre] = useState(false);
  const [confirmarLiberacion, setConfirmarLiberacion] = useState(false);
  const [cambiarPasswordAbierto, setCambiarPasswordAbierto] = useState(false);
  const [editarAbierto, setEditarAbierto] = useState(false);
  const [passwordNueva, setPasswordNueva] = useState("");
  const [errorPassword, setErrorPassword] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["account", id],
    queryFn: () => api<AccountDetailData>(`/accounts/${id}`),
    enabled: Boolean(id),
  });
  const curiosityWindowActive = data?.ventana_curiosidad?.activa;
  const curiosityWindowExpectedEnd = data?.ventana_curiosidad?.fin_previsto_en;

  useEffect(() => {
    if (!curiosityWindowActive || !curiosityWindowExpectedEnd) return;

    const expectedEnd = new Date(curiosityWindowExpectedEnd).getTime();
    if (!Number.isFinite(expectedEnd)) return;

    let timer = 0;
    const refreshAtEnd = () => {
      const remaining = expectedEnd - Date.now();
      if (remaining <= 0) {
        void queryClient.invalidateQueries({ queryKey: ["account", id] });
        return;
      }
      timer = window.setTimeout(
        refreshAtEnd,
        Math.min(remaining + 100, 2_147_483_647),
      );
    };
    refreshAtEnd();

    return () => window.clearTimeout(timer);
  }, [curiosityWindowActive, curiosityWindowExpectedEnd, id, queryClient]);

  // Las credenciales se piden aparte, y sólo cuando la persona las pide: no se
  // descifran "por si acaso" al abrir la pantalla.
  const credenciales = useQuery({
    queryKey: ["account-credentials", id],
    queryFn: () => api<AccountCredentials>(`/accounts/${id}/credentials`),
    enabled: credencialesVisibles && !esOperador,
  });

  const sincronizar = useMutation({
    mutationFn: () => api(`/accounts/${id}/sync-services`, { metodo: "POST" }),
    onSuccess: () => {
      toast.success(
        "Parametrización de contenido actualizada desde el proveedor",
      );
      void queryClient.invalidateQueries({ queryKey: ["account", id] });
    },
    onError: (causa: Error) => toast.error(causa.message),
  });

  const cerrarCuenta = useMutation({
    mutationFn: () => api(`/accounts/${id}/close`, { metodo: "POST" }),
    onSuccess: () => {
      toast.success("Cuenta cerrada.");
      setConfirmarCierre(false);
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
      navigate("/accounts");
    },
    onError: (causa: ApiError) => toast.error(causa.message),
  });

  const liberarVentanaCuriosidad = useMutation({
    mutationFn: () =>
      api(`/accounts/${id}/curiosity-window/release`, { metodo: "POST" }),
    onSuccess: () => {
      toast.success("Ventana de curiosidad levantada.");
      setConfirmarLiberacion(false);
      void queryClient.invalidateQueries({ queryKey: ["account", id] });
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
    onError: (causa: ApiError) => toast.error(causa.message),
  });

  const cambiarPassword = useMutation({
    mutationFn: () =>
      api(`/accounts/${id}/password`, {
        metodo: "PATCH",
        body: { password: passwordNueva },
      }),
    onSuccess: () => {
      toast.success("Contraseña actualizada en el proveedor.");
      setCambiarPasswordAbierto(false);
      setPasswordNueva("");
      void queryClient.invalidateQueries({
        queryKey: ["account-credentials", id],
      });
    },
    onError: (causa: ApiError) => toast.error(causa.message),
  });

  if (isLoading) return <Skeleton className="h-64" />;

  if (error || !data) {
    return (
      <Alert tone="danger" titulo="No pudimos cargar la cuenta">
        {(error as Error)?.message ?? "Verifique el enlace."}
      </Alert>
    );
  }

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
        <Link to="/accounts">
          <ArrowLeft />
          Volver a cuentas
        </Link>
      </Button>

      <PageHeader
        eyebrow="Cuenta en el proveedor"
        titulo={data.proveedor_cuenta_id ?? "Cuenta sin confirmar"}
        descripcion={
          data.es_exclusiva
            ? "Cuenta exclusiva: fue creada para un único cliente final, con hasta 3 fijos + 3 móviles."
            : "Cuenta compartida: 3 cupos por categoría, repartidos entre ventas 1+1 o 2+2."
        }
        acciones={
          <>
            <AccountStatusBadge estado={data.estado} />
            {!esOperador ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => sincronizar.mutate()}
                disabled={sincronizar.isPending}
              >
                <RefreshCw />
                {sincronizar.isPending
                  ? "Consultando…"
                  : "Sincronizar contenido"}
              </Button>
            ) : null}
            {!esOperador &&
            data.estado !== "cerrada" &&
            data.capacidad.ocupados === 0 ? (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setConfirmarCierre(true)}
              >
                <XCircle />
                Cerrar cuenta
              </Button>
            ) : null}
          </>
        }
      />

      <ConfirmDialog
        abierto={confirmarCierre}
        onCambio={setConfirmarCierre}
        titulo="Cerrar esta Cuenta"
        descripcion="Se cierra en el proveedor y ya no va a poder usarse. Sólo se puede cerrar una Cuenta sin Dispositivos activos ni bloqueados."
        etiquetaConfirmar="Cerrar cuenta"
        tono="danger"
        cargando={cerrarCuenta.isPending}
        onConfirmar={() => cerrarCuenta.mutate()}
      >
        <Alert tone="warning">
          Esta acción no se puede deshacer. Úsela sólo para Cuentas creadas por
          error o abandonadas.
        </Alert>
      </ConfirmDialog>

      <ConfirmDialog
        abierto={confirmarLiberacion}
        onCambio={setConfirmarLiberacion}
        titulo="Levantar ventana de curiosidad"
        descripcion="La Cuenta compartida volverá a estar disponible de inmediato para otra venta compatible."
        etiquetaConfirmar="Levantar ventana"
        cargando={liberarVentanaCuriosidad.isPending}
        onConfirmar={() => liberarVentanaCuriosidad.mutate()}
      >
        <Alert tone="warning">
          Confirme sólo si ya no necesita mantener esta Cuenta reservada durante
          el plazo indicado.
        </Alert>
      </ConfirmDialog>

      <Dialog
        open={cambiarPasswordAbierto}
        onOpenChange={setCambiarPasswordAbierto}
      >
        <DialogContent
          titulo="Cambiar contraseña de la Cuenta"
          descripcion="Reemplaza la contraseña generada automáticamente por una definida a mano. Debe ser numérica, de 8 a 20 dígitos."
        >
          <div className="space-y-4">
            <Field
              label="Contraseña nueva"
              htmlFor="password-nueva"
              required
              error={errorPassword}
            >
              <Input
                id="password-nueva"
                inputMode="numeric"
                value={passwordNueva}
                onChange={(evento) =>
                  setPasswordNueva(
                    evento.target.value.replace(/\D/g, "").slice(0, 20),
                  )
                }
                autoFocus
              />
            </Field>
            <Alert tone="warning">
              Los Clientes Finales que usan esta Cuenta van a necesitar la
              contraseña nueva para seguir accediendo. Avíseles antes de
              cambiarla.
            </Alert>
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setCambiarPasswordAbierto(false)}
                disabled={cambiarPassword.isPending}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  if (!/^\d{8,20}$/.test(passwordNueva)) {
                    setErrorPassword("Ingrese entre 8 y 20 dígitos numéricos.");
                    return;
                  }
                  setErrorPassword("");
                  cambiarPassword.mutate();
                }}
                disabled={cambiarPassword.isPending}
              >
                {cambiarPassword.isPending
                  ? "Guardando…"
                  : "Guardar contraseña"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {!esOperador ? (
        <EditAccountDialog
          cuenta={data}
          abierto={editarAbierto}
          onCambio={setEditarAbierto}
        />
      ) : null}

      {!esOperador && data.estado === "activa" && data.password_pendiente ? (
        <Alert tone="warning" titulo="Cuenta importada: contraseña pendiente">
          Defina una contraseña desde esta pantalla antes de agregar Clientes Finales. El cambio se
          aplicará también en el proveedor.
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {!esOperador && !data.es_exclusiva ? (
            <CuriosityWindowPanel
              currentWindow={data.ventana_curiosidad}
              history={data.historial_ventanas_curiosidad ?? []}
              onRelease={() => setConfirmarLiberacion(true)}
              releasing={liberarVentanaCuriosidad.isPending}
            />
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Ocupación</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <CapacityMeter capacidad={data.capacidad} />
              <OcupacionDetalle ocupacion={data.capacidad} />
              {data.capacidad.cerca_del_tope ? (
                <Alert tone="warning" titulo="Cerca del tope de capacidad">
                  {data.es_exclusiva
                    ? "Esta Cuenta está cerca de su tope de 3 fijos + 3 móviles."
                    : "Una venta compartida adicional puede asignarse a otra Cuenta compatible."}
                </Alert>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <Tabs defaultValue="devices">
              <div className="px-5 pt-2">
                <TabsList>
                  <TabsTrigger value="devices">Dispositivos</TabsTrigger>
                  {!esOperador ? (
                    <TabsTrigger value="customers">Clientes</TabsTrigger>
                  ) : null}
                </TabsList>
              </div>
              <CardContent>
                <TabsContent value="devices">
                  <AccountDevicesTab
                    key={data.id}
                    cuenta={data}
                    esOperador={esOperador}
                  />
                </TabsContent>
                {!esOperador ? (
                  <TabsContent value="customers">
                    {data.clientes_finales &&
                    data.clientes_finales.length > 0 ? (
                      <Table>
                        <THead>
                          <TR>
                            <TH>N° cliente</TH>
                            <TH>Cliente</TH>
                            <TH align="right">Dispositivos</TH>
                          </TR>
                        </THead>
                        <TBody>
                          {data.clientes_finales.map((cliente) => (
                            <TR key={cliente.id}>
                              <TD>
                                <span className="id-tecnico">
                                  {cliente.numero_cliente}
                                </span>
                              </TD>
                              <TD>
                                <Link
                                  to={`/customers/${cliente.id}`}
                                  className="text-sm text-azure-600 hover:underline dark:text-azure-400"
                                >
                                  {cliente.nombre}
                                </Link>
                              </TD>
                              <TD align="right">
                                <span className="tabular-nums">
                                  {cliente.dispositivos}
                                </span>
                              </TD>
                            </TR>
                          ))}
                        </TBody>
                      </Table>
                    ) : (
                      <div className="py-6 text-center">
                        <p className="text-sm texto-suave">
                          Esta cuenta todavía no tiene clientes asociados.
                        </p>
                      </div>
                    )}
                  </TabsContent>
                ) : null}
              </CardContent>
            </Tabs>
          </Card>
        </div>

        <div className="space-y-4">
          {/* Credenciales: sólo panel de la Empresa Revendedora (regla 4.2) */}
          {!esOperador ? (
            <Card>
              <CardHeader className="flex-row items-center gap-2">
                <KeyRound className="size-4 texto-suave" />
                <CardTitle>Credenciales del cliente</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!credencialesVisibles ? (
                  <>
                    <p className="text-sm texto-suave">
                      Son las credenciales que le entrega a su cliente final
                      para usar el servicio.
                    </p>
                    <Button
                      variant="primary"
                      size="sm"
                      className="w-full"
                      onClick={() => setCredencialesVisibles(true)}
                    >
                      Ver credenciales
                    </Button>
                  </>
                ) : credenciales.isLoading ? (
                  <Skeleton className="h-20" />
                ) : credenciales.error ? (
                  <Alert tone="danger">
                    {(credenciales.error as Error).message}
                  </Alert>
                ) : (
                  <dl className="space-y-2.5">
                    <div>
                      <dt className="eyebrow">Usuario</dt>
                      <dd className="mt-0.5">
                        <CopyableId
                          valor={credenciales.data?.usuario}
                          etiqueta="Usuario"
                        />
                      </dd>
                    </div>
                    <div>
                      <dt className="eyebrow">Contraseña</dt>
                      <dd className="mt-0.5">
                        <SecretValue
                          valor={credenciales.data?.password}
                          etiqueta="Contraseña"
                        />
                      </dd>
                    </div>
                    <div>
                      <dt className="eyebrow">PIN de control parental</dt>
                      <dd className="mt-0.5">
                        <SecretValue
                          valor={credenciales.data?.pin}
                          etiqueta="PIN"
                        />
                      </dd>
                    </div>
                    <div>
                      <dt className="eyebrow">Correo de la cuenta</dt>
                      <dd className="mt-0.5">
                        <CopyableId
                          valor={credenciales.data?.email_contacto}
                          etiqueta="Correo"
                          mono={false}
                        />
                      </dd>
                    </div>
                  </dl>
                )}

                {credencialesVisibles ? (
                  <div className="flex flex-wrap gap-2">
                    <WhatsappTemplateButton
                      usuario={credenciales.data?.usuario}
                      password={credenciales.data?.password}
                      pin={credenciales.data?.pin}
                      esExclusiva={data.es_exclusiva}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setPasswordNueva("");
                        setErrorPassword("");
                        setCambiarPasswordAbierto(true);
                      }}
                    >
                      <Lock className="size-3.5" />
                      Cambiar contraseña
                    </Button>
                  </div>
                ) : null}

                {!data.es_exclusiva ? (
                  <Alert tone="info">
                    Esta cuenta es compartida: todos los clientes finales que
                    tengan un dispositivo acá usan estas mismas credenciales.
                  </Alert>
                ) : null}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Credenciales</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm texto-suave">
                  Las credenciales de la cuenta las administra la empresa
                  revendedora. El operador principal identifica la cuenta por su
                  ID para dar soporte.
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Datos de la cuenta</CardTitle>
              {!esOperador ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditarAbierto(true)}
                >
                  <Pencil className="size-3.5" />
                  Editar
                </Button>
              ) : null}
            </CardHeader>
            <CardContent>
              <dl className="divide-y divide-[rgb(var(--borde))]">
                <DetailRow etiqueta="ID interno">
                  <CopyableId valor={data.id} etiqueta="ID interno" />
                </DetailRow>
                <DetailRow etiqueta="ID en el proveedor">
                  <CopyableId
                    valor={data.proveedor_cuenta_id}
                    etiqueta="ID en proveedor"
                  />
                </DetailRow>
                <DetailRow etiqueta="Tipo">
                  <Badge tone={data.es_exclusiva ? "info" : "neutral"}>
                    {data.es_exclusiva ? "Exclusiva" : "Compartida"}
                  </Badge>
                </DetailRow>
                <DetailRow etiqueta="Proveedor">
                  {data.proveedor ?? "—"}
                </DetailRow>
                {data.servicios_nombres ? (
                  <DetailRow etiqueta="Contenido habilitado">
                    <div className="flex flex-wrap gap-1">
                      {data.servicios_nombres.length > 0 ? (
                        data.servicios_nombres.map((paquete) => (
                          <Badge key={paquete} tone="neutral">
                            {paquete}
                          </Badge>
                        ))
                      ) : (
                        <span className="texto-suave">—</span>
                      )}
                    </div>
                  </DetailRow>
                ) : null}
                <DetailRow etiqueta="Alta">
                  {formatearFecha(data.creado_en)}
                </DetailRow>
              </dl>
            </CardContent>
          </Card>

          {data.dispositivos.some((dispositivo) => dispositivo.mac) ? (
            <Card>
              <CardHeader>
                <CardTitle>Equipos informados</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {data.dispositivos
                  .filter((dispositivo) => dispositivo.mac)
                  .map((dispositivo) => (
                    <p key={dispositivo.id} className="id-tecnico">
                      {formatearMac(dispositivo.mac)}
                    </p>
                  ))}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
};

const OcupacionDetalle = ({
  ocupacion,
}: {
  ocupacion: AccountDetailData["capacidad"];
}) => (
  <div className="rounded-lg border p-3">
    <p className="eyebrow">Cupos 1+1</p>
    <p className="mt-1 font-display text-lg font-bold tabular-nums">
      {ocupacion.ocupados}{" "}
      <span className="text-sm font-normal texto-suave">
        de {ocupacion.limite}
      </span>
    </p>
    <p className="text-xs texto-suave">
      {ocupacion.libres > 0
        ? `${ocupacion.libres} cupo${ocupacion.libres === 1 ? "" : "s"} libre${ocupacion.libres === 1 ? "" : "s"}`
        : "Cuenta en el límite"}
    </p>
  </div>
);
