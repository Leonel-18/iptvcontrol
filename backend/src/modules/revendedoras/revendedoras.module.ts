import { Module } from '@nestjs/common';
import { TeamMembersModule } from '../team-members/team-members.module';
import { RevendedorasController } from './revendedoras.controller';
import { RevendedorasService } from './revendedoras.service';

@Module({
  imports: [TeamMembersModule],
  controllers: [RevendedorasController],
  providers: [RevendedorasService],
  exports: [RevendedorasService],
})
export class RevendedorasModule {}
