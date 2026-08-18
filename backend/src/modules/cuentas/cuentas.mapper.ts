import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Cuenta, Dispositivo, EstadoCuenta } from '@prisma/client';
import { CapacidadCuenta } from './capacidad.util';
import { SENSA_SERVICIOS } from '../../proveedor/sensa/sensa.constants';

/**
 * =============================================================================
 * Serialización de Cuentas según quién pregunta
 * =============================================================================
 * La tabla de campos permitidos/prohibidos de docs/03_Reglas_de_Negocio.md,
 * sección 4.2, es NORMATIVA: cualquier endpoint nuevo que exponga datos de
 * Cuenta o Dispositivo al panel del Operador Principal tiene que respetarla.
 *
 * Punto importante de diseño: los campos prohibidos no se ocultan en el
 * frontend, no llegan nunca al frontend. El Operador Principal también vende
 * IPTV, así que darle visibilidad sobre la cartera de sus Empresas Revendedoras
 * sería como que un mayorista vea la lista de clientes de sus distribuidores.
 * =============================================================================
 */

/** Ocupación de una categoría, en formato listo para mostrar ("2 de 3"). */
export class OcupacionCategoriaDto {
  @ApiProperty({ description: 'Dispositivos habilitados en el proveedor.' })
  habilitados!: number;

  @ApiProperty({ description: 'Dispositivos que están ocupando lugar.' })
  ocupados!: number;

  @ApiProperty({ description: 'Cupos habilitados y libres.' })
  libres!: number;

  @ApiProperty({ description: 'Tope de la categoría (3).' })
  tope!: number;

  @ApiProperty({ description: 'True si conviene avisar que está cerca del tope.' })
  cerca_del_tope!: boolean;

  @ApiProperty({ description: 'Texto listo para mostrar, ej. "2 de 3".' })
  resumen!: string;
}

export class CuentaOperadorDto {
  @ApiProperty() id!: string;
  @ApiProperty({ description: 'ID de la Cuenta en el proveedor (soporte técnico).' })
  proveedor_cuenta_id!: string | null;
  @ApiProperty({ enum: EstadoCuenta }) estado!: EstadoCuenta;
  @ApiProperty() es_exclusiva!: boolean;
  @ApiProperty() empresa_revendedora_id!: string;
  @ApiProperty({ type: OcupacionCategoriaDto }) fijos!: OcupacionCategoriaDto;
  @ApiProperty({ type: OcupacionCategoriaDto }) moviles!: OcupacionCategoriaDto;
  @ApiProperty() creado_en!: Date;
}

export class CuentaRevendedoraDto extends CuentaOperadorDto {
  @ApiProperty({ description: 'Usuario de la Cuenta en el proveedor.' })
  usuario!: string;
  @ApiPropertyOptional({ description: 'Contraseña. Sólo para el panel de la Empresa Revendedora.' })
  password?: string | null;
  @ApiPropertyOptional({ description: 'PIN de control parental.' })
  pin?: string | null;
  @ApiProperty({ description: 'Correo de contacto de la Cuenta en el proveedor.' })
  email_contacto!: string;
  @ApiProperty({ description: 'Códigos de servicio habilitados, ej. "1|3|5".' })
  servicios!: string;
  @ApiProperty({ description: 'Nombres de los paquetes habilitados.', type: [String] })
  servicios_nombres!: string[];
}

const armarOcupacion = (
  categoria: CapacidadCuenta['fijo'],
  tope: number,
): OcupacionCategoriaDto => ({
  habilitados: categoria.habilitados,
  ocupados: categoria.ocupados,
  libres: categoria.libres,
  tope,
  cerca_del_tope: categoria.cercaDelTope,
  resumen: `${categoria.ocupados} de ${tope}`,
});

/** Traduce "1|3|5" a los nombres de paquetes del Anexo de Servicios de SENSA. */
export const nombresDeServicios = (servicios: string): string[] =>
  (servicios ?? '')
    .split('|')
    .map((codigo) => codigo.trim())
    .filter(Boolean)
    .map((codigo) => SENSA_SERVICIOS[codigo] ?? `Servicio ${codigo}`);

/**
 * Vista para el panel del Operador Principal: sin usuario, contraseña ni PIN.
 */
export const mapCuentaParaOperador = (
  cuenta: Cuenta,
  capacidad: CapacidadCuenta,
  tope = 3,
): CuentaOperadorDto => ({
  id: cuenta.id,
  proveedor_cuenta_id: cuenta.proveedorCuentaId,
  estado: cuenta.estado,
  es_exclusiva: cuenta.esExclusiva,
  empresa_revendedora_id: cuenta.empresaRevendedoraId,
  fijos: armarOcupacion(capacidad.fijo, tope),
  moviles: armarOcupacion(capacidad.movil, tope),
  creado_en: cuenta.creadoEn,
});

/**
 * Vista para el panel de la Empresa Revendedora: incluye credenciales, porque
 * son las que le pasa a su Cliente Final (reglas de negocio, sección 8).
 *
 * `credenciales` llega ya descifrada desde el servicio; este mapper no toca
 * criptografía, sólo arma la respuesta.
 */
export const mapCuentaParaRevendedora = (
  cuenta: Cuenta,
  capacidad: CapacidadCuenta,
  credenciales: { password: string | null; pin: string | null } | null,
  tope = 3,
): CuentaRevendedoraDto => ({
  ...mapCuentaParaOperador(cuenta, capacidad, tope),
  usuario: cuenta.usuario,
  password: credenciales?.password ?? undefined,
  pin: credenciales?.pin ?? undefined,
  email_contacto: cuenta.emailContacto,
  servicios: cuenta.servicios,
  servicios_nombres: nombresDeServicios(cuenta.servicios),
});

/** Dispositivo visto por el Operador Principal: sin nota descriptiva. */
export const mapDispositivoParaOperador = (dispositivo: Dispositivo) => ({
  id: dispositivo.id,
  cuenta_id: dispositivo.cuentaId,
  proveedor_device_id: dispositivo.proveedorDeviceId,
  tipo: dispositivo.tipo,
  estado: dispositivo.estado,
  creado_en: dispositivo.creadoEn,
});

/** Dispositivo visto por su Empresa Revendedora: con nota y cliente asociado. */
export const mapDispositivoParaRevendedora = (
  dispositivo: Dispositivo & {
    clienteFinal?: {
      id: string;
      numeroCliente: number;
      nombre: string;
      apellido: string | null;
    } | null;
  },
) => ({
  ...mapDispositivoParaOperador(dispositivo),
  cliente_final_id: dispositivo.clienteFinalId,
  cliente_final: dispositivo.clienteFinal
    ? {
        id: dispositivo.clienteFinal.id,
        numero_cliente: dispositivo.clienteFinal.numeroCliente,
        nombre: [dispositivo.clienteFinal.nombre, dispositivo.clienteFinal.apellido]
          .filter(Boolean)
          .join(' '),
      }
    : null,
  mac: dispositivo.mac,
  nota_descriptiva: dispositivo.notaDescriptiva,
});
