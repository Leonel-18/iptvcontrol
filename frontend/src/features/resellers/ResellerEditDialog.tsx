import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { Alert, Button, Field, Input, Separator } from "@/components/ui/primitives";
import { Dialog, DialogContent } from "@/components/ui/overlays";

/** Convierte "7, 3 1" en [7, 3, 1]: enteros únicos, sin negativos, de mayor a menor. */
const parsearAvisos = (valor: string): number[] =>
  Array.from(
    new Set(
      valor
        .split(/[\s,;]+/)
        .map((parte) => Number(parte))
        .filter((numero) => Number.isInteger(numero) && numero >= 0),
    ),
  ).sort((a, b) => b - a);

/**
 * Edición de los datos administrativos de una Empresa Revendedora (Operador
 * Principal). Cada cambio queda registrado en el Audit Log con quién y cuándo,
 * incluido el valor anterior y el nuevo. No se propaga a Cuentas SENSA ya
 * existentes: afecta sólo a futuras altas.
 */
export const ResellerEditDialog = ({
  empresaId,
  valoresIniciales,
  abierto,
  onCambio,
}: {
  empresaId: string;
  valoresIniciales: {
    razon_social: string;
    cuit: string;
    direccion: string;
    nombre_contacto: string;
    apellido_contacto: string;
    telefono_contacto: string;
    email_contacto: string;
    sitio_web: string | null;
    cuentas_max_crear_mensual: number;
    pruebas: {
      habilitadas: boolean;
      cupo_mensual: number;
      duracion_dias: number;
      extras_periodo: number;
      avisos_dias: number[];
    };
  };
  abierto: boolean;
  onCambio: (abierto: boolean) => void;
}) => {
  const queryClient = useQueryClient();
  const [valores, setValores] = useState({
    razon_social: valoresIniciales.razon_social,
    cuit: valoresIniciales.cuit,
    direccion: valoresIniciales.direccion,
    nombre_contacto: valoresIniciales.nombre_contacto,
    apellido_contacto: valoresIniciales.apellido_contacto,
    telefono_contacto: valoresIniciales.telefono_contacto,
    email_contacto: valoresIniciales.email_contacto,
    sitio_web: valoresIniciales.sitio_web ?? "",
    cuentas_max_crear_mensual: String(valoresIniciales.cuentas_max_crear_mensual),
    pruebas_habilitadas: valoresIniciales.pruebas.habilitadas,
    pruebas_cupo_mensual: String(valoresIniciales.pruebas.cupo_mensual),
    pruebas_duracion_dias: String(valoresIniciales.pruebas.duracion_dias),
    pruebas_extras_periodo: String(valoresIniciales.pruebas.extras_periodo),
    pruebas_avisos_dias: valoresIniciales.pruebas.avisos_dias.join(", "),
  });
  const [errores, setErrores] = useState<Record<string, string>>({});

  const actualizar = (clave: keyof typeof valores, valor: string | boolean) => {
    setValores((actual) => ({ ...actual, [clave]: valor }));
    setErrores((actual) => ({ ...actual, [clave]: "" }));
  };

  const guardar = useMutation({
    mutationFn: () =>
      api(`/resellers/${empresaId}`, {
        metodo: "PATCH",
        body: {
          razon_social: valores.razon_social.trim(),
          cuit: valores.cuit.replace(/\D/g, ""),
          direccion: valores.direccion.trim(),
          nombre_contacto: valores.nombre_contacto.trim(),
          apellido_contacto: valores.apellido_contacto.trim(),
          telefono_contacto: valores.telefono_contacto.trim(),
          email_contacto: valores.email_contacto.trim().toLowerCase(),
          sitio_web: valores.sitio_web.trim() || undefined,
          cuentas_max_crear_mensual: Number(valores.cuentas_max_crear_mensual),
          pruebas_habilitadas: valores.pruebas_habilitadas,
          pruebas_cupo_mensual: Number(valores.pruebas_cupo_mensual),
          pruebas_duracion_dias: Number(valores.pruebas_duracion_dias),
          pruebas_extras_periodo: Number(valores.pruebas_extras_periodo),
          pruebas_avisos_dias: parsearAvisos(valores.pruebas_avisos_dias),
        },
      }),
    onSuccess: () => {
      toast.success("Datos de la empresa actualizados");
      void queryClient.invalidateQueries({ queryKey: ["reseller", empresaId] });
      void queryClient.invalidateQueries({ queryKey: ["resellers"] });
      void queryClient.invalidateQueries({ queryKey: ["audit-log"] });
      onCambio(false);
    },
    onError: (causa: ApiError) => toast.error(causa.message),
  });

  const validar = (): boolean => {
    const nuevos: Record<string, string> = {};
    if (valores.razon_social.trim().length < 2) nuevos.razon_social = "Ingrese la razón social.";
    if (valores.cuit.replace(/\D/g, "").length !== 11) {
      nuevos.cuit = "El CUIT debe tener 11 dígitos.";
    }
    if (valores.direccion.trim().length < 3) nuevos.direccion = "Ingrese la dirección.";
    if (valores.nombre_contacto.trim().length < 2) nuevos.nombre_contacto = "Ingrese el nombre.";
    if (valores.apellido_contacto.trim().length < 2) {
      nuevos.apellido_contacto = "Ingrese el apellido.";
    }
    if (valores.telefono_contacto.replace(/\D/g, "").length < 6) {
      nuevos.telefono_contacto = "Ingrese un teléfono válido.";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valores.email_contacto.trim())) {
      nuevos.email_contacto = "Ingrese un correo válido.";
    }
    const limite = Number(valores.cuentas_max_crear_mensual);
    if (!Number.isInteger(limite) || limite < 0) {
      nuevos.cuentas_max_crear_mensual = "Ingrese un número entero mayor o igual a 0.";
    }
    const enteroNoNegativo = (valor: string) => {
      const numero = Number(valor);
      return Number.isInteger(numero) && numero >= 0;
    };
    if (!enteroNoNegativo(valores.pruebas_cupo_mensual)) {
      nuevos.pruebas_cupo_mensual = "Ingrese un número entero mayor o igual a 0.";
    }
    if (!enteroNoNegativo(valores.pruebas_duracion_dias)) {
      nuevos.pruebas_duracion_dias = "Ingrese un número entero mayor o igual a 0.";
    }
    if (!enteroNoNegativo(valores.pruebas_extras_periodo)) {
      nuevos.pruebas_extras_periodo = "Ingrese un número entero mayor o igual a 0.";
    }
    const avisos = valores.pruebas_avisos_dias.trim();
    if (
      avisos &&
      avisos
        .split(/[\s,;]+/)
        .some((parte) => !enteroNoNegativo(parte))
    ) {
      nuevos.pruebas_avisos_dias = "Separe los días con comas (ej. 7, 3, 1).";
    }
    setErrores(nuevos);
    return Object.keys(nuevos).length === 0;
  };

  return (
    <Dialog open={abierto} onOpenChange={onCambio}>
      <DialogContent
        titulo="Editar datos de la empresa"
        descripcion="Los cambios quedan registrados en la auditoría con quién los realizó."
        className="max-w-2xl"
      >
        <div className="space-y-4">
          <Alert tone="info" titulo="Alcance del cambio">
            Afecta a los datos administrativos y a las Cuentas que se creen de ahora en adelante.
            Las Cuentas SENSA ya existentes no se modifican.
          </Alert>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Razón social"
              htmlFor="editar-razon-social"
              required
              error={errores.razon_social}
              className="sm:col-span-2"
            >
              <Input
                id="editar-razon-social"
                value={valores.razon_social}
                onChange={(evento) => actualizar("razon_social", evento.target.value)}
                autoFocus
              />
            </Field>

            <Field label="CUIT" htmlFor="editar-cuit" required error={errores.cuit}>
              <Input
                id="editar-cuit"
                value={valores.cuit}
                placeholder="30716009226"
                onChange={(evento) => actualizar("cuit", evento.target.value)}
                className="font-mono"
              />
            </Field>

            <Field label="Teléfono" htmlFor="editar-telefono" required error={errores.telefono_contacto}>
              <Input
                id="editar-telefono"
                value={valores.telefono_contacto}
                onChange={(evento) => actualizar("telefono_contacto", evento.target.value)}
              />
            </Field>

            <Field
              label="Dirección"
              htmlFor="editar-direccion"
              required
              error={errores.direccion}
              className="sm:col-span-2"
            >
              <Input
                id="editar-direccion"
                value={valores.direccion}
                onChange={(evento) => actualizar("direccion", evento.target.value)}
              />
            </Field>

            <Field
              label="Nombre del contacto"
              htmlFor="editar-nombre"
              required
              error={errores.nombre_contacto}
            >
              <Input
                id="editar-nombre"
                value={valores.nombre_contacto}
                onChange={(evento) => actualizar("nombre_contacto", evento.target.value)}
              />
            </Field>

            <Field
              label="Apellido del contacto"
              htmlFor="editar-apellido"
              required
              error={errores.apellido_contacto}
            >
              <Input
                id="editar-apellido"
                value={valores.apellido_contacto}
                onChange={(evento) => actualizar("apellido_contacto", evento.target.value)}
              />
            </Field>

            <Field
              label="Correo de contacto"
              htmlFor="editar-email"
              required
              error={errores.email_contacto}
              help="Es la base de los correos de cada Cuenta."
              className="sm:col-span-2"
            >
              <Input
                id="editar-email"
                type="email"
                value={valores.email_contacto}
                onChange={(evento) => actualizar("email_contacto", evento.target.value)}
              />
            </Field>

            <Field label="Sitio web" htmlFor="editar-sitio" className="sm:col-span-2">
              <Input
                id="editar-sitio"
                value={valores.sitio_web}
                placeholder="www.miisp.com.ar"
                onChange={(evento) => actualizar("sitio_web", evento.target.value)}
              />
            </Field>

            <Field
              label="Cuentas máx. a crear mensualmente"
              htmlFor="editar-limite-mensual"
              required
              error={errores.cuentas_max_crear_mensual}
              help="Límite de Cuentas nuevas por mes calendario. Al superarlo, no se pueden crear más hasta el mes siguiente."
              className="sm:col-span-2"
            >
              <Input
                id="editar-limite-mensual"
                type="number"
                min={0}
                value={valores.cuentas_max_crear_mensual}
                onChange={(evento) => actualizar("cuentas_max_crear_mensual", evento.target.value)}
              />
            </Field>
          </div>

          <Separator />

          <section className="space-y-3">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={valores.pruebas_habilitadas}
                onChange={(evento) => actualizar("pruebas_habilitadas", evento.target.checked)}
                className="size-4 shrink-0 accent-azure-500"
              />
              <span className="text-sm font-semibold">Habilitar cuentas de prueba</span>
            </label>
            <p className="text-xs text-navy-500 dark:text-navy-400">
              Mientras esté deshabilitado, la Empresa Revendedora verá la opción pero no podrá
              crear pruebas. La duración aplica sólo a las pruebas nuevas.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Cupo mensual"
                htmlFor="editar-pruebas-cupo"
                error={errores.pruebas_cupo_mensual}
                help="Cuentas de prueba que la empresa puede crear por mes."
              >
                <Input
                  id="editar-pruebas-cupo"
                  type="number"
                  min={0}
                  value={valores.pruebas_cupo_mensual}
                  onChange={(evento) => actualizar("pruebas_cupo_mensual", evento.target.value)}
                />
              </Field>

              <Field
                label="Duración de nuevas pruebas (días)"
                htmlFor="editar-pruebas-duracion"
                error={errores.pruebas_duracion_dias}
                help="No recalcula los vencimientos ya generados."
              >
                <Input
                  id="editar-pruebas-duracion"
                  type="number"
                  min={0}
                  value={valores.pruebas_duracion_dias}
                  onChange={(evento) => actualizar("pruebas_duracion_dias", evento.target.value)}
                />
              </Field>

              <Field
                label="Extras del período actual"
                htmlFor="editar-pruebas-extras"
                error={errores.pruebas_extras_periodo}
                help="Cuentas de prueba adicionales habilitadas en el período en curso."
              >
                <Input
                  id="editar-pruebas-extras"
                  type="number"
                  min={0}
                  value={valores.pruebas_extras_periodo}
                  onChange={(evento) => actualizar("pruebas_extras_periodo", evento.target.value)}
                />
              </Field>

              <Field
                label="Avisos previos al vencimiento (días)"
                htmlFor="editar-pruebas-avisos"
                error={errores.pruebas_avisos_dias}
                help="Separe varios valores con comas, ej. 7, 3, 1."
              >
                <Input
                  id="editar-pruebas-avisos"
                  value={valores.pruebas_avisos_dias}
                  placeholder="7, 3, 1"
                  onChange={(evento) => actualizar("pruebas_avisos_dias", evento.target.value)}
                />
              </Field>
            </div>
          </section>

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
              {guardar.isPending ? "Guardando…" : "Guardar cambios"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
