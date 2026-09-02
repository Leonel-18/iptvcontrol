import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DatabaseZap, MoreHorizontal, RefreshCw, Trash2, Upload, X } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { toast } from 'sonner';
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
import {
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/overlays';
import { Table, TableSkeleton, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { api } from '@/lib/api';
import type {
  ExternalAccountImportResult,
  ExternalProviderAccount,
  ExternalProviderAccountsReport,
} from '@/lib/types';
import { ImportExternalAccountsDialog } from './ImportExternalAccountsDialog';

const normalizar = (valor: string) => valor.trim().toLocaleLowerCase('es');

export const ExternalProviderAccountsCard = () => {
  const queryClient = useQueryClient();
  const [filtros, setFiltros] = useState({
    email: '',
    nombre: '',
    apellido: '',
    dni: '',
    ciudad: '',
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [accountsToImport, setAccountsToImport] = useState<ExternalProviderAccount[]>([]);
  const [accountToDelete, setAccountToDelete] = useState<ExternalProviderAccount | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [lastImport, setLastImport] = useState<ExternalAccountImportResult | null>(null);
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
    setSelected(new Set());
  };

  const allFilteredSelected = cuentas.length > 0 && cuentas.every((cuenta) => selected.has(cuenta.proveedor_cuenta_id));
  const someFilteredSelected = cuentas.some((cuenta) => selected.has(cuenta.proveedor_cuenta_id));
  const selectedAccounts = (consulta.data?.cuentas ?? []).filter((cuenta) =>
    selected.has(cuenta.proveedor_cuenta_id),
  );

  const toggleAccount = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleFiltered = () => {
    setSelected((current) => {
      const next = new Set(current);
      if (allFilteredSelected) cuentas.forEach((account) => next.delete(account.proveedor_cuenta_id));
      else cuentas.forEach((account) => next.add(account.proveedor_cuenta_id));
      return next;
    });
  };

  const applyImportResult = (result: ExternalAccountImportResult) => {
    const resolved = new Set(
      result.resultados
        .filter((item) => item.estado !== 'fallida')
        .map((item) => item.proveedor_cuenta_id),
    );
    const failed = new Set(
      result.resultados
        .filter((item) => item.estado === 'fallida')
        .map((item) => item.proveedor_cuenta_id),
    );
    queryClient.setQueryData<ExternalProviderAccountsReport>(
      ['resellers', 'external-accounts'],
      (current) =>
        current
          ? {
              resumen: {
                ...current.resumen,
                cuentas_iptvcontrol: current.resumen.cuentas_iptvcontrol + result.resumen.importadas,
                cuentas_externas: Math.max(0, current.resumen.cuentas_externas - resolved.size),
              },
              cuentas: current.cuentas.filter(
                (account) => !resolved.has(account.proveedor_cuenta_id),
              ),
            }
          : current,
    );
    setSelected(failed);
    setAccountsToImport([]);
    setLastImport(result);
    void queryClient.invalidateQueries({ queryKey: ['resellers', 'external-accounts'] });
    void queryClient.invalidateQueries({ queryKey: ['resellers'] });
    void queryClient.invalidateQueries({ queryKey: ['accounts'] });
  };

  const deleteAccount = useMutation({
    mutationFn: (id: string) =>
      api<{ proveedor_cuenta_id: string; estado: string }>(
        `/resellers/external-accounts/${encodeURIComponent(id)}/close`,
        { metodo: 'POST' },
      ),
    onSuccess: (result) => {
      queryClient.setQueryData<ExternalProviderAccountsReport>(
        ['resellers', 'external-accounts'],
        (current) =>
          current
            ? {
                resumen: {
                  ...current.resumen,
                  cuentas_proveedor: Math.max(0, current.resumen.cuentas_proveedor - 1),
                  cuentas_externas: Math.max(0, current.resumen.cuentas_externas - 1),
                },
                cuentas: current.cuentas.filter(
                  (account) => account.proveedor_cuenta_id !== result.proveedor_cuenta_id,
                ),
              }
            : current,
      );
      setSelected((current) => {
        const next = new Set(current);
        next.delete(result.proveedor_cuenta_id);
        return next;
      });
      setAccountToDelete(null);
      setDeleteConfirmation('');
      toast.success(
        result.estado === 'ya_no_existe'
          ? 'La Cuenta ya no existía en el proveedor.'
          : 'Cuenta eliminada definitivamente del proveedor.',
      );
      void queryClient.invalidateQueries({ queryKey: ['resellers', 'external-accounts'] });
    },
    onError: (cause: Error) => toast.error(cause.message),
  });

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

      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-azure-50 px-3 py-2.5 dark:bg-azure-900/30">
          <p className="text-sm font-medium">{selected.size} Cuenta(s) seleccionada(s)</p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              <X />
              Limpiar
            </Button>
            <Button variant="primary" size="sm" onClick={() => setAccountsToImport(selectedAccounts)}>
              <Upload />
              Importar seleccionadas
            </Button>
          </div>
        </div>
      ) : null}

      {lastImport && lastImport.resumen.fallidas > 0 ? (
        <div className="border-b px-3 py-2 text-sm text-alert" role="status">
          {lastImport.resumen.importadas} importada(s), {lastImport.resumen.fallidas} fallida(s).
          Las fallidas permanecen seleccionadas para reintentar.
        </div>
      ) : null}

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
              <TH className="w-10">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  ref={(element) => {
                    if (element) element.indeterminate = someFilteredSelected && !allFilteredSelected;
                  }}
                  onChange={toggleFiltered}
                  aria-label="Seleccionar todas las cuentas filtradas"
                  className="size-4 accent-azure-500"
                />
              </TH>
              <TH>Cuenta / DNI</TH>
              <TH>Nombre</TH>
              <TH>Correo</TH>
              <TH>Ciudad</TH>
              <TH>Referencia</TH>
              <TH>Estado</TH>
              <TH align="right">Acciones</TH>
            </TR>
          </THead>
          {consulta.isLoading ? (
            <TableSkeleton columnas={8} />
          ) : (
            <TBody>
              {cuentas.map((cuenta) => (
                <TR key={cuenta.proveedor_cuenta_id}>
                  <TD>
                    <input
                      type="checkbox"
                      checked={selected.has(cuenta.proveedor_cuenta_id)}
                      onChange={() => toggleAccount(cuenta.proveedor_cuenta_id)}
                      aria-label={`Seleccionar Cuenta ${cuenta.dni}`}
                      className="size-4 accent-azure-500"
                    />
                  </TD>
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
                  <TD align="right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setAccountsToImport([cuenta])}
                      >
                        <Upload />
                        Importar
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`Acciones para ${cuenta.dni}`}>
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem
                            tone="danger"
                            onSelect={() => {
                              setDeleteConfirmation('');
                              setAccountToDelete(cuenta);
                            }}
                          >
                            <Trash2 />
                            Eliminar definitivamente en SENSA
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TD>
                </TR>
              ))}
              {!consulta.isLoading && cuentas.length === 0 ? (
                <TR>
                  <TD colSpan={8}>
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

      <ImportExternalAccountsDialog
        accounts={accountsToImport}
        open={accountsToImport.length > 0}
        onOpenChange={(open) => !open && setAccountsToImport([])}
        onImported={applyImportResult}
      />

      <ConfirmDialog
        abierto={Boolean(accountToDelete)}
        onCambio={(open) => {
          if (!open) {
            setAccountToDelete(null);
            setDeleteConfirmation('');
          }
        }}
        titulo="Eliminar definitivamente en SENSA"
        descripcion="SENSA eliminará la Cuenta y todos sus Dispositivos. IPTVControl bloqueará la operación si detecta algún equipo."
        etiquetaConfirmar="Eliminar Cuenta"
        tono="danger"
        cargando={deleteAccount.isPending}
        confirmarDeshabilitado={deleteConfirmation !== accountToDelete?.dni}
        onConfirmar={() => accountToDelete && deleteAccount.mutate(accountToDelete.proveedor_cuenta_id)}
      >
        <p className="mb-3 text-sm">
          Para confirmar, escriba el DNI <strong>{accountToDelete?.dni}</strong>.
        </p>
        <Input
          value={deleteConfirmation}
          onChange={(event) => setDeleteConfirmation(event.target.value.trim())}
          aria-label="Confirmar DNI de la Cuenta a eliminar"
          autoFocus
        />
      </ConfirmDialog>
    </Card>
  );
};
