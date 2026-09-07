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
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ClientesService } from './clientes.service';
import { CrearClienteDto } from './dto/crear-cliente.dto';
import { ActualizarClienteDto, ListarClientesQueryDto } from './dto/listar-clientes.query';
import { ColumnaCsv, generarCsv, responderCsv } from '../../common/csv/csv.util';
import { SoloRevendedor } from '../../common/auth/decorators';
import { RequestContextService } from '../../common/context/request-context.service';

/**
 * Forma laxa de una fila del CSV de Clientes Finales: los campos de datos
 * personales son opcionales porque, para el Operador Principal, el servicio no
 * los serializa (regla de negocio 4.2).
 */
interface CsvCliente {
  numero_cliente: number;
  estado: string;
  tipo_alta: string;
  cantidad_dispositivos: number;
  creado_en: Date | string;
  id_gestion_externo?: string | null;
  nombre_completo?: string;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
}

/**
 * Clientes Finales — `/customers` en el frontend.
 *
 * La misma ruta sirve a los dos paneles: para el Operador Principal el backend
 * devuelve la versión por ID (sin nombre ni datos de contacto), tal como fija la
 * regla 4.2. No es que el frontend los oculte: no los recibe.
 */
@ApiTags('customers')
@Controller('customers')
export class ClientesController {
  constructor(
    private readonly clientes: ClientesService,
    private readonly contexto: RequestContextService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Lista Clientes Finales.',
    description:
      'Con `format=csv` descarga el listado para conciliar con el CRM externo. Para el Operador ' +
      'Principal, tanto el JSON como el CSV traen la versión por ID (sin nombre ni datos de ' +
      'contacto), según la regla de negocio 4.2.',
  })
  async listar(@Query() query: ListarClientesQueryDto, @Res({ passthrough: true }) res: Response) {
    const resultado = await this.clientes.listar(query);

    if (query.esCsv) {
      // La exportación se arma sobre lo que el servicio ya serializó, así que
      // para el Operador Principal las columnas de datos personales no existen:
      // no alcanzaba con no mostrarlas, el CSV es una vía de fuga igual de real.
      const esOperador = this.contexto.esOperador;
      const filas = resultado.data as CsvCliente[];

      const columnas: ColumnaCsv<CsvCliente>[] = [
        { encabezado: 'Número de cliente', valor: (fila) => fila.numero_cliente },
        { encabezado: 'Estado', valor: (fila) => fila.estado },
        {
          encabezado: 'Tipo de cuenta',
          valor: (fila) => (fila.tipo_alta === 'cuenta_exclusiva' ? 'Exclusiva' : 'Compartida'),
        },
        { encabezado: 'Dispositivos', valor: (fila) => fila.cantidad_dispositivos },
        {
          encabezado: 'Alta',
          valor: (fila) => new Date(fila.creado_en).toLocaleDateString('es-AR'),
        },
      ];

      if (!esOperador) {
        columnas.splice(
          1,
          0,
          { encabezado: 'ID gestión externa', valor: (fila) => fila.id_gestion_externo },
          { encabezado: 'Nombre', valor: (fila) => fila.nombre_completo },
          { encabezado: 'Teléfono', valor: (fila) => fila.telefono },
          { encabezado: 'Email', valor: (fila) => fila.email },
          { encabezado: 'Dirección', valor: (fila) => fila.direccion },
        );
      }

      responderCsv(res, 'clientes-finales', generarCsv(filas, columnas));
      return undefined;
    }

    return resultado;
  }

  @Get('check-external-id')
  @SoloRevendedor()
  @ApiQuery({ name: 'value', description: 'ID del cliente en el sistema de gestión propio.' })
  @ApiOperation({
    summary: 'Verifica duplicados de ID de gestión externa.',
    description:
      'Paso del wizard de alta (regla 2.4). Si hay coincidencias, el asistente ofrece agrupar el ' +
      'dispositivo en el cliente existente o crear un cliente nuevo de todos modos.',
  })
  async verificarIdExterno(@Query('value') value: string) {
    const coincidencias = await this.clientes.buscarCoincidenciasGestionExterna(value ?? '');
    return { hay_coincidencias: coincidencias.length > 0, coincidencias };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Vista por Cliente, con la Cuenta a la que pertenece.' })
  async obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.clientes.obtener(id);
  }

  @Post()
  @SoloRevendedor()
  @ApiOperation({
    summary: 'Alta de Cliente Final.',
    description:
      'Dos métodos: `cuenta_exclusiva` (siempre crea una Cuenta nueva) o ' +
      '`dispositivo_compartido` (reserva 1+1 o 2+2 y busca una Cuenta propia con firma idéntica ' +
      'y cupos suficientes). Una Cuenta compartida admite 3 cupos por categoría.',
  })
  async crear(@Body() dto: CrearClienteDto) {
    return this.clientes.crear(dto);
  }

  @Patch(':id')
  @SoloRevendedor()
  @ApiOperation({ summary: 'Actualiza los datos de contacto del Cliente Final.' })
  async actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarClienteDto) {
    return this.clientes.actualizar(id, dto);
  }

  @Post(':id/suspend')
  @SoloRevendedor()
  @ApiOperation({
    summary: 'Suspende al Cliente Final.',
    description:
      'Libera su Dispositivo en el proveedor pero lo deja reservado: no se puede asignar a otro ' +
      'cliente mientras dure la suspensión.',
  })
  async suspender(@Param('id', ParseUUIDPipe) id: string) {
    return this.clientes.suspender(id);
  }

  @Post(':id/reactivate')
  @SoloRevendedor()
  @ApiOperation({
    summary: 'Reactiva un Cliente Final suspendido.',
    description:
      'Vuelve a habilitar el cupo en el proveedor y reactiva sus Dispositivos reservados.',
  })
  async reactivar(@Param('id', ParseUUIDPipe) id: string) {
    return this.clientes.reactivar(id);
  }

  @Post(':id/terminate')
  @SoloRevendedor()
  @ApiOperation({
    summary: 'Baja definitiva del Cliente Final.',
    description:
      'Lógica inversa al alta. Sus Dispositivos quedan disponibles para reasignar. Es la única vía ' +
      'para liberar un Dispositivo bloqueado por suspensión.',
  })
  async darDeBaja(@Param('id', ParseUUIDPipe) id: string) {
    return this.clientes.darDeBaja(id);
  }
}
