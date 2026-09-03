import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoEmpresaRevendedora } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

/**
 * Alta de Empresa Revendedora (docs/03_Reglas_de_Negocio.md, sección 14).
 *
 * Todos estos datos son de uso administrativo/legal y NO se envían al Proveedor.
 * El email de contacto además es la base para generar los correos de contacto de
 * cada Cuenta (regla 2.3) y el login del `reseller_admin` que se invita.
 */
export class CrearRevendedoraDto {
  @ApiProperty({ description: 'Razón social de la Empresa Revendedora.' })
  @IsString()
  @Length(2, 160)
  razon_social!: string;

  @ApiProperty({
    description:
      'CUIT de 11 dígitos, sin guiones ni espacios (mismo formato que usa el proveedor).',
    example: '30716009226',
  })
  @IsNumberString({ no_symbols: true }, { message: 'El CUIT debe contener sólo dígitos.' })
  @Length(11, 11, { message: 'El CUIT debe tener 11 dígitos, sin guiones ni espacios.' })
  cuit!: string;

  @ApiProperty()
  @IsString()
  @Length(3, 200)
  direccion!: string;

  @ApiProperty({ description: 'Nombre del contacto principal.' })
  @IsString()
  @Length(2, 80)
  nombre_contacto!: string;

  @ApiProperty({ description: 'Apellido del contacto principal.' })
  @IsString()
  @Length(2, 80)
  apellido_contacto!: string;

  @ApiProperty()
  @IsString()
  @Length(6, 30)
  telefono_contacto!: string;

  @ApiProperty({
    description:
      'Correo de contacto. Es el login del reseller_admin y la base de los correos de cada Cuenta.',
  })
  @IsEmail({}, { message: 'El correo de contacto no es válido.' })
  @MaxLength(160)
  email_contacto!: string;

  @ApiPropertyOptional({ description: 'Sitio web (opcional).' })
  @IsOptional()
  @IsUrl({ require_protocol: false }, { message: 'El sitio web no es una URL válida.' })
  @MaxLength(200)
  sitio_web?: string;

  @ApiPropertyOptional({
    description:
      'Modalidad comercial asignada. La define el Operador Principal; la Empresa Revendedora no ' +
      'puede autogestionarla.',
  })
  @IsOptional()
  @IsUUID()
  modalidad_comercial_id?: string;
}

export class ActualizarRevendedoraDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 160) razon_social?: string;
  @ApiPropertyOptional({
    description: 'CUIT de 11 dígitos, sin guiones ni espacios. Debe ser único.',
  })
  @IsOptional()
  @IsNumberString({ no_symbols: true }, { message: 'El CUIT debe contener sólo dígitos.' })
  @Length(11, 11, { message: 'El CUIT debe tener 11 dígitos, sin guiones ni espacios.' })
  cuit?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(3, 200) direccion?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 80) nombre_contacto?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 80) apellido_contacto?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(6, 30) telefono_contacto?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() @MaxLength(160) email_contacto?: string;
  @ApiPropertyOptional() @IsOptional() @IsUrl({ require_protocol: false }) sitio_web?: string;
  @ApiPropertyOptional({ description: 'Cuentas máximas a crear mensualmente (default 10).' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  cuentas_max_crear_mensual?: number;

  @ApiPropertyOptional({ enum: EstadoEmpresaRevendedora })
  @IsOptional()
  @IsEnum(EstadoEmpresaRevendedora)
  estado?: EstadoEmpresaRevendedora;
}

/**
 * Cambio de modalidad comercial o escala.
 *
 * Potestad exclusiva del Operador Principal, tanto para downgrade como para
 * upgrade (regla 1 y flujo 4.5). Depende del trato comercial pactado, no es una
 * elección libre de la Empresa Revendedora.
 */
export class CambiarModalidadDto {
  @ApiProperty({ description: 'Modalidad comercial a aplicar.' })
  @IsUUID()
  modalidad_comercial_id!: string;

  @ApiPropertyOptional({ description: 'Motivo del cambio, para el registro de auditoría.' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  motivo?: string;
}

export class ListarRevendedorasQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: EstadoEmpresaRevendedora })
  @IsOptional()
  @IsEnum(EstadoEmpresaRevendedora)
  status?: EstadoEmpresaRevendedora;
}
