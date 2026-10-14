import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AccionAuditoria,
  EntidadAuditada,
  EstadoCuenta,
  EstadoDispositivo,
  EstadoEmpresaRevendedora,
  ModalidadComercial,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { RequestContextService } from '../../common/context/request-context.service';
import { PaginatedResponse } from '../../common/dto/pagination.dto';
import { TeamMembersService } from '../team-members/team-members.service';
import { ProveedorService } from '../../proveedor/proveedor.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { InventarioProveedorService } from '../cuentas/inventario-proveedor.service';
import { normalizarServicios } from '../../proveedor/servicios.util';
import { ImportarCuentasExternasDto } from './dto/cuenta-externa.dto';
import {
  finMesArgentina,
  inicioMesArgentina,
  periodoMesArgentina,
} from '../../common/time/calendario-comercial';
import {
  ActualizarRevendedoraDto,
  AgrupacionMetricas,
  CambiarModalidadDto,
  CrearRevendedoraDto,
  ListarRevendedorasQueryDto,
  MetricasRevendedoraQueryDto,
} from './dto/revendedora.dto';

/** Un punto de la serie histórica de Cuentas. */
interface PuntoMetricas {
  fecha: string;
  altas: number;
  altas_importadas: number;
  cierres: number;
  total: number;
  activas: number;
}

/**
 * Bordes de día en calendario argentino (UTC-3 todo el año, sin horario de
 * verano desde 2009). `inicioDiaArgentina` devuelve el instante UTC de las
 * 00:00 AR; `finDiaArgentina`, el de las 00:00 AR del día siguiente, para
 * filtrar con `[inicio, fin)`.
 */
function partesFechaArgentina(referencia: Date): { anio: number; mes: number; dia: number } {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(referencia);
  return {
    anio: Number(partes.find((parte) => parte.type === 'year')?.value),
    mes: Number(partes.find((parte) => parte.type === 'month')?.value),
    dia: Number(partes.find((parte) => parte.type === 'day')?.value),
  };
}

/** Instante UTC de una fecha argentina: 00:00 AR = 03:00 UTC. */
function instanteArgentina(anio: number, mes: number, dia: number): Date {
  return new Date(Date.UTC(anio, mes - 1, dia, 3, 0, 0, 0));
}

function inicioDiaArgentina(referencia: Date): Date {
  const { anio, mes, dia } = partesFechaArgentina(referencia);
  return instanteArgentina(anio, mes, dia);
}

/** Interpreta `YYYY-MM-DD` como fecha argentina (no como medianoche UTC). */
function inicioDiaDesdeTexto(texto: string): Date {
  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto);
  if (coincidencia) {
    return instanteArgentina(
      Number(coincidencia[1]),
      Number(coincidencia[2]),
      Number(coincidencia[3]),
    );
  }
  return inicioDiaArgentina(new Date(texto));
}

function finDiaDesdeTexto(texto: string): Date {
  return new Date(inicioDiaDesdeTexto(texto).getTime() + 86_400_000);
}

/** Lunes 00:00 AR de la semana que contiene a `referencia` (semana ISO). */
function inicioSemanaArgentina(referencia: Date): Date {
  const dia = inicioDiaArgentina(referencia);
  const diaSemana = (dia.getUTCDay() + 6) % 7; // 0 = lunes … 6 = domingo
  return new Date(dia.getTime() - diaSemana * 86_400_000);
}

/** Primer día a las 00:00 AR del mes que contiene a `referencia`. */
function inicioMesDesdeInstante(referencia: Date): Date {
  const { anio, mes } = partesFechaArgentina(referencia);
  return instanteArgentina(anio, mes, 1);
}

/** Primer día a las 00:00 AR del mes siguiente (normaliza el cambio de año). */
function mesSiguiente(fecha: Date): Date {
  const { anio, mes } = partesFechaArgentina(fecha);
  return instanteArgentina(anio, mes + 1, 1);
}

/**
 * Administración de Empresas Revendedoras.
 *
 * Es el tenant del sistema: cada una tiene login y panel propio, con aislamiento
 * total respecto a las demás y respecto al propio Operador Principal.
 *
 * El alta la hace siempre un `operator_admin`, y dispara la invitación del
 * `reseller_admin` correspondiente (flujo 4.7): en el MVP, cada Empresa
 * Revendedora opera con un único Team Member.
 */
@Injectable()
export class RevendedorasService {
  private readonly logger = new Logger(RevendedorasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly contexto: RequestContextService,
    private readonly teamMembers: TeamMembersService,
    private readonly proveedor: ProveedorService,
    private readonly crypto: CryptoService,
    private readonly inventario: InventarioProveedorService,
  ) {}

  async listar(query: ListarRevendedorasQueryDto) {
    const where: Prisma.EmpresaRevendedoraWhereInput = {
      estado: query.status,
      OR: query.q
        ? [
            { razonSocial: { contains: query.q, mode: 'insensitive' } },
            { cuit: { contains: query.q } },
            { emailContacto: { contains: query.q, mode: 'insensitive' } },
          ]
        : undefined,
    };

    const [total, empresas, conteos] = await Promise.all([
      this.prisma.db.empresaRevendedora.count({ where }),
      this.prisma.db.empresaRevendedora.findMany({
        where,
        include: {
          modalidadComercial: true,
          _count: { select: { cuentas: true, clientesFinales: true } },
        },
        orderBy: { razonSocial: 'asc' },
        skip: query.esCsv ? undefined : query.skip,
        take: query.esCsv ? undefined : query.take,
      }),
      this.conteosComerciales(query),
    ]);

    const data = empresas.map((empresa) => {
      const conteo = conteos.get(empresa.id);
      const totalCuentas = conteo?.totalCuentas ?? empresa._count.cuentas;
      const creadasMes = conteo?.creadasMesSistema ?? 0;
      const cuentasActivas = conteo?.cuentasActivas ?? 0;

      return {
        id: empresa.id,
        razon_social: empresa.razonSocial,
        cuit: empresa.cuit,
        email_contacto: empresa.emailContacto,
        telefono_contacto: empresa.telefonoContacto,
        contacto: `${empresa.nombreContacto} ${empresa.apellidoContacto}`.trim(),
        sitio_web: empresa.sitioWeb,
        estado: empresa.estado,
        modalidad_comercial: empresa.modalidadComercial
          ? {
              id: empresa.modalidadComercial.id,
              tipo: empresa.modalidadComercial.tipo,
              escala: empresa.modalidadComercial.escala,
              precio_por_cuenta: Number(empresa.modalidadComercial.precioPorCuenta),
            }
          : null,
        cantidad_cuentas: totalCuentas,
        cantidad_clientes: empresa._count.clientesFinales,
        cuentas_max_crear_mensual: empresa.cuentasMaxCrearMensual,
        // Dispositivos sincronizados (sin contar dados de baja).
        dispositivos: conteo?.dispositivos ?? 0,
        comerciales: {
          cuentas_a_cobrar: this.calcularCuentasACobrar({
            modalidad: empresa.modalidadComercial,
            asignadaEn: empresa.modalidadAsignadaEn ?? empresa.creadoEn,
            creadasEnMes: creadasMes,
            cuentasActivas,
          }),
          cuentas_maximas: this.calcularMaximoComercial({
            totalCuentas: totalCuentas,
            creadasEnMes: creadasMes,
            cuentasMaxCrearMensual: empresa.cuentasMaxCrearMensual,
          }),
          creadas_mes: creadasMes,
        },
        creado_en: empresa.creadoEn,
      };
    });

    return PaginatedResponse.build(data, total, query.page ?? 1, query.per_page ?? 25);
  }

