import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestContextService } from '../../common/context/request-context.service';
import { PaginatedResponse } from '../../common/dto/pagination.dto';
import {
  mapDispositivoParaOperador,
  mapDispositivoParaRevendedora,
} from '../cuentas/cuentas.mapper';
import { ListarDispositivosQueryDto } from './dto/listar-dispositivos.query';

/**
 * Consultas sobre Dispositivos.
 *
 * Separado de `DispositivosService` a propósito: ahí viven las operaciones que
 * hablan con el Proveedor y mueven estado; acá sólo lecturas. Mezclarlas hace
 * que un archivo de 700 líneas sea imposible de revisar.
 */
@Injectable()
export class DispositivosQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contexto: RequestContextService,
  ) {}

  async listar(query: ListarDispositivosQueryDto) {
    const esOperador = this.contexto.esOperador;

    const where: Prisma.DispositivoWhereInput = {
      cuentaId: query.account_id,
      clienteFinalId: query.customer_id,
      empresaRevendedoraId: query.reseller_id,
      tipo: query.type,
      estado: query.status,
      // La nota descriptiva es texto libre que puede contener el nombre del
      // Cliente Final, y la MAC identifica su equipo: la regla 4.2 se los niega
      // al Operador Principal, así que tampoco puede filtrar por ellos.
      OR: query.q
        ? esOperador
          ? [{ proveedorDeviceId: { contains: query.q, mode: 'insensitive' } }]
          : [
              { proveedorDeviceId: { contains: query.q, mode: 'insensitive' } },
              { mac: { contains: query.q, mode: 'insensitive' } },
              { notaDescriptiva: { contains: query.q, mode: 'insensitive' } },
            ]
        : undefined,
    };

    const esCsv = query.esCsv;
    const [total, dispositivos] = await Promise.all([
      this.prisma.db.dispositivo.count({ where }),
      this.prisma.db.dispositivo.findMany({
        where,
        include: {
          clienteFinal: {
            select: { id: true, numeroCliente: true, nombre: true, apellido: true },
          },
          cuenta: { select: { proveedorCuentaId: true } },
        },
        orderBy: { creadoEn: 'desc' },
        skip: esCsv ? undefined : query.skip,
        take: esCsv ? undefined : query.take,
      }),
    ]);

    const data = dispositivos.map((dispositivo) => ({
      ...(esOperador
        ? mapDispositivoParaOperador(dispositivo)
        : mapDispositivoParaRevendedora(dispositivo)),
      proveedor_cuenta_id: dispositivo.cuenta.proveedorCuentaId,
    }));

    return PaginatedResponse.build(data, total, query.page ?? 1, query.per_page ?? 25);
  }

  async obtener(id: string) {
    const dispositivo = await this.prisma.db.dispositivo.findUnique({
      where: { id },
      include: {
        clienteFinal: {
          select: { id: true, numeroCliente: true, nombre: true, apellido: true },
        },
        cuenta: { select: { id: true, proveedorCuentaId: true, esExclusiva: true } },
      },
    });

    if (!dispositivo) {
      throw new NotFoundException('El dispositivo no existe o no está disponible.');
    }

    const base = this.contexto.esOperador
      ? mapDispositivoParaOperador(dispositivo)
      : mapDispositivoParaRevendedora(dispositivo);

    return {
      ...base,
      cuenta: {
        id: dispositivo.cuenta.id,
        proveedor_cuenta_id: dispositivo.cuenta.proveedorCuentaId,
        es_exclusiva: dispositivo.cuenta.esExclusiva,
      },
    };
  }
}
