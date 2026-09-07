import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Mail, PauseCircle, PlayCircle, Pencil } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { api, ApiError, type Paginado } from '@/lib/api';
import { formatearFecha, formatearFechaHora, formatearImporte } from '@/lib/utils';
import type { CommercialPlan, ResellerDetail as ResellerDetailData } from '@/lib/types';
import {
  commercialPlanTypeLabels,
  roleLabels,
  teamMemberStatusLabels,
  traducir,
} from '@/i18n/entityLabels';
import {
  CopyableId,
  DetailRow,
  Metric,
  PageHeader,
  ResellerStatusBadge,
  TeamMemberStatusBadge,
} from '@/components/common';
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Skeleton,
} from '@/components/ui/primitives';
import { ConfirmDialog, Dialog, DialogContent, Select } from '@/components/ui/overlays';
import { ResellerAccountsCard } from './ResellerAccountsCard';
import { ResellerEditDialog } from './ResellerEditDialog';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';

/**
 * Detalle de Empresa Revendedora — `/resellers/:id`.
 *
 * Muestra los datos administrativos, el resumen de cuentas y dispositivos —
 * siempre por ID, sin datos de Clientes Finales (regla 4.2) — y las dos acciones
 * exclusivas del Operador Principal: cambiar la modalidad comercial (downgrade o
 * upgrade) y suspender o reactivar la empresa.
 */