  /**
   * Conteos por Empresa Revendedora para el listado, en un solo query batch.
   * Corre dentro del contexto RLS del Operador (mismo patrón que el resto de
   * las queries crudas del sistema): sin esto, un subquery de conteo podría no
   * ver filas según la sesión.
   */
  private async conteosComerciales(query: ListarRevendedorasQueryDto) {
    const operadorPrincipalId = this.requerirOperador();
    const ahora = new Date();
    const inicioMes = inicioMesArgentina(ahora);
    const finMes = finMesArgentina(ahora);

    const filtroBase = query.status ? Prisma.sql`AND er."estado" = ${query.status}` : Prisma.empty;
    const filtroBusqueda = query.q
      ? Prisma.sql`AND (er."razon_social" ILIKE ${`%${query.q}%`} OR er."cuit" LIKE ${`%${query.q}%`} OR er."email_contacto" ILIKE ${`%${query.q}%`})`
      : Prisma.empty;

    const filas = await this.prisma.transactionComoOperador(
      operadorPrincipalId,
      (tx) =>
        tx.$queryRaw<
          Array<{
            empresa_revendedora_id: string;
            total_cuentas: bigint;
            creadas_mes_sistema: bigint;
            cuentas_activas: bigint;
            dispositivos: bigint;
          }>
        >`
      SELECT
        er."id" AS empresa_revendedora_id,
        (SELECT COUNT(*)::bigint FROM "cuenta" c WHERE c."empresa_revendedora_id" = er."id") AS total_cuentas,
        (SELECT COUNT(*)::bigint FROM "cuenta" c
          WHERE c."empresa_revendedora_id" = er."id"
            AND c."procedencia" = 'creada_en_sistema'
            AND c."estado" = 'activa'
            AND c."creado_en" >= ${inicioMes} AND c."creado_en" < ${finMes}) AS creadas_mes_sistema,
        (SELECT COUNT(*)::bigint FROM "cuenta" c
          WHERE c."empresa_revendedora_id" = er."id" AND c."estado" = 'activa') AS cuentas_activas,
        (SELECT COUNT(*)::bigint FROM "dispositivo" d
          WHERE d."empresa_revendedora_id" = er."id"
            AND d."estado" = 'activo') AS dispositivos
      FROM "empresa_revendedora" er
      WHERE 1=1 ${filtroBase} ${filtroBusqueda}
    `,
    );

    return new Map(
      filas.map((fila) => [
        fila.empresa_revendedora_id,
        {
          totalCuentas: Number(fila.total_cuentas),
          creadasMesSistema: Number(fila.creadas_mes_sistema),
          cuentasActivas: Number(fila.cuentas_activas),
          dispositivos: Number(fila.dispositivos),
        },
      ]),
    );
  }

