import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

/** Ajuste de la reserva (slot) de una venta compartida: 1+1 o 2+2. */
export class AjustarSlotVentaDto {
  @ApiProperty({
    enum: [1, 2],
    description: 'Cupos por categoría de la venta (1 = 1+1, 2 = 2+2).',
  })
  @IsIn([1, 2], { message: 'Los cupos por categoría sólo pueden ser 1 (1+1) o 2 (2+2).' })
  cupos_por_categoria!: 1 | 2;
}
