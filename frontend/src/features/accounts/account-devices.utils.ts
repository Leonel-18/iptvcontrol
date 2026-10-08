import type {
  AccountDetail,
  AccountProviderDevice,
  AccountProviderInventory,
} from "@/lib/types";

/**
 * Decide si se puede cargar un Cliente Final desde la vista de la Cuenta.
 *
 * Es válido tanto en una Cuenta compartida como en una exclusiva **sin titular**.
 * Una Cuenta exclusiva ya tiene un único Cliente Final, así que con titular
 * (o con contraseña pendiente de una importada) no se ofrece el alta. La misma
 * condición alimenta el botón y el diálogo para que no se desincronicen.
 */
export const puedeAgregarCliente = (
  cuenta: Pick<AccountDetail, "es_exclusiva" | "cliente_final_exclusivo" | "password_pendiente">,
  esOperador: boolean,
): boolean =>
  !esOperador &&
  !cuenta.password_pendiente &&
  (!cuenta.es_exclusiva || !cuenta.cliente_final_exclusivo);

/** Filtra por la identidad canónica usada por backend: ID del proveedor dentro de la Cuenta. */
export const getUnlinkedProviderDevices = (
  cuenta: AccountDetail,
  inventario: AccountProviderInventory | null,
): AccountProviderDevice[] => {
  if (!inventario || inventario.cuenta_id !== cuenta.id) return [];
  const vinculados = new Set(
    cuenta.dispositivos
      .map((dispositivo) => dispositivo.proveedor_device_id)
      .filter((id): id is string => Boolean(id)),
  );
  return inventario.dispositivos.filter(
    (dispositivo) =>
      dispositivo.clasificacion === "desconocido" &&
      !vinculados.has(dispositivo.proveedor_device_id),
  );
};