  /**
   * Detalle de una Empresa Revendedora.
   *
   * Para el Operador Principal incluye el resumen de Cuentas y Dispositivos, pero
   * siempre por ID: sin nombres ni datos de contacto de Clientes Finales, sin
   * credenciales de Cuenta y sin notas descriptivas (regla 4.2).
   */
  async obtener(id: string) {
    const empresa = await this.prisma.db.empresaRevendedora.findUnique({
      where: { id },
      include: {
        modalidadComercial: true,
        teamMembers: {
          select: { id: true, email: true, rol: true, estado: true, ultimoAccesoEn: true },
        },
      },
    });

    if (!empresa) {
      throw new NotFoundException('La Empresa Revendedora no existe o no está disponible.');
    }

    const [cuentas, dispositivos, clientesActivos, creadasMesSistema] = await Promise.all([
      this.prisma.db.cuenta.groupBy({
        by: ['estado'],
        where: { empresaRevendedoraId: id },
        _count: { _all: true },
      }),
      this.prisma.db.dispositivo.groupBy({
        by: ['estado'],
        where: { empresaRevendedoraId: id },
        _count: { _all: true },
      }),
      this.prisma.db.clienteFinal.count({
        where: { empresaRevendedoraId: id, estado: 'activo' },
      }),
      // Cuentas creadas por IPTVControl en el mes calendario AR y que siguen
      // ACTIVAS (las cerradas en el proveedor ya liberaron su cupo y no se
      // cuentan; las importadas no consumen cupo mensual).
      this.prisma.db.cuenta.count({
        where: {
          empresaRevendedoraId: id,
          procedencia: 'creada_en_sistema',
          estado: EstadoCuenta.activa,
          creadoEn: { gte: inicioMesArgentina(new Date()), lt: finMesArgentina(new Date()) },
        },
      }),
    ]);

    const contar = <T extends { _count: { _all: number } }>(
      grupos: T[],
      predicado: (grupo: T) => boolean,
    ) => grupos.filter(predicado).reduce((total, grupo) => total + grupo._count._all, 0);

    const totalCuentas = contar(cuentas, () => true);
    const cuentasActivas = contar(cuentas, (grupo) => grupo.estado === EstadoCuenta.activa);
    const comerciales = {
      cuentas_a_cobrar: this.calcularCuentasACobrar({
        modalidad: empresa.modalidadComercial,
        asignadaEn: empresa.modalidadAsignadaEn ?? empresa.creadoEn,
        creadasEnMes: creadasMesSistema,
        cuentasActivas,
      }),
      cuentas_maximas: this.calcularMaximoComercial({
        totalCuentas,
        creadasEnMes: creadasMesSistema,
        cuentasMaxCrearMensual: empresa.cuentasMaxCrearMensual,
      }),
      creadas_mes: creadasMesSistema,
    };

    return {
      id: empresa.id,
      razon_social: empresa.razonSocial,
      cuit: empresa.cuit,
      direccion: empresa.direccion,
      nombre_contacto: empresa.nombreContacto,
      apellido_contacto: empresa.apellidoContacto,
      telefono_contacto: empresa.telefonoContacto,
      email_contacto: empresa.emailContacto,
      sitio_web: empresa.sitioWeb,
      estado: empresa.estado,
      cuentas_max_crear_mensual: empresa.cuentasMaxCrearMensual,
      // Módulo de cuentas de prueba (HU-P01/P02): configuración por empresa. Los
      // extras sólo se informan si corresponden al período vigente.
      pruebas: {
        habilitadas: empresa.pruebasHabilitadas,
        cupo_mensual: empresa.pruebasCupoMensual,
        duracion_dias: empresa.pruebasDuracionDias,
        extras_periodo:
          empresa.pruebasExtrasPeriodoRef === periodoMesArgentina(new Date())
            ? empresa.pruebasExtrasPeriodo
            : 0,
        avisos_dias: empresa.pruebasAvisosDias,
      },
      modalidad_asignada_en: empresa.modalidadAsignadaEn ?? null,
      modalidad_comercial: empresa.modalidadComercial
        ? {
            id: empresa.modalidadComercial.id,
            tipo: empresa.modalidadComercial.tipo,
            escala: empresa.modalidadComercial.escala,
            precio_por_cuenta: Number(empresa.modalidadComercial.precioPorCuenta),
            ritmo_incremento: empresa.modalidadComercial.ritmoIncremento,
            tope_cuentas_activas: empresa.modalidadComercial.topeCuentasActivas,
          }
        : null,
      team_members: empresa.teamMembers.map((miembro) => ({
        id: miembro.id,
        email: miembro.email,
        rol: miembro.rol,
        estado: miembro.estado,
        ultimo_acceso_en: miembro.ultimoAccesoEn,
      })),
      resumen: {
        cuentas_activas: cuentasActivas,
        cuentas_cerradas: contar(cuentas, (grupo) => grupo.estado === EstadoCuenta.cerrada),
        dispositivos_activos: contar(
          dispositivos,
          (grupo) => grupo.estado === EstadoDispositivo.activo,
        ),
        dispositivos_bloqueados: contar(
          dispositivos,
          (grupo) => grupo.estado === EstadoDispositivo.bloqueado_por_suspension,
        ),
        dispositivos_disponibles: contar(
          dispositivos,
          (grupo) => grupo.estado === EstadoDispositivo.disponible,
        ),
        clientes_activos: clientesActivos,
      },
      // Límites visibles antes de crear una Cuenta (TAREA 1).
      comerciales,
      creado_en: empresa.creadoEn,
    };
  }

  /**
   * Serie histórica de Cuentas de una Empresa Revendedora.
   *
   * Reconstruye la evolución con datos que ya existen (no inventa snapshots):
   *  - altas por período: fecha de registro de cada Cuenta en IPTVControl
   *    (`Cuenta.creadoEn`). Las importadas se informan aparte: su `creadoEn` es
   *    la fecha de importación, no su alta real en el Proveedor.
   *  - cierres por período y cuentas activas: única fuente de bajas es el
   *    `AuditLog` (`cierre_cuenta` / `cierre_cuenta_prueba`). Una Cuenta cerrada
   *    sin evento de cierre (p. ej. importada ya inactiva) se considera no activa
   *    desde su alta para no inflar la serie (coincide con el estado actual).
   *  - total acumulado: todas las Cuentas registradas, activas o cerradas.
   *
   * Los límites comerciales (cuentas máximas, tope de activas, máximo crear/mes)
   * son valores vigentes, no históricos: se devuelven como referencia.
   */
  async metricas(id: string, query: MetricasRevendedoraQueryDto) {
    const empresa = await this.prisma.db.empresaRevendedora.findUnique({
      where: { id },
      include: { modalidadComercial: true },
    });
    if (!empresa) {
      throw new NotFoundException('La Empresa Revendedora no existe o no está disponible.');
    }

    const hasta = query.hasta ? finDiaDesdeTexto(query.hasta) : new Date();
    const desde = query.desde
      ? inicioDiaDesdeTexto(query.desde)
      : inicioDiaArgentina(empresa.creadoEn);
    const agrupacion = query.agrupacion ?? this.deducirAgrupacion(desde, hasta);

    const [cuentas, cierres] = await Promise.all([
      this.prisma.db.cuenta.findMany({
        where: { empresaRevendedoraId: id },
        select: { id: true, creadoEn: true, estado: true, procedencia: true },
      }),
      this.prisma.db.auditLog.findMany({
        where: {
          empresaRevendedoraId: id,
          accion: {
            in: [AccionAuditoria.cierre_cuenta, AccionAuditoria.cierre_cuenta_prueba],
          },
        },
        select: { entidadId: true, creadoEn: true },
      }),
    ]);

    const buckets = this.generarBuckets(desde, hasta, agrupacion);
    const cierrePorCuenta = new Map<string, Date>();
    for (const cierre of cierres) {
      if (!cierre.entidadId) continue;
      const previo = cierrePorCuenta.get(cierre.entidadId);
      if (!previo || cierre.creadoEn < previo)
        cierrePorCuenta.set(cierre.entidadId, cierre.creadoEn);
    }

    const puntos: PuntoMetricas[] = buckets.map((bucket) => {
      let altas = 0;
      let altasImportadas = 0;
      for (const cuenta of cuentas) {
        if (cuenta.creadoEn >= bucket.inicio && cuenta.creadoEn < bucket.fin) {
          altas += 1;
          if (cuenta.procedencia === 'importada_proveedor') altasImportadas += 1;
        }
      }
      const cierresBucket = cierres.filter(
        (cierre) => cierre.creadoEn >= bucket.inicio && cierre.creadoEn < bucket.fin,
      ).length;

      const total = cuentas.filter((cuenta) => cuenta.creadoEn < bucket.fin).length;
      const activas = cuentas.filter((cuenta) => {
        if (cuenta.creadoEn >= bucket.fin) return false;
        if (cuenta.estado === EstadoCuenta.activa) return true;
        const cierre = cierrePorCuenta.get(cuenta.id);
        return cierre !== undefined && cierre >= bucket.fin;
      }).length;

      return {
        fecha: bucket.inicio.toISOString(),
        altas,
        altas_importadas: altasImportadas,
        cierres: cierresBucket,
        total,
        activas,
      };
    });

    const totalCuentas = cuentas.length;
    const cuentasActivas = cuentas.filter((cuenta) => cuenta.estado === EstadoCuenta.activa).length;
    const creadasMesSistema = cuentas.filter(
      (cuenta) =>
        cuenta.procedencia === 'creada_en_sistema' &&
        cuenta.estado === EstadoCuenta.activa &&
        cuenta.creadoEn >= inicioMesArgentina(new Date()) &&
        cuenta.creadoEn < finMesArgentina(new Date()),
    ).length;

    return {
      empresa_id: empresa.id,
      desde: desde.toISOString(),
      hasta: hasta.toISOString(),
      agrupacion,
      puntos,
      referencias: {
        total_cuentas: totalCuentas,
        cuentas_activas: cuentasActivas,
        cuentas_maximas: this.calcularMaximoComercial({
          totalCuentas,
          creadasEnMes: creadasMesSistema,
          cuentasMaxCrearMensual: empresa.cuentasMaxCrearMensual,
        }),
        cuentas_a_cobrar: this.calcularCuentasACobrar({
          modalidad: empresa.modalidadComercial,
          asignadaEn: empresa.modalidadAsignadaEn ?? empresa.creadoEn,
          creadasEnMes: creadasMesSistema,
          cuentasActivas,
        }),
        cuentas_max_crear_mensual: empresa.cuentasMaxCrearMensual,
        tope_cuentas_activas: empresa.modalidadComercial?.topeCuentasActivas ?? null,
        tipo_modalidad: empresa.modalidadComercial?.tipo ?? null,
        ritmo_incremento: empresa.modalidadComercial?.ritmoIncremento ?? null,
      },
    };
  }

