import { useQuery } from '@tanstack/react-query';
import { FlaskConical } from 'lucide-react';
import { toast } from 'sonner';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@/components/ui/primitives';
import { api } from '@/lib/api';
import type { ResellerDetail as ResellerDetailData } from '@/lib/types';

/**
 * Cuentas de prueba (HU-P01) — tarjeta de la sección Configuración.
 *
 * Muestra el estado del módulo habilitado por el Operador Principal y sus
 * parámetros, que son de sólo lectura para la Empresa Revendedora. El alta de
 * una prueba se habilita en una historia posterior: por ahora el botón queda
 * visible y deshabilitado mientras el módulo esté apagado.
 */
export const TestAccountsSettings = () => {
  const consulta = useQuery({
    queryKey: ['reseller', 'me'],
    queryFn: () => api<ResellerDetailData>('/resellers/me'),
  });

  if (consulta.isLoading) return <Skeleton className="h-56" />;
  if (consulta.isError || !consulta.data) return null;

  const { pruebas } = consulta.data;

  const dato = (label: string, valor: string) => (
    <div className="flex flex-col">
      <span className="font-mono text-2xs uppercase tracking-wide texto-suave">{label}</span>
      <span className="text-base font-semibold tabular-nums">{valor}</span>
    </div>
  );

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-4">
        <CardTitle>Cuentas de prueba</CardTitle>
        <Badge tone={pruebas.habilitadas ? 'success' : 'neutral'}>
          {pruebas.habilitadas ? 'Habilitado' : 'Deshabilitado'}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-5">
        {pruebas.habilitadas ? (
          <Alert tone="info">
            Podés ofrecer pruebas a clientes nuevos. La duración configurada aplica a las pruebas
            que crees de ahora en adelante.
          </Alert>
        ) : (
          <Alert tone="warning">
            El módulo de cuentas de prueba está deshabilitado para tu empresa. Consultá con el
            operador para activarlo.
          </Alert>
        )}

        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          {dato('Cupo mensual', String(pruebas.cupo_mensual))}
          {dato('Duración (días)', String(pruebas.duracion_dias))}
          {dato('Extras del período', String(pruebas.extras_periodo))}
          {dato(
            'Avisos (días)',
            pruebas.avisos_dias.length ? pruebas.avisos_dias.join(', ') : '—',
          )}
        </div>

        <div className="flex justify-end">
          <Button
            variant="primary"
            disabled={!pruebas.habilitadas}
            onClick={() =>
              toast.info('El alta de cuentas de prueba se habilita en la próxima actualización.')
            }
          >
            <FlaskConical />
            Nueva cuenta de prueba
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
