import { useQuery } from '@tanstack/react-query';
import { DatabaseZap, RefreshCw } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { CopyableId } from '@/components/common';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
} from '@/components/ui/primitives';
import { Table, TableSkeleton, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { api } from '@/lib/api';
import type { ExternalProviderAccountsReport } from '@/lib/types';

const normalizar = (valor: string) => valor.trim().toLocaleLowerCase('es');

export const ExternalProviderAccountsCard = () => {
  const [filtros, setFiltros] = useState({
    email: '',
    nombre: '',
    apellido: '',
    dni: '',
    ciudad: '',
  });
  const filtrosDiferidos = useDeferredValue(filtros);
  const consulta = useQuery({
    queryKey: ['resellers', 'external-accounts'],
    queryFn: () => api<ExternalProviderAccountsReport>('/resellers/external-accounts'),
    staleTime: 5 * 60_000,
  });

  const cuentas = (consulta.data?.cuentas ?? []).filter((cuenta) =>
    Object.entries(filtrosDiferidos).every(([campo, valor]) => {
      if (!valor.trim()) return true;
      return normalizar(String(cuenta[campo as keyof typeof filtrosDiferidos] ?? '')).includes(
        normalizar(valor),
      );
    }),
  );

  const actualizarFiltro = (campo: keyof typeof filtros, valor: string) => {
    setFiltros((actuales) => ({ ...actuales, [campo]: valor }));
  };

  return (
    <Card className="mt-6 overflow-hidden">
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle>Cuentas detectadas fuera de IPTVControl</CardTitle>
          <CardDescription>
            Compara el inventario completo del proveedor con las cuentas registradas localmente.
          </CardDescription>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void consulta.refetch()}
          disabled={consulta.isFetching}
        >
          <RefreshCw className={consulta.isFetching ? 'animate-spin' : ''} />
          Actualizar
        </Button>
      </CardHeader>

      {consulta.data ? (
        <div className="grid grid-cols-3 border-b superficie-2">
          {[
            ['En proveedor', consulta.data.resumen.cuentas_proveedor],
            ['En IPTVControl', consulta.data.resumen.cuentas_iptvcontrol],
            ['Externas', consulta.data.resumen.cuentas_externas],
          ].map(([etiqueta, valor]) => (
            <div key={etiqueta} className="border-r px-4 py-3 last:border-r-0">
              <p className="text-xs texto-suave">{etiqueta}</p>
              <p className="mt-0.5 font-mono text-xl font-semibold tabular-nums">{valor}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-2 border-b p-3 sm:grid-cols-2 xl:grid-cols-5">
        <Input
          placeholder="Correo"
          value={filtros.email}
          onChange={(evento) => actualizarFiltro('email', evento.target.value)}
          aria-label="Filtrar cuentas externas por correo"
        />
        <Input
          placeholder="Nombre"
          value={filtros.nombre}
          onChange={(evento) => actualizarFiltro('nombre', evento.target.value)}
          aria-label="Filtrar cuentas externas por nombre"
        />
        <Input
          placeholder="Apellido"
          value={filtros.apellido}
          onChange={(evento) => actualizarFiltro('apellido', evento.target.value)}
          aria-label="Filtrar cuentas externas por apellido"
        />
        <Input
          placeholder="DNI"
          value={filtros.dni}
          onChange={(evento) => actualizarFiltro('dni', evento.target.value)}
          aria-label="Filtrar cuentas externas por DNI"
        />
        <Input
          placeholder="Ciudad"
          value={filtros.ciudad}
          onChange={(evento) => actualizarFiltro('ciudad', evento.target.value)}
          aria-label="Filtrar cuentas externas por ciudad"
        />
      </div>

      {consulta.error ? (
        <CardContent>
          <p className="text-sm text-alert" role="alert">
            {(consulta.error as Error).message}
          </p>
        </CardContent>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Cuenta / DNI</TH>
              <TH>Nombre</TH>
              <TH>Correo</TH>
              <TH>Ciudad</TH>
              <TH>Referencia</TH>
              <TH>Estado</TH>
            </TR>
          </THead>
          {consulta.isLoading ? (
            <TableSkeleton columnas={6} />
          ) : (
            <TBody>
              {cuentas.map((cuenta) => (
                <TR key={cuenta.proveedor_cuenta_id}>
                  <TD>
                    <CopyableId valor={cuenta.dni} etiqueta="DNI" />
                  </TD>
                  <TD>{`${cuenta.nombre} ${cuenta.apellido}`.trim() || '—'}</TD>
                  <TD>{cuenta.email || '—'}</TD>
                  <TD>{cuenta.ciudad || '—'}</TD>
                  <TD>{cuenta.referencia_externa || '—'}</TD>
                  <TD>
                    <Badge tone={cuenta.estado === 'activa' ? 'success' : 'neutral'}>
                      {cuenta.estado === 'activa' ? 'Activa' : 'Inactiva'}
                    </Badge>
                  </TD>
                </TR>
              ))}
              {!consulta.isLoading && cuentas.length === 0 ? (
                <TR>
                  <TD colSpan={6}>
                    <EmptyState
                      icono={<DatabaseZap className="size-8" />}
                      titulo={
                        consulta.data?.resumen.cuentas_externas === 0
                          ? 'Todas las cuentas están registradas'
                          : 'Ninguna cuenta coincide con los filtros'
                      }
                      descripcion={
                        consulta.data?.resumen.cuentas_externas === 0
                          ? 'El inventario del proveedor y IPTVControl no presentan diferencias.'
                          : 'Modifique uno o más filtros para ampliar la búsqueda.'
                      }
                    />
                  </TD>
                </TR>
              ) : null}
            </TBody>
          )}
        </Table>
      )}
    </Card>
  );
};
