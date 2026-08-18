import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, Plus, UserMinus, UsersRound } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { api, ApiError, type Paginado } from '@/lib/api';
import { useSesion } from '@/lib/session';
import { formatearFecha, formatearFechaHora } from '@/lib/utils';
import type { InvitationResult, TeamMember } from '@/lib/types';
import { roleLabels, traducir } from '@/i18n/entityLabels';
import { CopyableId, PageHeader, TeamMemberStatusBadge } from '@/components/common';
import { TeamMemberForm } from './TeamMemberForm';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Field,
} from '@/components/ui/primitives';
import { ConfirmDialog, Dialog, DialogContent } from '@/components/ui/overlays';
import { Table, TableSkeleton, TBody, TD, TH, THead, TR } from '@/components/ui/table';

/**
 * Equipo — `/team-members`.
 *
 * Se llama "Team Member" y no "usuario" a propósito: el Cliente Final no tiene
 * acceso al sistema, así que usar la misma palabra para las dos cosas es lo que
 * genera errores de permisos (convención de rutas, sección 4.3).
 *
 * Excepción documentada: el primer `operator_admin` no se crea desde acá, sino
 * con el seed de despliegue — cuando se instala el sistema todavía no existe
 * nadie con permisos para crearlo.
 */
export const TeamMemberList = () => {
  const { esOperador } = useSesion();
  const queryClient = useQueryClient();
  const [alta, setAlta] = useState(false);
  const [aDesactivar, setADesactivar] = useState<TeamMember | null>(null);
  const [invitacion, setInvitacion] = useState<InvitationResult | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['team-members'],
    queryFn: () => api<Paginado<TeamMember>>('/team-members', { params: { per_page: 100 } }),
  });

  const reenviar = useMutation({
    mutationFn: (id: string) =>
      api<InvitationResult>(`/team-members/${id}/resend-invitation`, { metodo: 'POST' }),
    onSuccess: (resultado) => {
      if (resultado.enviada) {
        toast.success('Invitación reenviada');
        setInvitacion(resultado);
      } else {
        toast.warning(resultado.motivo ?? 'No se pudo reenviar la invitación');
      }
    },
    onError: (causa: ApiError) => toast.error(causa.message),
  });

  const desactivar = useMutation({
    mutationFn: (id: string) => api(`/team-members/${id}`, { metodo: 'DELETE' }),
    onSuccess: () => {
      toast.success('Acceso dado de baja');
      setADesactivar(null);
      void queryClient.invalidateQueries({ queryKey: ['team-members'] });
    },
    onError: (causa: ApiError) => toast.error(causa.message),
  });

  return (
    <>
      <PageHeader
        eyebrow="Accesos"
        titulo="Equipo"
        descripcion="Personas que pueden entrar al panel. El acceso se otorga por invitación: cada una define su propia contraseña."
        acciones={
          <Button variant="primary" size="sm" onClick={() => setAlta(true)}>
            <Plus />
            Invitar
          </Button>
        }
      />

      <Card>
        <Table>
          <THead>
            <TR>
              <TH>Correo</TH>
              <TH>Nombre</TH>
              <TH>Rol</TH>
              {esOperador ? <TH>Empresa</TH> : null}
              <TH>Estado</TH>
              <TH align="right">Último acceso</TH>
              <TH align="right" />
            </TR>
          </THead>

          {isLoading ? (
            <TableSkeleton columnas={esOperador ? 7 : 6} />
          ) : (
            <TBody>
              {data?.data.map((miembro) => (
                <TR key={miembro.id}>
                  <TD>
                    <span className="text-sm font-medium">{miembro.email}</span>
                  </TD>
                  <TD>
                    <span className="text-sm texto-suave">{miembro.nombre ?? '—'}</span>
                  </TD>
                  <TD>
                    <span className="text-sm">{traducir(roleLabels, miembro.rol)}</span>
                  </TD>
                  {esOperador ? (
                    <TD>
                      <span className="text-sm texto-suave">
                        {miembro.empresa_revendedora?.razon_social ?? 'Operador principal'}
                      </span>
                    </TD>
                  ) : null}
                  <TD>
                    <TeamMemberStatusBadge estado={miembro.estado} />
                  </TD>
                  <TD align="right">
                    <span className="text-xs texto-suave">
                      {miembro.ultimo_acceso_en
                        ? formatearFechaHora(miembro.ultimo_acceso_en)
                        : `Invitado el ${formatearFecha(miembro.creado_en)}`}
                    </span>
                  </TD>
                  <TD align="right">
                    <div className="flex justify-end gap-1">
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
                      ) : null}
                      {miembro.estado !== 'inactivo' ? (
                        <Button variant="ghost" size="sm" onClick={() => setADesactivar(miembro)}>
                          <UserMinus />
                          Dar de baja
                        </Button>
                      ) : null}
                    </div>
                  </TD>
                </TR>
              ))}

              {data && data.data.length === 0 ? (
                <TR>
                  <TD colSpan={esOperador ? 7 : 6}>
                    <EmptyState
                      icono={<UsersRound className="size-8" />}
                      titulo="No hay accesos creados"
                      descripcion="Invite a alguien de su equipo para que pueda operar el panel."
                      accion={
                        <Button variant="primary" size="sm" onClick={() => setAlta(true)}>
                          Invitar
                        </Button>
                      }
                    />
                  </TD>
                </TR>
              ) : null}
            </TBody>
          )}
        </Table>
      </Card>

      {alta ? (
        <TeamMemberForm
          abierto={alta}
          onCambio={setAlta}
          onInvitado={(resultado) => setInvitacion(resultado)}
        />
      ) : null}

      <ConfirmDialog
        abierto={Boolean(aDesactivar)}
        onCambio={(abierto) => !abierto && setADesactivar(null)}
        titulo="Dar de baja el acceso"
        descripcion={`${aDesactivar?.email ?? ''} no va a poder volver a ingresar al panel.`}
        etiquetaConfirmar="Dar de baja"
        tono="danger"
        cargando={desactivar.isPending}
        onConfirmar={() => aDesactivar && desactivar.mutate(aDesactivar.id)}
      />

      {/* Enlace de invitación, para pasarlo a mano si el correo no llega */}
      {invitacion?.url_invitacion ? (
        <Dialog open onOpenChange={() => setInvitacion(null)}>
          <DialogContent
            titulo="Invitación generada"
            descripcion="Enlace de un solo uso para definir la contraseña."
          >
            <div className="space-y-4">
              <Field
                label="Enlace"
                help={`Vence en ${Math.round((invitacion.expira_en_segundos ?? 0) / 3600)} horas.`}
              >
                <div className="superficie-2 break-all rounded border p-2">
                  <CopyableId valor={invitacion.url_invitacion} etiqueta="Enlace" mono={false} />
                </div>
              </Field>
              <Alert tone="info">
                El enlace lleva a la pantalla del proveedor de identidad, donde la persona elige su
                contraseña. Nadie más la conoce.
              </Alert>
              <div className="flex justify-end">
                <Button variant="primary" onClick={() => setInvitacion(null)}>
                  Listo
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
};
