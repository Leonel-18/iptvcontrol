import { Module } from '@nestjs/common';
import { CuentasModule } from '../cuentas/cuentas.module';
import { DispositivosModule } from '../dispositivos/dispositivos.module';
import { ClientesController } from './clientes.controller';
import { ClientesService } from './clientes.service';

@Module({
  imports: [CuentasModule, DispositivosModule],
  controllers: [ClientesController],
  providers: [ClientesService],
  exports: [ClientesService],
})
export class ClientesModule {}
