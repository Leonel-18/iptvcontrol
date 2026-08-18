import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ProveedorModule } from '../proveedor/proveedor.module';
import { COLA_PROVEEDOR } from './cola-proveedor.constants';
import { ColaProveedorProcessor } from './cola-proveedor.processor';
import { ColaProveedorService } from './cola-proveedor.service';

/**
 * Colas de trabajo (BullMQ + Redis).
 *
 * Global porque el encolado se dispara desde varios flujos de negocio y no
 * aporta nada re-importarlo en cada módulo.
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('redis.host'),
          port: config.get<number>('redis.port'),
          password: config.get<string>('redis.password'),
          // Sin esto, BullMQ reintenta para siempre y llena los logs si Redis
          // todavía no levantó.
          maxRetriesPerRequest: null,
        },
      }),
    }),
    BullModule.registerQueue({ name: COLA_PROVEEDOR }),
    ProveedorModule,
  ],
  providers: [ColaProveedorService, ColaProveedorProcessor],
  exports: [ColaProveedorService, BullModule],
})
export class QueuesModule {}
