import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CuentasService } from './cuentas.service';
import { ListarCuentasQueryDto } from './dto/listar-cuentas.query';
import { ActualizarCuentaDto } from './dto/actualizar-cuenta.dto';
import { CambiarPasswordCuentaDto } from './dto/cambiar-password-cuenta.dto';
import { generarCsv, responderCsv } from '../../common/csv/csv.util';
import { SoloRevendedor } from '../../common/auth/decorators';
import { InventarioProveedorService } from './inventario-proveedor.service';
import { VentanasCuriosidadService } from './ventanas-curiosidad.service';

/**
 * Cuentas — `/accounts` en el frontend.
 *
 * Una sola ruta sirve a los dos paneles: el scope de datos lo define el token y
 * los campos visibles el rol (multi-tenancy invisible en la URL).
 */
@ApiTags('accounts')
@Controller('accounts')
export class CuentasController {
  constructor(
    private readonly cuentas: CuentasService,
    private readonly inventario: InventarioProveedorService,
    private readonly ventanasCuriosidad: VentanasCuriosidadService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Lista Cuentas.',
    description:
      'El Operador Principal ve todas las de sus Empresas Revendedoras (sin usuario/contraseña/PIN); ' +
      'una Empresa Revendedora ve sólo las propias. Con `format=csv` se descarga el listado.',
  })
  async listar(@Query() query: ListarCuentasQueryDto, @Res({ passthrough: true }) res: Response) {
    const resultado = await this.cuentas.listar(query);

    if (query.esCsv) {
      const csv = generarCsv(resultado.data, [
        { encabezado: 'ID Cuenta', valor: (fila) => fila.id },
        { encabezado: 'ID en proveedor', valor: (fila) => fila.proveedor_cuenta_id },
        { encabezado: 'Estado', valor: (fila) => fila.estado },
        { encabezado: 'Exclusiva', valor: (fila) => (fila.es_exclusiva ? 'Sí' : 'No') },
        { encabezado: 'Dispositivos fijos', valor: (fila) => fila.fijos.resumen },
        { encabezado: 'Dispositivos móviles', valor: (fila) => fila.moviles.resumen },
        {
          encabezado: 'Alta',
          valor: (fila) => new Date(fila.creado_en).toLocaleDateString('es-AR'),
        },
      ]);
      responderCsv(res, 'cuentas', csv);
      return undefined;
    }

    return resultado;
  }

  @Get('capacity-alerts')
  @ApiOperation({
    summary: 'Cuentas cerca del tope de capacidad.',
    description:
      'Aviso visual del panel (regla de negocio 12): anticipa que el próximo alta va a ' +
      'requerir buscar otra Cuenta con lugar o crear una nueva.',
  })
  async alertas(@Query('reseller_id') resellerId?: string) {
    return this.cuentas.alertasCapacidad(resellerId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Vista por Cuenta.',
    description:
      'Incluye parametrización de contenido y los Clientes Finales y Dispositivos relacionados. ' +
      'Las credenciales se piden aparte, en `/accounts/:id/credentials`.',
  })
  async obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.cuentas.obtener(id);
  }

  @Patch(':id')
  @SoloRevendedor()
  @ApiOperation({
    summary: 'Edita el tipo de Cuenta (exclusiva ↔ compartida) y/o sus servicios.',
    description:
      'Cambiar de tipo sólo es posible con a lo sumo un Cliente Final activo; de exclusiva a ' +
      'compartida, además, sin superar 2 Dispositivos fijos ni 2 móviles (máximo de una venta ' +
      '2+2). Los servicios se validan siempre contra lo contratado.',
  })
  async actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarCuentaDto) {
    return this.cuentas.actualizarPropiedades(id, dto);
  }

  @Get(':id/credentials')
  @SoloRevendedor()
  @ApiOperation({
    summary: 'Usuario, contraseña y PIN de la Cuenta.',
    description:
      'Exclusivo del panel de la Empresa Revendedora dueña. El Operador Principal no accede a ' +
      'estos campos (regla de negocio 4.2).',
  })
  async credenciales(@Param('id', ParseUUIDPipe) id: string) {
    return this.cuentas.obtenerCredenciales(id);
  }

  @Patch(':id/password')
  @SoloRevendedor()
  @ApiOperation({
    summary: 'Cambia manualmente la contraseña de la Cuenta.',
    description:
      'La contraseña de una Cuenta nueva se genera automáticamente al darla de alta; este ' +
      'endpoint permite reemplazarla a mano (numérica, 8 a 20 dígitos) cuando la Empresa ' +
      'Revendedora lo necesite. Exclusivo del panel de la Empresa Revendedora dueña.',
  })
  async cambiarPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CambiarPasswordCuentaDto,
  ) {
    return this.cuentas.cambiarPassword(id, dto.password);
  }

  @Post(':id/curiosity-window/release')
  @SoloRevendedor()
  @ApiOperation({
    summary: 'Levanta manualmente la Ventana de curiosidad activa de una Cuenta compartida.',
  })
  levantarVentanaCuriosidad(@Param('id', ParseUUIDPipe) id: string) {
    return this.ventanasCuriosidad.levantarManualmente(id);
  }

  @Post(':id/sync-services')
  @ApiOperation({
    summary: 'Sincroniza la parametrización de contenido con el proveedor.',
    description: 'La API del proveedor no tiene webhooks: la actualización es por consulta activa.',
  })
  async sincronizar(@Param('id', ParseUUIDPipe) id: string) {
    return this.cuentas.sincronizarServicios(id);
  }

  @Post(':id/sync-devices')
  @ApiOperation({
    summary: 'Consulta el inventario real de Dispositivos de la Cuenta en el proveedor.',
    description:
      'SENSA no tiene webhooks: es la única forma de ver qué equipo se auto-provisionó al ' +
      'iniciar sesión por el reproductor web. Los Dispositivos que no son ni una venta ni una ' +
      'reserva técnica quedan registrados como incidencia pendiente de revisión manual; nunca ' +
      'se eliminan automáticamente desde acá.',
  })
  async sincronizarDispositivos(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventario.sincronizar(id);
  }

  @Post(':id/close')
  @SoloRevendedor()
  @ApiOperation({
    summary: 'Cierra una Cuenta sin uso (creada por error o abandonada).',
    description:
      'No se puede cerrar una Cuenta con Dispositivos activos o bloqueados por suspensión: ' +
      'primero hay que dar de baja a esos Clientes Finales.',
  })
  async cerrar(@Param('id', ParseUUIDPipe) id: string) {
    return this.cuentas.cerrar(id);
  }
}
