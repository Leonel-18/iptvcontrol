import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { api, ApiError, type Paginado } from '@/lib/api';
import { useSesion } from '@/lib/session';
import type { InvitationResult, Reseller } from '@/lib/types';
import { roleLabels } from '@/i18n/entityLabels';
import { Alert, Button, Field, Input } from '@/components/ui/primitives';
import { Dialog, DialogContent, Select } from '@/components/ui/overlays';

/**
 * Invitación de un Team Member.
 *
 * En el MVP los roles reales son `operator_admin` y `reseller_admin`. Los
 * `*_staff` figuran en el glosario pero están reservados para cuando haga falta
 * distinguir permisos internos (por ejemplo ventas y soporte), así que no se
 * ofrecen todavía para no prometer algo que el backend no diferencia.
 */
export const TeamMemberForm = ({
  abierto,
  onCambio,
  onInvitado,
}: {
  abierto: boolean;
  onCambio: (abierto: boolean) => void;
  onInvitado: (resultado: InvitationResult) => void;
}) => {
  const { esOperador } = useSesion();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState(esOperador ? 'operator_admin' : 'reseller_admin');
  const [empresaId, setEmpresaId] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});

  const empresas = useQuery({
    queryKey: ['resellers', 'para-invitacion'],
    queryFn: () => api<Paginado<Reseller>>('/resellers', { params: { per_page: 100 } }),
    enabled: esOperador,
  });

  const invitar = useMutation({
    mutationFn: () =>
      api<InvitationResult>('/team-members', {
        metodo: 'POST',
        body: {
          email: email.trim().toLowerCase(),
          nombre: nombre.trim() || undefined,
          rol,
          empresa_revendedora_id: rol.startsWith('reseller') && esOperador ? empresaId : undefined,
        },
      }),
    onSuccess: (resultado) => {
      if (resultado.enviada) {
        toast.success('Invitación enviada');
        onInvitado(resultado);
      } else {
        toast.warning(resultado.motivo ?? 'El acceso quedó pendiente de invitación');
      }
      void queryClient.invalidateQueries({ queryKey: ['team-members'] });
      onCambio(false);
    },
    onError: (causa: ApiError) => toast.error(causa.message),
  });

  const validar = (): boolean => {
    const nuevos: Record<string, string> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      nuevos.email = 'Ingrese un correo válido.';
    }
    if (esOperador && rol.startsWith('reseller') && !empresaId) {
      nuevos.empresa = 'Indique a qué empresa revendedora pertenece.';
    }
    setErrores(nuevos);
    return Object.keys(nuevos).length === 0;
  };

  const rolesDisponibles = esOperador
    ? [
        { value: 'operator_admin', label: roleLabels.operator_admin },
        { value: 'reseller_admin', label: roleLabels.reseller_admin },
      ]
    : [{ value: 'reseller_admin', label: roleLabels.reseller_admin }];

  return (
    <Dialog open={abierto} onOpenChange={onCambio}>
      <DialogContent
        titulo="Invitar a alguien del equipo"
        descripcion="Recibe un enlace de un solo uso para definir su propia contraseña."
      >
        <div className="space-y-4">
          <Field label="Correo" htmlFor="email-invitado" required error={errores.email}>
            <Input
              id="email-invitado"
              type="email"
              value={email}
              onChange={(evento) => setEmail(evento.target.value)}
              autoFocus
            />
          </Field>

          <Field label="Nombre y apellido" htmlFor="nombre-invitado">
            <Input
              id="nombre-invitado"
              value={nombre}
              onChange={(evento) => setNombre(evento.target.value)}
            />
          </Field>

          <Field label="Rol" htmlFor="rol-invitado" required>
            <Select
              id="rol-invitado"
              value={rol}
              onChange={setRol}
              opciones={rolesDisponibles}
              disabled={rolesDisponibles.length === 1}
            />
          </Field>

          {esOperador && rol.startsWith('reseller') ? (
            <Field
              label="Empresa revendedora"
              htmlFor="empresa-invitado"
              required
              error={errores.empresa}
            >
              <Select
                id="empresa-invitado"
                value={empresaId}
                onChange={setEmpresaId}
                placeholder={empresas.isLoading ? 'Cargando…' : 'Seleccione una empresa'}
                opciones={(empresas.data?.data ?? []).map((empresa) => ({
                  value: empresa.id,
                  label: empresa.razon_social,
                  help: empresa.cuit,
                }))}
              />
            </Field>
          ) : null}

          <Alert tone="info">
            IPTVControl no guarda la contraseña de nadie: el enlace lleva a la pantalla del proveedor
            de identidad, donde la persona la define.
          </Alert>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => onCambio(false)} disabled={invitar.isPending}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (validar()) invitar.mutate();
              }}
              disabled={invitar.isPending}
            >
              {invitar.isPending ? 'Invitando…' : 'Enviar invitación'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
