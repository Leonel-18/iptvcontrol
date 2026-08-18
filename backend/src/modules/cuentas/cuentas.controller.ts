import { Controller, Get, Param, ParseUUIDPipe, Post, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CuentasService } from './cuentas.service';
import { ListarCuentasQueryDto } from './dto/listar-cuentas.query';
import { generarCsv, responderCsv } from '../../common/csv/csv.util';
import { SoloRevendedor } from '../../common/auth/decorators';

/**
 * Cuentas — `/accounts` en el frontend.
 *
 * Una sola ruta sirve a los dos paneles: el scope de datos lo define el token y
 * los campos visibles el rol (multi-tenancy invisible en la URL).
 */
@ApiTags('accounts')
@Controller('accounts')
export class CuentasController {
  constructor(private readonly cuentas: CuentasService) {}

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

  @Post(':id/sync-services')
  @ApiOperation({
    summary: 'Sincroniza la parametrización de contenido con el proveedor.',
    description: 'La API del proveedor no tiene webhooks: la actualización es por consulta activa.',
  })
  async sincronizar(@Param('id', ParseUUIDPipe) id: string) {
    return this.cuentas.sincronizarServicios(id);
  }
}
