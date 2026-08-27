import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ExternalLink,
  Link2,
  PauseCircle,
  PlayCircle,
  Plus,
  Trash2,
  UserX,
} from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { useSesion } from "@/lib/session";
import { formatearFecha, formatearMac } from "@/lib/utils";
import type {
  AccountDevice,
  CustomerDetail as CustomerDetailData,
  DeviceIncident,
} from "@/lib/types";
import { customerIntakeLabels, traducir } from "@/i18n/entityLabels";
import {
  CopyableId,
  CustomerStatusBadge,
  DeviceStatusBadge,
  DeviceTypeBadge,
  DetailRow,
  PageHeader,
  SecretValue,
  VinculacionEnCursoAlert,
  WhatsappTemplateButton,
} from "@/components/common";
import { AddDeviceDialog } from "../devices/AddDeviceDialog";
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
import { ConfirmDialog } from "@/components/ui/overlays";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

/**
 * Vista por Cliente — `/customers/:id`.
 *
 * La segunda vista de la regla de negocio 8: las credenciales de la cuenta a la
 * que pertenece el cliente, la parametrización de contenido, sus dispositivos y
 * un botón para saltar a la vista completa de la cuenta.
 *
 * También concentra las tres transiciones de estado: suspender, reactivar y baja
 * definitiva. Cada una explica su consecuencia sobre el dispositivo antes de
 * ejecutarse, porque la diferencia entre suspensión y baja es exactamente eso.
 */
