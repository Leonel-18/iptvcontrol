import { describe, expect, it } from "vitest";
import type { AccountDetail, AccountProviderInventory } from "@/lib/types";
import { getUnlinkedProviderDevices, puedeAgregarCliente } from "./account-devices.utils";

describe("puedeAgregarCliente", () => {
  const base: Pick<
    AccountDetail,
    "es_exclusiva" | "cliente_final_exclusivo" | "password_pendiente"
  > = {
    es_exclusiva: false,
    cliente_final_exclusivo: null,
    password_pendiente: false,
  };

  it("permite agregar en una Cuenta compartida sin contraseña pendiente", () => {
    expect(puedeAgregarCliente(base, false)).toBe(true);
  });

  it("permite agregar en una Cuenta exclusiva sin titular", () => {
    expect(puedeAgregarCliente({ ...base, es_exclusiva: true }, false)).toBe(true);
  });

  it("no permite agregar en una Cuenta exclusiva que ya tiene titular", () => {
    expect(
      puedeAgregarCliente(
        {
          ...base,
          es_exclusiva: true,
          cliente_final_exclusivo: { id: "cliente-1", numero_cliente: 1, nombre: "Ana" },
        },
        false,
      ),
    ).toBe(false);
  });

  it("no permite agregar al Operador Principal", () => {
    expect(puedeAgregarCliente(base, true)).toBe(false);
  });

  it("no permite agregar si la contraseña está pendiente (Cuenta importada)", () => {
    expect(puedeAgregarCliente({ ...base, password_pendiente: true }, false)).toBe(false);
  });
});

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
