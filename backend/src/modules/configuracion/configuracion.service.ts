import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { AccionAuditoria, EntidadAuditada } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { AuditService } from '../../common/audit/audit.service';
import { RequestContextService } from '../../common/context/request-context.service';
import { ProveedorService } from '../../proveedor/proveedor.service';
import { CONECTOR_SENSA } from '../../proveedor/sensa/sensa.constants';
import {
  ActualizarConexionProveedorDto,
  ActualizarPlantillaWhatsAppDto,
  ActualizarVentanaCuriosidadDto,
  ConfiguracionProveedorRespuestaDto,
  ProbarConexionDto,
} from './dto/configuracion.dto';
import {
  PLANTILLA_DEFAULT_WHATSAPP,
  TOKENS_PLANTILLA_WHATSAPP,
  validarPlantilla,
} from './plantilla-whatsapp.util';

/**
 * =============================================================================
 * Menú de Parametrización — Conexión con el Proveedor
 * =============================================================================
 * Nace de un pedido explícito de Bruno: poder cambiar los datos de conexión a
 * SENSA sin depender de un despliegue de código
 * (docs/04_Esqueleto_Tecnico_Inicial.md, sección 9).
 *
 * Dos reglas de seguridad que no se negocian:
 *  1. El token se guarda cifrado (AES-256-GCM) y no se devuelve nunca en claro.
 *     La respuesta informa si está cargado y muestra sólo una pista de los
 *     últimos caracteres, para que el operador reconozca cuál puso.
 *  2. La prueba de conexión corre en el servidor. Si el navegador hiciera la
 *     llamada, el token viajaría al cliente — exactamente lo que la sección 9.2
 *     prohíbe.
 * =============================================================================
 */
@Injectable()
export class ConfiguracionService {
  private readonly logger = new Logger(ConfiguracionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
    private readonly contexto: RequestContextService,
    private readonly proveedor: ProveedorService,
  ) {}

  async obtener(): Promise<ConfiguracionProveedorRespuestaDto> {
    const operadorPrincipalId = this.exigirOperador();

    const operador = await this.prisma.db.operadorPrincipal.findUniqueOrThrow({
      where: { id: operadorPrincipalId },
      include: { proveedorActivo: true },
    });

    const configuracion = operador.proveedorActivoId
      ? await this.prisma.db.configuracionProveedor.findUnique({
          where: {
            operadorPrincipalId_proveedorId: {
              operadorPrincipalId,
              proveedorId: operador.proveedorActivoId,
            },
          },
        })
      : null;

    const token = configuracion ? this.crypto.tryDecrypt(configuracion.tokenCifrado) : null;

    return {
      configurada: Boolean(configuracion),
      server: configuracion?.server ?? null,
      port: configuracion?.port ?? null,
      usuario: configuracion?.usuario ?? null,
      token_cargado: Boolean(token),
      // Pista, no el token: alcanza para reconocerlo sin exponerlo.
      token_pista: token ? `••••${token.slice(-4)}` : null,
      proveedor: operador.proveedorActivo?.nombre ?? null,
      ciudad_por_defecto: configuracion?.ciudadPorDefecto ?? null,
      servicios_por_defecto: configuracion?.serviciosPorDefecto ?? null,
      dni_inicial_sensa: operador.dniInicialSensa,
      dni_actual_sensa: operador.dniActualSensa,
      umbral_alerta_capacidad: operador.umbralAlertaCapacidad,
      max_reintentos_dni: operador.maxReintentosDni,
      url_base: configuracion
        ? `https://${configuracion.server}${configuracion.port === 443 ? '' : `:${configuracion.port}`}/v4/`
        : null,
    };
  }

