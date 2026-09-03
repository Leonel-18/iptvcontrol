import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, PlugZap, Save, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import type { ConnectionTest, ProviderSettings } from '@/lib/types';
import { CopyableId, PageHeader } from '@/components/common';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/overlays';
import { ProviderSection } from './ProviderSection';

/**
 * =============================================================================
 * Configuración — `/settings`
 * =============================================================================
 * Menú de Parametrización del Operador Principal (docs/04, sección 9). Agrupa
 * dos secciones que tratan lo mismo —la integración con el Proveedor— para
 * evitar redundancia de pantallas y de datos:
 *
 *   1. "Conexión": credenciales de la API del Proveedor y parámetros de la
 *      integración (DNI inicial, reintentos, umbral, servicios, ciudad).
 *   2. "Proveedores": registros, paquetes y licencias (antes `/providers`).
 *
 * La sección activa viaja en el query string (`?section=`), de modo que
 * `/providers` puede redirigir a `/settings?section=providers` sin romper
 * enlaces guardados.
 *
 * Cosas no negociables que esta pantalla respeta:
 *  - El token se envía, nunca se recibe.
 *  - "Probar conexión" lo ejecuta el backend, nunca el navegador.
 * =============================================================================
 */
export const SettingsView = () => {
  const [params, setParams] = useSearchParams();
  const seccion = params.get('section') === 'providers' ? 'providers' : 'conexion';

  const cambiarSeccion = (siguiente: string) => {
    const nuevos = new URLSearchParams(params);
    if (siguiente === 'conexion') nuevos.delete('section');
    else nuevos.set('section', siguiente);
    setParams(nuevos, { replace: true });
  };

  return (
    <>
      <PageHeader
        eyebrow="Parametrización"
        titulo="Configuración"
        descripcion="Conexión con el proveedor de contenido, registros, paquetes y licencias."
      />

      <Tabs value={seccion} onValueChange={cambiarSeccion}>
        <TabsList>
          <TabsTrigger value="conexion">Conexión</TabsTrigger>
          <TabsTrigger value="providers">Proveedores</TabsTrigger>
        </TabsList>
        <TabsContent value="conexion">
          <ConnectionSection />
        </TabsContent>
        <TabsContent value="providers">
          <ProviderSection />
        </TabsContent>
      </Tabs>
    </>
  );
};

/**
 * Conexión con la API del Proveedor y parámetros de integración.
 */
