import { Module } from '@nestjs/common';
import { CuentasModule } from '../cuentas/cuentas.module';
import { ProveedorModule } from '../../proveedor/proveedor.module';
import { DispositivosController } from './dispositivos.controller';
import { DispositivosService } from './dispositivos.service';
import { DispositivosQueryService } from './dispositivos-query.service';

@Module({
  imports: [CuentasModule, ProveedorModule],
  controllers: [DispositivosController],
  providers: [DispositivosService, DispositivosQueryService],
  exports: [DispositivosService, DispositivosQueryService],
})
export class DispositivosModule {}
