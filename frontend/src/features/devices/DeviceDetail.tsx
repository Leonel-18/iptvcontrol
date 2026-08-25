import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, Trash2, UserCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { api, ApiError, type Paginado } from '@/lib/api';
import { useSesion } from '@/lib/session';
import { formatearFecha, formatearMac } from '@/lib/utils';
import type { AccountDevice, Customer } from '@/lib/types';
import { deviceStatusHelp } from '@/i18n/entityLabels';
import {
  CopyableId,
  DeviceStatusBadge,
  DeviceTypeBadge,
  DetailRow,
  PageHeader,
} from '@/components/common';
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  Skeleton,
  Textarea,
} from '@/components/ui/primitives';
import { ConfirmDialog, Dialog, DialogContent, Select } from '@/components/ui/overlays';

interface DeviceDetailData extends AccountDevice {
  cuenta: { id: string; proveedor_cuenta_id: string | null; es_exclusiva: boolean };
}

/**
 * Detalle de Dispositivo — `/devices/:id`.
 *
 * Concentra las tres acciones sobre un dispositivo suelto:
 *  - editar la nota interna,
 *  - baja individual (no afecta al resto de los dispositivos del cliente),
 *  - reasignación, sólo si está liberado.
 */
export const DeviceDetail = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { esOperador } = useSesion();
  const queryClient = useQueryClient();

  const [nota, setNota] = useState('');
  const [confirmarBaja, setConfirmarBaja] = useState(false);
  const [reasignar, setReasignar] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['device', id],
    queryFn: () => api<DeviceDetailData>(`/devices/${id}`),
    enabled: Boolean(id),
  });

  useEffect(() => {
    if (data && 'nota_descriptiva' in data) setNota(data.nota_descriptiva ?? '');
  }, [data]);

  const guardarNota = useMutation({
    mutationFn: () =>
      api(`/devices/${id}`, { metodo: 'PATCH', body: { nota_descriptiva: nota.trim() || null } }),
    onSuccess: () => {
      toast.success('Nota actualizada');
      void queryClient.invalidateQueries({ queryKey: ['device', id] });
    },
    onError: (causa: ApiError) => toast.error(causa.message),
  });

  const darDeBaja = useMutation({
    mutationFn: () => api(`/devices/${id}`, { metodo: 'DELETE' }),
    onSuccess: () => {
      toast.success('Dispositivo dado de baja. Queda disponible para reasignar.');
      setConfirmarBaja(false);
      void queryClient.invalidateQueries({ queryKey: ['devices'] });
      void queryClient.invalidateQueries({ queryKey: ['device', id] });
    },
    onError: (causa: ApiError) => toast.error(causa.message),
  });

  if (isLoading) return <Skeleton className="h-64" />;

  if (error || !data) {
    return (
      <Alert tone="danger" titulo="No pudimos cargar el dispositivo">
        {(error as Error)?.message ?? 'Verifique el enlace.'}
      </Alert>
    );
  }

  const bloqueado = data.estado === 'bloqueado_por_suspension';
  const disponible = data.estado === 'disponible';
  const activo = data.estado === 'activo';

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-3 -ml-2" onClick={() => navigate('/devices')}>
        <ArrowLeft />
        Volver a dispositivos
      </Button>

      <PageHeader
        eyebrow="Dispositivo"
        titulo={data.proveedor_device_id ?? 'Pendiente de activación'}
        descripcion={deviceStatusHelp[data.estado]}
        acciones={
          <>
            <DeviceTypeBadge tipo={data.tipo} />
            <DeviceStatusBadge estado={data.estado} vinculacion={data.estado_vinculacion} />
            {!esOperador && disponible ? (
              <Button variant="primary" size="sm" onClick={() => setReasignar(true)}>
                <UserCheck />
                Reasignar a un cliente
              </Button>
            ) : null}
            {!esOperador && activo ? (
              <Button variant="danger" size="sm" onClick={() => setConfirmarBaja(true)}>
                <Trash2 />
                Dar de baja
              </Button>
            ) : null}
          </>
        }
      />

      {bloqueado ? (
        <Alert tone="warning" titulo="Reservado por suspensión" className="mb-4">
          Este dispositivo está liberado en el proveedor pero reservado para su cliente suspendido.
          No se puede reasignar hasta que ese cliente pase a baja definitiva.
        </Alert>
      ) : null}

      {!data.proveedor_device_id && activo ? (
        <Alert tone="info" titulo="Esperando el primer inicio de sesión" className="mb-4">
          El cupo ya está habilitado en la cuenta. Cuando el cliente encienda el equipo, el sistema
          captura su identificador consultando al proveedor.
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Datos del dispositivo</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-[rgb(var(--borde))]">
              <DetailRow etiqueta="ID interno">
                <CopyableId valor={data.id} etiqueta="ID interno" />
              </DetailRow>
              <DetailRow etiqueta="ID en el proveedor">
                <CopyableId valor={data.proveedor_device_id} etiqueta="ID en proveedor" />
              </DetailRow>
              <DetailRow etiqueta="Cuenta">
                <Link
                  to={`/accounts/${data.cuenta.id}`}
                  className="id-tecnico text-azure-600 hover:underline dark:text-azure-400"
                >
                  {data.cuenta.proveedor_cuenta_id ?? data.cuenta.id.slice(0, 8)}
                </Link>
              </DetailRow>
              {!esOperador ? (
                <DetailRow etiqueta="MAC del equipo">
                  {data.mac ? (
                    <CopyableId valor={formatearMac(data.mac)} etiqueta="MAC" />
                  ) : (
                    <span className="texto-suave">No informada</span>
                  )}
                </DetailRow>
              ) : null}
              {!esOperador ? (
                <DetailRow etiqueta="Cliente">
                  {data.cliente_final ? (
                    <Link
                      to={`/customers/${data.cliente_final.id}`}
                      className="text-sm text-azure-600 hover:underline dark:text-azure-400"
                    >
                      {data.cliente_final.nombre} (N° {data.cliente_final.numero_cliente})
                    </Link>
                  ) : (
                    <span className="texto-suave">Sin cliente asignado</span>
                  )}
                </DetailRow>
              ) : null}
              <DetailRow etiqueta="Alta">{formatearFecha(data.creado_en)}</DetailRow>
            </dl>
          </CardContent>
        </Card>

        {!esOperador ? (
          <Card>
            <CardHeader>
              <CardTitle>Nota interna</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field
                label="Cómo identifica este equipo"
                htmlFor="nota-dispositivo"
                help="Sólo se ve en su panel. No se envía al proveedor."
              >
                <Textarea
                  id="nota-dispositivo"
                  value={nota}
                  onChange={(evento) => setNota(evento.target.value)}
                  rows={3}
                  placeholder="TV del living"
                />
              </Field>
              <Button
                variant="primary"
                size="sm"
                className="w-full"
                onClick={() => guardarNota.mutate()}
                disabled={guardarNota.isPending}
              >
                <Save />
                {guardarNota.isPending ? 'Guardando…' : 'Guardar nota'}
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <ConfirmDialog
        abierto={confirmarBaja}
        onCambio={setConfirmarBaja}
        titulo="Dar de baja el dispositivo"
        descripcion="Se elimina en el proveedor y se resta un dispositivo habilitado de la cuenta."
        etiquetaConfirmar="Dar de baja"
        tono="danger"
        cargando={darDeBaja.isPending}
        onConfirmar={() => darDeBaja.mutate()}
      >
        <Alert tone="info">
          No afecta a los demás dispositivos del cliente ni a su estado general. El dispositivo queda
          disponible para reasignar.
        </Alert>
      </ConfirmDialog>

      {reasignar ? (
        <ReassignDialog
          dispositivoId={data.id}
          abierto={reasignar}
          onCambio={setReasignar}
          onListo={() => {
            void queryClient.invalidateQueries({ queryKey: ['device', id] });
            void queryClient.invalidateQueries({ queryKey: ['devices'] });
          }}
        />
      ) : null}
    </>
  );
};

/**
 * Reasignación de un Dispositivo liberado.
 *
 * Riesgo aceptado y ya confirmado por Bruno (regla 6): el cliente nuevo recibe
 * las mismas credenciales que tenía el saliente y el sistema no rota la
 * contraseña. Se lo advierte acá para que quien opera lo tenga presente, no como
 * una pregunta abierta.
 */
const ReassignDialog = ({
  dispositivoId,
  abierto,
  onCambio,
  onListo,
}: {
  dispositivoId: string;
  abierto: boolean;
  onCambio: (abierto: boolean) => void;
  onListo: () => void;
}) => {
  const [clienteId, setClienteId] = useState('');

  const clientes = useQuery({
    queryKey: ['customers', 'activos-para-reasignar'],
    queryFn: () =>
      api<Paginado<Customer>>('/customers', { params: { status: 'activo', per_page: 100 } }),
  });

  const reasignar = useMutation({
    mutationFn: () =>
      api(`/devices/${dispositivoId}/reassign`, {
        metodo: 'POST',
        body: { customer_id: clienteId },
      }),
    onSuccess: () => {
      toast.success('Dispositivo reasignado');
      onListo();
      onCambio(false);
    },
    onError: (causa: ApiError) => toast.error(causa.message),
  });

  return (
    <Dialog open={abierto} onOpenChange={onCambio}>
      <DialogContent
        titulo="Reasignar el dispositivo"
        descripcion="Elija el cliente final que va a usar este dispositivo liberado."
      >
        <div className="space-y-4">
          <Field label="Cliente final" htmlFor="cliente-reasignar" required>
            <Select
              id="cliente-reasignar"
              value={clienteId}
              onChange={setClienteId}
              placeholder={clientes.isLoading ? 'Cargando clientes…' : 'Seleccione un cliente'}
              opciones={(clientes.data?.data ?? []).map((cliente) => ({
                value: cliente.id,
                label: `N° ${cliente.numero_cliente} — ${cliente.nombre_completo}`,
              }))}
            />
          </Field>

          <Alert tone="warning" titulo="Tenga en cuenta">
            El cliente nuevo va a recibir las mismas credenciales de esta cuenta que tenía el
            cliente anterior. El sistema no cambia la contraseña.
          </Alert>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => onCambio(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={() => reasignar.mutate()}
              disabled={!clienteId || reasignar.isPending}
            >
              {reasignar.isPending ? 'Reasignando…' : 'Reasignar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
