import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, Save } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { useSesion } from '@/lib/session';
import { renderizarTokens } from '@/lib/utils';
import type { WhatsappTemplateData } from '@/lib/types';
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, Skeleton } from '@/components/ui/primitives';

/**
 * Plantilla de WhatsApp de la Empresa Revendedora (tarjeta para Configuración).
 *
 * La empresa arma su propio mensaje de credenciales usando tokens; al copiar
 * desde una Cuenta/Cliente, IPTVControl reemplaza los tokens por los datos
 * reales. No se ofrecen tokens sensibles (PIN, DNI, correo ni dirección).
 */
export const WhatsappTemplateSettings = () => {
  const queryClient = useQueryClient();
  const { sesion } = useSesion();
  const areaRef = useRef<HTMLTextAreaElement>(null);

  const plantilla = useQuery({
    queryKey: ['settings-whatsapp-template'],
    queryFn: () => api<WhatsappTemplateData>('/settings/whatsapp-template'),
  });

  const [contenido, setContenido] = useState('');
  const [tocado, setTocado] = useState(false);

  const tokens = plantilla.data?.tokens ?? [];
  const maximo = 4000;

  useMemo(() => {
    if (plantilla.data && !tocado) {
      setContenido(plantilla.data.contenido);
    }
  }, [plantilla.data, tocado]);

  const guardar = useMutation({
    mutationFn: () =>
      api<WhatsappTemplateData>('/settings/whatsapp-template', {
        metodo: 'PATCH',
        body: { contenido },
      }),
    onSuccess: (resultado) => {
      queryClient.setQueryData(['settings-whatsapp-template'], resultado);
      setTocado(false);
      toast.success('Plantilla de WhatsApp guardada');
    },
    onError: (causa: ApiError) => toast.error(causa.message),
  });

  const insertarToken = (token: string) => {
    const area = areaRef.current;
    setTocado(true);
    if (!area) {
      setContenido((actual) => `${actual}{{${token}}}`);
      return;
    }
    const inicio = area.selectionStart ?? contenido.length;
    const fin = area.selectionEnd ?? contenido.length;
    const siguiente = `${contenido.slice(0, inicio)}{{${token}}}${contenido.slice(fin)}`;
    setContenido(siguiente);
    requestAnimationFrame(() => {
      area.focus();
      const posicion = inicio + token.length + 4;
      area.setSelectionRange(posicion, posicion);
    });
  };

  const preview = useMemo(
    () =>
      renderizarTokens(contenido, {
        usuario: '30000001',
        password: '12345678',
        servicios: 'Básico · Universal Plus',
        empresa: sesion?.empresa_revendedora?.razon_social || 'Mi Empresa',
      }),
    [contenido, sesion?.empresa_revendedora?.razon_social],
  );

  const excede = contenido.length > maximo;

  if (plantilla.isLoading) return <Skeleton className="h-64" />;

  if (plantilla.error) {
    return (
      <Alert tone="danger" titulo="No pudimos cargar la plantilla de WhatsApp">
        {(plantilla.error as Error).message}
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Plantilla de WhatsApp</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert tone="info">
          Es el mensaje que se copia al presionar “Copiar plantilla” en una Cuenta o Cliente Final.
          Use los tokens para que el sistema complete los datos reales. No se envían PIN, DNI ni
          datos de contacto del cliente.
        </Alert>

        <div>
          <div className="mb-1.5 flex flex-wrap gap-1.5">
            <span className="text-sm font-medium">Variables disponibles:</span>
            {tokens.map(({ token, etiqueta }) => (
              <button
                key={token}
                type="button"
                onClick={() => insertarToken(token)}
                className="rounded border bg-navy-50 px-2 py-0.5 font-mono text-xs text-azure-700 hover:bg-azure-50 dark:bg-navy-800 dark:text-azure-300"
                title={etiqueta}
              >
                {'{{'}{token}{'}}'}
              </button>
            ))}
          </div>

          <textarea
            ref={areaRef}
            value={contenido}
            onChange={(evento) => {
              setContenido(evento.target.value);
              setTocado(true);
            }}
            rows={12}
            maxLength={maximo + 200}
            aria-label="Plantilla de WhatsApp"
            className="w-full rounded border bg-transparent px-3 py-2 font-mono text-sm outline-none focus:border-azure-400"
          />
          <p className={`text-right text-xs ${excede ? 'text-alert' : 'texto-suave'}`}>
            {contenido.length} / {maximo}
          </p>
        </div>

        <div className="superficie-2 rounded border px-3 py-2">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-medium texto-suave">
            <Eye className="size-3.5" />
            Vista previa (con datos de ejemplo)
          </p>
          <pre className="whitespace-pre-wrap font-sans text-sm">{preview}</pre>
        </div>

        <div className="flex justify-end">
          <Button
            variant="primary"
            onClick={() => guardar.mutate()}
            disabled={guardar.isPending || excede || contenido.trim().length === 0}
          >
            <Save />
            {guardar.isPending ? 'Guardando…' : 'Guardar plantilla'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
