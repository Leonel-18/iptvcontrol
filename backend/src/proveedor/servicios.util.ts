import { BadRequestException } from '@nestjs/common';
import { LicenciasProveedor } from './proveedor-adapter.interface';

export const SERVICIO_BASICO = '1';

/** Firma estable para comparar Cuentas compartidas sin depender del orden recibido. */
export const normalizarServicios = (servicios: string[]): string => {
  const codigos = new Set([SERVICIO_BASICO]);
  for (const servicio of servicios) {
    const codigo = servicio.trim();
    if (!/^\d+$/.test(codigo)) {
      throw new BadRequestException(`El código de servicio "${servicio}" no es válido.`);
    }
    codigos.add(codigo);
  }
  return [...codigos].sort((a, b) => Number(a) - Number(b)).join('|');
};

export const serviciosContratados = (licencias: LicenciasProveedor): string => {
  const contratados = Object.entries(licencias.compradas)
    .filter(([, cantidad]) => cantidad > 0)
    .map(([codigo]) => codigo);
  return normalizarServicios(contratados);
};

export const validarServiciosContratados = (firma: string, licencias: LicenciasProveedor): void => {
  const noContratados = firma
    .split('|')
    .filter((codigo) => codigo !== SERVICIO_BASICO && (licencias.compradas[codigo] ?? 0) <= 0);
  if (noContratados.length > 0) {
    throw new BadRequestException(
      `Los servicios ${noContratados.join(', ')} no están contratados por el Operador Principal.`,
    );
  }
};
