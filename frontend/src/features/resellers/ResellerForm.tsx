import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { api, ApiError, type Paginado } from '@/lib/api';
import type { CommercialPlan, InvitationResult, ResellerDetail } from '@/lib/types';
import { commercialPlanTypeLabels, traducir } from '@/i18n/entityLabels';
import { formatearImporte } from '@/lib/utils';
import { Alert, Button, Field, Input } from '@/components/ui/primitives';
import { Dialog, DialogContent, Select } from '@/components/ui/overlays';
import { CopyableId } from '@/components/common';

/**
 * Alta de Empresa Revendedora.
 *
 * Los datos son los de la regla de negocio 14 (razón social, CUIT, dirección,
 * contacto, teléfono, correo y sitio web opcional). No se envían al proveedor:
 * son administrativos y legales.
 *
 * Al confirmar, el backend crea el tenant y dispara la invitación del
 * `reseller_admin` al correo de contacto. Si Auth0 no está configurado todavía,
 * el alta igual se completa y el diálogo lo informa: no se pierde el trabajo por
 * una dependencia de infraestructura.
 */
export const ResellerForm = ({
  abierto,
  onCambio,
}: {
  abierto: boolean;
  onCambio: (abierto: boolean) => void;
}) => {
  const queryClient = useQueryClient();

  const [valores, setValores] = useState({
    razon_social: '',
    cuit: '',
    direccion: '',
    nombre_contacto: '',
    apellido_contacto: '',
    telefono_contacto: '',
    email_contacto: '',
    sitio_web: '',
    modalidad_comercial_id: '',
  });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [invitacion, setInvitacion] = useState<InvitationResult | null>(null);

  const modalidades = useQuery({
    queryKey: ['commercial-plans', 'vigentes'],
    queryFn: () =>
      api<Paginado<CommercialPlan>>('/commercial-plans', {
        params: { only_current: 'true', per_page: 100 },
      }),
  });

  const crear = useMutation({
    mutationFn: () =>
      api<{ empresa: ResellerDetail; invitacion: InvitationResult }>('/resellers', {
        metodo: 'POST',
        body: {
          razon_social: valores.razon_social.trim(),
          cuit: valores.cuit.replace(/\D/g, ''),
          direccion: valores.direccion.trim(),
          nombre_contacto: valores.nombre_contacto.trim(),
          apellido_contacto: valores.apellido_contacto.trim(),
          telefono_contacto: valores.telefono_contacto.trim(),
          email_contacto: valores.email_contacto.trim().toLowerCase(),
          sitio_web: valores.sitio_web.trim() || undefined,
          modalidad_comercial_id: valores.modalidad_comercial_id || undefined,
        },
      }),
    onSuccess: (resultado) => {
      toast.success('Empresa revendedora dada de alta');
      void queryClient.invalidateQueries({ queryKey: ['resellers'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setInvitacion(resultado.invitacion);
    },
    onError: (causa: ApiError) => toast.error(causa.message),
  });

  const actualizar = (clave: keyof typeof valores, valor: string) => {
    setValores((actual) => ({ ...actual, [clave]: valor }));
    setErrores((actual) => ({ ...actual, [clave]: '' }));
  };

  const validar = (): boolean => {
    const nuevos: Record<string, string> = {};
    if (valores.razon_social.trim().length < 2) nuevos.razon_social = 'Ingrese la razón social.';
    if (valores.cuit.replace(/\D/g, '').length !== 11) {
      nuevos.cuit = 'El CUIT debe tener 11 dígitos.';
    }
    if (valores.direccion.trim().length < 3) nuevos.direccion = 'Ingrese la dirección.';
    if (valores.nombre_contacto.trim().length < 2) nuevos.nombre_contacto = 'Ingrese el nombre.';
    if (valores.apellido_contacto.trim().length < 2) {
      nuevos.apellido_contacto = 'Ingrese el apellido.';
    }
    if (valores.telefono_contacto.replace(/\D/g, '').length < 6) {
      nuevos.telefono_contacto = 'Ingrese un teléfono válido.';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valores.email_contacto.trim())) {
      nuevos.email_contacto = 'Ingrese un correo válido: va a ser el usuario de acceso.';
    }
    setErrores(nuevos);
    return Object.keys(nuevos).length === 0;
  };

  // Después del alta, el diálogo muestra el resultado de la invitación.
  if (invitacion) {
    return (
      <Dialog open={abierto} onOpenChange={onCambio}>
        <DialogContent
          titulo="Empresa dada de alta"
          descripcion="Falta que su administrador defina la contraseña de acceso."
        >
          <div className="space-y-4">
            {invitacion.enviada ? (
              <>
                <Alert tone="success" titulo="Invitación generada">
                  Se creó el acceso para <strong>{valores.email_contacto}</strong>. El enlace es de
                  un solo uso y vence en{' '}
                  {Math.round((invitacion.expira_en_segundos ?? 0) / 3600)} horas.
                </Alert>
                {invitacion.url_invitacion ? (
                  <Field
                    label="Enlace de invitación"
                    help="Compártalo con el administrador de la empresa si no recibe el correo."
                  >
                    <div className="superficie-2 break-all rounded border p-2">
                      <CopyableId
                        valor={invitacion.url_invitacion}
                        etiqueta="Enlace"
                        mono={false}
                      />
                    </div>
                  </Field>
                ) : null}
              </>
            ) : (
              <Alert tone="warning" titulo="La empresa quedó creada, sin acceso todavía">
                {invitacion.motivo ??
                  'No se pudo generar la invitación. Reintente desde la sección Equipo.'}
              </Alert>
            )}

            <div className="flex justify-end">
              <Button variant="primary" onClick={() => onCambio(false)}>
                Listo
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={abierto} onOpenChange={onCambio}>
      <DialogContent
        titulo="Nueva empresa revendedora"
        descripcion="Datos administrativos y de contacto. No se envían al proveedor."
        className="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Razón social"
              htmlFor="razon-social"
              required
              error={errores.razon_social}
              className="sm:col-span-2"
            >
              <Input
                id="razon-social"
                value={valores.razon_social}
                onChange={(evento) => actualizar('razon_social', evento.target.value)}
                autoFocus
              />
            </Field>

            <Field label="CUIT" htmlFor="cuit" required error={errores.cuit}>
              <Input
                id="cuit"
                value={valores.cuit}
                placeholder="30716009226"
                onChange={(evento) => actualizar('cuit', evento.target.value)}
                className="font-mono"
              />
            </Field>

            <Field label="Teléfono" htmlFor="telefono" required error={errores.telefono_contacto}>
              <Input
                id="telefono"
                value={valores.telefono_contacto}
                onChange={(evento) => actualizar('telefono_contacto', evento.target.value)}
              />
            </Field>

            <Field
              label="Dirección"
              htmlFor="direccion"
              required
              error={errores.direccion}
              className="sm:col-span-2"
            >
              <Input
                id="direccion"
                value={valores.direccion}
                onChange={(evento) => actualizar('direccion', evento.target.value)}
              />
            </Field>

            <Field label="Nombre del contacto" htmlFor="nombre" required error={errores.nombre_contacto}>
              <Input
                id="nombre"
                value={valores.nombre_contacto}
                onChange={(evento) => actualizar('nombre_contacto', evento.target.value)}
              />
            </Field>

            <Field
              label="Apellido del contacto"
              htmlFor="apellido"
              required
              error={errores.apellido_contacto}
            >
              <Input
                id="apellido"
                value={valores.apellido_contacto}
                onChange={(evento) => actualizar('apellido_contacto', evento.target.value)}
              />
            </Field>

            <Field
              label="Correo de contacto"
              htmlFor="email"
              required
              error={errores.email_contacto}
              help="Es el usuario de acceso al panel y la base de los correos de cada cuenta."
              className="sm:col-span-2"
            >
              <Input
                id="email"
                type="email"
                value={valores.email_contacto}
                onChange={(evento) => actualizar('email_contacto', evento.target.value)}
              />
            </Field>

            <Field label="Sitio web" htmlFor="sitio-web" className="sm:col-span-2">
              <Input
                id="sitio-web"
                value={valores.sitio_web}
                placeholder="www.miisp.com.ar"
                onChange={(evento) => actualizar('sitio_web', evento.target.value)}
              />
            </Field>

            <Field
              label="Modalidad comercial"
              htmlFor="modalidad"
              help="Puede asignarla ahora o más adelante. La define siempre el operador principal."
              className="sm:col-span-2"
            >
              <Select
                id="modalidad"
                value={valores.modalidad_comercial_id}
                onChange={(valor) => actualizar('modalidad_comercial_id', valor)}
                placeholder={modalidades.isLoading ? 'Cargando…' : 'Sin asignar'}
                opciones={(modalidades.data?.data ?? []).map((modalidad) => ({
                  value: modalidad.id,
                  label: `${traducir(commercialPlanTypeLabels, modalidad.tipo)} · ${modalidad.escala}`,
                  help: formatearImporte(modalidad.precio_por_cuenta),
                }))}
              />
            </Field>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => onCambio(false)} disabled={crear.isPending}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (validar()) crear.mutate();
              }}
              disabled={crear.isPending}
            >
              {crear.isPending ? 'Dando de alta…' : 'Dar de alta'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
