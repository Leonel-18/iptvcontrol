import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { CryptoService } from '../../common/crypto/crypto.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestContextService } from '../../common/context/request-context.service';
import { crearRespuestaErrorBot } from './bot-error.mapper';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class BotIdempotenciaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly contexto: RequestContextService,
  ) {}

  async ejecutar<T>(
    clave: string | undefined,
    payload: unknown,
    operacion: () => Promise<T>,
  ): Promise<T> {
    if (!clave || !UUID_PATTERN.test(clave)) {
      throw new BadRequestException({
        error: 'IdempotencyKeyRequired',
        message: 'El header Idempotency-Key es obligatorio y debe contener un UUID válido.',
      });
    }

    const empresaRevendedoraId = this.contexto.empresaRevendedoraId;
    if (!empresaRevendedoraId) {
      throw new BadRequestException('No se pudo identificar la Empresa Revendedora.');
    }

    const hashSolicitud = this.calcularHash(payload);
    const solicitudes = this.prisma.db.solicitudIdempotenciaBot;
    let id: string;

    try {
      const creada = await solicitudes.create({
        data: {
          empresaRevendedoraId,
          clave,
          hashSolicitud,
          estado: 'procesando',
        },
        select: { id: true },
      });
      id = creada.id;
    } catch (error) {
      if (!this.esConflictoUnico(error)) throw error;
      const existente = await solicitudes.findUnique({
        where: { empresaRevendedoraId_clave: { empresaRevendedoraId, clave } },
      });
      if (!existente) throw error;
      if (existente.hashSolicitud !== hashSolicitud) {
        throw new ConflictException({
          error: 'IdempotencyConflict',
          message: 'La Idempotency-Key ya fue utilizada con datos diferentes.',
        });
      }
      if (existente.respuestaCifrada) {
        return JSON.parse(this.crypto.decrypt(existente.respuestaCifrada)) as T;
      }
      throw new ConflictException({
        error: 'RequestInProgress',
        message: 'La solicitud con esta Idempotency-Key todavía se está procesando.',
      });
    }

    let respuesta: T;
    try {
      respuesta = await operacion();
    } catch (error) {
      await solicitudes.update({
        where: { id },
        data: {
          estado: 'fallida',
          respuestaCifrada: this.crypto.encrypt(JSON.stringify(crearRespuestaErrorBot(error))),
          finalizadaEn: new Date(),
        },
      });
      throw error;
    }
    await solicitudes.update({
      where: { id },
      data: {
        estado: 'completada',
        respuestaCifrada: this.crypto.encrypt(JSON.stringify(respuesta)),
        finalizadaEn: new Date(),
      },
    });
    return respuesta;
  }

  private calcularHash(payload: unknown): string {
    return createHash('sha256').update(this.serializarCanonico(payload)).digest('hex');
  }

  private serializarCanonico(valor: unknown): string {
    if (Array.isArray(valor)) {
      return `[${valor.map((item) => this.serializarCanonico(item)).join(',')}]`;
    }
    if (valor !== null && typeof valor === 'object') {
      const entradas = Object.entries(valor as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([a], [b]) => a.localeCompare(b));
      return `{${entradas
        .map(([clave, item]) => `${JSON.stringify(clave)}:${this.serializarCanonico(item)}`)
        .join(',')}}`;
    }
    return JSON.stringify(valor);
  }

  private esConflictoUnico(error: unknown): boolean {
    return (
      typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002'
    );
  }
}
