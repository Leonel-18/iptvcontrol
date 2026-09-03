import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class ImportarCuentasExternasDto {
  @ApiProperty({ description: 'Empresa Revendedora destinataria.' })
  @IsUUID()
  empresa_revendedora_id!: string;

  @ApiProperty({ type: [String], description: 'IDs técnicos de las Cuentas en el Proveedor.' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  proveedor_cuenta_ids!: string[];

  @ApiPropertyOptional({
    description:
      'true si la Cuenta se importa como exclusiva (un único Cliente Final). Por defecto las ' +
      'importadas se tratan como compartidas y quedan bloqueadas para ventas nuevas hasta conciliar ' +
      'su inventario y definir la contraseña.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  es_exclusiva?: boolean;
}
