import { Module } from '@nestjs/common';
import { ProveedorModule } from '../../proveedor/proveedor.module';
import { CuentasController } from './cuentas.controller';
import { CuentasService } from './cuentas.service';
import { CuentasProvisioningService } from './cuentas-provisioning.service';
import { IdentificadoresService } from './identificadores.service';
import { InventarioProveedorService } from './inventario-proveedor.service';
import { VentanasCuriosidadService } from './ventanas-curiosidad.service';

@Module({
  imports: [ProveedorModule],
  controllers: [CuentasController],
  providers: [
    CuentasService,
    CuentasProvisioningService,
    IdentificadoresService,
    InventarioProveedorService,
    VentanasCuriosidadService,
  ],
  // El aprovisionamiento lo consumen los flujos de Clientes Finales y
  // Dispositivos, que son los que deciden cuándo hace falta una Cuenta nueva.
  exports: [
    CuentasService,
    CuentasProvisioningService,
    IdentificadoresService,
    InventarioProveedorService,
    VentanasCuriosidadService,
  ],
})
export class CuentasModule {}
