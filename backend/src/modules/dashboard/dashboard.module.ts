import { Module } from '@nestjs/common';
import { CuentasModule } from '../cuentas/cuentas.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [CuentasModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