  async actualizar(dto: ActualizarConexionProveedorDto) {
    const operadorPrincipalId = this.exigirOperador();

    const operador = await this.prisma.operadorPrincipal.findUniqueOrThrow({
      where: { id: operadorPrincipalId },
    });

    // El Proveedor activo tiene que existir para poder guardarle credenciales.
    let proveedorId = operador.proveedorActivoId;
    if (!proveedorId) {
      const sensa =
        (await this.prisma.proveedor.findFirst({ where: { tipoConector: CONECTOR_SENSA } })) ??
        (await this.prisma.proveedor.create({
          data: { nombre: 'SENSA', tipoConector: CONECTOR_SENSA },
        }));
      proveedorId = sensa.id;
      await this.prisma.operadorPrincipal.update({
        where: { id: operadorPrincipalId },
        data: { proveedorActivoId: proveedorId },
      });
    }

    const existente = await this.prisma.db.configuracionProveedor.findUnique({
      where: { operadorPrincipalId_proveedorId: { operadorPrincipalId, proveedorId } },
    });

    if (!existente && (!dto.server || !dto.port || !dto.usuario || !dto.token)) {
      throw new BadRequestException(
        'Para configurar la conexión por primera vez hay que informar servidor, puerto, usuario y token.',
      );
    }

    const datos = {
      server: dto.server ?? existente!.server,
      port: dto.port ?? existente!.port,
      usuario: dto.usuario ?? existente!.usuario,
      tokenCifrado: dto.token ? this.crypto.encrypt(dto.token) : existente!.tokenCifrado,
      ciudadPorDefecto: dto.ciudad_por_defecto ?? existente?.ciudadPorDefecto ?? 'Mendoza',
      serviciosPorDefecto: dto.servicios_por_defecto ?? existente?.serviciosPorDefecto ?? '1',
    };

    await this.prisma.transaction(async (tx) => {
      await tx.configuracionProveedor.upsert({
        where: {
          operadorPrincipalId_proveedorId: { operadorPrincipalId, proveedorId: proveedorId! },
        },
        create: { operadorPrincipalId, proveedorId: proveedorId!, ...datos },
        update: datos,
      });

      const cambiosOperador: Record<string, number> = {};
      if (dto.dni_inicial_sensa !== undefined) {
        cambiosOperador.dniInicialSensa = dto.dni_inicial_sensa;
      }
      if (dto.umbral_alerta_capacidad !== undefined) {
        cambiosOperador.umbralAlertaCapacidad = dto.umbral_alerta_capacidad;
      }
      if (dto.max_reintentos_dni !== undefined) {
        cambiosOperador.maxReintentosDni = dto.max_reintentos_dni;
      }

      if (Object.keys(cambiosOperador).length > 0) {
        await tx.operadorPrincipal.update({
          where: { id: operadorPrincipalId },
          data: cambiosOperador,
        });
      }

      // Se audita el cambio de configuración (regla 11), sin incluir el token.
      await this.audit.registrarEnTx(tx, {
        accion: AccionAuditoria.cambio_configuracion_proveedor,
        entidad: EntidadAuditada.ConfiguracionProveedor,
        entidadId: proveedorId!,
        empresaRevendedoraId: null,
        operadorPrincipalId,
        detalle: {
          server: datos.server,
          port: datos.port,
          usuario: datos.usuario,
          token_actualizado: Boolean(dto.token),
          ciudad_por_defecto: datos.ciudadPorDefecto,
          servicios_por_defecto: datos.serviciosPorDefecto,
          dni_inicial_sensa: dto.dni_inicial_sensa ?? null,
          umbral_alerta_capacidad: dto.umbral_alerta_capacidad ?? null,
          max_reintentos_dni: dto.max_reintentos_dni ?? null,
        },
      });
    });

    this.logger.log(
      `Configuración del Proveedor actualizada por el Team Member ${this.contexto.teamMemberId}.`,
    );
    return this.obtener();
  }

  /**
   * Botón "Probar conexión": dispara el método Test API del Proveedor
   * (`GET /v4/`) antes de guardar. Server-side, siempre.
   */
  async probarConexion(dto: ProbarConexionDto) {
    const operadorPrincipalId = this.exigirOperador();

    // Si vinieron credenciales completas, se prueban ésas (permite validar antes
    // de guardar). Si no, se prueba la configuración ya almacenada.
    if (dto.server && dto.port && dto.usuario && dto.token) {
      const resultado = await this.proveedor.probarConexionCon(CONECTOR_SENSA, {
        server: dto.server,
        port: dto.port,
        usuario: dto.usuario,
        token: dto.token,
      });
      return this.formatearPrueba(resultado);
    }

    const resultado = await this.proveedor.probarConexion(operadorPrincipalId);
    return this.formatearPrueba(resultado);
  }

  async obtenerVentanaCuriosidad() {
    const empresaRevendedoraId = this.exigirRevendedor();
    const empresa = await this.prisma.db.empresaRevendedora.findUniqueOrThrow({
      where: { id: empresaRevendedoraId },
      select: { duracionVentanaCuriosidadMinutos: true },
    });
    return {
      duracion_predeterminada_minutos: empresa.duracionVentanaCuriosidadMinutos,
    };
  }

