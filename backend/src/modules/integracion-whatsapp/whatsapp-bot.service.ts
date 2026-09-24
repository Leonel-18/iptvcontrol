import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TipoAltaClienteFinal } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestContextService } from '../../common/context/request-context.service';
import { ClientesService } from '../clientes/clientes.service';
import { ConfiguracionService } from '../configuracion/configuracion.service';
import { ProveedoresService } from '../configuracion/proveedores.service';
import { renderizarPlantilla } from '../configuracion/plantilla-whatsapp.util';
import { CrearClienteBotDto } from './dto/crear-cliente-bot.dto';

/** Cuenta tal como la devuelve la vista por Cliente para la Empresa Revendedora. */
interface CuentaDelCliente {
  id: string;
  usuario: string;
  password: string | null;
  pin: string | null;
  servicios: string;
  servicios_nombres: string[];
  es_exclusiva: boolean;
}

interface ClienteCreadoConCuenta {
  id: string;
  numero_cliente: number;
  tipo_alta: string;
  cuenta: CuentaDelCliente | null;
}

interface ResultadoAltaBot {
  cliente: ClienteCreadoConCuenta;
  cuenta_creada: boolean;
  dispositivo_pendiente_de_activacion: boolean;
  solicitud_vinculacion_id: string | null;
}

/**
 * =============================================================================
 * Bot de WhatsApp — creación de Clientes Finales
 * =============================================================================
 * El bot NO reimplementa la lógica de alta: delega en `ClientesService.crear`,
 * el mismo camino que usa el wizard del panel. Así la Cuenta sigue creándose
 * con el `ProveedorAdapter` de SENSA, con los contadores sincronizados, la
 * Ventana de Alta, la firma de servicios y el Audit Log — sin duplicar nada.
 *
 * Diferencias con el panel, decididas con Bruno:
 *  - la Empresa Revendedora dueña la fija la configuración del endpoint (el bot
 *    no elige tenant);
 *  - la Ventana de Alta la fija el servidor (96 h por defecto), no el cliente;
 *  - la respuesta incluye las credenciales y el mensaje de WhatsApp ya
 *    renderizado, para que el bot lo envíe sin armar nada.
 * =============================================================================
 */
@Injectable()
export class WhatsappBotService {
  private readonly logger = new Logger(WhatsappBotService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly contexto: RequestContextService,
    private readonly clientes: ClientesService,
    private readonly configuracion: ConfiguracionService,
    private readonly proveedores: ProveedoresService,
  ) {}

  async crearCliente(dto: CrearClienteBotDto) {
    const esCompartida = dto.tipo_alta === TipoAltaClienteFinal.dispositivo_compartido;
    const ventanaMinutos = this.config.get<number>('whatsappBot.ventanaMinutos') ?? 5760;

    // Los servicios no los elige el cliente: van TODOS los del catálogo (los 7
    // códigos), sin importar el tipo de Cuenta. El básico código 1 ya viene
    // incluido en el catálogo. Si alguno no está contratado por el Operador
    // Principal, `ClientesService.crear` lo rechaza — la validación sigue viva.
    const servicios = this.proveedores.catalogoServicios().map((servicio) => servicio.codigo);

    // Se arma el mismo contrato que consume el wizard. La ubicación es
    // automática: la venta se suma a una Cuenta compatible sin Ventana vigente o,
    // si no hay ninguna, crea una nueva; la duración del bot sólo se usa para
    // abrir la Ventana de Alta en la Cuenta elegida.
    const resultado = (await this.clientes.crear({
      nombre: dto.nombre,
      apellido: dto.apellido,
      dni: dto.dni,
      telefono: dto.telefono,
      email: dto.email,
      direccion: dto.direccion,
      id_gestion_externo: dto.id_gestion_externo,
      tipo_alta: dto.tipo_alta,
      servicios,
      cupos_por_categoria: esCompartida ? dto.cupos_por_categoria : undefined,
      duracion_ventana_curiosidad_minutos: esCompartida ? ventanaMinutos : undefined,
      dispositivo: { nota_descriptiva: dto.dispositivo?.nota_descriptiva },
      confirmar_duplicado: dto.confirmar_duplicado,
    })) as unknown as ResultadoAltaBot;

    const cuenta = resultado.cliente.cuenta;
    const mensaje = await this.armarMensajeWhatsApp(cuenta);

    this.logger.log(
      `Bot WhatsApp creó el Cliente Final ${resultado.cliente.numero_cliente} ` +
        `(${dto.tipo_alta}) para la Empresa Revendedora ${this.contexto.empresaRevendedoraId}.`,
    );

    return {
      cliente: {
        id: resultado.cliente.id,
        numero_cliente: resultado.cliente.numero_cliente,
        tipo_alta: resultado.cliente.tipo_alta,
      },
      cuenta: cuenta
        ? {
            id: cuenta.id,
            usuario: cuenta.usuario,
            password: cuenta.password,
            pin: cuenta.pin,
            servicios: cuenta.servicios,
            servicios_nombres: cuenta.servicios_nombres,
            es_exclusiva: cuenta.es_exclusiva,
          }
        : null,
      cuenta_creada: resultado.cuenta_creada,
      dispositivo_pendiente_de_activacion: resultado.dispositivo_pendiente_de_activacion,
      solicitud_vinculacion_id: resultado.solicitud_vinculacion_id,
      whatsapp: mensaje,
    };
  }

  /**
   * Renderiza la plantilla de WhatsApp de la Empresa Revendedora con las
   * credenciales recién generadas. El PIN no se incluye: la plantilla del panel
   * tampoco lo ofrece, para no exponer de más.
   */
  private async armarMensajeWhatsApp(cuenta: CuentaDelCliente | null) {
    const empresaRevendedoraId = this.contexto.empresaRevendedoraId;
    const plantilla = await this.configuracion.obtenerPlantillaWhatsApp();
    const empresa = empresaRevendedoraId
      ? await this.prisma.db.empresaRevendedora.findUnique({
          where: { id: empresaRevendedoraId },
          select: { razonSocial: true },
        })
      : null;

    const mensaje = renderizarPlantilla(plantilla.contenido, {
      usuario: cuenta?.usuario,
      password: cuenta?.password,
      servicios: cuenta?.servicios_nombres?.join(', '),
      empresa: empresa?.razonSocial,
    });

    return { mensaje, plantilla_version: plantilla.version };
  }
}
