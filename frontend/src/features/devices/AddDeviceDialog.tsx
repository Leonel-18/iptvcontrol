import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { Alert, Button, Field, Textarea } from '@/components/ui/primitives';
import { Dialog, DialogContent } from '@/components/ui/overlays';

/**
 * Alta de un Dispositivo adicional para un Cliente Final que ya existe.
 *
 * Si el cliente ya completó los cupos de su venta compartida (1+1 o 2+2), o
 * los 3 fijos + 3 móviles de su Cuenta exclusiva, el alta
 * puede quedar en otra Cuenta compatible sin alterar necesariamente la actual.
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
  const [nota, setNota] = useState('');

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
          nota_descriptiva: nota.trim() || undefined,
        },
      }),
    onSuccess: (resultado) => {
      toast.success('Dispositivo agregado');
      if (resultado.migro_de_cuenta) {
        toast.info(
          'El dispositivo adicional se asignó a otra Cuenta compatible. Revise los datos de la venta.',
          { duration: 8000 },
        );
      } else if (resultado.cuenta_creada) {
        toast.info('Se creó una cuenta nueva en el proveedor para alojar el dispositivo.');
      }
      if (resultado.dispositivo_pendiente_de_activacion) {
        toast.info(
          'Se abrirá una ventana de vinculación cuando el cliente inicie sesión por primera vez.',
        );
      }
      void queryClient.invalidateQueries({ queryKey: ['customer', clienteId] });
      void queryClient.invalidateQueries({ queryKey: ['devices'] });
      void queryClient.invalidateQueries({ queryKey: ['accounts'] });
      onCambio(false);
    },
    onError: (causa: ApiError) => toast.error(causa.message),
  });

  return (
    <Dialog open={abierto} onOpenChange={onCambio}>
      <DialogContent
        titulo="Agregar un dispositivo"
        descripcion={`Se suma un dispositivo a ${clienteNombre}.`}
      >
        <div className="space-y-4">
          <Alert tone="info" titulo="Vinculación al primer inicio">
            Cuando el cliente inicie sesión por primera vez, se abrirá una ventana para vincular el
            equipo con este Dispositivo.
          </Alert>

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
            En una Cuenta compartida, cada venta conserva los cupos 1+1 o 2+2 elegidos al crearla;
            en una Cuenta exclusiva, admite hasta 3 de cada categoría. Si este cliente ya completó
            su cupo, el alta puede quedar en otra Cuenta compatible. Esto no implica migrar los
            Dispositivos existentes ni cambiar necesariamente sus credenciales.
          </Alert>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => onCambio(false)} disabled={crear.isPending}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={() => crear.mutate()} disabled={crear.isPending}>
              {crear.isPending ? 'Agregando…' : 'Agregar dispositivo'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
