import { Module } from '@nestjs/common';
import { CuentasModule } from '../cuentas/cuentas.module';
import { ClientesModule } from '../clientes/clientes.module';
import { DispositivosModule } from '../dispositivos/dispositivos.module';
import { IntegracionesModule } from '../integraciones/integraciones.module';
import { PortalApiKeyGuard } from './portal-api-key.guard';
import { PortalClienteController } from './portal-cliente.controller';
import { PortalClienteService } from './portal-cliente.service';

/**
 * Integración del Portal de Cliente externo.
 *
 * Reutiliza `CuentasService` (credenciales, contraseña, PIN, servicios),
 * `InventarioProveedorService` (dispositivos del proveedor) y `DispositivosService`
 * / `IncidenciasDispositivosService` (asignación y baja). No duplica lógica.
 */
@Module({
  imports: [CuentasModule, ClientesModule, DispositivosModule, IntegracionesModule],
  controllers: [PortalClienteController],
  providers: [PortalClienteService, PortalApiKeyGuard],
})
export class IntegracionPortalClienteModule {}
