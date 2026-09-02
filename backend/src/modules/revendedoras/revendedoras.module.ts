import { Module } from '@nestjs/common';
import { TeamMembersModule } from '../team-members/team-members.module';
import { ProveedorModule } from '../../proveedor/proveedor.module';
import { CuentasModule } from '../cuentas/cuentas.module';
import { RevendedorasController } from './revendedoras.controller';
import { RevendedorasService } from './revendedoras.service';

@Module({
  imports: [TeamMembersModule, ProveedorModule, CuentasModule],
  controllers: [RevendedorasController],
  providers: [RevendedorasService],
  exports: [RevendedorasService],
})
export class RevendedorasModule {}
