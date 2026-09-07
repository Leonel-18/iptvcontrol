import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import type { CommercialPlan } from '@/lib/types';
import { commercialPlanTypeHelp, commercialPlanTypeLabels } from '@/i18n/entityLabels';
import { Alert, Button, Field, Input } from '@/components/ui/primitives';
import { Dialog, DialogContent, Select } from '@/components/ui/overlays';

/**
 * Alta y edición de una Modalidad Comercial.
 *
 * Los dos esquemas de la regla 1:
 *  - Al menudeo: se factura por cuentas usadas, con precio por escala de volumen.
 *  - Con obligación mensual: compromiso creciente y acumulativo (X5, X10…), donde
 *    el ritmo de incremento lo parametriza el Operador Principal — no está
 *    hardcodeado, porque puede variar entre distribuidores.
 */
export const CommercialPlanForm = ({
  abierto,
  onCambio,
  plan,
}: {
  abierto: boolean;
  onCambio: (abierto: boolean) => void;
  plan?: CommercialPlan;
}) => {
  const queryClient = useQueryClient();
  const esEdicion = Boolean(plan);

  const [tipo, setTipo] = useState<'menudeo' | 'obligacion_mensual'>(plan?.tipo ?? 'menudeo');
  const [escala, setEscala] = useState(plan?.escala ?? '');
  const [precio, setPrecio] = useState(plan ? String(plan.precio_por_cuenta) : '');
  const [ritmo, setRitmo] = useState(plan?.ritmo_incremento ? String(plan.ritmo_incremento) : '');
  const [tope, setTope] = useState(
    plan?.tope_cuentas_activas ? String(plan.tope_cuentas_activas) : '',
  );
  const [vigenteDesde, setVigenteDesde] = useState(
    plan ? plan.vigente_desde.slice(0, 10) : new Date().toISOString().slice(0, 10),
  );
  const [errores, setErrores] = useState<Record<string, string>>({});

  const guardar = useMutation({
    mutationFn: () => {
      const cuerpo = {
        escala: escala.trim(),
        precio_por_cuenta: Number(precio),
        ritmo_incremento: tipo === 'obligacion_mensual' && ritmo ? Number(ritmo) : undefined,
        tope_cuentas_activas: tope ? Number(tope) : undefined,
        vigente_desde: new Date(vigenteDesde).toISOString(),
      };

      return esEdicion
        ? api(`/commercial-plans/${plan!.id}`, { metodo: 'PATCH', body: cuerpo })
        : api('/commercial-plans', { metodo: 'POST', body: { ...cuerpo, tipo } });
    },
    onSuccess: () => {
      toast.success(esEdicion ? 'Modalidad actualizada' : 'Modalidad creada');
      void queryClient.invalidateQueries({ queryKey: ['commercial-plans'] });
      onCambio(false);
    },
    onError: (causa: ApiError) => toast.error(causa.message),
  });

  const validar = (): boolean => {
    const nuevos: Record<string, string> = {};
    if (escala.trim().length === 0) nuevos.escala = 'Indique la escala (ej. X5 o "Menudeo 1-50").';
    const valorPrecio = Number(precio);
    if (!Number.isFinite(valorPrecio) || valorPrecio <= 0) {
      nuevos.precio = 'Ingrese el precio por cuenta.';
    }
    if (tipo === 'obligacion_mensual' && (!ritmo || Number(ritmo) <= 0)) {
      nuevos.ritmo = 'Indique cuántas cuentas crece el compromiso por mes.';
    }
    setErrores(nuevos);
    return Object.keys(nuevos).length === 0;
  };

  return (
    <Dialog open={abierto} onOpenChange={onCambio}>
      <DialogContent
        titulo={esEdicion ? 'Editar modalidad comercial' : 'Nueva modalidad comercial'}
        descripcion="Los precios son parametrizables y se pueden actualizar por IPC creando una vigencia nueva."
      >
        <div className="space-y-4">
          <Field label="Tipo de modalidad" htmlFor="tipo-modalidad" required>
            <Select
              id="tipo-modalidad"
              value={tipo}
              onChange={(valor) => setTipo(valor as typeof tipo)}
              disabled={esEdicion}
              opciones={Object.entries(commercialPlanTypeLabels).map(([value, label]) => ({
                value,
                label,
                help: commercialPlanTypeHelp[value],
              }))}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Escala"
              htmlFor="escala"
              required
              error={errores.escala}
              help={tipo === 'obligacion_mensual' ? 'Ej. X5, X10' : 'Ej. Menudeo 1-50'}
            >
              <Input
                id="escala"
                value={escala}
                onChange={(evento) => setEscala(evento.target.value)}
              />
            </Field>

            <Field label="Precio por cuenta" htmlFor="precio" required error={errores.precio}>
              <Input
                id="precio"
                type="number"
                min="0"
                step="0.01"
                value={precio}
                onChange={(evento) => setPrecio(evento.target.value)}
                className="tabular-nums"
              />
            </Field>

            {tipo === 'obligacion_mensual' ? (
              <Field
                label="Incremento mensual"
                htmlFor="ritmo"
                required
                error={errores.ritmo}
                help="Cuántas cuentas más se comprometen cada mes."
              >
                <Input
                  id="ritmo"
                  type="number"
                  min="1"
                  value={ritmo}
                  onChange={(evento) => setRitmo(evento.target.value)}
                  className="tabular-nums"
                />
              </Field>
            ) : null}

            <Field
              label="Límite de cuentas activas"
              htmlFor="tope"
              help="Opcional. Vacío = sin límite configurado."
            >
              <Input
                id="tope"
                type="number"
                min="1"
                value={tope}
                onChange={(evento) => setTope(evento.target.value)}
                className="tabular-nums"
              />
            </Field>

            <Field label="Vigente desde" htmlFor="vigencia" required>
              <Input
                id="vigencia"
                type="date"
                value={vigenteDesde}
                onChange={(evento) => setVigenteDesde(evento.target.value)}
              />
            </Field>
          </div>

          {tipo === 'obligacion_mensual' ? (
            <Alert tone="info">
              El compromiso es acumulativo: con incremento 5, el mes 1 se facturan 5 cuentas, el mes
              2 diez, el mes 3 quince. Las cuentas no usadas no se pierden, quedan disponibles para
              el mes siguiente.
            </Alert>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => onCambio(false)} disabled={guardar.isPending}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (validar()) guardar.mutate();
              }}
              disabled={guardar.isPending}
            >
              {guardar.isPending ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Crear modalidad'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
