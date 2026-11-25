import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Plus, RotateCw, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { api, ApiError, type Paginado } from '@/lib/api';
import { copiarAlPortapapeles, formatearFechaHora } from '@/lib/utils';
import type {
  IntegrationCredential,
  IntegrationCredentialCreated,
  IntegrationScope,
  Reseller,
  TeamMember,
} from '@/lib/types';
import { CopyableId } from '@/components/common';
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
} from '@/components/ui/primitives';
import {
  ConfirmDialog,
  Dialog,
  DialogContent,
  Select,
  Switch,
} from '@/components/ui/overlays';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';

const SCOPES: { value: IntegrationScope; label: string; help: string }[] = [
  {
    value: 'whatsapp_bot',
    label: 'Bot de WhatsApp',
    help: 'Alta de Clientes Finales desde un sistema externo.',
  },
  {
    value: 'portal_cliente',
    label: 'Portal de Cliente',
    help: 'Consulta y administración de credenciales y dispositivos por DNI.',
  },
];

const SCOPES_TODOS: IntegrationScope[] = SCOPES.map((scope) => scope.value);

const baseUrl = () => {
  const configurada = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';
  return new URL(configurada, window.location.origin).toString().replace(/\/$/, '');
};

/**
 * Credenciales de integración por Empresa Revendedora.
 *
 * Una key sirve para cualquier API de integración habilitada por sus `scopes`.
 * La key completa se muestra una única vez al crearla o rotarla.
 */
