import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService, TransactionClient } from '../../common/prisma/prisma.service';
import { RequestContextService } from '../../common/context/request-context.service';
import {
  finMesArgentina,
  inicioMesArgentina,
  periodoMesArgentina,
} from '../../common/time/calendario-comercial';

/** Estado del módulo de cuentas de prueba y consumo del período vigente. */
export interface EstadoCuentasPrueba {
  /** Mes AR "YYYY-MM" al que corresponde el consumo. */
  periodo: string;
  habilitadas: boolean;
  cupo_mensual: number;
  extras: number;
  total: number;
  consumidas: number;
  disponible: number;
  duracion_dias: number;
  avisos_dias: number[];
}

/**
 * Cuentas de prueba (Épica B).
 *
 * Aquí vive el contador mensual (HU-P02): el operador fija un cupo base y,
 * opcionalmente, extras del período. El consumo es un registro append-only —
 * una fila por prueba creada — independiente del estado actual de la Cuenta,
 * para que borrar o convertir una prueba no devuelva cupo. Las altas (HU-P03)
 * reutilizan `asegurarDisponibilidad` y `registrarConsumo`.
 */
@Injectable()
export class PruebasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contexto: RequestContextService,
  ) {}

  /** Estado del módulo para el panel de la Empresa Revendedora autenticada. */
  async obtenerParaRevendedor(): Promise<EstadoCuentasPrueba> {
    return this.obtenerEstado(this.exigirRevendedor());
  }

  /** Consumo del período para una Empresa Revendedora puntual. */
  async obtenerEstado(empresaRevendedoraId: string): Promise<EstadoCuentasPrueba> {
    return this.prisma.transaction((tx) =>
      this.calcularEstado(tx, empresaRevendedoraId, new Date()),
    );
  }

  /**
   * Guard reutilizable por el alta de una prueba (HU-P03): exige el módulo
   * habilitado y cupo disponible dentro de la transacción del alta.
   */
  async asegurarDisponibilidad(
    empresaRevendedoraId: string,
    tx: TransactionClient,
  ): Promise<EstadoCuentasPrueba> {
    const estado = await this.calcularEstado(tx, empresaRevendedoraId, new Date());
    if (!estado.habilitadas) {
      throw new BadRequestException(
        'El módulo de cuentas de prueba está deshabilitado para esta Empresa Revendedora.',
      );
    }
    if (estado.disponible <= 0) {
      throw new BadRequestException(
        `No hay cupo de cuentas de prueba disponible en este período ` +
          `(${estado.consumidas} de ${estado.total}).`,
      );
    }
    return estado;
  }

  /**
   * Registra el consumo de una prueba. Append-only: no se revierte al borrar o
   * convertir la prueba (HU-P02).
   */
  async registrarConsumo(
    params: { empresaRevendedoraId: string; cuentaId?: string | null },
    tx: TransactionClient,
  ): Promise<void> {
    await tx.consumoCuentaPrueba.create({
      data: {
        empresaRevendedoraId: params.empresaRevendedoraId,
        cuentaId: params.cuentaId ?? null,
      },
    });
  }

  private async calcularEstado(
    db: TransactionClient,
    empresaRevendedoraId: string,
    referencia: Date,
  ): Promise<EstadoCuentasPrueba> {
    const empresa = await db.empresaRevendedora.findUniqueOrThrow({
      where: { id: empresaRevendedoraId },
      select: {
        pruebasHabilitadas: true,
        pruebasCupoMensual: true,
        pruebasDuracionDias: true,
        pruebasExtrasPeriodo: true,
        pruebasExtrasPeriodoRef: true,
        pruebasAvisosDias: true,
      },
    });

    const periodo = periodoMesArgentina(referencia);
    // Los extras sólo cuentan en el período para el que fueron cargados: al
    // cambiar de mes dejan de aplicar solos (HU-P02).
    const extras = empresa.pruebasExtrasPeriodoRef === periodo ? empresa.pruebasExtrasPeriodo : 0;
    const total = empresa.pruebasCupoMensual + extras;

    const consumidas = await db.consumoCuentaPrueba.count({
      where: {
        empresaRevendedoraId,
        consumidaEn: {
          gte: inicioMesArgentina(referencia),
          lt: finMesArgentina(referencia),
        },
      },
    });

    return {
      periodo,
      habilitadas: empresa.pruebasHabilitadas,
      cupo_mensual: empresa.pruebasCupoMensual,
      extras,
      total,
      consumidas,
      disponible: Math.max(0, total - consumidas),
      duracion_dias: empresa.pruebasDuracionDias,
      avisos_dias: empresa.pruebasAvisosDias,
    };
  }

  private exigirRevendedor(): string {
    const empresaRevendedoraId = this.contexto.empresaRevendedoraId;
    if (this.contexto.esOperador || !empresaRevendedoraId) {
      throw new ForbiddenException(
        'El estado de las cuentas de prueba se consulta desde el panel de cada Empresa Revendedora.',
      );
    }
    return empresaRevendedoraId;
  }
}
