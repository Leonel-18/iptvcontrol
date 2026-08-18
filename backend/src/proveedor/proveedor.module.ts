import { Module } from '@nestjs/common';
import { ConfiguracionProveedorService } from './configuracion-proveedor.service';
import { PROVEEDOR_ADAPTERS } from './proveedor-adapter.interface';
import { ProveedorService } from './proveedor.service';
import { ProveedorRateLimiterService } from './rate-limiter.service';
import { ProveedorTelemetryService } from './proveedor-telemetry.service';
import { SensaAdapter } from './sensa/sensa.adapter';

/**
 * Módulo de integración con Proveedores de contenido.
 *
 * Punto de extensión: para sumar un Proveedor nuevo se escribe su adapter, se
 * agrega al array de `PROVEEDOR_ADAPTERS` y se registra el `tipoConector` en la
 * tabla `proveedor`. Ni la lógica de negocio ni los controllers se tocan.
 */
@Module({
  providers: [
    SensaAdapter,
    ProveedorRateLimiterService,
    ProveedorTelemetryService,
    ConfiguracionProveedorService,
    ProveedorService,
    {
      provide: PROVEEDOR_ADAPTERS,
      useFactory: (sensa: SensaAdapter) => [sensa],
      inject: [SensaAdapter],
    },
  ],
  exports: [ProveedorService, ConfiguracionProveedorService, ProveedorTelemetryService],
})
export class ProveedorModule {}
