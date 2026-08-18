import { useQuery } from '@tanstack/react-query';
import { api, descargarCsv } from '@/lib/api';
import { formatearFechaHora, formatearImporte, formatearNumero } from '@/lib/utils';
import type { ConsumptionReport, LicenseReport } from '@/lib/types';
import { commercialPlanTypeLabels, traducir } from '@/i18n/entityLabels';
import { ExportCsvButton, Metric, PageHeader } from '@/components/common';
import {
  Alert,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@/components/ui/primitives';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';

/**
 * Reportes — `/reports`.
 *
 * Sirven para facturar a mano: IPTVControl no emite comprobantes ni gestiona
 * cobranzas, eso está fuera del alcance. Lo que hace es responder "cuántas
 * cuentas le corresponde facturarle a cada empresa este mes", cruzando la
 * modalidad comercial con el uso real.
 */
export const ReportsView = () => {
  const consumo = useQuery({
    queryKey: ['report-consumption'],
    queryFn: () => api<ConsumptionReport>('/reports/consumption'),
  });

  const licencias = useQuery({
    queryKey: ['report-licenses'],
    queryFn: () => api<LicenseReport>('/reports/licenses'),
  });

  return (
    <>
      <PageHeader
        eyebrow="Facturación externa"
        titulo="Reportes de consumo"
        descripcion="Licencias comprometidas vs. utilizadas por empresa revendedora."
        acciones={
          <ExportCsvButton
            onExportar={() => descargarCsv('/reports/consumption', {}, 'consumo')}
            etiqueta="Exportar consumo"
          />
        }
      />

      {consumo.isLoading ? (
        <Skeleton className="h-64" />
      ) : consumo.error ? (
        <Alert tone="danger" titulo="No pudimos generar el reporte">
          {(consumo.error as Error).message}
        </Alert>
      ) : consumo.data ? (
        <div className="space-y-4">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              etiqueta="Cuentas facturables"
              valor={formatearNumero(consumo.data.totales.cuentas_facturables)}
              tono="azure"
            />
            <Metric
              etiqueta="Cuentas en uso"
              valor={formatearNumero(consumo.data.totales.cuentas_en_uso)}
              detalle={`${formatearNumero(consumo.data.totales.cuentas_activas)} activas en total`}
            />
            <Metric
              etiqueta="Importe estimado"
              valor={formatearImporte(consumo.data.totales.importe_estimado)}
              detalle="Suma de referencia"
            />
            <Metric
              etiqueta="Clientes finales activos"
              valor={formatearNumero(consumo.data.totales.clientes_activos)}
              detalle={`${formatearNumero(consumo.data.totales.dispositivos_activos)} dispositivos`}
            />
          </section>

          <Alert tone="info">{consumo.data.nota}</Alert>

          <Card>
            <CardHeader>
              <CardTitle>Detalle por empresa revendedora</CardTitle>
            </CardHeader>
            <Table>
              <THead>
                <TR>
                  <TH>Empresa</TH>
                  <TH>Modalidad</TH>
                  <TH align="right">Cuentas en uso</TH>
                  <TH align="right">Comprometidas</TH>
                  <TH align="right">Sin usar</TH>
                  <TH align="right">Facturables</TH>
                  <TH align="right">Importe</TH>
                </TR>
              </THead>
              <TBody>
                {consumo.data.filas.map((fila) => (
                  <TR key={fila.empresa_revendedora_id}>
                    <TD>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium">{fila.razon_social}</span>
                        <span className="id-tecnico texto-suave">{fila.cuit}</span>
                      </div>
                    </TD>
                    <TD>
                      <span className="text-sm">
                        {fila.modalidad
                          ? `${traducir(commercialPlanTypeLabels, fila.modalidad)} · ${fila.escala}`
                          : 'Sin asignar'}
                      </span>
                    </TD>
                    <TD align="right">
                      <span className="tabular-nums">{fila.cuentas_en_uso}</span>
                    </TD>
                    <TD align="right">
                      <span className="tabular-nums">{fila.cuentas_comprometidas ?? '—'}</span>
                    </TD>
                    <TD align="right">
                      <span
                        className={`tabular-nums ${
                          (fila.cuentas_sin_usar ?? 0) > 0 ? 'text-warn' : ''
                        }`}
                      >
                        {fila.cuentas_sin_usar ?? '—'}
                      </span>
                    </TD>
                    <TD align="right">
                      <span className="font-medium tabular-nums">{fila.cuentas_facturables}</span>
                    </TD>
                    <TD align="right">
                      <span className="tabular-nums">{formatearImporte(fila.importe_estimado)}</span>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <CardContent>
              <p className="text-xs texto-suave">
                Generado el {formatearFechaHora(consumo.data.generado_en)}. "Sin usar" son cuentas
                comprometidas que la empresa todavía no vendió: no se pierden, quedan disponibles
                para el mes siguiente.
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Licencias en el proveedor</CardTitle>
        </CardHeader>
        <CardContent>
          {licencias.isLoading ? (
            <Skeleton className="h-24" />
          ) : !licencias.data?.disponible ? (
            <Alert tone="warning">
              {licencias.data?.motivo ?? 'No se pudo consultar el proveedor en este momento.'}
            </Alert>
          ) : (
            <>
              <Table>
                <THead>
                  <TR>
                    <TH>Paquete</TH>
                    <TH align="right">Contratadas</TH>
                    <TH align="right">En uso</TH>
                    <TH align="right">Disponibles</TH>
                  </TR>
                </THead>
                <TBody>
                  {licencias.data.detalle?.map((item) => (
                    <TR key={item.codigo}>
                      <TD>
                        <span className="text-sm">{item.paquete}</span>
                      </TD>
                      <TD align="right">
                        <span className="tabular-nums">{formatearNumero(item.compradas)}</span>
                      </TD>
                      <TD align="right">
                        <span className="tabular-nums">{formatearNumero(item.usadas)}</span>
                      </TD>
                      <TD align="right">
                        <span
                          className={`tabular-nums ${item.disponibles <= 0 ? 'text-alert' : ''}`}
                        >
                          {formatearNumero(item.disponibles)}
                        </span>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
              <p className="mt-3 text-xs texto-suave">
                Consultado el {formatearFechaHora(licencias.data.consultado_en)} directamente al
                proveedor.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
};
