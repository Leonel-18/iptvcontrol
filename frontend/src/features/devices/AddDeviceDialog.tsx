import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MonitorPlay, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { deviceTypeHelp, deviceTypeLabels } from '@/i18n/entityLabels';
import { Alert, Button, Field, Input, Textarea } from '@/components/ui/primitives';
import { Dialog, DialogContent } from '@/components/ui/overlays';

/**
 * Alta de un Dispositivo adicional para un Cliente Final que ya existe.
 *
 * Es el flujo 4.4: si la cuenta actual del cliente llegó al tope 3+3, el backend
 * le asigna una cuenta con capacidad y migra ahí sus dispositivos. El diálogo lo
 * anticipa, porque significa que al cliente le cambian las credenciales.
 */
export const AddDeviceDialog = ({
  clienteId,
  clienteNombre,
  abierto,
  onCambio,
}: {
  clienteId: string;
  clienteNombre: string;
  abierto: boolean;
  onCambio: (abierto: boolean) => void;
}) => {
  const queryClient = useQueryClient();
  const [tipo, setTipo] = useState<'fijo' | 'movil'>('fijo');
  const [mac, setMac] = useState('');
  const [nota, setNota] = useState('');
  const [errorMac, setErrorMac] = useState<string>();

  const crear = useMutation({
    mutationFn: () =>
      api<{
        cuenta_creada: boolean;
        migro_de_cuenta: boolean;
        dispositivo_pendiente_de_activacion: boolean;
      }>('/devices', {
        metodo: 'POST',
        body: {
          customer_id: clienteId,
          tipo,
          mac: mac.replace(/[^0-9a-fA-F]/g, '').toUpperCase() || undefined,
          nota_descriptiva: nota.trim() || undefined,
        },
      }),
    onSuccess: (resultado) => {
      toast.success('Dispositivo agregado');
      if (resultado.migro_de_cuenta) {
        toast.info(
          'La cuenta anterior estaba en el tope: se migró el cliente a una cuenta con capacidad. ' +
            'Revise las credenciales nuevas.',
          { duration: 8000 },
        );
      } else if (resultado.cuenta_creada) {
        toast.info('Se creó una cuenta nueva en el proveedor para alojar el dispositivo.');
      }
      if (resultado.dispositivo_pendiente_de_activacion) {
        toast.info('El ID del dispositivo se captura cuando el cliente inicie sesión.');
      }
      void queryClient.invalidateQueries({ queryKey: ['customer', clienteId] });
      void queryClient.invalidateQueries({ queryKey: ['devices'] });
      void queryClient.invalidateQueries({ queryKey: ['accounts'] });
      onCambio(false);
    },
    onError: (causa: ApiError) => toast.error(causa.message),
  });

  const confirmar = () => {
    if (mac) {
      const limpia = mac.replace(/[^0-9a-fA-F]/g, '');
      if (limpia.length !== 12) {
        setErrorMac('La MAC debe tener 12 dígitos hexadecimales.');
        return;
      }
    }
    setErrorMac(undefined);
    crear.mutate();
  };

  return (
    <Dialog open={abierto} onOpenChange={onCambio}>
      <DialogContent
        titulo="Agregar un dispositivo"
        descripcion={`Se suma un dispositivo a ${clienteNombre}.`}
      >
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium">Categoría</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {(['fijo', 'movil'] as const).map((opcion) => {
                const Icono = opcion === 'fijo' ? MonitorPlay : Smartphone;
                return (
                  <button
                    key={opcion}
                    type="button"
                    onClick={() => setTipo(opcion)}
                    className={cn(
                      'flex items-start gap-2.5 rounded-lg border p-3 text-left',
                      tipo === opcion
                        ? 'border-azure-500 bg-azure-50 dark:bg-azure-900/30'
                        : 'hover:bg-navy-50 dark:hover:bg-navy-800',
                    )}
                  >
                    <Icono className="mt-0.5 size-4 shrink-0 texto-suave" />
                    <div>
                      <p className="text-sm font-medium">{deviceTypeLabels[opcion]}</p>
                      <p className="text-xs texto-suave">{deviceTypeHelp[opcion]}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <Field
            label="MAC del equipo"
            htmlFor="mac-adicional"
            error={errorMac}
            help="Opcional. Sin MAC, el dispositivo se activa cuando el cliente inicie sesión."
          >
            <Input
              id="mac-adicional"
              value={mac}
              placeholder="03AC1AE60CA7"
              onChange={(evento) => setMac(evento.target.value)}
              className="font-mono"
            />
          </Field>

          <Field label="Nota interna" htmlFor="nota-adicional">
            <Textarea
              id="nota-adicional"
              value={nota}
              onChange={(evento) => setNota(evento.target.value)}
              rows={2}
              placeholder="TV del dormitorio"
            />
          </Field>

          <Alert tone="info">
            Si la cuenta actual del cliente ya está en el tope de 3 + 3, el sistema le asigna una
            cuenta con capacidad y migra sus dispositivos. En ese caso, las credenciales cambian.
          </Alert>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => onCambio(false)} disabled={crear.isPending}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={confirmar} disabled={crear.isPending}>
              {crear.isPending ? 'Agregando…' : 'Agregar dispositivo'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
