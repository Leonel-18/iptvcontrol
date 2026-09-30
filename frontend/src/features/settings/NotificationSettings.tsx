import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Separator,
  Skeleton,
} from '@/components/ui/primitives';
import { api, ApiError } from '@/lib/api';
import type { NotificationSettings as NotificationSettingsData } from '@/lib/types';

/** Convierte "7, 3 1" en [7, 3, 1]: enteros únicos, sin negativos, de mayor a menor. */
const parsearDias = (valor: string): number[] =>
  Array.from(
    new Set(
      valor
        .split(/[\s,;]+/)
        .map((parte) => Number(parte))
        .filter((numero) => Number.isInteger(numero) && numero >= 1),
    ),
  ).sort((a, b) => b - a);

/**
 * Preferencias de notificaciones internas (HU-N02).
 *
 * Los hitos de vencimiento se expresan como múltiples días de anticipación (no
 * spam periódico). La frecuencia de dispositivos define cada cuánto recordar el
 * mismo evento pendiente. Los hitos de prueba los parametriza el Operador
 * Principal y acá se muestran como referencia.
 */
export const NotificationSettings = () => {
  const queryClient = useQueryClient();
  const [dispositivos, setDispositivos] = useState(true);
  const [frecuencia, setFrecuencia] = useState('24');
  const [ventanaAlta, setVentanaAlta] = useState(true);
  const [ventanaDias, setVentanaDias] = useState('');
  const [error, setError] = useState('');

  const consulta = useQuery({
    queryKey: ['settings', 'notifications'],
    queryFn: () => api<NotificationSettingsData>('/settings/notifications'),
  });

  useEffect(() => {
    if (consulta.data) {
      setDispositivos(consulta.data.dispositivos.habilitados);
      setFrecuencia(String(consulta.data.dispositivos.frecuencia_horas));
      setVentanaAlta(consulta.data.ventana_alta.habilitados);
      setVentanaDias(consulta.data.ventana_alta.dias.join(', '));
    }
  }, [consulta.data]);

  const guardar = useMutation({
    mutationFn: () =>
      api<NotificationSettingsData>('/settings/notifications', {
        metodo: 'PATCH',
        body: {
          dispositivos_habilitados: dispositivos,
          dispositivos_frecuencia_horas: Number(frecuencia),
          ventana_alta_habilitados: ventanaAlta,
          ventana_alta_dias: parsearDias(ventanaDias),
        },
      }),
    onSuccess: (resultado) => {
      queryClient.setQueryData(['settings', 'notifications'], resultado);
      toast.success('Preferencias de notificaciones guardadas');
    },
    onError: (causa: ApiError) => toast.error(causa.message),
  });

  if (consulta.isLoading) return <Skeleton className="h-64" />;
  if (consulta.isError) {
    return (
      <Alert tone="danger" titulo="No pudimos cargar las notificaciones">
        {(consulta.error as Error).message}
      </Alert>
    );
  }

  const guardarConValidacion = () => {
    const horas = Number(frecuencia);
    if (!Number.isInteger(horas) || horas < 1) {
      setError('La frecuencia de dispositivos debe ser un número entero de horas mayor a 0.');
      return;
    }
    if (ventanaDias.trim() && parsearDias(ventanaDias).length === 0) {
      setError('Los días de anticipación deben ser enteros mayores a 0 (ej. 3, 1).');
      return;
    }
    setError('');
    guardar.mutate();
  };

  const pruebas = consulta.data?.pruebas;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notificaciones</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <Alert tone="info">
          Estas preferencias definen qué avisos internos recibís y con qué anticipación. Se guardan
          por Empresa Revendedora.
        </Alert>

        <section className="space-y-3">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={dispositivos}
              onChange={(evento) => setDispositivos(evento.target.checked)}
              className="size-4 shrink-0 accent-azure-500"
            />
            <span className="text-sm font-semibold">Avisos de dispositivos pendientes</span>
          </label>
          <Field
            label="Recordar cada (horas)"
            htmlFor="notif-frecuencia"
            help="Mientras el dispositivo siga sin resolver, se recuerda cada este intervalo. No se crea un aviso nuevo en cada barrido."
          >
            <Input
              id="notif-frecuencia"
              type="number"
              min={1}
              value={frecuencia}
              disabled={!dispositivos}
              onChange={(evento) => setFrecuencia(evento.target.value.replace(/[^\d]/g, ''))}
              className="tabular-nums"
            />
          </Field>
        </section>

        <Separator />

        <section className="space-y-3">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={ventanaAlta}
              onChange={(evento) => setVentanaAlta(evento.target.checked)}
              className="size-4 shrink-0 accent-azure-500"
            />
            <span className="text-sm font-semibold">Avisos de ventana de alta por vencer</span>
          </label>
          <Field
            label="Días de anticipación"
            htmlFor="notif-ventana-dias"
            help="Separe varios hitos con comas, ej. 3, 1. Se avisa una vez por hito, no de forma periódica."
          >
            <Input
              id="notif-ventana-dias"
              value={ventanaDias}
              disabled={!ventanaAlta}
              placeholder="3, 1"
              onChange={(evento) => setVentanaDias(evento.target.value)}
            />
          </Field>
        </section>

        <Separator />

        <section className="space-y-1">
          <p className="text-sm font-semibold">Avisos de cuentas de prueba</p>
          <p className="text-xs texto-suave">
            {pruebas?.habilitadas
              ? pruebas.dias.length > 0
                ? `Se avisa con ${pruebas.dias.join(', ')} día(s) de anticipación, según la parametrización de tu empresa.`
                : 'Tu empresa todavía no tiene días de anticipación definidos para las pruebas.'
              : 'El módulo de cuentas de prueba está deshabilitado para tu empresa.'}
          </p>
        </section>

        {error ? <Alert tone="danger">{error}</Alert> : null}

        <div className="flex justify-end">
          <Button
            variant="primary"
            onClick={guardarConValidacion}
            disabled={guardar.isPending}
          >
            <Save />
            {guardar.isPending ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
