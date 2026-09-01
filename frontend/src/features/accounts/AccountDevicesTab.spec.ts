import { describe, expect, it } from "vitest";
import type { AccountDetail, AccountProviderInventory } from "@/lib/types";
import { getUnlinkedProviderDevices } from "./account-devices.utils";

describe("getUnlinkedProviderDevices", () => {
  it("muestra sólo equipos desconocidos cuyo ID del proveedor no está vinculado", () => {
    const cuenta = {
      id: "account-1",
      dispositivos: [
        { id: "local-1", proveedor_device_id: "provider-1" },
        { id: "pending", proveedor_device_id: null },
      ],
    } as AccountDetail;
    const inventario = {
      cuenta_id: "account-1",
      dispositivos: [
        { proveedor_device_id: "provider-1", clasificacion: "vinculado" },
        { proveedor_device_id: "provider-1", clasificacion: "desconocido" },
        { proveedor_device_id: "provider-2", clasificacion: "desconocido" },
      ],
    } as AccountProviderInventory;

    expect(getUnlinkedProviderDevices(cuenta, inventario)).toEqual([
      expect.objectContaining({ proveedor_device_id: "provider-2" }),
    ]);
  });

  it("no agrega filas antes de consultar al proveedor", () => {
    expect(
      getUnlinkedProviderDevices({ dispositivos: [] } as unknown as AccountDetail, null),
    ).toEqual([]);
  });

  it("descarta el inventario conservado de otra Cuenta", () => {
    const cuenta = { id: "account-2", dispositivos: [] } as unknown as AccountDetail;
    const inventario = {
      cuenta_id: "account-1",
      dispositivos: [
        { proveedor_device_id: "provider-1", clasificacion: "desconocido" },
      ],
    } as AccountProviderInventory;

    expect(getUnlinkedProviderDevices(cuenta, inventario)).toEqual([]);
  });
});