export const ResellerDetail = () => {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const [cambiarPlan, setCambiarPlan] = useState(false);
  const [confirmarEstado, setConfirmarEstado] = useState(false);
  const [editarDatos, setEditarDatos] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['reseller', id],
    queryFn: () => api<ResellerDetailData>(`/resellers/${id}`),
    enabled: Boolean(id),
  });

  const cambiarEstado = useMutation({
    mutationFn: (estado: 'activa' | 'suspendida') =>
      api(`/resellers/${id}`, { metodo: 'PATCH', body: { estado } }),
    onSuccess: (_resultado, estado) => {
      toast.success(estado === 'suspendida' ? 'Empresa suspendida' : 'Empresa reactivada');
      setConfirmarEstado(false);
      void queryClient.invalidateQueries({ queryKey: ['reseller', id] });
      void queryClient.invalidateQueries({ queryKey: ['resellers'] });
    },
    onError: (causa: ApiError) => toast.error(causa.message),
  });

  const reenviar = useMutation({
    mutationFn: (teamMemberId: string) =>
      api(`/team-members/${teamMemberId}/resend-invitation`, { metodo: 'POST' }),
    onSuccess: () => toast.success('Invitación reenviada'),
    onError: (causa: ApiError) => toast.error(causa.message),
  });

  if (isLoading) return <Skeleton className="h-64" />;

  if (error || !data) {
    return (
      <Alert tone="danger" titulo="No pudimos cargar la empresa">
        {(error as Error)?.message ?? 'Verifique el enlace.'}
      </Alert>
    );
  }

  const suspendida = data.estado === 'suspendida';

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
        <Link to="/resellers">
          <ArrowLeft />
          Volver a empresas
        </Link>
      </Button>

      <PageHeader
        eyebrow={`CUIT ${data.cuit}`}
        titulo={data.razon_social}
        descripcion={`${data.nombre_contacto} ${data.apellido_contacto} · ${data.email_contacto}`}
        acciones={
          <>
            <ResellerStatusBadge estado={data.estado} />
            <Button variant="secondary" size="sm" onClick={() => setEditarDatos(true)}>
              <Pencil />
              Editar datos
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setCambiarPlan(true)}>
              Cambiar modalidad
            </Button>
            <Button
              variant={suspendida ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setConfirmarEstado(true)}
            >
              {suspendida ? <PlayCircle /> : <PauseCircle />}
              {suspendida ? 'Reactivar' : 'Suspender'}
            </Button>
          </>
        }
      />

      {suspendida ? (
        <Alert tone="warning" titulo="Empresa suspendida" className="mb-4">
          Sus miembros del equipo no pueden ingresar al panel mientras esté suspendida.
        </Alert>
      ) : null}

      <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric etiqueta="Cuentas activas" valor={data.resumen.cuentas_activas} tono="azure" />
        <Metric etiqueta="Clientes activos" valor={data.resumen.clientes_activos} />
        <Metric
          etiqueta="Dispositivos activos"
          valor={data.resumen.dispositivos_activos}
          detalle={`${data.resumen.dispositivos_bloqueados} bloqueados`}
        />
        <Metric
          etiqueta="Dispositivos liberados"
          valor={data.resumen.dispositivos_disponibles}
          detalle={`${data.resumen.cuentas_cerradas} cuentas cerradas`}
        />
      </section>

      {/* Cuentas de esta Empresa Revendedora, por ID (regla de negocio 4.2) */}
      <ResellerAccountsCard empresaId={data.id} className="mb-4" />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Datos administrativos</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-[rgb(var(--borde))]">
              <DetailRow etiqueta="ID de la empresa">
                <CopyableId valor={data.id} etiqueta="ID de empresa" />
              </DetailRow>
              <DetailRow etiqueta="CUIT">
                <CopyableId valor={data.cuit} etiqueta="CUIT" />
              </DetailRow>
              <DetailRow etiqueta="Dirección">{data.direccion}</DetailRow>
              <DetailRow etiqueta="Contacto">
                {data.nombre_contacto} {data.apellido_contacto}
              </DetailRow>
              <DetailRow etiqueta="Teléfono">{data.telefono_contacto}</DetailRow>
              <DetailRow etiqueta="Correo">{data.email_contacto}</DetailRow>
              <DetailRow etiqueta="Sitio web">
                {data.sitio_web ? (
                  <a
                    href={data.sitio_web.startsWith('http') ? data.sitio_web : `https://${data.sitio_web}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-azure-600 hover:underline dark:text-azure-400"
                  >
                    {data.sitio_web}
                  </a>
                ) : (
                  '—'
                )}
              </DetailRow>
              <DetailRow etiqueta="Alta">{formatearFecha(data.creado_en)}</DetailRow>
            </dl>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Modalidad comercial</CardTitle>
            </CardHeader>
            <CardContent>
              {data.modalidad_comercial ? (
                <dl className="divide-y divide-[rgb(var(--borde))]">
                  <DetailRow etiqueta="Modalidad">
                    {traducir(commercialPlanTypeLabels, data.modalidad_comercial.tipo)}
                  </DetailRow>
                  <DetailRow etiqueta="Escala">
                    <span className="id-tecnico">{data.modalidad_comercial.escala}</span>
                  </DetailRow>
                  <DetailRow etiqueta="Precio por cuenta">
                    {formatearImporte(data.modalidad_comercial.precio_por_cuenta)}
                  </DetailRow>
                  {data.modalidad_comercial.ritmo_incremento ? (
                    <DetailRow etiqueta="Incremento mensual">
                      {data.modalidad_comercial.ritmo_incremento} cuentas por mes
                    </DetailRow>
                  ) : null}
                  {data.modalidad_comercial.tope_cuentas_activas ? (
                    <DetailRow etiqueta="Límite de cuentas activas">
                      {data.modalidad_comercial.tope_cuentas_activas ?? 'Sin límite configurado'}
                    </DetailRow>
                  ) : null}
                </dl>
              ) : (
                <Alert tone="warning">
                  Esta empresa todavía no tiene modalidad asignada, así que no ve precios en su
                  panel. Asígnele una para completar el alta.
                </Alert>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Acceso al panel</CardTitle>
            </CardHeader>
            <CardContent>
              {data.team_members.length === 0 ? (
                <p className="text-sm texto-suave">
                  No hay accesos creados para esta empresa. Genere uno desde la sección Equipo.
                </p>
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH>Correo</TH>
                      <TH>Rol</TH>
                      <TH>Estado</TH>
                      <TH align="right">Último acceso</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {data.team_members.map((miembro) => (
                      <TR key={miembro.id}>
                        <TD>
                          <span className="text-sm">{miembro.email}</span>
                        </TD>
                        <TD>
                          <span className="text-sm texto-suave">
                            {traducir(roleLabels, miembro.rol)}
                          </span>
                        </TD>
                        <TD>
                          <TeamMemberStatusBadge estado={miembro.estado} />
                        </TD>
                        <TD align="right">
                          {miembro.estado === 'invitado' ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => reenviar.mutate(miembro.id)}
                              disabled={reenviar.isPending}
                            >
                              <Mail />
                              Reenviar
                            </Button>
                          ) : (
                            <span className="text-xs texto-suave">
                              {miembro.ultimo_acceso_en
                                ? formatearFechaHora(miembro.ultimo_acceso_en)
                                : traducir(teamMemberStatusLabels, miembro.estado)}
                            </span>
                          )}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        abierto={confirmarEstado}
        onCambio={setConfirmarEstado}
        titulo={suspendida ? 'Reactivar la empresa' : 'Suspender la empresa'}
        descripcion={
          suspendida
            ? 'Sus miembros del equipo van a poder volver a ingresar al panel.'
            : 'Sus miembros del equipo no van a poder ingresar al panel.'
        }
        etiquetaConfirmar={suspendida ? 'Reactivar' : 'Suspender'}
        tono={suspendida ? 'primary' : 'danger'}
        cargando={cambiarEstado.isPending}
        onConfirmar={() => cambiarEstado.mutate(suspendida ? 'activa' : 'suspendida')}
      >
        {!suspendida ? (
          <Alert tone="info">
            No se dan de baja cuentas ni dispositivos: el servicio de sus clientes finales sigue
            funcionando. Sólo se bloquea el acceso al panel.
          </Alert>
        ) : null}
      </ConfirmDialog>

      {cambiarPlan ? (
        <ChangePlanDialog
          empresaId={data.id}
          actualId={data.modalidad_comercial?.id}
          abierto={cambiarPlan}
          onCambio={setCambiarPlan}
        />
      ) : null}

      {editarDatos ? (
        <ResellerEditDialog
          empresaId={data.id}
          valoresIniciales={{
            razon_social: data.razon_social,
            cuit: data.cuit,
            direccion: data.direccion,
            nombre_contacto: data.nombre_contacto,
            apellido_contacto: data.apellido_contacto,
            telefono_contacto: data.telefono_contacto,
            email_contacto: data.email_contacto,
            sitio_web: data.sitio_web,
            cuentas_max_crear_mensual: data.cuentas_max_crear_mensual,
          }}
          abierto
          onCambio={setEditarDatos}
        />
      ) : null}
    </>
  );
};

/**
 * Cambio de modalidad comercial o escala (flujo 4.5).
 * Potestad exclusiva del Operador Principal, tanto para bajar como para subir.
 */
const ChangePlanDialog = ({
  empresaId,
  actualId,
  abierto,
  onCambio,
}: {
  empresaId: string;
  actualId?: string;
  abierto: boolean;
  onCambio: (abierto: boolean) => void;
}) => {
  const queryClient = useQueryClient();
  const [modalidadId, setModalidadId] = useState(actualId ?? '');
  const [motivo, setMotivo] = useState('');

  const modalidades = useQuery({
    queryKey: ['commercial-plans', 'vigentes'],
    queryFn: () =>
      api<Paginado<CommercialPlan>>('/commercial-plans', {
        params: { only_current: 'true', per_page: 100 },
      }),
  });

  const cambiar = useMutation({
    mutationFn: () =>
      api(`/resellers/${empresaId}/commercial-plan`, {
        metodo: 'POST',
        body: { modalidad_comercial_id: modalidadId, motivo: motivo.trim() || undefined },
      }),
    onSuccess: () => {
      toast.success('Modalidad comercial actualizada');
      void queryClient.invalidateQueries({ queryKey: ['reseller', empresaId] });
      void queryClient.invalidateQueries({ queryKey: ['resellers'] });
      onCambio(false);
    },
    onError: (causa: ApiError) => toast.error(causa.message),
  });

  return (
    <Dialog open={abierto} onOpenChange={onCambio}>
      <DialogContent
        titulo="Cambiar la modalidad comercial"
        descripcion="Aplica tanto para bajar como para subir de escala, según lo pactado con la empresa."
      >
        <div className="space-y-4">
          <Field label="Modalidad" htmlFor="modalidad-nueva" required>
            <Select
              id="modalidad-nueva"
              value={modalidadId}
              onChange={setModalidadId}
              placeholder={modalidades.isLoading ? 'Cargando…' : 'Seleccione una modalidad'}
              opciones={(modalidades.data?.data ?? []).map((modalidad) => ({
                value: modalidad.id,
                label: `${traducir(commercialPlanTypeLabels, modalidad.tipo)} · ${modalidad.escala}`,
                help: formatearImporte(modalidad.precio_por_cuenta),
              }))}
            />
          </Field>

          <Field
            label="Motivo"
            htmlFor="motivo"
            help="Queda registrado en la auditoría junto al valor anterior y el nuevo."
          >
            <Input
              id="motivo"
              value={motivo}
              onChange={(evento) => setMotivo(evento.target.value)}
              placeholder="Acuerdo comercial de agosto"
            />
          </Field>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => onCambio(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={() => cambiar.mutate()}
              disabled={!modalidadId || modalidadId === actualId || cambiar.isPending}
            >
              {cambiar.isPending ? 'Aplicando…' : 'Aplicar cambio'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
