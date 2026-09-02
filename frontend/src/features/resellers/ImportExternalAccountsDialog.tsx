import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Alert, Button, Field } from '@/components/ui/primitives';
import { Dialog, DialogContent, Select } from '@/components/ui/overlays';
import { api, type Paginado } from '@/lib/api';
import type {
  ExternalAccountImportResult,
  ExternalProviderAccount,
  Reseller,
} from '@/lib/types';

export const ImportExternalAccountsDialog = ({
  accounts,
  open,
  onOpenChange,
  onImported,
}: {
  accounts: ExternalProviderAccount[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (result: ExternalAccountImportResult) => void;
}) => {
  const [resellerId, setResellerId] = useState('');
  const [error, setError] = useState('');
  const resellers = useQuery({
    queryKey: ['resellers', 'external-account-import'],
    queryFn: () => api<Paginado<Reseller>>('/resellers', { params: { per_page: 100 } }),
    enabled: open,
  });
  const importAccounts = useMutation({
    mutationFn: () =>
      api<ExternalAccountImportResult>('/resellers/external-accounts/import', {
        metodo: 'POST',
        body: {
          empresa_revendedora_id: resellerId,
          proveedor_cuenta_ids: accounts.map((account) => account.proveedor_cuenta_id),
        },
      }),
    onSuccess: (result) => {
      onImported(result);
      if (result.resumen.fallidas > 0) {
        toast.warning(
          `Se importaron ${result.resumen.importadas}; ${result.resumen.fallidas} requieren revisión.`,
        );
      } else {
        toast.success(
          `${result.resumen.importadas} Cuenta(s) importada(s) correctamente.`,
        );
      }
      onOpenChange(false);
      setResellerId('');
    },
    onError: (cause: Error) => toast.error(cause.message),
  });

  const submit = () => {
    if (!resellerId) {
      setError('Seleccione la Empresa Revendedora de destino.');
      return;
    }
    setError('');
    importAccounts.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !importAccounts.isPending && onOpenChange(next)}>
      <DialogContent
        titulo={`Importar ${accounts.length} Cuenta(s)`}
        descripcion="Se registrarán como exclusivas y la Empresa Revendedora deberá definir su contraseña."
      >
        <div className="space-y-4">
          <Field label="Empresa revendedora" required error={error}>
            <Select
              value={resellerId}
              onChange={setResellerId}
              placeholder={resellers.isLoading ? 'Cargando empresas…' : 'Seleccione una empresa'}
              opciones={(resellers.data?.data ?? []).map((reseller) => ({
                value: reseller.id,
                label: reseller.razon_social,
                help: reseller.cuit,
              }))}
              disabled={importAccounts.isPending}
            />
          </Field>

          <Alert tone="warning" titulo="Revisión posterior obligatoria">
            <span className="inline-flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              SENSA no informa la contraseña actual. La Empresa deberá abrir cada Cuenta importada
              y usar “Cambiar contraseña” antes de agregar Clientes Finales.
            </span>
          </Alert>

          <div className="max-h-52 overflow-y-auto rounded border">
            {accounts.map((account) => (
              <div
                key={account.proveedor_cuenta_id}
                className="flex items-center justify-between gap-3 border-b px-3 py-2 text-sm last:border-b-0"
              >
                <span className="id-tecnico">{account.dni}</span>
                <span className="truncate texto-suave">
                  {`${account.nombre} ${account.apellido}`.trim() || account.email}
                </span>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={importAccounts.isPending}
            >
              Cancelar
            </Button>
            <Button variant="primary" onClick={submit} disabled={importAccounts.isPending}>
              {importAccounts.isPending ? 'Importando…' : `Importar ${accounts.length} Cuenta(s)`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
