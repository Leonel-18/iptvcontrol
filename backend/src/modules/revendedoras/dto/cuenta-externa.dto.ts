import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
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
}
