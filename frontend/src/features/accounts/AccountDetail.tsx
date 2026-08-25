import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, KeyRound, RefreshCw, XCircle } from "lucide-react";
import { useState } from "react";
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
} from "@/components/common";
import { AccountDevicesTab } from "./AccountDevicesTab";
import { AccountProviderInventoryTab } from "./AccountProviderInventoryTab";
import { CapacityMeter } from "@/components/CapacityMeter";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
} from "@/components/ui/primitives";
import {
  ConfirmDialog,
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

  const { data, isLoading, error } = useQuery({
    queryKey: ["account", id],
    queryFn: () => api<AccountDetailData>(`/accounts/${id}`),
    enabled: Boolean(id),
  });

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
            : "Cuenta compartida: hasta 3 ventas de distintos clientes, cada una con hasta 1 fijo + 1 móvil."
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
          Esta acción no se puede deshacer. Úsela sólo para Cuentas creadas por error o
          abandonadas.
        </Alert>
      </ConfirmDialog>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Ocupación</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <CapacityMeter capacidad={data.capacidad} />
              <OcupacionDetalle ocupacion={data.capacidad} esExclusiva={data.es_exclusiva} />
              {data.capacidad.cerca_del_tope ? (
                <Alert tone="warning" titulo="Cerca del tope de capacidad">
                  {data.es_exclusiva
                    ? "Esta Cuenta está cerca de su tope de 3 fijos + 3 móviles."
                    : "Una venta unitaria adicional puede asignarse a otra Cuenta compatible."}
                </Alert>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <Tabs defaultValue="devices">
              <div className="px-5 pt-2">
                <TabsList>
                  <TabsTrigger value="devices">Dispositivos</TabsTrigger>
                  <TabsTrigger value="provider">En el proveedor</TabsTrigger>
                  {!esOperador ? (
                    <TabsTrigger value="customers">Clientes</TabsTrigger>
                  ) : null}
                </TabsList>
              </div>
              <CardContent>
                <TabsContent value="devices">
                  <AccountDevicesTab
                    dispositivos={data.dispositivos}
                    esOperador={esOperador}
                    clientesFinales={data.clientes_finales}
                    cuentaId={data.id}
                  />
                </TabsContent>
                <TabsContent value="provider">
                  <AccountProviderInventoryTab
                    cuentaId={data.id}
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
                      <p className="py-6 text-center text-sm texto-suave">
                        Esta cuenta todavía no tiene clientes asociados.
                      </p>
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
            <CardHeader>
              <CardTitle>Datos de la cuenta</CardTitle>
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
  esExclusiva,
}: {
  ocupacion: AccountDetailData["capacidad"];
  esExclusiva: boolean;
}) => (
  <div className="rounded-lg border p-3">
    <p className="eyebrow">{esExclusiva ? "Dispositivos" : "Ventas"}</p>
    <p className="mt-1 font-display text-lg font-bold tabular-nums">
      {ocupacion.ocupados}{" "}
      <span className="text-sm font-normal texto-suave">
        de {ocupacion.limite}
      </span>
    </p>
    <p className="text-xs texto-suave">
      {ocupacion.libres > 0
        ? `${ocupacion.libres} lugar${ocupacion.libres === 1 ? "" : "es"} libre${ocupacion.libres === 1 ? "" : "s"}`
        : "Cuenta en el límite"}
    </p>
  </div>
);
