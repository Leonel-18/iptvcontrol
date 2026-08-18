import { Module } from '@nestjs/common';
import { ProveedorModule } from '../../proveedor/proveedor.module';
import { ReportesController } from './reportes.controller';
import { ReportesService } from './reportes.service';

@Module({
  imports: [ProveedorModule],
  controllers: [ReportesController],
  providers: [ReportesService],
})
export class ReportesModule {}
