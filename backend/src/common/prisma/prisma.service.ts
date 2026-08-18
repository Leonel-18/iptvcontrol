import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { RequestContext, RequestContextService } from '../context/request-context.service';

/** Cliente de Prisma dentro de una transacción (sin métodos de gestión). */
export type TransactionClient = Prisma.TransactionClient;

/**
 * Instancia visible del cliente Prisma. Prisma 6, al aplicar una extensión con
 * `$extends` (la extensión RLS de abajo), enruta los getters/métodos de la clase
 * hacia un objeto intermedio ("impostor") que NO expone los delegates de modelos
 * (`teamMember`, `cuenta`, ...). Por eso `sinContexto` no puede devolver `this`:
 * la referencia a la instancia real (la que el guard usa) se captura acá en el
 * constructor.
 */
let clienteVisible: PrismaClient | undefined;

/**
 * Acceso a PostgreSQL con el contexto multi-tenant activado.
 *
 * Prisma no soporta Row-Level Security de forma nativa, así que la combinación
 * que usamos (documentada en docs/04_Esqueleto_Tecnico_Inicial.md, 2.1) es:
 *
 *   1. Antes de cada consulta, dentro de la MISMA transacción, se ejecuta
 *      `set_config('app.current_tenant', ..., TRUE)`.
 *   2. Las políticas de RLS de Postgres leen ese valor y filtran las filas.
 *
 * El `TRUE` del tercer parámetro es clave: hace que el valor sea local a la
 * transacción. Sin eso, al reutilizarse una conexión del pool podría quedar
 * "pegado" el tenant del request anterior — el peor bug posible en un sistema
 * multi-tenant.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  /**
   * Cliente extendido: cada operación se envuelve sola en una transacción que
   * primero setea el contexto de tenant. Usalo para lecturas y escrituras
   * sueltas; para operaciones compuestas usá `transaction()`.
   */
  readonly db: ReturnType<PrismaService['construirClienteConRls']>;

  constructor(private readonly contexto: RequestContextService) {
    super({
      log: [
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
      ],
    });
    clienteVisible = this;
    this.db = this.construirClienteConRls();
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Conexión a PostgreSQL establecida.');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Transacción interactiva con el contexto de tenant ya aplicado.
   *
   * Todas las operaciones de negocio que tocan más de una tabla (alta de
   * Cliente Final, baja, migración de Cuenta) van por acá: o pasa todo, o no
   * pasa nada. Es lo que evita quedar con una Cuenta creada en SENSA y sin
   * registro local, o al revés (reglas de negocio, sección 5).
   */
  async transaction<T>(
    fn: (tx: TransactionClient) => Promise<T>,
    opciones?: { timeoutMs?: number },
  ): Promise<T> {
    return this.$transaction(
      async (tx) => {
        await this.aplicarContexto(tx, this.contextoActual());
        return fn(tx);
      },
      { timeout: opciones?.timeoutMs ?? 30_000 },
    );
  }

  /**
   * Ejecuta trabajo fuera de un request HTTP (jobs de BullMQ, reconciliación)
   * con el contexto de un Operador Principal. Sirve para tareas que necesitan
   * ver Cuentas y Dispositivos de todas sus Empresas Revendedoras.
   */
  async transactionComoOperador<T>(
    operadorPrincipalId: string,
    fn: (tx: TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      await this.aplicarContexto(tx, {
        esOperador: true,
        operadorPrincipalId,
        empresaRevendedoraId: null,
      });
      return fn(tx);
    });
  }

  /**
   * Igual que la anterior, pero con el contexto de una Empresa Revendedora
   * concreta (necesario cuando el job tiene que escribir Clientes Finales, que
   * por política de RLS sólo admiten escritura desde su propio tenant).
   */
  async transactionComoTenant<T>(
    empresaRevendedoraId: string,
    operadorPrincipalId: string | null,
    fn: (tx: TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      await this.aplicarContexto(tx, {
        esOperador: false,
        operadorPrincipalId,
        empresaRevendedoraId,
      });
      return fn(tx);
    });
  }

  /**
   * Cliente sin contexto de tenant, para el bootstrap de autenticación: hay que
   * poder buscar el TeamMember por `auth0_user_id` ANTES de saber a qué tenant
   * pertenece. La política `team_member_tenant` habilita exactamente ese caso
   * (contexto vacío) y nada más.
   */
  get sinContexto(): PrismaClient {
    // No devolvemos `this`: con `$extends` activo, `this` es el impostor de Prisma
    // sin delegates de modelos. La instancia real quedó guardada en `clienteVisible`.
    return clienteVisible ?? this;
  }

  private contextoActual(): Pick<
    RequestContext,
    'esOperador' | 'operadorPrincipalId' | 'empresaRevendedoraId'
  > {
    const ctx = this.contexto.get();
    return {
      esOperador: ctx?.esOperador ?? false,
      operadorPrincipalId: ctx?.operadorPrincipalId ?? null,
      empresaRevendedoraId: ctx?.empresaRevendedoraId ?? null,
    };
  }

  private async aplicarContexto(
    tx: TransactionClient,
    ctx: Pick<RequestContext, 'esOperador' | 'operadorPrincipalId' | 'empresaRevendedoraId'>,
  ): Promise<void> {
    await tx.$executeRaw`SELECT
      set_config('app.current_tenant', ${ctx.empresaRevendedoraId ?? ''}, TRUE),
      set_config('app.current_operador', ${ctx.operadorPrincipalId ?? ''}, TRUE),
      set_config('app.is_operator', ${ctx.esOperador ? 'on' : 'off'}, TRUE)`;
  }

  private construirClienteConRls() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const service = this;
    return this.$extends({
      name: 'rls-multitenant',
      query: {
        $allModels: {
          async $allOperations({ args, query }) {
            const ctx = service.contextoActual();
            // Patrón oficial de Prisma para RLS: batch transaction donde la
            // primera sentencia setea el contexto y la segunda es la consulta.
            const [, resultado] = await service.$transaction([
              service.$executeRaw`SELECT
                set_config('app.current_tenant', ${ctx.empresaRevendedoraId ?? ''}, TRUE),
                set_config('app.current_operador', ${ctx.operadorPrincipalId ?? ''}, TRUE),
                set_config('app.is_operator', ${ctx.esOperador ? 'on' : 'off'}, TRUE)`,
              query(args),
            ]);
            return resultado;
          },
        },
      },
    });
  }
}
