import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestContextService } from '../../common/context/request-context.service';
import { ProveedorService } from '../../proveedor/proveedor.service';
import { SENSA_SERVICIOS } from '../../proveedor/sensa/sensa.constants';

/**
 * Proveedores de contenido registrados.
 *
 * Hoy hay un único registro (SENSA), pero la entidad existe desde el MVP para
 * que sumar otro Proveedor a futuro sea agregar una fila y un adapter, no
 * refactorizar el modelo de datos.
 */
@Injectable()
export class ProveedoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contexto: RequestContextService,
    private readonly proveedor: ProveedorService,
  ) {}

  async listar() {
    const operadorPrincipalId = this.exigirOperador();

    const [proveedores, operador] = await Promise.all([
      this.prisma.proveedor.findMany({ orderBy: { nombre: 'asc' } }),
      this.prisma.operadorPrincipal.findUniqueOrThrow({
        where: { id: operadorPrincipalId },
        select: { proveedorActivoId: true },
      }),
    ]);

    const configuradas = await this.prisma.db.configuracionProveedor.findMany({
      where: { operadorPrincipalId },
      select: { proveedorId: true },
    });
    const conConfiguracion = new Set(configuradas.map((fila) => fila.proveedorId));

    return proveedores.map((proveedor) => ({
      id: proveedor.id,
      nombre: proveedor.nombre,
      tipo_conector: proveedor.tipoConector,
      activo: proveedor.id === operador.proveedorActivoId,
      configurado: conConfiguracion.has(proveedor.id),
    }));
  }

  /** Catálogo de paquetes de contenido del Proveedor (Anexo de Servicios). */
  catalogoServicios() {
    return Object.entries(SENSA_SERVICIOS).map(([codigo, nombre]) => ({
      codigo,
      nombre,
      obligatorio: codigo === '1',
      nota:
        codigo === '1'
          ? 'El paquete básico es obligatorio y no se puede eliminar.'
          : codigo === '2'
            ? 'Sólo disponible en el reproductor web (los App Stores no admiten contenido adulto).'
            : undefined,
    }));
  }

  /** Catálogo vendible para ambos paneles, sin exponer cantidades contratadas. */
  async catalogoServiciosDisponibles() {
    const operadorPrincipalId = this.contexto.operadorPrincipalId;
    if (!operadorPrincipalId) {
      throw new ForbiddenException('No se pudo identificar al Operador Principal del request.');
    }
    const licencias = await this.proveedor.consultarLicencias(operadorPrincipalId);
    return this.catalogoServicios().map((servicio) => ({
      ...servicio,
      contratado: servicio.obligatorio || (licencias.compradas[servicio.codigo] ?? 0) > 0,
    }));
  }

  /** Licencias contratadas vs. usadas, según el Proveedor. */
  async licencias() {
    const operadorPrincipalId = this.exigirOperador();
    const licencias = await this.proveedor.consultarLicencias(operadorPrincipalId);

    const codigos = new Set([
      ...Object.keys(licencias.compradas),
      ...Object.keys(licencias.usadas),
    ]);

    return {
      detalle: [...codigos].sort().map((codigo) => ({
        codigo,
        paquete: SENSA_SERVICIOS[codigo] ?? `Servicio ${codigo}`,
        compradas: licencias.compradas[codigo] ?? 0,
        usadas: licencias.usadas[codigo] ?? 0,
        disponibles: (licencias.compradas[codigo] ?? 0) - (licencias.usadas[codigo] ?? 0),
      })),
      consultado_en: new Date().toISOString(),
    };
  }

  /** Cambia el Proveedor activo del Operador Principal. */
  async activar(proveedorId: string) {
    const operadorPrincipalId = this.exigirOperador();

    const proveedor = await this.prisma.proveedor.findUnique({ where: { id: proveedorId } });
    if (!proveedor) throw new BadRequestException('El proveedor indicado no existe.');

    await this.prisma.operadorPrincipal.update({
      where: { id: operadorPrincipalId },
      data: { proveedorActivoId: proveedorId },
    });

    return this.listar();
  }

  private exigirOperador(): string {
    const operadorPrincipalId = this.contexto.operadorPrincipalId;
    if (!this.contexto.esOperador || !operadorPrincipalId) {
      throw new ForbiddenException(
        'La administración de proveedores es exclusiva del Operador Principal.',
      );
    }
    return operadorPrincipalId;
  }
}