export const CustomerDetail = () => {
  const { id = "" } = useParams();
  const { esOperador } = useSesion();
  const queryClient = useQueryClient();

  const [accion, setAccion] = useState<
    "suspend" | "reactivate" | "terminate" | null
  >(null);
  const [agregarDispositivo, setAgregarDispositivo] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => api<CustomerDetailData>(`/customers/${id}`),
    enabled: Boolean(id),
    // Mientras haya una ventana de vinculación abierta, se refresca solo cada
    // 15 s: así el aviso desaparece apenas el sondeo vincule el equipo, sin
    // que la persona tenga que recargar la página para notarlo.
    refetchInterval: (query) => {
      const dispositivos = (query.state.data as CustomerDetailData | undefined)?.dispositivos;
      const ventanaAbierta = dispositivos?.some((dispositivo) => dispositivo.ventana_vinculacion);
      return ventanaAbierta ? 15_000 : false;
    },
  });

  const incidencias = useQuery({
    queryKey: ["device-incidents"],
    queryFn: () => api<DeviceIncident[]>("/device-incidents"),
    enabled: !esOperador,
  });

  const resolverIncidencia = useMutation({
    mutationFn: ({
      incidenteId,
      accion,
    }: {
      incidenteId: string;
      accion: "vincular" | "eliminar";
    }) =>
      api(`/device-incidents/${incidenteId}/resolve`, {
        metodo: "POST",
        // "Vincular éste" siempre lo asigna al Cliente Final que se está viendo:
        // es el contexto desde el que se abre esta lista de incidencias.
        body: accion === "vincular" ? { accion, cliente_final_id: id } : { accion },
      }),
    onSuccess: (_resultado, variables) => {
      toast.success(
        variables.accion === "vincular"
          ? "Dispositivo vinculado a este cliente."
          : "Dispositivo desconocido eliminado.",
      );
      void queryClient.invalidateQueries({ queryKey: ["device-incidents"] });
      void queryClient.invalidateQueries({ queryKey: ["customer", id] });
    },
    onError: (causa: ApiError) => toast.error(causa.message),
  });

  const transicion = useMutation({
    mutationFn: (tipo: "suspend" | "reactivate" | "terminate") =>
      api(`/customers/${id}/${tipo}`, { metodo: "POST" }),
    onSuccess: (_resultado, tipo) => {
      const mensajes = {
        suspend:
          "Cliente suspendido. Su dispositivo queda reservado y no se puede reasignar.",
        reactivate:
          "Cliente reactivado. Su dispositivo volvió a habilitarse en el proveedor.",
        terminate:
          "Cliente dado de baja. Su dispositivo quedó disponible para reasignar.",
      } as const;
      toast.success(mensajes[tipo]);
      setAccion(null);
      void queryClient.invalidateQueries({ queryKey: ["customer", id] });
      void queryClient.invalidateQueries({ queryKey: ["customers"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (causa: ApiError) => toast.error(causa.message),
  });

  if (isLoading) return <Skeleton className="h-64" />;

  if (error || !data) {
    return (
      <Alert tone="danger" titulo="No pudimos cargar el cliente">
        {(error as Error)?.message ?? "Verifique el enlace."}
      </Alert>
    );
  }

  const activo = data.estado === "activo";
  const suspendido = data.estado === "suspendido";
  const dadoDeBaja = data.estado === "dado_de_baja";
  const incidenciasCuenta = (incidencias.data ?? []).filter(
    (incidencia) => incidencia.cuenta_id === data.cuenta?.id,
  );
  const dispositivoEnVentana = data.dispositivos.find(
    (dispositivo) => dispositivo.ventana_vinculacion,
  );

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
        <Link to="/customers">
          <ArrowLeft />
          Volver a clientes
        </Link>
      </Button>

      <PageHeader
        eyebrow={`Cliente N° ${data.numero_cliente}`}
        titulo={data.nombre_completo || `Cliente ${data.numero_cliente}`}
        descripcion={traducir(customerIntakeLabels, data.tipo_alta)}
        acciones={
          <>
            <CustomerStatusBadge estado={data.estado} />
            {!esOperador && activo ? (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setAgregarDispositivo(true)}
                >
                  <Plus />
                  Agregar dispositivo
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setAccion("suspend")}
                >
                  <PauseCircle />
                  Suspender
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setAccion("terminate")}
                >
                  <UserX />
                  Dar de baja
                </Button>
              </>
            ) : null}
            {!esOperador && suspendido ? (
              <>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setAccion("reactivate")}
                >
                  <PlayCircle />
                  Reactivar
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setAccion("terminate")}
                >
                  <UserX />
                  Baja definitiva
                </Button>
              </>
            ) : null}
          </>
        }
      />

      {suspendido ? (
        <Alert tone="warning" titulo="Cliente suspendido" className="mb-4">
          Su dispositivo está liberado en el proveedor pero reservado: nadie más
          puede tomarlo. La única forma de liberarlo para otro cliente es
          pasarlo a baja definitiva.
        </Alert>
      ) : null}

      {dadoDeBaja ? (
        <Alert tone="info" titulo="Cliente dado de baja" className="mb-4">
          Sus dispositivos quedaron disponibles y pueden asignarse a un cliente
          nuevo desde la sección Dispositivos.
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {!esOperador && dispositivoEnVentana?.ventana_vinculacion ? (
            <VinculacionEnCursoAlert
              expiraEn={dispositivoEnVentana.ventana_vinculacion.expira_en}
            />
          ) : null}

          {!esOperador && incidenciasCuenta.length > 0 ? (
            <Card className="border-warn/50">
              <CardHeader>
                <CardTitle>Dispositivos sin asignar</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Alert tone="warning">
                  El Proveedor reporta estos equipos en la Cuenta de este cliente, pero todavía no
                  están vinculados a nadie (pueden exceder el cupo de esta venta). Si alguno es en
                  realidad de este cliente, vincúlelo; si no, elimínelo.
                </Alert>
                {incidenciasCuenta.map((incidencia) => (
                  <div
                    key={incidencia.id}
                    className="superficie flex flex-wrap items-center justify-between gap-3 rounded border p-3"
                  >
                    <div>
                      <p className="id-tecnico">
                        ID {incidencia.proveedor_device_id}
                      </p>
                      <p className="mt-1 text-xs texto-suave">
                        {incidencia.tipo_proveedor || "Tipo sin informar"}
                        {incidencia.mac
                          ? ` · ${formatearMac(incidencia.mac)}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={resolverIncidencia.isPending}
                        onClick={() =>
                          resolverIncidencia.mutate({
                            incidenteId: incidencia.id,
                            accion: "vincular",
                          })
                        }
                      >
                        <Link2 />
                        Vincular éste
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={resolverIncidencia.isPending}
                        onClick={() =>
                          resolverIncidencia.mutate({
                            incidenteId: incidencia.id,
                            accion: "eliminar",
                          })
                        }
                      >
                        <Trash2 />
                        Eliminar
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader className="flex-row items-center justify-between gap-2">
              <CardTitle>Dispositivos</CardTitle>
              {!esOperador && activo ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAgregarDispositivo(true)}
                >
                  <Plus />
                  Agregar
                </Button>
              ) : null}
            </CardHeader>
            <CardContent>
              {data.dispositivos.length === 0 ? (
                <p className="py-4 text-center text-sm texto-suave">
                  Este cliente no tiene dispositivos asignados.
                </p>
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH>ID en proveedor</TH>
                      <TH>Tipo</TH>
                      <TH>Estado</TH>
                      {!esOperador ? <TH>Equipo / nota</TH> : null}
                      <TH align="right">Alta</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {data.dispositivos.map((dispositivo: AccountDevice) => (
                      <TR key={dispositivo.id}>
                        <TD>
                          <Link
                            to={`/devices/${dispositivo.id}`}
                            className="id-tecnico text-azure-600 hover:underline dark:text-azure-400"
                          >
                            {dispositivo.proveedor_device_id ?? "Pendiente"}
                          </Link>
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
                            <div className="flex flex-col gap-0.5">
                              {dispositivo.mac ? (
                                <span className="id-tecnico">
                                  {formatearMac(dispositivo.mac)}
                                </span>
                              ) : null}
                              {dispositivo.nota_descriptiva ? (
                                <span className="text-xs texto-suave">
                                  {dispositivo.nota_descriptiva}
                                </span>
                              ) : null}
                              {!dispositivo.mac &&
                              !dispositivo.nota_descriptiva ? (
                                <span className="texto-suave">—</span>
                              ) : null}
                            </div>
                          </TD>
                        ) : null}
                        <TD align="right">
                          <span className="text-sm texto-suave">
                            {formatearFecha(dispositivo.creado_en)}
                          </span>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {!esOperador ? (
            <Card>
              <CardHeader>
                <CardTitle>Datos de contacto</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="divide-y divide-[rgb(var(--borde))]">
                  <DetailRow etiqueta="Nombre">
                    {data.nombre_completo || "—"}
                  </DetailRow>
                  <DetailRow etiqueta="DNI">
                    <span className="id-tecnico">{data.dni || "—"}</span>
                  </DetailRow>
                  <DetailRow etiqueta="Teléfono">
                    {data.telefono || "—"}
                  </DetailRow>
                  <DetailRow etiqueta="Correo">{data.email || "—"}</DetailRow>
                  <DetailRow etiqueta="Dirección">
                    {data.direccion || "—"}
                  </DetailRow>
                  <DetailRow etiqueta="ID en su gestión">
                    {data.id_gestion_externo ? (
                      <CopyableId
                        valor={data.id_gestion_externo}
                        etiqueta="ID de gestión"
                      />
                    ) : (
                      "—"
                    )}
                  </DetailRow>
                  <DetailRow etiqueta="Alta">
                    {formatearFecha(data.creado_en)}
                  </DetailRow>
                  {data.suspendido_en ? (
                    <DetailRow etiqueta="Suspendido">
                      {formatearFecha(data.suspendido_en)}
                    </DetailRow>
                  ) : null}
                  {data.dado_de_baja_en ? (
                    <DetailRow etiqueta="Baja">
                      {formatearFecha(data.dado_de_baja_en)}
                    </DetailRow>
                  ) : null}
                </dl>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          {/* Credenciales de la Cuenta del cliente + salto a la vista de Cuenta */}
          {!esOperador && data.cuenta ? (
            <Card>
              <CardHeader>
                <CardTitle>Su cuenta en el proveedor</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <dl className="space-y-2.5">
                  <div>
                    <dt className="eyebrow">Usuario</dt>
                    <dd className="mt-0.5">
                      <CopyableId
                        valor={data.cuenta.usuario}
                        etiqueta="Usuario"
                      />
                    </dd>
                  </div>
                  <div>
                    <dt className="eyebrow">Contraseña</dt>
                    <dd className="mt-0.5">
                      <SecretValue
                        valor={data.cuenta.password}
                        etiqueta="Contraseña"
                      />
                    </dd>
                  </div>
                  <div>
                    <dt className="eyebrow">PIN</dt>
                    <dd className="mt-0.5">
                      <SecretValue valor={data.cuenta.pin} etiqueta="PIN" />
                    </dd>
                  </div>
                  <div>
                    <dt className="eyebrow">Contenido habilitado</dt>
                    <dd className="mt-1 flex flex-wrap gap-1">
                      {data.cuenta.servicios_nombres.map((paquete) => (
                        <Badge key={paquete} tone="neutral">
                          {paquete}
                        </Badge>
                      ))}
                    </dd>
                  </div>
                  <div>
                    <dt className="eyebrow">Ocupación de la cuenta</dt>
                    <dd className="mt-0.5 font-mono text-xs">
                      Dispositivos {data.cuenta.capacidad ?? "—"}
                    </dd>
                  </div>
                </dl>

                <WhatsappTemplateButton
                  usuario={data.cuenta.usuario}
                  password={data.cuenta.password}
                  pin={data.cuenta.pin}
                  esExclusiva={data.cuenta.es_exclusiva}
                />

                {!data.cuenta.es_exclusiva ? (
                  <Alert tone="info">
                    Cuenta compartida: estas credenciales las usan también los
                    otros clientes finales que tengan un dispositivo en esta
                    cuenta.
                  </Alert>
                ) : null}

                {data.cuenta.cerca_del_tope ? (
                  <Alert tone="warning">
                    Esta cuenta está cerca del tope. El próximo alta puede
                    requerir otra cuenta.
                  </Alert>
                ) : null}

                <Button
                  asChild
                  variant="secondary"
                  size="sm"
                  className="w-full"
                >
                  <Link to={`/accounts/${data.cuenta.id}`}>
                    <ExternalLink />
                    Ver la cuenta completa
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {esOperador ? (
            <Card>
              <CardHeader>
                <CardTitle>Visibilidad del operador</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm texto-suave">
                  Los datos de contacto del cliente final y las credenciales de
                  su cuenta los administra la empresa revendedora. Para soporte,
                  identifique el caso por el número de cliente y el ID de la
                  cuenta.
                </p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      {/* Confirmaciones: cada una nombra la consecuencia sobre el dispositivo */}
      <ConfirmDialog
        abierto={accion === "suspend"}
        onCambio={(abierto) => setAccion(abierto ? "suspend" : null)}
        titulo="Suspender al cliente"
        descripcion="Se libera su dispositivo en el proveedor, pero queda reservado para él."
        etiquetaConfirmar="Suspender"
        cargando={transicion.isPending}
        onConfirmar={() => transicion.mutate("suspend")}
      >
        <Alert tone="warning">
          Mientras esté suspendido, ese dispositivo no se puede asignar a otro
          cliente. Para liberarlo hay que pasar este cliente a baja definitiva.
        </Alert>
      </ConfirmDialog>

      <ConfirmDialog
        abierto={accion === "reactivate"}
        onCambio={(abierto) => setAccion(abierto ? "reactivate" : null)}
        titulo="Reactivar al cliente"
        descripcion="Se vuelve a habilitar su dispositivo en el proveedor, en la misma cuenta."
        etiquetaConfirmar="Reactivar"
        cargando={transicion.isPending}
        onConfirmar={() => transicion.mutate("reactivate")}
      />

      <ConfirmDialog
        abierto={accion === "terminate"}
        onCambio={(abierto) => setAccion(abierto ? "terminate" : null)}
        titulo="Dar de baja definitiva"
        descripcion="Se elimina el Dispositivo en el Proveedor y la capacidad liberada queda protegida por una reserva técnica."
        etiquetaConfirmar="Dar de baja"
        tono="danger"
        cargando={transicion.isPending}
        onConfirmar={() => transicion.mutate("terminate")}
      >
        <Alert tone="danger">
          El dispositivo queda disponible para otro cliente, que va a recibir
          las mismas credenciales de esta cuenta. La contraseña no se rota.
        </Alert>
      </ConfirmDialog>

      {agregarDispositivo ? (
        <AddDeviceDialog
          clienteId={data.id}
          clienteNombre={data.nombre_completo}
          abierto={agregarDispositivo}
          onCambio={setAgregarDispositivo}
        />
      ) : null}
    </>
  );
};
