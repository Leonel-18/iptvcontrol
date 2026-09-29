import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SoloRevendedor } from '../../common/auth/decorators';
import { PruebasService } from './pruebas.service';

@ApiTags('settings')
@Controller('settings/test-accounts')
@SoloRevendedor()
export class PruebasController {
  constructor(private readonly pruebas: PruebasService) {}

  @Get()
  @ApiOperation({
    summary: 'Estado del módulo de cuentas de prueba y consumo del período vigente.',
  })
  obtener() {
    return this.pruebas.obtenerParaRevendedor();
  }
}
