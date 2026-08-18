import { Link } from 'react-router-dom';
import { formatearMac } from '@/lib/utils';
import type { AccountDevice } from '@/lib/types';
import { CopyableId, DeviceStatusBadge, DeviceTypeBadge } from '@/components/common';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';

/**
 * Dispositivos de una Cuenta.
 *
 * Se separa en su propio componente porque se usa en la vista por Cuenta y es la
 * grilla que más se mira: es donde se ve, de un vistazo, qué lugar queda libre.
 */
export const AccountDevicesTab = ({
  dispositivos,
  esOperador,
}: {
  dispositivos: AccountDevice[];
  esOperador: boolean;
}) => {
  if (dispositivos.length === 0) {
    return (
      <p className="py-6 text-center text-sm texto-suave">
        Esta cuenta todavía no tiene dispositivos activados.
      </p>
    );
  }

  return (
    <Table>
      <THead>
        <TR>
          <TH>ID en proveedor</TH>
          <TH>Tipo</TH>
          <TH>Estado</TH>
          {!esOperador ? <TH>Cliente</TH> : null}
          {!esOperador ? <TH>Equipo / nota</TH> : null}
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
                  {dispositivo.proveedor_device_id ?? 'Pendiente'}
                </Link>
                {!dispositivo.proveedor_device_id &&
                dispositivo.estado === 'activo' ? (
                  <span className="text-2xs text-warn">Esperando primer inicio de sesión</span>
                ) : null}
              </div>
            </TD>
            <TD>
              <DeviceTypeBadge tipo={dispositivo.tipo} />
            </TD>
            <TD>
              <DeviceStatusBadge estado={dispositivo.estado} />
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
                    <CopyableId valor={formatearMac(dispositivo.mac)} etiqueta="MAC" />
                  ) : null}
                  {dispositivo.nota_descriptiva ? (
                    <span className="text-xs texto-suave">{dispositivo.nota_descriptiva}</span>
                  ) : null}
                  {!dispositivo.mac && !dispositivo.nota_descriptiva ? (
                    <span className="text-sm texto-suave">—</span>
                  ) : null}
                </div>
              </TD>
            ) : null}
          </TR>
        ))}
      </TBody>
    </Table>
  );
};
