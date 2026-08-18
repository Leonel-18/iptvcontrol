import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EstadoCuenta, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { RequestContextService } from '../../common/context/request-context.service';
import { ProveedorService } from '../../proveedor/proveedor.service';
import { PaginatedResponse } from '../../common/dto/pagination.dto';
import { calcularCapacidad } from './capacidad.util';
import {
  CuentaOperadorDto,
  CuentaRevendedoraDto,
  mapCuentaParaOperador,
  mapCuentaParaRevendedora,
  mapDispositivoParaOperador,
  mapDispositivoParaRevendedora,
} from './cuentas.mapper';
import { ListarCuentasQueryDto } from './dto/listar-cuentas.query';

/**
 * Consultas sobre Cuentas.
 *
 * El aislamiento no se resuelve acá con `if` por rol: las filas que se pueden
 * leer las decide Row-Level Security según el contexto del request. Lo que sí
 * resuelve este servicio es QUÉ CAMPOS de esas filas se serializan, que es la
 * otra mitad de la regla 4.2.
 */
@Injectable()
export class CuentasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly contexto: RequestContextService,
    private readonly proveedor: ProveedorService,
  ) {}

  async listar(
    query: ListarCuentasQueryDto,
  ): Promise<PaginatedResponse<CuentaOperadorDto | CuentaRevendedoraDto>> {
    const esOperador = this.contexto.esOperador;

    const where: Prisma.CuentaWhereInput = {
      estado: query.status,
      empresaRevendedoraId: query.reseller_id,
      esExclusiva: query.exclusive,
      // El Operador Principal busca por los identificadores que sí le
      // corresponden. Dejarlo filtrar por `usuario` o por el correo de la Cuenta
      // le permitiría confirmar esos valores por prueba y error, y son campos que
      // la regla 4.2 le niega.
      OR: query.q
        ? esOperador
          ? [
              { proveedorCuentaId: { contains: query.q, mode: 'insensitive' } },
              { dniAltaSensa: { contains: query.q } },
            ]
          : [
              { proveedorCuentaId: { contains: query.q, mode: 'insensitive' } },
              { dniAltaSensa: { contains: query.q } },
              { usuario: { contains: query.q, mode: 'insensitive' } },
              { emailContacto: { contains: query.q, mode: 'insensitive' } },
            ]
        : undefined,
    };

    const umbral = await this.umbralAlerta();
    const esCsv = query.esCsv;

    const [total, cuentas] = await Promise.all([
      this.prisma.db.cuenta.count({ where }),
      this.prisma.db.cuenta.findMany({
        where,
        include: { dispositivos: { select: { tipo: true, estado: true } } },
        orderBy: { creadoEn: 'desc' },
        skip: esCsv ? undefined : query.skip,
        take: esCsv ? undefined : query.take,
      }),
    ]);

    const data = cuentas.map((cuenta) => {
      const capacidad = calcularCapacidad(cuenta, umbral);
      // En los listados no se descifran credenciales: descifrar 200 filas por
      // pantalla no aporta y multiplica la exposición del dato sensible.
      return esOperador
        ? mapCuentaParaOperador(cuenta, capacidad)
        : mapCuentaParaRevendedora(cuenta, capacidad, null);
    });

    return PaginatedResponse.build(data, total, query.page ?? 1, query.per_page ?? 25);
  }

  /**
   * Vista por Cuenta (reglas de negocio, sección 8): credenciales,
   * parametrización de contenido y listado de Clientes Finales y Dispositivos
   * relacionados. Para el Operador Principal, la misma URL devuelve la versión
   * recortada.
   */
  async obtener(id: string, revelarCredenciales = false) {
    const cuenta = await this.prisma.db.cuenta.findUnique({
      where: { id },
      include: {
        dispositivos: {
          include: {
            clienteFinal: {
              select: { id: true, numeroCliente: true, nombre: true, apellido: true },
            },
          },
          orderBy: [{ tipo: 'asc' }, { creadoEn: 'asc' }],
        },
      },
    });

    if (!cuenta) {
      throw new NotFoundException('La cuenta no existe o no está disponible.');
    }

    const umbral = await this.umbralAlerta();
    const capacidad = calcularCapacidad(cuenta, umbral);

    if (this.contexto.esOperador) {
      return {
        ...mapCuentaParaOperador(cuenta, capacidad),
        dispositivos: cuenta.dispositivos.map(mapDispositivoParaOperador),
      };
    }

    const credenciales = revelarCredenciales
      ? {
          password: this.crypto.tryDecrypt(cuenta.passwordCifrado),
          pin: this.crypto.tryDecrypt(cuenta.pinCifrado),
        }
      : null;

    return {
      ...mapCuentaParaRevendedora(cuenta, capacidad, credenciales),
      dispositivos: cuenta.dispositivos.map(mapDispositivoParaRevendedora),
      clientes_finales: this.resumirClientes(cuenta.dispositivos),
    };
  }

  /**
   * Credenciales en claro de una Cuenta.
   *
   * Sólo para el panel de la Empresa Revendedora dueña: el Operador Principal no
   * accede ni por endpoint propio (regla 4.2). Queda pendiente de definición con
   * Federico si además conviene registrar cada consulta a estos campos
   * (docs/05_Decisiones_Pendientes.md, sección 3); por eso el acceso está
   * concentrado en este único método, para que sumar ese registro después sea un
   * cambio de una línea y no una búsqueda por todo el código.
   */
  async obtenerCredenciales(id: string): Promise<{
    usuario: string;
    password: string | null;
    pin: string | null;
    email_contacto: string;
  }> {
    if (this.contexto.esOperador) {
      throw new ForbiddenException(
        'El Operador Principal no tiene acceso a las credenciales de las Cuentas de sus Empresas Revendedoras.',
      );
    }

    const cuenta = await this.prisma.db.cuenta.findUnique({ where: { id } });
    if (!cuenta) {
      throw new NotFoundException('La cuenta no existe o no está disponible.');
    }

    return {
      usuario: cuenta.usuario,
      password: this.crypto.tryDecrypt(cuenta.passwordCifrado),
      pin: this.crypto.tryDecrypt(cuenta.pinCifrado),
      email_contacto: cuenta.emailContacto,
    };
  }

  /**
   * Sincroniza la parametrización de contenido con el Proveedor.
   *
   * La API de SENSA no tiene webhooks, así que la única forma de enterarse de un
   * cambio hecho por fuera de IPTVControl es preguntar (polling).
   */
  async sincronizarServicios(id: string) {
    const cuenta = await this.prisma.db.cuenta.findUnique({ where: { id } });
    if (!cuenta) throw new NotFoundException('La cuenta no existe o no está disponible.');
    if (!cuenta.proveedorCuentaId) {
      return { servicios: cuenta.servicios, plan: null, sincronizada: false };
    }

    const operadorPrincipalId = await this.operadorDeCuenta(cuenta.empresaRevendedoraId);
    const servicios = await this.proveedor.consultarServicios(
      operadorPrincipalId,
      cuenta.proveedorCuentaId,
    );

    await this.prisma.db.cuenta.update({
      where: { id },
      data: { servicios: servicios.servicios || cuenta.servicios },
    });

    return { servicios: servicios.servicios, plan: servicios.plan, sincronizada: true };
  }

  /** Cuentas cerca del tope, para el aviso visual del panel (regla 12). */
  async alertasCapacidad(empresaRevendedoraId?: string) {
    const umbral = await this.umbralAlerta();
    const cuentas = await this.prisma.db.cuenta.findMany({
      where: {
        estado: EstadoCuenta.activa,
        empresaRevendedoraId,
      },
      include: { dispositivos: { select: { tipo: true, estado: true } } },
    });

    return cuentas
      .map((cuenta) => ({ cuenta, capacidad: calcularCapacidad(cuenta, umbral) }))
      .filter(({ capacidad }) => capacidad.fijo.cercaDelTope || capacidad.movil.cercaDelTope)
      .map(({ cuenta, capacidad }) => ({
        cuenta_id: cuenta.id,
        proveedor_cuenta_id: cuenta.proveedorCuentaId,
        fijos: `${capacidad.fijo.ocupados} de 3`,
        moviles: `${capacidad.movil.ocupados} de 3`,
        completa: capacidad.completa,
        mensaje: capacidad.completa
          ? 'La cuenta llegó al tope: el próximo alta va a requerir otra cuenta.'
          : 'La cuenta está cerca del tope de capacidad.',
      }));
  }

  /** Umbral configurado por el Operador Principal (por defecto 2 de 3). */
  async umbralAlerta(): Promise<number> {
    const operadorId = this.contexto.operadorPrincipalId;
    if (!operadorId) return 2;
    const operador = await this.prisma.operadorPrincipal.findUnique({
      where: { id: operadorId },
      select: { umbralAlertaCapacidad: true },
    });
    return operador?.umbralAlertaCapacidad ?? 2;
  }

  private async operadorDeCuenta(empresaRevendedoraId: string): Promise<string> {
    const contexto = this.contexto.operadorPrincipalId;
    if (contexto) return contexto;
    const empresa = await this.prisma.empresaRevendedora.findUniqueOrThrow({
      where: { id: empresaRevendedoraId },
      select: { operadorPrincipalId: true },
    });
    return empresa.operadorPrincipalId;
  }

  private resumirClientes(
    dispositivos: {
      clienteFinal?: {
        id: string;
        numeroCliente: number;
        nombre: string;
        apellido: string | null;
      } | null;
    }[],
  ) {
    const mapa = new Map<
      string,
      { id: string; numero_cliente: number; nombre: string; dispositivos: number }
    >();

    for (const dispositivo of dispositivos) {
      const cliente = dispositivo.clienteFinal;
      if (!cliente) continue;
      const existente = mapa.get(cliente.id);
      if (existente) {
        existente.dispositivos += 1;
        continue;
      }
      mapa.set(cliente.id, {
        id: cliente.id,
        numero_cliente: cliente.numeroCliente,
        nombre: [cliente.nombre, cliente.apellido].filter(Boolean).join(' '),
        dispositivos: 1,
      });
    }

    return [...mapa.values()];
  }
}