const ConnectionSection = () => {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['settings-provider'],
    queryFn: () => api<ProviderSettings>('/settings/sensa'),
  });

  const [server, setServer] = useState('');
  const [port, setPort] = useState('443');
  const [usuario, setUsuario] = useState('');
  const [token, setToken] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [servicios, setServicios] = useState('');
  const [dniInicial, setDniInicial] = useState('');
  const [umbral, setUmbral] = useState('2');
  const [maxReintentos, setMaxReintentos] = useState('25');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [prueba, setPrueba] = useState<ConnectionTest | null>(null);

  // Se sincroniza el formulario cuando llegan los datos guardados.
  useEffect(() => {
    if (!data) return;
    setServer(data.server ?? '');
    setPort(String(data.port ?? 443));
    setUsuario(data.usuario ?? '');
    setCiudad(data.ciudad_por_defecto ?? 'Mendoza');
    setServicios(data.servicios_por_defecto ?? '1');
    setDniInicial(String(data.dni_inicial_sensa ?? ''));
    setUmbral(String(data.umbral_alerta_capacidad ?? 2));
    setMaxReintentos(String(data.max_reintentos_dni ?? 25));
  }, [data]);

  const guardar = useMutation({
    mutationFn: () =>
      api<ProviderSettings>('/settings/sensa', {
        metodo: 'PATCH',
        body: {
          server: server.trim(),
          port: Number(port),
          usuario: usuario.trim(),
          // Sólo se manda el token si se escribió uno nuevo: así no se sobrescribe
          // el guardado por accidente.
          token: token.trim() || undefined,
          ciudad_por_defecto: ciudad.trim() || undefined,
          servicios_por_defecto: servicios.trim() || undefined,
          dni_inicial_sensa: dniInicial ? Number(dniInicial) : undefined,
          umbral_alerta_capacidad: umbral ? Number(umbral) : undefined,
          max_reintentos_dni: maxReintentos ? Number(maxReintentos) : undefined,
        },
      }),
    onSuccess: () => {
      toast.success('Configuración guardada');
      setToken('');
      void queryClient.invalidateQueries({ queryKey: ['settings-provider'] });
    },
    onError: (causa: ApiError) => toast.error(causa.message),
  });

  const probar = useMutation({
    mutationFn: () =>
      api<ConnectionTest>('/settings/sensa/test-connection', {
        metodo: 'POST',
        // Si hay un token escrito, se prueba ése sin guardarlo todavía.
        body:
          token.trim() && server.trim() && usuario.trim()
            ? {
                server: server.trim(),
                port: Number(port),
                usuario: usuario.trim(),
                token: token.trim(),
              }
            : {},
      }),
    onSuccess: (resultado) => {
      setPrueba(resultado);
      if (resultado.ok) toast.success(resultado.mensaje);
      else toast.error(resultado.mensaje);
    },
    onError: (causa: ApiError) => toast.error(causa.message),
  });

  const validar = (): boolean => {
    const nuevos: Record<string, string> = {};
    if (!/^[A-Za-z0-9.\-_]+$/.test(server.trim())) {
      nuevos.server = 'Ingrese sólo el host, sin https:// ni barras.';
    }
    const puerto = Number(port);
    if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) {
      nuevos.port = 'El puerto debe estar entre 1 y 65535.';
    }
    if (usuario.trim().length === 0) nuevos.usuario = 'Ingrese el usuario de la API.';
    if (!data?.token_cargado && token.trim().length === 0) {
      nuevos.token = 'Ingrese el token la primera vez.';
    }
    if (servicios && !/^[1-7](\|[1-7])*$/.test(servicios.trim())) {
      nuevos.servicios = 'Use códigos del 1 al 7 separados por "|", por ejemplo 1|3|5.';
    }
    if (dniInicial && !/^\d{7,8}$/.test(dniInicial)) {
      nuevos.dniInicial = 'El proveedor exige un número de 7 u 8 dígitos.';
    }
    setErrores(nuevos);
    return Object.keys(nuevos).length === 0;
  };

  if (isLoading) return <Skeleton className="h-96" />;

  if (error) {
    return (
      <Alert tone="danger" titulo="No pudimos cargar la configuración">
        {(error as Error).message}
      </Alert>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Credenciales de la API</CardTitle>
        </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field
                label="Servidor"
                htmlFor="server"
                required
                error={errores.server}
                className="sm:col-span-2"
              >
                <Input
                  id="server"
                  value={server}
                  placeholder="api.sensa.com.ar"
                  onChange={(evento) => setServer(evento.target.value)}
                  className="font-mono"
                />
              </Field>

              <Field label="Puerto" htmlFor="port" required error={errores.port}>
                <Input
                  id="port"
                  value={port}
                  onChange={(evento) => setPort(evento.target.value)}
                  className="font-mono tabular-nums"
                />
              </Field>

              <Field label="Usuario" htmlFor="usuario" required error={errores.usuario}>
                <Input
                  id="usuario"
                  value={usuario}
                  onChange={(evento) => setUsuario(evento.target.value)}
                  className="font-mono"
                />
              </Field>

              <Field
                label="Token"
                htmlFor="token"
                required={!data?.token_cargado}
                error={errores.token}
                help={
                  data?.token_cargado
                    ? `Ya hay uno cargado (${data.token_pista}). Escriba uno nuevo sólo si quiere reemplazarlo.`
                    : 'Se guarda cifrado y no vuelve a mostrarse.'
                }
                className="sm:col-span-2"
              >
                <Input
                  id="token"
                  type="password"
                  value={token}
                  placeholder={data?.token_cargado ? '••••••••' : ''}
                  onChange={(evento) => setToken(evento.target.value)}
                  className="font-mono"
                  autoComplete="new-password"
                />
              </Field>
            </div>

            {data?.url_base ? (
              <Field label="URL que se va a usar">
                <div className="superficie-2 rounded border px-3 py-2">
                  <CopyableId valor={data.url_base} etiqueta="URL base" />
                </div>
              </Field>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => probar.mutate()}
                disabled={probar.isPending}
              >
                <PlugZap />
                {probar.isPending ? 'Probando…' : 'Probar conexión'}
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  if (validar()) guardar.mutate();
                }}
                disabled={guardar.isPending}
              >
                <Save />
                {guardar.isPending ? 'Guardando…' : 'Guardar cambios'}
              </Button>
            </div>

            {prueba ? (
              <Alert tone={prueba.ok ? 'success' : 'danger'}>
                <span className="flex items-start gap-2">
                  {prueba.ok ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                  ) : (
                    <XCircle className="mt-0.5 size-4 shrink-0" />
                  )}
                  <span>
                    {prueba.mensaje}
                    {prueba.codigo ? (
                      <span className="font-mono text-xs"> (código {prueba.codigo})</span>
                    ) : null}
                  </span>
                </span>
              </Alert>
            ) : null}

            <p className="text-xs texto-suave">
              La prueba se ejecuta desde el servidor: el token nunca sale hacia el navegador.
            </p>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Parámetros de la integración</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field
                label="Número inicial de identificador"
                htmlFor="dni-inicial"
                error={errores.dniInicial}
                help="El proveedor exige un número tipo DNI de 7 u 8 dígitos por cuenta. El sistema lo va incrementando solo."
              >
                <Input
                  id="dni-inicial"
                  value={dniInicial}
                  onChange={(evento) => setDniInicial(evento.target.value)}
                  className="font-mono tabular-nums"
                />
              </Field>

              {data ? (
                <p className="text-xs texto-suave">
                  Último identificador utilizado:{' '}
                  <span className="font-mono">{data.dni_actual_sensa}</span>
                </p>
              ) : null}

              <Field
                label="Umbral de alerta de capacidad"
                htmlFor="umbral"
                help="A partir de cuántos dispositivos ocupados se avisa que la cuenta está cerca del tope de 3."
              >
                <Input
                  id="umbral"
                  type="number"
                  min="1"
                  max="3"
                  value={umbral}
                  onChange={(evento) => setUmbral(evento.target.value)}
                  className="tabular-nums"
                />
              </Field>

              <Field
                label="Reintentos de identificador"
                htmlFor="max-reintentos"
                help="Cuántas veces se incrementa el identificador ante un rechazo por repetido antes de cortar y avisar."
              >
                <Input
                  id="max-reintentos"
                  type="number"
                  min="1"
                  max="200"
                  value={maxReintentos}
                  onChange={(evento) => setMaxReintentos(evento.target.value)}
                  className="tabular-nums"
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Valores por defecto de cada cuenta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field
                label="Contenido inicial"
                htmlFor="servicios"
                error={errores.servicios}
                help='Códigos de paquetes separados por "|". El paquete básico (1) es obligatorio.'
              >
                <Input
                  id="servicios"
                  value={servicios}
                  placeholder="1|3|5"
                  onChange={(evento) => setServicios(evento.target.value)}
                  className="font-mono"
                />
              </Field>

              <Field
                label="Ciudad"
                htmlFor="ciudad"
                help="El proveedor la exige al crear una cuenta. Es un dato técnico de la integración, no del cliente final."
              >
                <Input
                  id="ciudad"
                  value={ciudad}
                  onChange={(evento) => setCiudad(evento.target.value)}
                />
              </Field>
            </CardContent>
          </Card>
        </div>
      </div>
  );
};