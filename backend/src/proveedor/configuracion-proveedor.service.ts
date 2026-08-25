import { Injectable, NotFoundException } from '@nestjs/common';
import { CryptoService } from '../common/crypto/crypto.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { CredencialesProveedor } from './proveedor-adapter.interface';

export interface ConfiguracionProveedorResuelta {
  id: string;
  operadorPrincipalId: string;
  proveedorId: string;
  proveedorNombre: string;
  tipoConector: string;
  credenciales: CredencialesProveedor;
  ciudadPorDefecto: string;
  serviciosPorDefecto: string;
}

/**
 * Resuelve la configuración de conexión al Proveedor de un Operador Principal y
 * descifra el token de Basic Auth.
 *
 * El token vive cifrado en base de datos (AES-256-GCM) y se descifra sólo acá,
 * en memoria, justo antes de armar la llamada. Nunca se devuelve por la API ni
 * se escribe en logs — de hecho `GET /settings/sensa` devuelve únicamente si
 * está configurado o no (docs/04, sección 9.3).
 */
@Injectable()
export class ConfiguracionProveedorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  /**
   * Configuración vigente del Operador Principal indicado.
   *
   * Se lee con el contexto de Operador Principal explícito (transacción RLS),
   * porque la política de `configuracion_proveedor` lo exige. Aplica tanto
   * desde un request HTTP como desde jobs de BullMQ que corren fuera de un
   * request: el contexto se setea acá mismo, no depende del AsyncLocalStorage.
   */
  async obtener(operadorPrincipalId: string): Promise<ConfiguracionProveedorResuelta> {
    const configuracion = await this.prisma.transactionComoOperador(
      operadorPrincipalId,
      async (tx) => {
        const operador = await tx.operadorPrincipal.findUnique({
          where: { id: operadorPrincipalId },
          select: { proveedorActivoId: true },
        });

        if (!operador?.proveedorActivoId) {
          throw new NotFoundException(
            'El Operador Principal no tiene un Proveedor activo configurado. ' +
              'Configúrelo en Configuración → Conexión con el proveedor.',
          );
        }

        const configuracionBuscada = await tx.configuracionProveedor.findUnique({
          where: {
            operadorPrincipalId_proveedorId: {
              operadorPrincipalId,
              proveedorId: operador.proveedorActivoId,
            },
          },
          include: { proveedor: true },
        });

        if (!configuracionBuscada) {
          throw new NotFoundException(
            'Falta configurar la conexión con el proveedor (servidor, puerto, usuario y token).',
          );
        }

        return configuracionBuscada;
      },
    );

    return {
      id: configuracion.id,
      operadorPrincipalId,
      proveedorId: configuracion.proveedorId,
      proveedorNombre: configuracion.proveedor.nombre,
      tipoConector: configuracion.proveedor.tipoConector,
      credenciales: {
        server: configuracion.server,
        port: configuracion.port,
        usuario: configuracion.usuario,
        token: this.crypto.decrypt(configuracion.tokenCifrado),
      },
      ciudadPorDefecto: configuracion.ciudadPorDefecto,
      serviciosPorDefecto: configuracion.serviciosPorDefecto,
    };
  }

  /** Igual que `obtener`, pero devuelve null en lugar de lanzar. */
  async obtenerOpcional(
    operadorPrincipalId: string,
  ): Promise<ConfiguracionProveedorResuelta | null> {
    try {
      return await this.obtener(operadorPrincipalId);
    } catch {
      return null;
    }
  }
}
