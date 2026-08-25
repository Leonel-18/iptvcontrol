import { Link } from "react-router-dom";
import { UserCog } from "lucide-react";
import { useState } from "react";
import { formatearMac } from "@/lib/utils";
import type { AccountDevice } from "@/lib/types";
import {
  CopyableId,
  DeviceStatusBadge,
  DeviceTypeBadge,
} from "@/components/common";
import { Button } from "@/components/ui/primitives";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { CorrectDeviceBindingDialog } from "./CorrectDeviceBindingDialog";

interface ClienteDeLaCuenta {
  id: string;
  numero_cliente: number;
  nombre: string;
}

/**
 * Dispositivos de una Cuenta.
 *
 * Se separa en su propio componente porque se usa en la vista por Cuenta y es la
 * grilla que más se mira: es donde se ve, de un vistazo, qué lugar queda libre.
 *
 * Para la Empresa Revendedora, cada Dispositivo ya vinculado ofrece la acción
 * "Corregir": SENSA no identifica de quién es cada inicio de sesión y en
 * Cuentas compartidas puede quedar vinculado al cliente equivocado (caso
 * Pepito/Marcelo). La corrección vive acá y no en /devices/:id porque se
 * resuelve mirando todos los Clientes de la Cuenta juntos.
 */
export const AccountDevicesTab = ({
  dispositivos,
  esOperador,
  clientesFinales,
  cuentaId,
}: {
  dispositivos: AccountDevice[];
  esOperador: boolean;
  /** Clientes de esta Cuenta; habilita la corrección de vinculación. */
  clientesFinales?: ClienteDeLaCuenta[];
  cuentaId?: string;
}) => {
  const [aCorregir, setACorregir] = useState<AccountDevice | null>(null);

  if (dispositivos.length === 0) {
    return (
      <p className="py-6 text-center text-sm texto-suave">
        Esta cuenta todavía no tiene dispositivos activados.
      </p>
    );
  }

  const puedeCorregir =
    !esOperador &&
    Boolean(cuentaId) &&
    dispositivos.some(
      (dispositivo) =>
        dispositivo.estado === "activo" &&
        dispositivo.estado_vinculacion === "vinculado" &&
        dispositivo.cliente_final,
    );

  return (
    <>
      <Table>
        <THead>
          <TR>
            <TH>ID en proveedor</TH>
            <TH>Tipo</TH>
            <TH>Estado</TH>
            {!esOperador ? <TH>Cliente</TH> : null}
            {!esOperador ? <TH>Equipo / nota</TH> : null}
            {puedeCorregir ? <TH align="right">Acción</TH> : null}
          </TR>
        </THead>
        <TBody>
          {dispositivos.map((dispositivo) => (
            <TR key={dispositivo.id}>
              <TD>
                <div className="flex flex-col gap-0.5">
                  <Link
                    to={`/devices/${dispositivo.id}`}
                    className="id-tecnico text-azure-600 hover:underline dark:text-azure-400"
                  >
                    {dispositivo.proveedor_device_id ?? "Pendiente"}
                  </Link>
                  {!dispositivo.proveedor_device_id &&
                  dispositivo.estado === "activo" ? (
                    <span className="text-2xs text-warn">
                      Esperando primer inicio de sesión
                    </span>
                  ) : null}
                </div>
              </TD>
              <TD>
                <DeviceTypeBadge tipo={dispositivo.tipo} />
              </TD>
              <TD>
                <DeviceStatusBadge
                  estado={dispositivo.estado}
                  vinculacion={dispositivo.estado_vinculacion}
                />
              </TD>
              {!esOperador ? (
                <TD>
                  {dispositivo.cliente_final ? (
                    <Link
                      to={`/customers/${dispositivo.cliente_final.id}`}
                      className="text-sm text-azure-600 hover:underline dark:text-azure-400"
                    >
                      {dispositivo.cliente_final.nombre}
                    </Link>
                  ) : (
                    <span className="text-sm texto-suave">Sin cliente</span>
                  )}
                </TD>
              ) : null}
              {!esOperador ? (
                <TD>
                  <div className="flex flex-col gap-0.5">
                    {dispositivo.mac ? (
                      <CopyableId
                        valor={formatearMac(dispositivo.mac)}
                        etiqueta="MAC"
                      />
                    ) : null}
                    {dispositivo.nota_descriptiva ? (
                      <span className="text-xs texto-suave">
                        {dispositivo.nota_descriptiva}
                      </span>
                    ) : null}
                    {!dispositivo.mac && !dispositivo.nota_descriptiva ? (
                      <span className="text-sm texto-suave">—</span>
                    ) : null}
                  </div>
                </TD>
              ) : null}
              {puedeCorregir ? (
                <TD align="right">
                  {dispositivo.estado === "activo" &&
                  dispositivo.estado_vinculacion === "vinculado" &&
                  dispositivo.cliente_final ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setACorregir(dispositivo)}
                    >
                      <UserCog />
                      Corregir
                    </Button>
                  ) : null}
                </TD>
              ) : null}
            </TR>
          ))}
        </TBody>
      </Table>

      {aCorregir && cuentaId ? (
        <CorrectDeviceBindingDialog
          dispositivo={aCorregir}
          clientesFinales={clientesFinales ?? []}
          cuentaId={cuentaId}
          abierto={Boolean(aCorregir)}
          onCambio={(abierto) => !abierto && setACorregir(null)}
        />
      ) : null}
    </>
  );
};
