import { SetMetadata } from '@nestjs/common';
import type { PermisoIntegracion } from './permisos';

export const PERMISO_INTEGRACION_KEY = 'iptvcontrol:integracion:permiso';

/** Exige un permiso concreto de la credencial para ejecutar el endpoint. */
export const RequierePermisoIntegracion = (permiso: PermisoIntegracion) =>
  SetMetadata(PERMISO_INTEGRACION_KEY, permiso);