  /** Agrupación por defecto según la amplitud de la ventana pedida. */
  private deducirAgrupacion(desde: Date, hasta: Date): AgrupacionMetricas {
    const dias = Math.max(1, Math.round((hasta.getTime() - desde.getTime()) / 86_400_000));
    if (dias <= 31) return AgrupacionMetricas.dia;
    if (dias <= 120) return AgrupacionMetricas.semana;
    return AgrupacionMetricas.mes;
  }

  /**
   * Genera los intervalos consecutivos [inicio, fin) del rango, alineados al
   * calendario argentino (día, semana que arranca el lunes, mes).
   */
  private generarBuckets(
    desde: Date,
    hasta: Date,
    agrupacion: AgrupacionMetricas,
  ): Array<{ inicio: Date; fin: Date }> {
    const buckets: Array<{ inicio: Date; fin: Date }> = [];
    let cursor =
      agrupacion === AgrupacionMetricas.mes
        ? inicioMesDesdeInstante(desde)
        : agrupacion === AgrupacionMetricas.semana
          ? inicioSemanaArgentina(desde)
          : desde;
    let guardia = 0;
    while (cursor < hasta && guardia < 5000) {
      guardia += 1;
      const fin =
        agrupacion === AgrupacionMetricas.mes
          ? mesSiguiente(cursor)
          : agrupacion === AgrupacionMetricas.semana
            ? new Date(cursor.getTime() + 7 * 86_400_000)
            : new Date(cursor.getTime() + 86_400_000);
      buckets.push({ inicio: cursor, fin });
      cursor = fin;
    }
    return buckets;
  }

  /** Perfil de la propia Empresa Revendedora, con sus precios vigentes. */
  async miPerfil() {
    const empresaRevendedoraId = this.contexto.empresaRevendedoraId;
    if (!empresaRevendedoraId) {
      throw new ForbiddenException('Este endpoint corresponde al panel de la Empresa Revendedora.');
    }
    return this.obtener(empresaRevendedoraId);
  }

  /**
   * Compara el inventario completo del Proveedor con las Cuentas locales del
   * Operador. Sólo se usan identificadores técnicos para evitar falsos matches
   * por nombres o correos compartidos.
   */
  async listarCuentasExternas() {
    const operadorPrincipalId = this.contexto.operadorPrincipalId;
    if (!operadorPrincipalId) {
      throw new ForbiddenException('Este endpoint corresponde al Operador Principal.');
    }

    const [cuentasProveedor, cuentasLocales] = await Promise.all([
      this.proveedor.listarCuentas(operadorPrincipalId),
      this.prisma.db.cuenta.findMany({
        where: { empresaRevendedora: { operadorPrincipalId } },
        select: { proveedorCuentaId: true, dniAltaSensa: true },
      }),
    ]);

    const idsProveedorLocales = new Set(
      cuentasLocales
        .map((cuenta) => cuenta.proveedorCuentaId?.trim())
        .filter((valor): valor is string => Boolean(valor)),
    );
    const dnisLocales = new Set(cuentasLocales.map((cuenta) => cuenta.dniAltaSensa.trim()));
    const externas = cuentasProveedor.filter(
      (cuenta) =>
        !idsProveedorLocales.has(cuenta.proveedorCuentaId.trim()) &&
        !dnisLocales.has(cuenta.dni.trim()),
    );

    return {
      resumen: {
        cuentas_proveedor: cuentasProveedor.length,
        cuentas_iptvcontrol: cuentasLocales.length,
        cuentas_externas: externas.length,
      },
      cuentas: externas.map((cuenta) => ({
        proveedor_cuenta_id: cuenta.proveedorCuentaId,
        dni: cuenta.dni,
        nombre: cuenta.nombre,
        apellido: cuenta.apellido,
        email: cuenta.email,
        ciudad: cuenta.ciudad,
        referencia_externa: cuenta.referenciaExterna ?? null,
        fecha_alta: cuenta.fechaAlta ?? null,
        estado: cuenta.activa ? 'activa' : 'inactiva',
      })),
    };
  }

