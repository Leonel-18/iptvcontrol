import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { cn, formatearFechaHora } from '@/lib/utils';
import {
  prepararSonido,
  reproducirSonidoNotificacion,
} from '@/lib/notification-sound';
import type {
  AppNotification,
  NotificationCenter,
  NotificationSoundPreference,
} from '@/lib/types';
import { Button } from '@/components/ui/primitives';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/overlays';

/**
 * Campana del centro de notificaciones (HU-N01).
 *
 * Las notificaciones son del tenant; el estado leído/no leído es del usuario.
 * Se refresca sola cada 30 s. Al abrir una con acción contextual ("Ver cuenta")
 * se marca como leída y navega a la entidad.
 */
export const NotificationBell = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const centro = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api<NotificationCenter>('/notifications'),
    refetchInterval: 30_000,
  });

  const marcarLeida = useMutation({
    mutationFn: (id: string) => api(`/notifications/${id}/read`, { metodo: 'POST' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const marcarTodas = useMutation({
    mutationFn: () => api('/notifications/read-all', { metodo: 'POST' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const noLeidas = centro.data?.no_leidas ?? 0;
  const items = centro.data?.data ?? [];

  // Preferencia individual de sonido (HU-N05).
  const preferencia = useQuery({
    queryKey: ['me', 'notification-sound'],
    queryFn: () => api<NotificationSoundPreference>('/me/notification-sound'),
    staleTime: 5 * 60 * 1000,
  });
  const sonidoHabilitado = preferencia.data?.sonido_habilitado ?? false;

  // Habilita el audio en el primer gesto del usuario (política de autoplay).
  useEffect(() => {
    window.addEventListener('pointerdown', prepararSonido, { once: true });
    return () => window.removeEventListener('pointerdown', prepararSonido);
  }, []);

  // Suena sólo cuando aparece una notificación nueva sin leer.
  const noLeidasPrevias = useRef<number | null>(null);
  useEffect(() => {
    if (
      noLeidasPrevias.current !== null &&
      noLeidas > noLeidasPrevias.current &&
      sonidoHabilitado
    ) {
      reproducirSonidoNotificacion();
    }
    noLeidasPrevias.current = noLeidas;
  }, [noLeidas, sonidoHabilitado]);

  const abrir = (notificacion: AppNotification) => {
    if (!notificacion.leida) marcarLeida.mutate(notificacion.id);
    if (notificacion.accion_tipo === 'ver_cuenta' && notificacion.accion_ref_id) {
      navigate(`/accounts/${notificacion.accion_ref_id}`);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notificaciones">
          <Bell />
          {noLeidas > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-alert px-1 font-mono text-[0.5625rem] font-semibold leading-4 text-white">
              {noLeidas > 99 ? '99+' : noLeidas}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80 max-w-[92vw] p-0">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-sm font-semibold">Notificaciones</span>
          {noLeidas > 0 ? (
            <button
              type="button"
              onClick={() => marcarTodas.mutate()}
              disabled={marcarTodas.isPending}
              className="text-xs text-azure-600 hover:underline disabled:opacity-50 dark:text-azure-400"
            >
              Marcar todas
            </button>
          ) : null}
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm texto-suave">Sin notificaciones.</p>
          ) : (
            items.map((notificacion) => (
              <button
                key={notificacion.id}
                type="button"
                onClick={() => abrir(notificacion)}
                className={cn(
                  'flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-colors hover:bg-navy-50 dark:hover:bg-navy-800',
                  !notificacion.leida && 'bg-azure-50/60 dark:bg-azure-900/20',
                )}
              >
                <span className="flex items-center gap-2">
                  {!notificacion.leida ? (
                    <span className="size-1.5 shrink-0 rounded-full bg-azure-500" aria-hidden />
                  ) : null}
                  <span className="text-sm font-medium">{notificacion.titulo}</span>
                </span>
                <span className="text-xs texto-suave">{notificacion.mensaje}</span>
                <span className="text-2xs texto-suave">
                  {formatearFechaHora(notificacion.creado_en)}
                </span>
              </button>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
