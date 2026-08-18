import {
  Body,
  Controller,
  Delete,
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
import { DispositivosQueryService } from './dispositivos-query.service';
import { DispositivosService } from './dispositivos.service';
import {
  ActualizarDispositivoDto,
  CrearDispositivoDto,
  ListarDispositivosQueryDto,
  ReasignarDispositivoDto,
} from './dto/listar-dispositivos.query';
import { generarCsv, responderCsv } from '../../common/csv/csv.util';
import { SoloRevendedor } from '../../common/auth/decorators';
import { ColaProveedorService } from '../../queues/cola-proveedor.service';

/**
 * Forma laxa de una fila del CSV de Dispositivos: los campos exclusivos de la
 * vista de la Empresa Revendedora son opcionales, porque para el Operador
 * Principal el backend no los serializa.
 */
interface CsvDispositivo {
  id: string;
  proveedor_device_id: string | null;
  proveedor_cuenta_id: string | null;
  tipo: string;
  estado: string;
  creado_en: Date | string;
  mac?: string | null;
  nota_descriptiva?: string | null;
  cliente_final?: { numero_cliente: number; nombre: string } | null;
}

/** Dispositivos — `/devices` en el frontend. */
@ApiTags('devices')
@Controller('devices')
export class DispositivosController {
  constructor(
    private readonly consultas: DispositivosQueryService,
    private readonly dispositivos: DispositivosService,
    private readonly cola: ColaProveedorService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Lista Dispositivos.',
    description:
      'Filtrable por `account_id`, `customer_id`, tipo y estado. Con `format=csv` descarga el listado.',
  })
  async listar(
    @Query() query: ListarDispositivosQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const resultado = await this.consultas.listar(query);

    if (query.esCsv) {
      // Las columnas de cliente y nota sólo tienen valor en la vista de la
      // Empresa Revendedora: para el Operador Principal el mapper ni las
      // incluye, así que salen vacías (regla de negocio 4.2).
      const filas = resultado.data as CsvDispositivo[];
      const csv = generarCsv(filas, [
        { encabezado: 'ID Dispositivo', valor: (fila) => fila.id },
        { encabezado: 'ID en proveedor', valor: (fila) => fila.proveedor_device_id },
        { encabezado: 'Cuenta', valor: (fila) => fila.proveedor_cuenta_id },
        { encabezado: 'Tipo', valor: (fila) => (fila.tipo === 'fijo' ? 'Fijo' : 'Móvil') },
        { encabezado: 'Estado', valor: (fila) => fila.estado },
        {
          encabezado: 'Número de cliente',
          valor: (fila) => fila.cliente_final?.numero_cliente ?? '',
        },
        { encabezado: 'Cliente', valor: (fila) => fila.cliente_final?.nombre ?? '' },
        { encabezado: 'MAC', valor: (fila) => fila.mac ?? '' },
        { encabezado: 'Nota', valor: (fila) => fila.nota_descriptiva ?? '' },
        {
          encabezado: 'Alta',
          valor: (fila) => new Date(fila.creado_en).toLocaleDateString('es-AR'),
        },
      ]);
      responderCsv(res, 'dispositivos', csv);
      return undefined;
    }

    return resultado;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un Dispositivo.' })
  async obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.consultas.obtener(id);
  }

  @Post()
  @SoloRevendedor()
  @ApiOperation({
    summary: 'Agrega un Dispositivo a un Cliente Final existente.',
    description:
      'Si la Cuenta actual del cliente llegó al tope 3+3, el sistema le asigna una Cuenta nueva con ' +
      'capacidad suficiente y migra ahí sus Dispositivos existentes (flujo 4.4).',
  })
  async crear(@Body() dto: CrearDispositivoDto) {
    const operadorPrincipalId = await this.dispositivos.operadorPrincipalId();
    const resultado = await this.dispositivos.altaAdicional(dto.customer_id, dto.tipo, {
      mac: dto.mac,
      notaDescriptiva: dto.nota_descriptiva,
      operadorPrincipalId,
    });

    if (resultado.pendienteDeAutoprovision) {
      await this.cola.encolarReconciliacion({
        cuentaId: resultado.cuenta.id,
        operadorPrincipalId,
      });
    }

    return {
      dispositivo: await this.consultas.obtener(resultado.dispositivo.id),
      cuenta_creada: resultado.cuentaCreada,
      migro_de_cuenta: resultado.migro,
      dispositivo_pendiente_de_activacion: resultado.pendienteDeAutoprovision,
    };
  }

  @Post(':id/reassign')
  @SoloRevendedor()
  @ApiOperation({
    summary: 'Reasigna un Dispositivo liberado a un Cliente Final.',
    description:
      'Sólo aplica a Dispositivos en estado `disponible`. Los bloqueados por suspensión no se ' +
      'pueden reasignar hasta que su cliente pase a baja definitiva.',
  })
  async reasignar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReasignarDispositivoDto) {
    const operadorPrincipalId = await this.dispositivos.operadorPrincipalId();
    const resultado = await this.dispositivos.reasignar(id, dto.customer_id, operadorPrincipalId, {
      mac: dto.mac,
      notaDescriptiva: dto.nota_descriptiva,
    });
    return {
      dispositivo: await this.consultas.obtener(resultado.dispositivo.id),
      dispositivo_pendiente_de_activacion: resultado.pendienteDeAutoprovision,
    };
  }

  @Patch(':id')
  @SoloRevendedor()
  @ApiOperation({
    summary: 'Actualiza la nota descriptiva.',
    description: 'Dato interno de IPTVControl: no se envía al proveedor.',
  })
  async actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarDispositivoDto) {
    await this.dispositivos.actualizarNota(id, dto.nota_descriptiva ?? null);
    return this.consultas.obtener(id);
  }

  @Delete(':id')
  @SoloRevendedor()
  @ApiOperation({
    summary: 'Baja individual de un Dispositivo.',
    description:
      'No afecta a los demás Dispositivos del Cliente Final ni a su estado general (regla 2.2). ' +
      'El Dispositivo queda disponible para reasignar.',
  })
  async baja(@Param('id', ParseUUIDPipe) id: string) {
    const operadorPrincipalId = await this.dispositivos.operadorPrincipalId();
    const dispositivo = await this.dispositivos.bajaIndividual(id, operadorPrincipalId);
    return { id: dispositivo.id, estado: dispositivo.estado };
  }
}
