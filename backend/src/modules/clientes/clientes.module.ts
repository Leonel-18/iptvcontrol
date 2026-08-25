import { Module } from '@nestjs/common';
import { CuentasModule } from '../cuentas/cuentas.module';
import { DispositivosModule } from '../dispositivos/dispositivos.module';
import { ClientesController } from './clientes.controller';
import { ClientesService } from './clientes.service';
import { ProveedorModule } from '../../proveedor/proveedor.module';

@Module({
  imports: [CuentasModule, DispositivosModule, ProveedorModule],
  controllers: [ClientesController],
  providers: [ClientesService],
  exports: [ClientesService],
})
export class ClientesModule {}
