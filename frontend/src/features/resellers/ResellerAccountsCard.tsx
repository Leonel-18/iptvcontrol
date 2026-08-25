import { useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, type Paginado } from '@/lib/api';
import { formatearFecha } from '@/lib/utils';
import type { Account } from '@/lib/types';
import { AccountStatusBadge, CopyableId } from '@/components/common';
import { CapacityMeter } from '@/components/CapacityMeter';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@/components/ui/primitives';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';

/**
 * Cuentas de una Empresa Revendedora, dentro de su detalle.
 *
 * Es la vista que pide docs/03_Reglas_de_Negocio.md §4.2: la misma tabla que la
 * vista por Cuenta, pero **por ID**. Sin usuario, sin contraseña, sin PIN, sin
 * nombres de Clientes Finales y sin notas descriptivas — y no porque se oculten
 * acá, sino porque el backend no los serializa para el Operador Principal.
 *
 * Se muestran las primeras 10 y se enlaza al listado completo filtrado, para no
 * convertir el detalle de la empresa en una tabla infinita.
 */
export const ResellerAccountsCard = ({
  empresaId,
  className,
}: {
  empresaId: string;
  className?: string;
}) => {
  const { data, isLoading } = useQuery({
    queryKey: ['accounts', 'por-empresa', empresaId],
    queryFn: () =>
      api<Paginado<Account>>('/accounts', {
        params: { reseller_id: empresaId, per_page: 10 },
      }),
  });

  return (
    <Card className={className}>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <div>
          <CardTitle>Cuentas en el proveedor</CardTitle>
          <p className="mt-0.5 text-xs texto-suave">
            Se identifican por ID. Las credenciales las administra la empresa revendedora.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link to={`/accounts?reseller_id=${empresaId}`}>
              <ExternalLink />
              Ver todas
            </Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link to={`/devices?reseller_id=${empresaId}`}>Dispositivos</Link>
          </Button>
        </div>
      </CardHeader>

      {isLoading ? (
        <CardContent>
          <Skeleton className="h-24" />
        </CardContent>
      ) : data && data.data.length > 0 ? (
        <>
          <Table>
            <THead>
              <TR>
                <TH>ID en proveedor</TH>
                <TH>Ocupación</TH>
                <TH>Tipo</TH>
                <TH>Estado</TH>
                <TH align="right">Alta</TH>
              </TR>
            </THead>
            <TBody>
              {data.data.map((cuenta) => (
                <TR key={cuenta.id}>
                  <TD>
                    <Link
                      to={`/accounts/${cuenta.id}`}
                      className="id-tecnico text-azure-600 hover:underline dark:text-azure-400"
                    >
                      {cuenta.proveedor_cuenta_id ?? 'Sin confirmar'}
                    </Link>
                  </TD>
                  <TD>
                    <CapacityMeter capacidad={cuenta.capacidad} compacto />
                  </TD>
                  <TD>
                    <Badge tone={cuenta.es_exclusiva ? 'info' : 'neutral'}>
                      {cuenta.es_exclusiva ? 'Exclusiva' : 'Compartida'}
                    </Badge>
                  </TD>
                  <TD>
                    <AccountStatusBadge estado={cuenta.estado} />
                  </TD>
                  <TD align="right">
                    <span className="text-sm texto-suave">{formatearFecha(cuenta.creado_en)}</span>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          {data.meta.total > data.data.length ? (
            <CardContent className="border-t">
              <p className="text-xs texto-suave">
                Se muestran {data.data.length} de {data.meta.total} cuentas.{' '}
                <Link
                  to={`/accounts?reseller_id=${empresaId}`}
                  className="text-azure-600 hover:underline dark:text-azure-400"
                >
                  Ver el listado completo
                </Link>
                .
              </p>
            </CardContent>
          ) : null}
        </>
      ) : (
        <CardContent>
          <p className="text-sm texto-suave">
            Esta empresa todavía no tiene cuentas. Se crean solas cuando da de alta su primer
            cliente final.
          </p>
          <p className="mt-2 text-xs texto-suave">
            ID de la empresa para soporte: <CopyableId valor={empresaId} etiqueta="ID de empresa" />
          </p>
        </CardContent>
      )}
    </Card>
  );
};
