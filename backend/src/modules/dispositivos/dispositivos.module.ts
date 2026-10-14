import { Module } from '@nestjs/common';
import { CuentasModule } from '../cuentas/cuentas.module';
import { ProveedorModule } from '../../proveedor/proveedor.module';
import { DispositivosController } from './dispositivos.controller';
import { DispositivosService } from './dispositivos.service';
import { DispositivosQueryService } from './dispositivos-query.service';
import { IncidenciasDispositivosController } from './incidencias-dispositivos.controller';
import { IncidenciasDispositivosService } from './incidencias-dispositivos.service';

@Module({
  imports: [CuentasModule, ProveedorModule],
  controllers: [DispositivosController, IncidenciasDispositivosController],
  providers: [DispositivosService, DispositivosQueryService, IncidenciasDispositivosService],
  // IncidenciasDispositivosService lo consume la integración del Portal de Cliente.
  exports: [DispositivosService, DispositivosQueryService, IncidenciasDispositivosService],
})
export class DispositivosModule {}