export const IntegrationsSettings = () => {
  const queryClient = useQueryClient();
  const [incluirRevocadas, setIncluirRevocadas] = useState(false);
  const [crearAbierto, setCrearAbierto] = useState(false);
  const [creada, setCreada] = useState<IntegrationCredentialCreated | null>(null);
  const [aRevocar, setARevocar] = useState<IntegrationCredential | null>(null);
  const [aRotar, setARotar] = useState<IntegrationCredential | null>(null);

  const [empresaId, setEmpresaId] = useState('');
  const [nombre, setNombre] = useState('');
  const [scopes, setScopes] = useState<IntegrationScope[]>(SCOPES_TODOS);
  const [teamMemberId, setTeamMemberId] = useState('');
  const [error, setError] = useState('');

  const credenciales = useQuery({
    queryKey: ['integration-credentials', incluirRevocadas],
    queryFn: () =>
      api<IntegrationCredential[]>('/integrations/credentials', {
        params: { incluir_revocadas: incluirRevocadas || undefined },
      }),
  });

  const resellers = useQuery({
    queryKey: ['resellers', 'integraciones'],
    queryFn: () => api<Paginado<Reseller>>('/resellers', { params: { per_page: 100 } }),
  });

  const teamMembers = useQuery({
    queryKey: ['team-members', 'integraciones', empresaId],
    queryFn: () =>
      api<Paginado<TeamMember>>('/team-members', {
        params: { per_page: 100, reseller_id: empresaId },
      }),
    enabled: Boolean(empresaId),
  });

  const invalidar = () =>
    queryClient.invalidateQueries({ queryKey: ['integration-credentials'] });

  const crear = useMutation({
    mutationFn: () =>
      api<IntegrationCredentialCreated>('/integrations/credentials', {
        metodo: 'POST',
        body: {
          empresa_revendedora_id: empresaId,
          nombre: nombre.trim(),
          scopes,
          team_member_id: teamMemberId || undefined,
        },
      }),
    onSuccess: (resultado) => {
      setCrearAbierto(false);
      setCreada(resultado);
      setNombre('');
      setTeamMemberId('');
      setEmpresaId('');
      setScopes(SCOPES_TODOS);
      setError('');
      void invalidar();
    },
    onError: (causa: ApiError) => toast.error(causa.message),
  });

  const revocar = useMutation({
    mutationFn: (id: string) =>
      api<IntegrationCredential>(`/integrations/credentials/${id}/revoke`, { metodo: 'POST' }),
    onSuccess: () => {
      toast.success('Credencial revocada.');
      setARevocar(null);
      void invalidar();
    },
    onError: (causa: ApiError) => toast.error(causa.message),
  });

  const rotar = useMutation({
    mutationFn: (id: string) =>
      api<IntegrationCredentialCreated>(`/integrations/credentials/${id}/rotate`, {
        metodo: 'POST',
      }),
    onSuccess: (resultado) => {
      setARotar(null);
      setCreada(resultado);
      void invalidar();
    },
    onError: (causa: ApiError) => toast.error(causa.message),
  });

  const opcionesEmpresas = useMemo(
    () =>
      (resellers.data?.data ?? []).map((reseller) => ({
        value: reseller.id,
        label: reseller.razon_social,
        help: reseller.estado === 'suspendida' ? 'Suspendida' : undefined,
      })),
    [resellers.data],
  );

  const opcionesTeamMembers = useMemo(
    () =>
      (teamMembers.data?.data ?? []).map((member) => ({
        value: member.id,
        label: member.nombre ? `${member.nombre} (${member.email})` : member.email,
      })),
    [teamMembers.data],
  );

  const alternarScope = (scope: IntegrationScope, activo: boolean) => {
    setScopes((actuales) =>
      activo ? [...new Set([...actuales, scope])] : actuales.filter((item) => item !== scope),
    );
  };

  const enviar = () => {
    if (!empresaId) return setError('Seleccione la Empresa Revendedora.');
    if (nombre.trim().length < 2) return setError('Ingrese un nombre de al menos 2 caracteres.');
    if (scopes.length === 0) return setError('Seleccione al menos una API.');
    setError('');
    crear.mutate();
  };

  const copiarKey = async () => {
    if (!creada) return;
    const ok = await copiarAlPortapapeles(creada.api_key);
    if (ok) toast.success('Key copiada');
    else toast.error('No se pudo copiar. Seleccione el texto y copie a mano.');
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Credenciales de integración</CardTitle>
            <p className="text-sm texto-suave">
              Una key por Empresa Revendedora, usable en el bot de WhatsApp, el Portal de Cliente o
              cualquier integración futura. La key completa se muestra una sola vez.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={incluirRevocadas}
                onCheckedChange={setIncluirRevocadas}
                aria-label="Mostrar credenciales revocadas"
              />
              Mostrar revocadas
            </label>
            <Button variant="primary" size="sm" onClick={() => setCrearAbierto(true)}>
              <Plus />
              Nueva credencial
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Alert tone="info">
            Entregue la key solo por un canal seguro. El sistema no permite volver a verla: si se
            pierde, hay que rotarla.
          </Alert>

          {credenciales.isLoading ? (
            <Skeleton className="h-40" />
          ) : credenciales.error ? (
            <Alert tone="danger" titulo="No pudimos cargar las credenciales">
              {(credenciales.error as Error).message}
            </Alert>
          ) : (credenciales.data ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm texto-suave">
              Todavía no hay credenciales de integración.
            </p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Empresa</TH>
                  <TH>Credencial</TH>
                  <TH>APIs</TH>
                  <TH>Estado</TH>
                  <TH>Último uso</TH>
                  <TH>Creada</TH>
                  <TH align="right">Acciones</TH>
                </TR>
              </THead>
              <TBody>
                {(credenciales.data ?? []).map((credencial) => (
                  <TR key={credencial.id}>
                    <TD>{credencial.empresa.razon_social}</TD>
                    <TD>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm">{credencial.nombre}</span>
                        <span className="id-tecnico text-2xs texto-suave">
                          {credencial.prefijo}…
                        </span>
                        {credencial.team_member ? (
                          <span className="text-2xs texto-suave">
                            Autor: {credencial.team_member.nombre ?? credencial.team_member.email}
                          </span>
                        ) : null}
                      </div>
                    </TD>
                    <TD>
                      <div className="flex flex-wrap gap-1">
                        {credencial.scopes.map((scope) => (
                          <Badge key={scope} tone="neutral">
                            {SCOPES.find((item) => item.value === scope)?.label ?? scope}
                          </Badge>
                        ))}
                      </div>
                    </TD>
                    <TD>
                      <Badge tone={credencial.activa ? 'success' : 'neutral'}>
                        {credencial.activa ? 'Activa' : 'Revocada'}
                      </Badge>
                    </TD>
                    <TD>
                      <span className="whitespace-nowrap text-sm texto-suave">
                        {formatearFechaHora(credencial.ultimo_uso_en)}
                      </span>
                    </TD>
                    <TD>
                      <span className="whitespace-nowrap text-sm texto-suave">
                        {formatearFechaHora(credencial.creado_en)}
                      </span>
                    </TD>
                    <TD align="right">
                      {credencial.activa ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setARotar(credencial)}
                          >
                            <RotateCw />
                            Rotar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-alert hover:bg-alert/10"
                            onClick={() => setARevocar(credencial)}
                          >
                            <Trash2 />
                            Revocar
                          </Button>
                        </div>
                      ) : (
                        <span className="text-2xs texto-suave">
                          {formatearFechaHora(credencial.revocado_en)}
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

      <Dialog open={crearAbierto} onOpenChange={setCrearAbierto}>
        <DialogContent
          titulo="Nueva credencial de integración"
          descripcion="La key se genera al confirmar y se muestra una única vez."
        >
          <div className="space-y-4">
            <Field label="Empresa Revendedora" htmlFor="integracion-empresa" required>
              <Select
                id="integracion-empresa"
                value={empresaId || undefined}
                onChange={(valor) => {
                  setEmpresaId(valor);
                  setTeamMemberId('');
                }}
                opciones={opcionesEmpresas}
                placeholder="Seleccione una Empresa"
              />
            </Field>

            <Field label="Nombre de la credencial" htmlFor="integracion-nombre" required>
              <Input
                id="integracion-nombre"
                value={nombre}
                onChange={(evento) => setNombre(evento.target.value)}
                placeholder="Bot WhatsApp producción"
              />
            </Field>

            <div className="space-y-2">
              <p className="text-sm font-medium">APIs habilitadas</p>
              {SCOPES.map((scope) => (
                <label
                  key={scope.value}
                  className="flex items-start justify-between gap-3 rounded border p-3"
                >
                  <span>
                    <span className="text-sm font-medium">{scope.label}</span>
                    <span className="mt-0.5 block text-xs texto-suave">{scope.help}</span>
                  </span>
                  <Switch
                    checked={scopes.includes(scope.value)}
                    onCheckedChange={(activo) => alternarScope(scope.value, activo)}
                    aria-label={`Habilitar ${scope.label}`}
                  />
                </label>
              ))}
            </div>

            <Field
              label="Team Member para Auditoría"
              htmlFor="integracion-team-member"
              help="Opcional. Si se indica, las acciones de la integración quedan a nombre de ese usuario."
            >
              <Select
                id="integracion-team-member"
                value={teamMemberId || undefined}
                onChange={setTeamMemberId}
                opciones={opcionesTeamMembers}
                placeholder={
                  !empresaId
                    ? 'Seleccione primero una Empresa'
                    : teamMembers.isLoading
                      ? 'Cargando usuarios…'
                      : 'Sin autor asignado'
                }
                disabled={!empresaId || teamMembers.isLoading}
              />
            </Field>

            {error ? <Alert tone="danger">{error}</Alert> : null}

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setCrearAbierto(false)}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={enviar} disabled={crear.isPending}>
                <KeyRound />
                {crear.isPending ? 'Generando…' : 'Generar credencial'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(creada)} onOpenChange={(abierto) => !abierto && setCreada(null)}>
        <DialogContent
          titulo="Credencial generada"
          descripcion="Copiá la key ahora. Por seguridad no se vuelve a mostrar."
        >
          {creada ? (
            <div className="space-y-4">
              <Alert tone="warning">
                Guardá la key en el servidor del integrador. Si la perdés, hay que rotarla.
              </Alert>

              <Field label="Key de integración">
                <div className="superficie-2 space-y-2 rounded border px-3 py-2">
                  <CopyableId valor={creada.api_key} etiqueta="Credencial" className="break-all" />
                  <Button variant="secondary" size="sm" onClick={() => void copiarKey()}>
                    Copiar key
                  </Button>
                </div>
              </Field>

              <Field label="URL base">
                <div className="superficie-2 rounded border px-3 py-2">
                  <CopyableId valor={baseUrl()} etiqueta="URL base" />
                </div>
              </Field>

              <div className="space-y-1">
                <p className="eyebrow">Endpoints principales</p>
                <p className="id-tecnico text-xs">
                  POST {baseUrl()}/integration/whatsapp/customers
                </p>
                <p className="id-tecnico text-xs">
                  POST {baseUrl()}/integration/portal-cliente/session
                </p>
                <p className="text-xs texto-suave">
                  Todas las llamadas llevan el header <code>x-api-key</code>.
                </p>
              </div>

              <div className="flex justify-end">
                <Button variant="primary" onClick={() => setCreada(null)}>
                  Entendido
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        abierto={Boolean(aRevocar)}
        onCambio={(abierto) => !abierto && setARevocar(null)}
        titulo="Revocar credencial"
        descripcion="Las integraciones que usen esta key dejan de funcionar de inmediato."
        etiquetaConfirmar="Revocar"
        tono="danger"
        cargando={revocar.isPending}
        onConfirmar={() => aRevocar && revocar.mutate(aRevocar.id)}
      >
        <Alert tone="danger">
          {aRevocar
            ? `Se revoca ${aRevocar.nombre} de ${aRevocar.empresa.razon_social}.`
            : null}
        </Alert>
      </ConfirmDialog>

      <ConfirmDialog
        abierto={Boolean(aRotar)}
        onCambio={(abierto) => !abierto && setARotar(null)}
        titulo="Rotar credencial"
        descripcion="Se genera una key nueva y la anterior se revoca."
        etiquetaConfirmar="Rotar"
        cargando={rotar.isPending}
        onConfirmar={() => aRotar && rotar.mutate(aRotar.id)}
      >
        <Alert tone="warning">
          Al confirmar, la key anterior deja de funcionar de inmediato. Copiá la nueva y actualizá
          el integrador.
        </Alert>
      </ConfirmDialog>
    </div>
  );
};
