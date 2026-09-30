import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Alert, Card, CardContent, CardHeader, CardTitle, Skeleton } from '@/components/ui/primitives';
import { api, ApiError } from '@/lib/api';
import { prepararSonido, reproducirSonidoNotificacion } from '@/lib/notification-sound';
import type { NotificationSoundPreference } from '@/lib/types';

/**
 * Preferencias del usuario (HU-N05).
 *
 * El sonido de notificaciones es individual: dos usuarios de la misma empresa
 * pueden tener configuraciones distintas. No afecta la generación de avisos,
 * sólo su presentación.
 */
export const UserPreferences = () => {
  const queryClient = useQueryClient();
  const [sonido, setSonido] = useState(true);

  const consulta = useQuery({
    queryKey: ['me', 'notification-sound'],
    queryFn: () => api<NotificationSoundPreference>('/me/notification-sound'),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (consulta.data) setSonido(consulta.data.sonido_habilitado);
  }, [consulta.data]);

  const guardar = useMutation({
    mutationFn: (valor: boolean) =>
      api<NotificationSoundPreference>('/me/notification-sound', {
        metodo: 'PATCH',
        body: { sonido_habilitado: valor },
      }),
    onSuccess: (resultado) => {
      queryClient.setQueryData(['me', 'notification-sound'], resultado);
    },
    onError: (causa: ApiError) => toast.error(causa.message),
  });

  const alternar = (valor: boolean) => {
    setSonido(valor);
    guardar.mutate(valor);
    // Un gesto del usuario alcanza para habilitar el audio del navegador.
    if (valor) {
      prepararSonido();
      reproducirSonidoNotificacion();
    }
  };

  if (consulta.isLoading) return <Skeleton className="h-32" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preferencias</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={sonido}
            onChange={(evento) => alternar(evento.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-azure-500"
          />
          <span>
            <span className="block text-sm font-semibold">Sonido de notificaciones</span>
            <span className="mt-0.5 block text-xs texto-suave">
              Reproduce un aviso sonoro al recibir una notificación nueva. Es una preferencia de tu
              usuario: no afecta a los demás. Si el navegador bloquea el audio, se ignora.
            </span>
          </span>
        </label>
        <Alert tone="info">
          Desactivar el sonido no deja de recibir notificaciones: sólo las muestra en silencio.
        </Alert>
      </CardContent>
    </Card>
  );
};
