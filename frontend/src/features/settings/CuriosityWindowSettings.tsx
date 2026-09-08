import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CuriosityDurationInput } from '@/components/CuriosityDurationInput';
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, Skeleton } from '@/components/ui/primitives';
import { api, ApiError } from '@/lib/api';
import type { CuriosityWindowSettings as CuriosityWindowSettingsData } from '@/lib/types';

/** Configuración de la Ventana de Alta (tarjeta para la sección Configuración). */
export const CuriosityWindowSettings = () => {
  const queryClient = useQueryClient();
  const [duration, setDuration] = useState(0);

  const settings = useQuery({
    queryKey: ['settings-curiosity-window'],
    queryFn: () => api<CuriosityWindowSettingsData>('/settings/curiosity-window'),
  });

  useEffect(() => {
    if (settings.data) {
      setDuration(settings.data.duracion_predeterminada_minutos);
    }
  }, [settings.data]);

  const save = useMutation({
    mutationFn: () =>
      api<CuriosityWindowSettingsData>('/settings/curiosity-window', {
        metodo: 'PATCH',
        body: { duracion_predeterminada_minutos: duration },
      }),
    onSuccess: (result) => {
      setDuration(result.duracion_predeterminada_minutos);
      queryClient.setQueryData(['settings-curiosity-window'], result);
      toast.success('Duración predeterminada guardada');
    },
    onError: (cause: ApiError) => toast.error(cause.message),
  });

  if (settings.isLoading) return <Skeleton className="h-56" />;

  if (settings.error) {
    return (
      <Alert tone="danger" titulo="No pudimos cargar la configuración">
        {(settings.error as Error).message}
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ventana de Alta</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <Alert tone="info">
          Esta es la duración que viene por defecto en cada alta compartida. No es un límite: en
          cada venta el vendedor puede poner la duración que quiera. Con 0 la venta puede sumarse
          a una Cuenta compartida existente; con una duración mayor a 0 se crea una Cuenta nueva
          propia para esa venta.
        </Alert>

        <CuriosityDurationInput value={duration} onChange={setDuration} />

        <div className="flex justify-end">
          <Button variant="primary" onClick={() => save.mutate()} disabled={save.isPending}>
            <Save />
            {save.isPending ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
