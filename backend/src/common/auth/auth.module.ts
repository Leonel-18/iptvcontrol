import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { Auth0ManagementService } from './auth0-management.service';

@Module({
  imports: [PassportModule.register({ session: false })],
  providers: [JwtStrategy, Auth0ManagementService],
  exports: [Auth0ManagementService],
})
export class AuthModule {}