  async importarCuentasExternas(dto: ImportarCuentasExternasDto) {
    const operadorPrincipalId = this.requerirOperador();
    const empresa = await this.prisma.db.empresaRevendedora.findFirst({
      where: {
        id: dto.empresa_revendedora_id,
        operadorPrincipalId,
        estado: EstadoEmpresaRevendedora.activa,
      },
      select: { id: true },
    });
    if (!empresa) {
      throw new BadRequestException(
        'La Empresa Revendedora no existe, está suspendida o no pertenece al Operador.',
      );
    }

    // Las Cuentas importadas se tratan como compartidas por defecto. Una Cuenta
    // compartida sin ventas asignadas no participa de la búsqueda de "Cuenta con
    // lugar": su primera venta se carga de forma contextual desde /accounts/:id
    // (POST /customers con cuenta_id), que reserva 1+1 o 2+2. Como excepción el
    // Operador puede marcarlas exclusivas.
    const esExclusiva = dto.es_exclusiva === true;

    const [cuentasProveedor, { configuracion }] = await Promise.all([
      this.proveedor.listarCuentas(operadorPrincipalId),
      this.proveedor.resolver(operadorPrincipalId),
    ]);
    const porId = new Map(
      cuentasProveedor.flatMap((cuenta) => [
        [cuenta.proveedorCuentaId.trim(), cuenta] as const,
        [cuenta.dni.trim(), cuenta] as const,
      ]),
    );
    const resultados: Array<{
      proveedor_cuenta_id: string;
      estado: 'importada' | 'ya_importada' | 'fallida';
      cuenta_id?: string;
      mensaje?: string;
    }> = [];

    for (const idSolicitado of dto.proveedor_cuenta_ids) {
      const proveedorCuentaId = idSolicitado.trim();
      const remota = porId.get(proveedorCuentaId);
      if (!remota) {
        resultados.push({
          proveedor_cuenta_id: proveedorCuentaId,
          estado: 'fallida',
          mensaje: 'La Cuenta ya no existe en el Proveedor.',
        });
        continue;
      }
      if (!remota.dni.trim() || !remota.email.trim() || !remota.pin) {
        resultados.push({
          proveedor_cuenta_id: proveedorCuentaId,
          estado: 'fallida',
          mensaje: 'El Proveedor no informó DNI, correo o PIN suficientes para importarla.',
        });
        continue;
      }
      const pin = remota.pin;

      try {
        const resultado = await this.prisma.transaction(async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${operadorPrincipalId}:${proveedorCuentaId}`}))`;
          const existente = await tx.cuenta.findFirst({
            where: {
              empresaRevendedora: { operadorPrincipalId },
              OR: [{ proveedorCuentaId: remota.proveedorCuentaId }, { dniAltaSensa: remota.dni }],
            },
            select: { id: true },
          });
          if (existente) return { estado: 'ya_importada' as const, id: existente.id };

          const creada = await tx.cuenta.create({
            data: {
              empresaRevendedoraId: empresa.id,
              proveedorId: configuracion.proveedorId,
              proveedorCuentaId: remota.proveedorCuentaId,
              dniAltaSensa: remota.dni.trim(),
              usuario: remota.proveedorCuentaId,
              passwordCifrado: null,
              pinCifrado: this.crypto.encrypt(pin),
              emailContacto: remota.email.trim().toLowerCase(),
              esExclusiva,
              servicios: normalizarServicios((remota.servicios || '1').split('|')),
              limiteDispositivos: 3,
              dispositivosFijosHabilitados: Math.max(0, Math.min(3, remota.dispositivosFijos)),
              dispositivosMovilesHabilitados: Math.max(0, Math.min(3, remota.dispositivosMoviles)),
              procedencia: 'importada_proveedor',
              estado: remota.activa ? EstadoCuenta.activa : EstadoCuenta.cerrada,
            },
          });
          await this.audit.registrarEnTx(tx, {
            accion: AccionAuditoria.alta_cuenta,
            entidad: EntidadAuditada.Cuenta,
            entidadId: creada.id,
            empresaRevendedoraId: empresa.id,
            operadorPrincipalId,
            detalle: {
              origen: 'importacion_proveedor',
              proveedor_cuenta_id: remota.proveedorCuentaId,
              es_exclusiva: esExclusiva,
              password_pendiente: true,
              inventario_pendiente: true,
            },
          });
          return { estado: 'importada' as const, id: creada.id };
        });

        let mensaje: string | undefined;
        if (resultado.estado === 'importada' && remota.activa) {
          try {
            await this.inventario.sincronizar(resultado.id);
            // La consulta inicial quedó registrada por InventarioProveedorService.
            // Los equipos detectados se vinculan después de cargar el Cliente.
          } catch {
            mensaje =
              'La Cuenta se importó, pero el inventario de Dispositivos quedó pendiente de consulta.';
          }
        }
        resultados.push({
          proveedor_cuenta_id: proveedorCuentaId,
          estado: resultado.estado,
          cuenta_id: resultado.id,
          mensaje,
        });
      } catch (error) {
        const duplicada =
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
        resultados.push({
          proveedor_cuenta_id: proveedorCuentaId,
          estado: duplicada ? 'ya_importada' : 'fallida',
          mensaje: duplicada
            ? 'La Cuenta fue importada por otro proceso.'
            : error instanceof Error
              ? error.message
              : 'No se pudo importar la Cuenta.',
        });
      }
    }

