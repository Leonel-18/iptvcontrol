import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AccionAuditoria, EntidadAuditada, ModalidadComercial, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { RequestContextService } from '../../common/context/request-context.service';
import { PaginatedResponse } from '../../common/dto/pagination.dto';
import {
  ActualizarModalidadDto,
  CrearModalidadDto,
  ListarModalidadesQueryDto,
} from './dto/modalidad.dto';

/**
 * Modalidades comerciales y precios.
 *
 * Los precios los establece el Operador Principal y son parametrizables, nunca
 * hardcodeados (regla 1.3, sujetos a actualización por IPC). La Empresa
 * Revendedora sólo los lee: necesita ver los precios vigentes que le
 * corresponden a ella según su escala, pero no puede modificarlos ni cambiarse
 * de modalidad por su cuenta.
 *
 * Los precios que la Empresa Revendedora le cobra a su Cliente Final quedan
 * fuera del sistema: IPTVControl no interviene en esa facturación.
 */
@Injectable()
export class ModalidadesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly contexto: RequestContextService,
  ) {}

  async listar(query: ListarModalidadesQueryDto) {
    const hoy = new Date();
    const soloVigentes = query.only_current === 'true';

    const where: Prisma.ModalidadComercialWhereInput = {
      tipo: query.type,
      ...(soloVigentes
        ? {
            vigenteDesde: { lte: hoy },
            OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: hoy } }],
          }
        : {}),
    };

    const [total, modalidades] = await Promise.all([
      this.prisma.db.modalidadComercial.count({ where }),
      this.prisma.db.modalidadComercial.findMany({
        where,
        include: { _count: { select: { empresasRevendedoras: true } } },
        orderBy: [{ tipo: 'asc' }, { escala: 'asc' }, { vigenteDesde: 'desc' }],
        skip: query.esCsv ? undefined : query.skip,
        take: query.esCsv ? undefined : query.take,
      }),
    ]);

    const data = modalidades.map((modalidad) =>
      this.map(modalidad, modalidad._count.empresasRevendedoras),
    );
    return PaginatedResponse.build(data, total, query.page ?? 1, query.per_page ?? 25);
  }

  async obtener(id: string) {
    const modalidad = await this.prisma.db.modalidadComercial.findUnique({
      where: { id },
      include: {
        _count: { select: { empresasRevendedoras: true } },
        empresasRevendedoras: this.contexto.esOperador
          ? { select: { id: true, razonSocial: true } }
          : false,
      },
    });

    if (!modalidad) throw new NotFoundException('La modalidad comercial no existe.');

    return {
      ...this.map(modalidad, modalidad._count.empresasRevendedoras),
      empresas_revendedoras:
        'empresasRevendedoras' in modalidad && Array.isArray(modalidad.empresasRevendedoras)
          ? modalidad.empresasRevendedoras.map((empresa) => ({
              id: empresa.id,
              razon_social: empresa.razonSocial,
            }))
          : undefined,
    };
  }

  async crear(dto: CrearModalidadDto) {
    const operadorPrincipalId = this.exigirOperador();

    const modalidad = await this.prisma.transaction(async (tx) => {
      const creada = await tx.modalidadComercial.create({
        data: {
          operadorPrincipalId,
          tipo: dto.tipo,
          escala: dto.escala.trim(),
          precioPorCuenta: new Prisma.Decimal(dto.precio_por_cuenta),
          ritmoIncremento: dto.ritmo_incremento ?? null,
          topeCuentasActivas: dto.tope_cuentas_activas ?? null,
          vigenteDesde: dto.vigente_desde ? new Date(dto.vigente_desde) : new Date(),
          vigenteHasta: dto.vigente_hasta ? new Date(dto.vigente_hasta) : null,
        },
      });

      await this.audit.registrarEnTx(tx, {
        accion: AccionAuditoria.cambio_precio,
        entidad: EntidadAuditada.ModalidadComercial,
        entidadId: creada.id,
        empresaRevendedoraId: null,
        operadorPrincipalId,
        detalle: {
          alta: true,
          tipo: creada.tipo,
          escala: creada.escala,
          precio_por_cuenta: Number(creada.precioPorCuenta),
        },
      });

      return creada;
    });

    return this.obtener(modalidad.id);
  }

  async actualizar(id: string, dto: ActualizarModalidadDto) {
    const operadorPrincipalId = this.exigirOperador();

    const anterior = await this.prisma.db.modalidadComercial.findUnique({ where: { id } });
    if (!anterior) throw new NotFoundException('La modalidad comercial no existe.');

    await this.prisma.transaction(async (tx) => {
      const actualizada = await tx.modalidadComercial.update({
        where: { id },
        data: {
          escala: dto.escala?.trim(),
          precioPorCuenta:
            dto.precio_por_cuenta !== undefined
              ? new Prisma.Decimal(dto.precio_por_cuenta)
              : undefined,
          ritmoIncremento: dto.ritmo_incremento,
          topeCuentasActivas: dto.tope_cuentas_activas,
          vigenteDesde: dto.vigente_desde ? new Date(dto.vigente_desde) : undefined,
          vigenteHasta: dto.vigente_hasta ? new Date(dto.vigente_hasta) : undefined,
        },
      });

      // Todo cambio de precio queda trazado con valor anterior y nuevo: es una de
      // las acciones que la regla 11 exige registrar en el Audit Log.
      await this.audit.registrarEnTx(tx, {
        accion: AccionAuditoria.cambio_precio,
        entidad: EntidadAuditada.ModalidadComercial,
        entidadId: id,
        empresaRevendedoraId: null,
        operadorPrincipalId,
        detalle: {
          anterior: {
            escala: anterior.escala,
            precio_por_cuenta: Number(anterior.precioPorCuenta),
            ritmo_incremento: anterior.ritmoIncremento,
            tope_cuentas_activas: anterior.topeCuentasActivas,
          },
          nuevo: {
            escala: actualizada.escala,
            precio_por_cuenta: Number(actualizada.precioPorCuenta),
            ritmo_incremento: actualizada.ritmoIncremento,
            tope_cuentas_activas: actualizada.topeCuentasActivas,
          },
        },
      });
    });

    return this.obtener(id);
  }

  /**
   * Precios vigentes de la Empresa Revendedora autenticada, con el compromiso
   * mensual calculado si opera con obligación mensual.
   */
  async misPrecios() {
    const empresaRevendedoraId = this.contexto.empresaRevendedoraId;
    if (!empresaRevendedoraId) {
      throw new ForbiddenException('Este endpoint corresponde al panel de la Empresa Revendedora.');
    }

    const empresa = await this.prisma.db.empresaRevendedora.findUniqueOrThrow({
      where: { id: empresaRevendedoraId },
      include: { modalidadComercial: true },
    });

    if (!empresa.modalidadComercial) {
      return {
        modalidad: null,
        mensaje:
          'Todavía no tiene una modalidad comercial asignada. Comuníquese con el operador principal.',
      };
    }

    const modalidad = empresa.modalidadComercial;
    const cuentasActivas = await this.prisma.db.cuenta.count({
      where: { empresaRevendedoraId, estado: 'activa' },
    });

    const mesesDesdeAlta = Math.max(
      1,
      Math.floor(
        (Date.now() - new Date(modalidad.vigenteDesde).getTime()) / (1000 * 60 * 60 * 24 * 30),
      ) + 1,
    );

    // Obligación mensual: el compromiso es creciente y acumulativo. Las Cuentas
    // no usadas no se pierden, quedan disponibles para el mes siguiente.
    const compromisoDelMes =
      modalidad.tipo === 'obligacion_mensual' && modalidad.ritmoIncremento
        ? modalidad.ritmoIncremento * mesesDesdeAlta
        : null;

    return {
      modalidad: this.map(modalidad),
      cuentas_activas: cuentasActivas,
      compromiso_del_mes: compromisoDelMes,
      cuentas_facturables:
        modalidad.tipo === 'obligacion_mensual'
          ? (compromisoDelMes ?? cuentasActivas)
          : cuentasActivas,
      importe_estimado:
        Number(modalidad.precioPorCuenta) *
        (modalidad.tipo === 'obligacion_mensual'
          ? (compromisoDelMes ?? cuentasActivas)
          : cuentasActivas),
      nota:
        modalidad.tipo === 'obligacion_mensual'
          ? 'Las Cuentas comprometidas se facturan en su totalidad, se usen o no. Las no usadas ' +
            'quedan disponibles para el mes siguiente.'
          : 'Se factura únicamente por las Cuentas efectivamente utilizadas.',
    };
  }

  private map(modalidad: ModalidadComercial, empresas?: number) {
    return {
      id: modalidad.id,
      tipo: modalidad.tipo,
      escala: modalidad.escala,
      precio_por_cuenta: Number(modalidad.precioPorCuenta),
      ritmo_incremento: modalidad.ritmoIncremento,
      tope_cuentas_activas: modalidad.topeCuentasActivas,
      vigente_desde: modalidad.vigenteDesde,
      vigente_hasta: modalidad.vigenteHasta,
      cantidad_empresas: empresas,
    };
  }

  private exigirOperador(): string {
    const operadorPrincipalId = this.contexto.operadorPrincipalId;
    if (!this.contexto.esOperador || !operadorPrincipalId) {
      throw new ForbiddenException(
        'Las modalidades comerciales y los precios los define el Operador Principal.',
      );
    }
    return operadorPrincipalId;
  }
}
