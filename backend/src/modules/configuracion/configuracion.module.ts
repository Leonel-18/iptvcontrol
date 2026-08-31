import { Module } from '@nestjs/common';
import { ProveedorModule } from '../../proveedor/proveedor.module';
import { ConfiguracionController } from './configuracion.controller';
import { ConfiguracionService } from './configuracion.service';
import { ProveedoresController } from './proveedores.controller';
import { ProveedoresService } from './proveedores.service';
import { ConfiguracionRevendedorController } from './configuracion-revendedor.controller';

@Module({
  imports: [ProveedorModule],
  controllers: [ConfiguracionController, ConfiguracionRevendedorController, ProveedoresController],
  providers: [ConfiguracionService, ProveedoresService],
  exports: [ConfiguracionService],
})
export class ConfiguracionModule {}