  async actualizarVentanaCuriosidad(dto: ActualizarVentanaCuriosidadDto) {
    const empresaRevendedoraId = this.exigirRevendedor();
    await this.prisma.transaction(async (tx) => {
      const anterior = await tx.empresaRevendedora.findUniqueOrThrow({
        where: { id: empresaRevendedoraId },
        select: { duracionVentanaCuriosidadMinutos: true },
      });
      await tx.empresaRevendedora.update({
        where: { id: empresaRevendedoraId },
        data: {
          duracionVentanaCuriosidadMinutos: dto.duracion_predeterminada_minutos,
        },
      });
      await this.audit.registrarEnTx(tx, {
        accion: AccionAuditoria.cambio_configuracion_ventana_curiosidad,
        entidad: EntidadAuditada.EmpresaRevendedora,
        entidadId: empresaRevendedoraId,
        detalle: {
          duracion_anterior_minutos: anterior.duracionVentanaCuriosidadMinutos,
          duracion_nueva_minutos: dto.duracion_predeterminada_minutos,
        },
      });
    });
    return this.obtenerVentanaCuriosidad();
  }

  private formatearPrueba(resultado: {
    ok: boolean;
    mensaje: string;
    latenciaMs: number;
    codigo?: number;
  }) {
    return {
      ok: resultado.ok,
      mensaje: resultado.ok
        ? `Conexión correcta (${resultado.latenciaMs} ms).`
        : `No se pudo conectar: ${resultado.mensaje}`,
      latencia_ms: resultado.latenciaMs,
      codigo: resultado.codigo ?? null,
      probado_en: new Date().toISOString(),
    };
  }

  async obtenerPlantillaWhatsApp() {
    const empresaRevendedoraId = this.exigirRevendedor();
    const plantilla = await this.prisma.db.plantillaWhatsApp.findUnique({
      where: { empresaRevendedoraId },
      select: { contenido: true, version: true, actualizadoEn: true },
    });
    return {
      contenido: plantilla?.contenido ?? PLANTILLA_DEFAULT_WHATSAPP,
      version: plantilla?.version ?? 0,
      personalizada: Boolean(plantilla),
      actualizada_en: plantilla?.actualizadoEn.toISOString() ?? null,
      tokens: TOKENS_PLANTILLA_WHATSAPP,
    };
  }

  async actualizarPlantillaWhatsApp(dto: ActualizarPlantillaWhatsAppDto) {
    const empresaRevendedoraId = this.exigirRevendedor();
    const contenido = dto.contenido.trim();
    validarPlantilla(contenido);

    const teamMemberId = this.contexto.teamMemberId ?? null;
    await this.prisma.transaction(async (tx) => {
      const existente = await tx.plantillaWhatsApp.findUnique({
        where: { empresaRevendedoraId },
        select: { id: true, version: true, contenido: true },
      });
      if (existente) {
        await tx.plantillaWhatsApp.update({
          where: { id: existente.id },
          data: {
            contenido,
            version: { increment: 1 },
            actualizadoPorTeamMemberId: teamMemberId,
          },
        });
      } else {
        await tx.plantillaWhatsApp.create({
          data: {
            empresaRevendedoraId,
            contenido,
            version: 1,
            actualizadoPorTeamMemberId: teamMemberId,
          },
        });
      }
      // Se audita el cambio (quién/cuándo y tokens usados), nunca el contenido.
      await this.audit.registrarEnTx(tx, {
        accion: AccionAuditoria.cambio_plantilla_whatsapp,
        entidad: EntidadAuditada.EmpresaRevendedora,
        entidadId: empresaRevendedoraId,
        detalle: {
          version_anterior: existente?.version ?? 0,
          version_nueva: (existente?.version ?? 0) + 1,
          tokens_usados: validarPlantilla(contenido),
        },
      });
    });
    return this.obtenerPlantillaWhatsApp();
  }

  private exigirOperador(): string {
    const operadorPrincipalId = this.contexto.operadorPrincipalId;
    if (!this.contexto.esOperador || !operadorPrincipalId) {
      throw new ForbiddenException(
        'La configuración de la conexión con el proveedor es exclusiva del Operador Principal.',
      );
    }
    return operadorPrincipalId;
  }

  private exigirRevendedor(): string {
    const empresaRevendedoraId = this.contexto.empresaRevendedoraId;
    if (this.contexto.esOperador || !empresaRevendedoraId) {
      throw new ForbiddenException(
        'Esta configuración se administra desde el panel de cada Empresa Revendedora.',
      );
    }
    return empresaRevendedoraId;
  }
}
