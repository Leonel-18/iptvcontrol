import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Length, Matches, Max, MaxLength, Min } from 'class-validator';

export class ActualizarVentanaCuriosidadDto {
  @ApiProperty({
    description:
      'Duración predeterminada máxima, en minutos, para nuevas ventas compartidas. Admite 0.',
    example: 1440,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  duracion_predeterminada_minutos!: number;
}

/**
 * Conexión con el Proveedor (docs/04_Esqueleto_Tecnico_Inicial.md, sección 9.1).
 *
 * `server` y `port` arman la URL base: `https://<server>:<port>/v4/`.
 * `usuario` y `token` son las credenciales de Basic Auth (`<user>:<token>`).
 * El token se guarda cifrado y NUNCA se devuelve en claro por la API.
 */
export class ActualizarConexionProveedorDto {
  @ApiPropertyOptional({
    description: 'Host de la API del proveedor.',
    example: 'api.sensa.com.ar',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Matches(/^[A-Za-z0-9.\-_]+$/, {
    message: 'El servidor debe ser un host válido, sin protocolo ni barras.',
  })
  server?: string;

  @ApiPropertyOptional({ description: 'Puerto de conexión.', example: 443 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @ApiPropertyOptional({ description: 'Usuario de Basic Auth.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  usuario?: string;

  @ApiPropertyOptional({
    description:
      'Token de Basic Auth. Se guarda cifrado con AES-256-GCM. Si no se envía, se conserva el actual.',
  })
  @IsOptional()
  @IsString()
  @Length(4, 400)
  token?: string;

  @ApiPropertyOptional({
    description:
      'Ciudad que se envía al proveedor al crear una Cuenta (campo obligatorio de su API). ' +
      'Es un parámetro técnico de la integración, no un dato del Cliente Final.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  ciudad_por_defecto?: string;

  @ApiPropertyOptional({
    description: 'Parametrización de contenido inicial de cada Cuenta nueva, ej. "1|3|5".',
    example: '1',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[1-7](\|[1-7])*$/, {
    message: 'Los servicios deben ser códigos del 1 al 7 separados por "|", ej. "1|3|5".',
  })
  servicios_por_defecto?: string;

  @ApiPropertyOptional({
    description:
      'Número inicial para generar el identificador tipo DNI de alta. El proveedor exige 7 u 8 dígitos.',
    example: 30000000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1000000)
  @Max(99999999)
  dni_inicial_sensa?: number;

  @ApiPropertyOptional({
    description:
      'Umbral de la alerta de Cuenta cerca del tope (regla 12). Valor inicial sugerido: 2 de 3.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3)
  umbral_alerta_capacidad?: number;

  @ApiPropertyOptional({
    description:
      'Límite de reintentos ante "identificador repetido" antes de cortar y avisar. Caso límite ' +
      'pendiente de definición formal.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  max_reintentos_dni?: number;
}

/**
 * Prueba de conexión. Si no se envían credenciales, se prueba la configuración
 * guardada. Siempre se ejecuta server-side: mandar el token al navegador está
 * explícitamente prohibido (restricción de seguridad no negociable, sección 9.2).
 */
export class ProbarConexionDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) server?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) usuario?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(4, 400) token?: string;
}

export class ConfiguracionProveedorRespuestaDto {
  @ApiProperty() configurada!: boolean;
  @ApiProperty({ nullable: true }) server!: string | null;
  @ApiProperty({ nullable: true }) port!: number | null;
  @ApiProperty({ nullable: true }) usuario!: string | null;
  @ApiProperty({
    description: 'Nunca se devuelve el token. Sólo si está cargado y sus últimos caracteres.',
  })
  token_cargado!: boolean;
  @ApiProperty({ nullable: true }) token_pista!: string | null;
  @ApiProperty() proveedor!: string | null;
  @ApiProperty() ciudad_por_defecto!: string | null;
  @ApiProperty() servicios_por_defecto!: string | null;
  @ApiProperty() dni_inicial_sensa!: number;
  @ApiProperty() dni_actual_sensa!: number;
  @ApiProperty() umbral_alerta_capacidad!: number;
  @ApiProperty() max_reintentos_dni!: number;
  @ApiProperty({ description: 'URL base que se va a usar contra el proveedor.', nullable: true })
  url_base!: string | null;
}
