import { Global, Module } from '@nestjs/common';
import { CryptoService } from './crypto.service';

/**
 * Global porque casi todos los módulos de negocio necesitan cifrar/descifrar
 * credenciales de Cuenta, y no aporta nada re-importarlo en cada uno.
 */
@Global()
@Module({
  providers: [CryptoService],
  exports: [CryptoService],
})
export class CryptoModule {}
