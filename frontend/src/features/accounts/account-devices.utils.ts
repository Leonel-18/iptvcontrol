import type {
  AccountDetail,
  AccountProviderDevice,
  AccountProviderInventory,
} from "@/lib/types";

/** Filtra por la identidad canónica usada por backend: ID del proveedor dentro de la Cuenta. */
export const getUnlinkedProviderDevices = (
  cuenta: AccountDetail,
  inventario: AccountProviderInventory | null,
): AccountProviderDevice[] => {
  if (!inventario) return [];
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
