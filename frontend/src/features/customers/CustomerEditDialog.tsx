import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import type { CustomerDetail } from "@/lib/types";
import {
  Alert,
  Button,
  Field,
  Input,
} from "@/components/ui/primitives";
import { Dialog, DialogContent } from "@/components/ui/overlays";

/**
 * Edición de los datos de contacto de un Cliente Final (sólo la base local de
 * IPTVControl). El cambio NO se envía al Proveedor: las credenciales y la
 * parametrización de la Cuenta no se tocan. Sólo puede editarlos la Empresa
 * Revendedora dueña (`PATCH /customers/:id`, regla de negocio 4.2).
 */
export const CustomerEditDialog = ({
  cliente,
  abierto,
  onCambio,
}: {
  cliente: CustomerDetail;
  abierto: boolean;
  onCambio: (abierto: boolean) => void;
}) => {
  const queryClient = useQueryClient();

  const [nombre, setNombre] = useState(cliente.nombre);
  const [apellido, setApellido] = useState(cliente.apellido ?? "");
  const [dni, setDni] = useState(cliente.dni ?? "");
  const [telefono, setTelefono] = useState(cliente.telefono ?? "");
  const [email, setEmail] = useState(cliente.email ?? "");
  const [direccion, setDireccion] = useState(cliente.direccion ?? "");
  const [idGestionExterno, setIdGestionExterno] = useState(
    cliente.id_gestion_externo ?? "",
  );
  const [error, setError] = useState<"" | "nombre" | "dni">("");

  useEffect(() => {
    if (!abierto) return;
    setNombre(cliente.nombre);
    setApellido(cliente.apellido ?? "");
    setDni(cliente.dni ?? "");
    setTelefono(cliente.telefono ?? "");
    setEmail(cliente.email ?? "");
    setDireccion(cliente.direccion ?? "");
    setIdGestionExterno(cliente.id_gestion_externo ?? "");
    setError("");
  }, [abierto, cliente]);

  const guardar = useMutation({
    mutationFn: () =>
      api(`/customers/${cliente.id}`, {
        metodo: "PATCH",
        body: {
          nombre: nombre.trim(),
          apellido: apellido.trim() || undefined,
          dni: dni.trim(),
          telefono: telefono.trim() || undefined,
          email: email.trim() || undefined,
          direccion: direccion.trim() || undefined,
          id_gestion_externo: idGestionExterno.trim() || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Datos de contacto actualizados.");
      onCambio(false);
      void queryClient.invalidateQueries({ queryKey: ["customer", cliente.id] });
      void queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (causa: ApiError) => toast.error(causa.message),
  });

  return (
    <Dialog open={abierto} onOpenChange={onCambio}>
      <DialogContent
        titulo="Editar datos de contacto"
        descripcion="Sólo cambia los datos locales de IPTVControl. No se modifican las credenciales ni la parametrización en el proveedor."
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Nombre"
              htmlFor="edit-nombre"
              required
              error={error === "nombre" ? "El nombre es obligatorio." : undefined}
            >
              <Input
                id="edit-nombre"
                value={nombre}
                onChange={(evento) => setNombre(evento.target.value)}
              />
            </Field>
            <Field label="Apellido" htmlFor="edit-apellido">
              <Input
                id="edit-apellido"
                value={apellido}
                onChange={(evento) => setApellido(evento.target.value)}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="DNI"
              htmlFor="edit-dni"
              required
              error={
                error === "dni"
                  ? "El DNI debe tener entre 6 y 10 dígitos numéricos."
                  : undefined
              }
            >
              <Input
                id="edit-dni"
                inputMode="numeric"
                value={dni}
                onChange={(evento) =>
                  setDni(evento.target.value.replace(/\D/g, "").slice(0, 10))
                }
              />
            </Field>
            <Field label="Teléfono" htmlFor="edit-telefono">
              <Input
                id="edit-telefono"
                value={telefono}
                onChange={(evento) => setTelefono(evento.target.value)}
              />
            </Field>
          </div>
          <Field label="Correo electrónico" htmlFor="edit-email">
            <Input
              id="edit-email"
              type="email"
              value={email}
              onChange={(evento) => setEmail(evento.target.value)}
            />
          </Field>
          <Field label="Dirección" htmlFor="edit-direccion">
            <Input
              id="edit-direccion"
              value={direccion}
              onChange={(evento) => setDireccion(evento.target.value)}
            />
          </Field>
          <Field
            label="ID en su sistema de gestión"
            htmlFor="edit-id-gestion"
            help="Opcional. Vincula a este cliente con su CRM/facturación externa."
          >
            <Input
              id="edit-id-gestion"
              value={idGestionExterno}
              onChange={(evento) => setIdGestionExterno(evento.target.value)}
            />
          </Field>
          <Alert tone="info">
            El número de cliente, el estado y el método de alta no se pueden
            editar desde acá.
          </Alert>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => onCambio(false)}
              disabled={guardar.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (!nombre.trim()) {
                  setError("nombre");
                  return;
                }
                if (!/^\d{6,10}$/.test(dni.trim())) {
                  setError("dni");
                  return;
                }
                setError("");
                guardar.mutate();
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
