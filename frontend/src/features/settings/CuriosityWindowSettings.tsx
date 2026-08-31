import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CuriosityDurationInput } from '@/components/CuriosityDurationInput';
import { PageHeader } from '@/components/common';
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, Skeleton } from '@/components/ui/primitives';
import { api, ApiError } from '@/lib/api';
import type { CuriosityWindowSettings as CuriosityWindowSettingsData } from '@/lib/types';

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

  if (settings.isLoading) return <Skeleton className="h-64" />;

  if (settings.error) {
    return (
      <Alert tone="danger" titulo="No pudimos cargar la configuración">
        {(settings.error as Error).message}
      </Alert>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Configuración"
        titulo="Ventana de curiosidad"
        descripcion="Defina cuánto tiempo queda reservada una Cuenta compartida antes de volver a estar disponible para otra venta."
      />

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Duración predeterminada</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <Alert tone="info">
            Este valor se propone en cada alta compartida. Puede reducirlo para una venta puntual,
            incluso a cero, sin cambiar la configuración general.
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
    </>
  );
};
