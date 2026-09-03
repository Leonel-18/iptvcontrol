import { Clock3, History, Unlock } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  formatCuriosityAvailability,
  formatDurationMinutes,
  isCuriosityWindowActive,
} from '@/lib/curiosity-window';
import { formatearFechaHora } from '@/lib/utils';
import type { CuriosityWindow, CuriosityWindowActor } from '@/lib/types';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui/primitives';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';

const actorLabel = (actor: CuriosityWindowActor): string => {
  if (typeof actor === 'string') return actor || 'Sistema';
  return actor?.nombre?.trim() || actor?.email || 'Sistema';
};

const reasonLabel = (reason: string | null): string => {
  if (!reason) return '—';
  const labels: Record<string, string> = {
    vencimiento: 'Vencimiento',
    levantamiento_manual: 'Levantamiento manual',
    cancelacion_venta: 'Venta cancelada',
  };
  return labels[reason] ?? reason.replaceAll('_', ' ');
};

export const CuriosityWindowPanel = ({
  currentWindow,
  history,
  onRelease,
  releasing,
}: {
  currentWindow?: CuriosityWindow | null;
  history: CuriosityWindow[];
  onRelease: () => void;
  releasing: boolean;
}) => {
  const [, forceExpiryRender] = useState(0);
  const active = isCuriosityWindowActive(currentWindow);

  useEffect(() => {
    if (!currentWindow?.activa) return;
    const expectedEnd = new Date(currentWindow.fin_previsto_en).getTime();
    if (!Number.isFinite(expectedEnd) || expectedEnd <= Date.now()) return;

    let timer = 0;
    const renderAtEnd = () => {
      const remaining = expectedEnd - Date.now();
      if (remaining <= 0) {
        forceExpiryRender((value) => value + 1);
        return;
      }
      timer = window.setTimeout(renderAtEnd, Math.min(remaining + 50, 2_147_483_647));
    };
    renderAtEnd();
    return () => window.clearTimeout(timer);
  }, [currentWindow?.activa, currentWindow?.fin_previsto_en]);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Clock3 className="size-4 texto-suave" />
          <CardTitle>Ventana de Alta</CardTitle>
        </div>
        <Badge tone={active ? 'warning' : 'success'}>
          {active ? 'Bloqueada para clientes nuevos' : 'Disponible para nuevas ventas'}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-5">
        {active && currentWindow ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-warn/40 bg-[#FDF5E4] px-4 py-3 dark:bg-warn/10">
              <p className="eyebrow">Nueva venta</p>
              <p className="mt-1 font-display text-lg font-semibold tabular-nums">
                Habilitada para otro cliente el{' '}
                {formatCuriosityAvailability(currentWindow.fin_previsto_en)}
              </p>
            </div>
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="eyebrow">Duración aplicada</dt>
                <dd className="mt-1">{formatDurationMinutes(currentWindow.duracion_aplicada_minutos)}</dd>
              </div>
              <div>
                <dt className="eyebrow">Iniciada</dt>
                <dd className="mt-1">{formatearFechaHora(currentWindow.inicio_en)}</dd>
              </div>
              <div>
                <dt className="eyebrow">Iniciada por</dt>
                <dd className="mt-1">{actorLabel(currentWindow.iniciada_por)}</dd>
              </div>
            </dl>
            <Button variant="secondary" size="sm" onClick={onRelease} disabled={releasing}>
              <Unlock />
              Levantar ventana
            </Button>
          </div>
        ) : (
          <div>
            <p className="font-medium">La Cuenta puede recibir una venta nueva.</p>
            <p className="mt-1 text-sm texto-suave">
              No hay una Ventana de Alta activa que la bloquee para otro cliente nuevo.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <History className="size-4 texto-suave" />
            <h3 className="text-sm font-semibold">Historial de ventanas</h3>
          </div>
          {history.length > 0 ? (
            <Table>
              <THead>
                <TR>
                  <TH>Inicio</TH>
                  <TH>Fin previsto</TH>
                  <TH>Fin real</TH>
                  <TH>Iniciada por</TH>
                  <TH>Finalizada por</TH>
                  <TH>Motivo</TH>
                </TR>
              </THead>
              <TBody>
                {history.map((window, index) => (
                  <TR key={`${window.inicio_en}-${index}`}>
                    <TD className="whitespace-nowrap">{formatearFechaHora(window.inicio_en)}</TD>
                    <TD className="whitespace-nowrap">{formatearFechaHora(window.fin_previsto_en)}</TD>
                    <TD className="whitespace-nowrap">{formatearFechaHora(window.fin_real_en)}</TD>
                    <TD>{actorLabel(window.iniciada_por)}</TD>
                    <TD>{window.fin_real_en ? actorLabel(window.finalizada_por) : '—'}</TD>
                    <TD className="capitalize">{reasonLabel(window.motivo_fin)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          ) : (
            <p className="rounded border px-3 py-4 text-sm texto-suave">
              Esta Cuenta todavía no tiene ventanas anteriores.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