    return {
      resumen: {
        solicitadas: resultados.length,
        importadas: resultados.filter((item) => item.estado === 'importada').length,
        ya_importadas: resultados.filter((item) => item.estado === 'ya_importada').length,
        fallidas: resultados.filter((item) => item.estado === 'fallida').length,
      },
      resultados,
    };
  }

  async cerrarCuentaExterna(proveedorCuentaIdSinNormalizar: string) {
    const operadorPrincipalId = this.requerirOperador();
    const proveedorCuentaId = proveedorCuentaIdSinNormalizar.trim();
    if (!proveedorCuentaId || proveedorCuentaId.length > 60) {
      throw new BadRequestException('El identificador de la Cuenta no es válido.');
    }

    return this.prisma.transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${operadorPrincipalId}:${proveedorCuentaId}`}))`;
        const local = await tx.cuenta.findFirst({
          where: {
            empresaRevendedora: { operadorPrincipalId },
            OR: [{ proveedorCuentaId }, { dniAltaSensa: proveedorCuentaId }],
          },
          select: { id: true },
        });
        if (local) {
          throw new ConflictException(
            'La Cuenta ya está registrada en IPTVControl y debe administrarse desde su Empresa Revendedora.',
          );
        }

        const remota = await this.proveedor.consultarCuenta(operadorPrincipalId, proveedorCuentaId);
        if (!remota) return { proveedor_cuenta_id: proveedorCuentaId, estado: 'ya_no_existe' };

        const dispositivos = await this.proveedor.listarDispositivos(
          operadorPrincipalId,
          proveedorCuentaId,
        );
        if (dispositivos.length > 0) {
          throw new BadRequestException(
            `No se puede eliminar: SENSA informa ${dispositivos.length} Dispositivo(s) en esta Cuenta.`,
          );
        }

        await this.proveedor.cerrarCuenta(operadorPrincipalId, proveedorCuentaId);
        await this.audit.registrarEnTx(tx, {
          accion: AccionAuditoria.cierre_cuenta,
          entidad: EntidadAuditada.Cuenta,
          entidadId: proveedorCuentaId,
          operadorPrincipalId,
          detalle: { origen: 'cuenta_externa', proveedor_cuenta_id: proveedorCuentaId },
        });
        return { proveedor_cuenta_id: proveedorCuentaId, estado: 'eliminada' };
      },
      { timeoutMs: 60_000 },
    );
  }

  async crear(dto: CrearRevendedoraDto) {
    const operadorPrincipalId = this.contexto.operadorPrincipalId;
    if (!operadorPrincipalId) {
      throw new ForbiddenException(
        'El alta de Empresas Revendedoras la realiza el Operador Principal.',
      );
    }

    const duplicada = await this.prisma.db.empresaRevendedora.findFirst({
      where: { cuit: dto.cuit },
      select: { id: true, razonSocial: true },
    });
    if (duplicada) {
      throw new BadRequestException(
        `Ya existe una Empresa Revendedora con el CUIT ${dto.cuit} (${duplicada.razonSocial}).`,
      );
    }

    if (dto.modalidad_comercial_id) {
      await this.validarModalidad(dto.modalidad_comercial_id, operadorPrincipalId);
    }

    const empresa = await this.prisma.transaction(async (tx) => {
      const creada = await tx.empresaRevendedora.create({
        data: {
          operadorPrincipalId,
          razonSocial: dto.razon_social.trim(),
          cuit: dto.cuit,
          direccion: dto.direccion.trim(),
          nombreContacto: dto.nombre_contacto.trim(),
          apellidoContacto: dto.apellido_contacto.trim(),
          telefonoContacto: dto.telefono_contacto.trim(),
          emailContacto: dto.email_contacto.trim().toLowerCase(),
          sitioWeb: dto.sitio_web?.trim() || null,
          modalidadComercialId: dto.modalidad_comercial_id ?? null,
          // El "mes 1" de una obligación mensual arranca al asignar la modalidad.
          modalidadAsignadaEn: dto.modalidad_comercial_id ? new Date() : null,
          estado: EstadoEmpresaRevendedora.activa,
        },
      });

      await this.audit.registrarEnTx(tx, {
        accion: AccionAuditoria.alta_empresa_revendedora,
        entidad: EntidadAuditada.EmpresaRevendedora,
        entidadId: creada.id,
        empresaRevendedoraId: null,
        operadorPrincipalId,
        detalle: {
          razon_social: creada.razonSocial,
          cuit: creada.cuit,
          modalidad_comercial_id: creada.modalidadComercialId,
        },
      });

      return creada;
    });

    // Invitación del reseller_admin (flujo 4.7). Si Auth0 no está configurado, el
    // alta de la Empresa Revendedora igual queda hecha: se informa el estado de
    // la invitación para que el Operador Principal la reintente después.
    const invitacion = await this.teamMembers
      .invitarResellerAdmin({
        email: empresa.emailContacto,
        nombre: `${empresa.nombreContacto} ${empresa.apellidoContacto}`.trim(),
        empresaRevendedoraId: empresa.id,
      })
      .catch((error) => {
        this.logger.error(
          `Empresa Revendedora ${empresa.id} creada, pero falló la invitación del reseller_admin: ` +
            (error as Error).message,
        );
        return { enviada: false, motivo: (error as Error).message };
      });

    return { empresa: await this.obtener(empresa.id), invitacion };
  }

  async actualizar(id: string, dto: ActualizarRevendedoraDto) {
    const operadorPrincipalId = this.contexto.operadorPrincipalId;
    const esOperador = this.contexto.esOperador;

    // La Empresa Revendedora puede mantener sus datos de contacto, pero no su
    // estado (activa/suspendida), ni su CUIT, ni su límite mensual, ni la
    // configuración del módulo de cuentas de prueba: eso lo administra el
    // Operador Principal (HU-P01).
    const tocaConfiguracionDePruebas =
      dto.pruebas_habilitadas !== undefined ||
      dto.pruebas_cupo_mensual !== undefined ||
      dto.pruebas_duracion_dias !== undefined ||
      dto.pruebas_extras_periodo !== undefined ||
      dto.pruebas_avisos_dias !== undefined;
    if (!esOperador) {
      if (
        dto.estado ||
        dto.cuit ||
        dto.cuentas_max_crear_mensual !== undefined ||
        tocaConfiguracionDePruebas
      ) {
        throw new ForbiddenException(
          'Solo el Operador Principal puede cambiar el estado, el CUIT, el límite mensual o la ' +
            'configuración de cuentas de prueba.',
        );
      }
      if (this.contexto.empresaRevendedoraId !== id) {
        throw new ForbiddenException('No tiene permisos sobre esa Empresa Revendedora.');
      }
    }

    const anterior = await this.prisma.db.empresaRevendedora.findUnique({ where: { id } });
    if (!anterior) throw new NotFoundException('La Empresa Revendedora no existe.');

    // Validación de unicidad del CUIT si cambió (a nombre de otra empresa).
    if (dto.cuit && dto.cuit !== anterior.cuit) {
      const duplicada = await this.prisma.db.empresaRevendedora.findFirst({
        where: { cuit: dto.cuit, id: { not: id } },
        select: { id: true, razonSocial: true },
      });
      if (duplicada) {
        throw new BadRequestException(
          `Ya existe otra Empresa Revendedora con el CUIT ${dto.cuit} (${duplicada.razonSocial}).`,
        );
      }
    }

    const actualizada = await this.prisma.transaction(async (tx) => {
      const resultado = await tx.empresaRevendedora.update({
        where: { id },
        data: {
          razonSocial: dto.razon_social?.trim(),
          cuit: dto.cuit,
          direccion: dto.direccion?.trim(),
          nombreContacto: dto.nombre_contacto?.trim(),
          apellidoContacto: dto.apellido_contacto?.trim(),
          telefonoContacto: dto.telefono_contacto?.trim(),
          emailContacto: dto.email_contacto?.trim().toLowerCase(),
          sitioWeb: dto.sitio_web?.trim(),
          cuentasMaxCrearMensual: dto.cuentas_max_crear_mensual,
          estado: dto.estado,
          pruebasHabilitadas: dto.pruebas_habilitadas,
          pruebasCupoMensual: dto.pruebas_cupo_mensual,
          pruebasDuracionDias: dto.pruebas_duracion_dias,
          pruebasExtrasPeriodo: dto.pruebas_extras_periodo,
          // Los extras se cargan "para el período actual": se estampa el mes AR
          // vigente para que dejen de aplicar solos al cambiar de mes (HU-P02).
          pruebasExtrasPeriodoRef:
            dto.pruebas_extras_periodo !== undefined ? periodoMesArgentina(new Date()) : undefined,
          pruebasAvisosDias: dto.pruebas_avisos_dias,
        },
      });

      if (dto.estado && dto.estado !== anterior.estado) {
        await this.audit.registrarEnTx(tx, {
          accion:
            dto.estado === EstadoEmpresaRevendedora.suspendida
              ? AccionAuditoria.suspension_empresa_revendedora
              : AccionAuditoria.reactivacion_empresa_revendedora,
          entidad: EntidadAuditada.EmpresaRevendedora,
          entidadId: id,
          empresaRevendedoraId: id,
          operadorPrincipalId: operadorPrincipalId ?? anterior.operadorPrincipalId,
          detalle: { estado_anterior: anterior.estado, estado_nuevo: dto.estado },
        });
      }

      // Cambios de datos administrativos o del límite mensual: se registran con
      // quién (team_member_id vía contexto), cuándo y sobre qué empresa, sin
      // incluir datos sensibles. `null` marca el campo como sin cambios.
      const cambios = this.calcularCambiosParaAuditoria(anterior, dto);
      if (Object.keys(cambios).length > 0) {
        await this.audit.registrarEnTx(tx, {
          accion: AccionAuditoria.actualizacion_empresa_revendedora,
          entidad: EntidadAuditada.EmpresaRevendedora,
          entidadId: id,
          empresaRevendedoraId: id,
          operadorPrincipalId: operadorPrincipalId ?? anterior.operadorPrincipalId,
          detalle: { cambios },
        });
      }

      return resultado;
    });

    return this.obtener(actualizada.id);
  }

  /** Reduce los cambios a `campo → { anterior, nuevo }` (tipos JSON seguros). */
  private calcularCambiosParaAuditoria(
    anterior: {
      razonSocial: string;
      cuit: string;
      direccion: string;
      nombreContacto: string;
      apellidoContacto: string;
      telefonoContacto: string;
      emailContacto: string;
      sitioWeb: string | null;
      cuentasMaxCrearMensual: number;
      pruebasHabilitadas: boolean;
      pruebasCupoMensual: number;
      pruebasDuracionDias: number;
      pruebasExtrasPeriodo: number;
      pruebasAvisosDias: number[];
    },
    dto: ActualizarRevendedoraDto,
  ): Record<
    string,
    { anterior: string | number | boolean | null; nuevo: string | number | boolean | null }
  > {
    const mapeo: Array<{
      campo: string;
      previo: string | number | boolean | null;
      nuevo: string | number | boolean | null | undefined;
    }> = [
      { campo: 'razon_social', nuevo: dto.razon_social?.trim(), previo: anterior.razonSocial },
      { campo: 'cuit', nuevo: dto.cuit, previo: anterior.cuit },
      { campo: 'direccion', nuevo: dto.direccion?.trim(), previo: anterior.direccion },
      {
        campo: 'nombre_contacto',
        nuevo: dto.nombre_contacto?.trim(),
        previo: anterior.nombreContacto,
      },
      {
        campo: 'apellido_contacto',
        nuevo: dto.apellido_contacto?.trim(),
        previo: anterior.apellidoContacto,
      },
      {
        campo: 'telefono_contacto',
        nuevo: dto.telefono_contacto?.trim(),
        previo: anterior.telefonoContacto,
      },
      {
        campo: 'email_contacto',
        nuevo: dto.email_contacto?.trim().toLowerCase(),
        previo: anterior.emailContacto,
      },
      {
        campo: 'cuentas_max_crear_mensual',
        nuevo: dto.cuentas_max_crear_mensual,
        previo: anterior.cuentasMaxCrearMensual,
      },
      {
        campo: 'pruebas_habilitadas',
        nuevo: dto.pruebas_habilitadas,
        previo: anterior.pruebasHabilitadas,
      },
      {
        campo: 'pruebas_cupo_mensual',
        nuevo: dto.pruebas_cupo_mensual,
        previo: anterior.pruebasCupoMensual,
      },
      {
        campo: 'pruebas_duracion_dias',
        nuevo: dto.pruebas_duracion_dias,
        previo: anterior.pruebasDuracionDias,
      },
      {
        campo: 'pruebas_extras_periodo',
        nuevo: dto.pruebas_extras_periodo,
        previo: anterior.pruebasExtrasPeriodo,
      },
      {
        campo: 'pruebas_avisos_dias',
        nuevo: dto.pruebas_avisos_dias ? dto.pruebas_avisos_dias.join(',') : undefined,
        previo: anterior.pruebasAvisosDias.join(','),
      },
    ];

    const cambios: Record<
      string,
      { anterior: string | number | boolean | null; nuevo: string | number | boolean | null }
    > = {};
    for (const item of mapeo) {
      if (item.nuevo !== undefined && item.nuevo !== item.previo) {
        cambios[item.campo] = { anterior: item.previo, nuevo: item.nuevo ?? null };
      }
    }
    const sitioNuevo = dto.sitio_web === undefined ? undefined : dto.sitio_web.trim() || null;
    if (sitioNuevo !== undefined && sitioNuevo !== anterior.sitioWeb) {
      cambios['sitio_web'] = { anterior: anterior.sitioWeb, nuevo: sitioNuevo };
    }
    return cambios;
  }

  /**
   * Cambio de modalidad comercial o escala (flujo 4.5).
   * Downgrade y upgrade, ambos exclusivos del Operador Principal.
   */
  async cambiarModalidad(id: string, dto: CambiarModalidadDto) {
    const operadorPrincipalId = this.contexto.operadorPrincipalId;
    if (!operadorPrincipalId) {
      throw new ForbiddenException(
        'El cambio de modalidad comercial es potestad exclusiva del Operador Principal.',
      );
    }

    const empresa = await this.prisma.db.empresaRevendedora.findUnique({
      where: { id },
      include: { modalidadComercial: true },
    });
    if (!empresa) throw new NotFoundException('La Empresa Revendedora no existe.');

    const nueva = await this.validarModalidad(dto.modalidad_comercial_id, operadorPrincipalId);

    await this.prisma.transaction(async (tx) => {
      await tx.empresaRevendedora.update({
        where: { id },
        data: {
          modalidadComercialId: nueva.id,
          // Reinicia el "mes 1" del compromiso al cambiar de escala/plan; el
          // Operador puede ajustar la fecha manualmente si el acuerdo arranca
          // antes o después.
          modalidadAsignadaEn: new Date(),
        },
      });

      await this.audit.registrarEnTx(tx, {
        accion: AccionAuditoria.cambio_modalidad_comercial,
        entidad: EntidadAuditada.EmpresaRevendedora,
        entidadId: id,
        empresaRevendedoraId: id,
        operadorPrincipalId,
        detalle: {
          anterior: empresa.modalidadComercial
            ? {
                id: empresa.modalidadComercial.id,
                tipo: empresa.modalidadComercial.tipo,
                escala: empresa.modalidadComercial.escala,
                precio_por_cuenta: Number(empresa.modalidadComercial.precioPorCuenta),
              }
            : null,
          nueva: {
            id: nueva.id,
            tipo: nueva.tipo,
            escala: nueva.escala,
            precio_por_cuenta: Number(nueva.precioPorCuenta),
          },
          motivo: dto.motivo ?? null,
        },
      });
    });

    return this.obtener(id);
  }

  private async validarModalidad(modalidadId: string, operadorPrincipalId: string) {
    const modalidad = await this.prisma.db.modalidadComercial.findUnique({
      where: { id: modalidadId },
    });
    if (!modalidad || modalidad.operadorPrincipalId !== operadorPrincipalId) {
      throw new BadRequestException('La modalidad comercial indicada no existe.');
    }
    return modalidad;
  }

  /** Mes comercial transcurrido (diferencia en meses calendario AR). */
  private cuentasDelMesComercial(asignadaEn: Date, referencia: Date = new Date()): number {
    const desde = inicioMesArgentina(asignadaEn);
    const ahoraInicioMes = inicioMesArgentina(referencia);
    const diffMeses =
      (ahoraInicioMes.getUTCFullYear() - desde.getUTCFullYear()) * 12 +
      (ahoraInicioMes.getUTCMonth() - desde.getUTCMonth());
    return Math.max(0, diffMeses);
  }

  /**
   * "Cuentas a cobrar" del mes calendario AR, según la modalidad:
   *
   * - obligación mensual (X5/X10): el compromiso del mes en curso (ritmo x mes
   *   comercial). El "mes 1" arranca cuando se asignó la modalidad a la empresa
   *   (`modalidadAsignadaEn`); el Operador la ajusta manualmente al cambiar de
   *   escala.
   * - menudeo: todas las Cuentas activas/creadas de la empresa en el mes (no se
   *   descuentan cierres: el cierre no libera el cobro del período).
   */
  calcularCuentasACobrar(params: {
    modalidad?: Pick<ModalidadComercial, 'tipo' | 'ritmoIncremento'> | null;
    asignadaEn: Date;
    creadasEnMes: number;
    cuentasActivas: number;
  }): number {
    const { modalidad, asignadaEn, creadasEnMes, cuentasActivas } = params;
    if (modalidad?.tipo === 'obligacion_mensual') {
      const mes = this.cuentasDelMesComercial(asignadaEn) + 1;
      const ritmo = modalidad.ritmoIncremento ?? 0;
      return Math.max(0, ritmo * mes);
    }
    return Math.max(creadasEnMes, cuentasActivas);
  }

  /**
   * "Cuentas máximas" del mes: máximo de Cuentas creadas que la Empresa
   * Revendedora puede tener en total. Fórmula confirmada por Bruno:
   *
   *   TOTAL de Cuentas creadas (históricas + las del mes)
   *   - Cuentas creadas en el mes
   *   + "Cuentas max. a crear mensualmente" (parametrizable por empresa)
   *
   * Ejemplo: 23 totales - 3 del mes + 10 = 30. Las importadas cuentan en TOTAL
   * (ocupan capacidad) pero no en "creadas en el mes".
   */
  calcularMaximoComercial(params: {
    totalCuentas: number;
    creadasEnMes: number;
    cuentasMaxCrearMensual: number;
  }): number {
    return Math.max(0, params.totalCuentas - params.creadasEnMes + params.cuentasMaxCrearMensual);
  }

  private requerirOperador(): string {
    const operadorPrincipalId = this.contexto.operadorPrincipalId;
    if (!operadorPrincipalId) {
      throw new ForbiddenException('Este endpoint corresponde al Operador Principal.');
    }
    return operadorPrincipalId;
  }
}
