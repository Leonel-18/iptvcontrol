import { Injectable } from '@nestjs/common';
import { AccionAuditoria, EntidadAuditada, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestContextService } from '../../common/context/request-context.service';
import { PaginatedResponse } from '../../common/dto/pagination.dto';
import { ListarAuditoriaQueryDto } from './dto/listar-auditoria.query';

/** Etiquetas en español de cada acción, para mostrar directo en el panel. */
const ETIQUETAS_ACCION: Record<AccionAuditoria, string> = {
  alta_cliente: 'Alta de Cliente Final',
  suspension_cliente: 'Suspensión de Cliente Final',
  reactivacion_cliente: 'Reactivación de Cliente Final',
  baja_cliente: 'Baja definitiva de Cliente Final',
  reasignacion_dispositivo: 'Reasignación de Dispositivo',
  alta_dispositivo: 'Alta de Dispositivo',
  baja_dispositivo: 'Baja de Dispositivo',
  migracion_cuenta: 'Migración de Cuenta',
  alta_cuenta: 'Alta de Cuenta',
  cierre_cuenta: 'Cierre de Cuenta',
  cambio_password_cuenta: 'Cambio manual de contraseña de Cuenta',
  cambio_pin_cuenta: 'Cambio manual de PIN de Cuenta',
  cambio_tipo_cuenta: 'Cambio de tipo de Cuenta',
  cambio_servicios_cuenta: 'Cambio de servicios de Cuenta',
  cambio_modalidad_comercial: 'Cambio de modalidad comercial',
  cambio_precio: 'Cambio de precios',
  alta_empresa_revendedora: 'Alta de Empresa Revendedora',
  baja_empresa_revendedora: 'Baja de Empresa Revendedora',
  cambio_configuracion_proveedor: 'Cambio de configuración del proveedor',
  alta_team_member: 'Alta de miembro del equipo',
  reenvio_invitacion_team_member: 'Reenvío de invitación',
  baja_team_member: 'Baja de miembro del equipo',
  apertura_vinculacion_dispositivo: 'Apertura de vinculación de Dispositivo',
  vinculacion_dispositivo: 'Vinculación de Dispositivo',
  vinculacion_ambigua: 'Vinculación ambigua de Dispositivo',
  alta_reserva_tecnica: 'Alta de reserva técnica',
  liberacion_reserva_tecnica: 'Liberación de reserva técnica',
  deteccion_dispositivo_no_autorizado: 'Detección de Dispositivo no autorizado',
  resolucion_incidencia_dispositivo: 'Resolución de incidencia de Dispositivo',
  correccion_vinculacion_dispositivo: 'Corrección de vinculación de Dispositivo',
  apertura_ventana_curiosidad: 'Apertura de Ventana de Alta',
  levantamiento_ventana_curiosidad: 'Levantamiento de Ventana de Alta',
  cambio_configuracion_ventana_curiosidad: 'Cambio de duración de Ventana de Alta',
  actualizacion_empresa_revendedora: 'Actualización de datos de Empresa Revendedora',
  suspension_empresa_revendedora: 'Suspensión de Empresa Revendedora',
  reactivacion_empresa_revendedora: 'Reactivación de Empresa Revendedora',
  cambio_slots_cuenta: 'Cambio de cupos (slots) de una Cuenta',
  cambio_plantilla_whatsapp: 'Cambio de plantilla de WhatsApp',
};

/**
 * Consulta del registro de auditoría (docs/03_Reglas_de_Negocio.md, sección 11).
 *
 * Quién ve qué:
 *  - El Operador Principal ve el log completo de todas sus Empresas Revendedoras,
 *    pero respetando la misma restricción de campos de la sección 4.2: cuando el
 *    registro involucra un Cliente Final, ve el ID y el número de cliente, nunca
 *    el nombre ni los datos de contacto.
 *  - Cada Empresa Revendedora ve únicamente el log de sus propias acciones.
 *
 * El filtrado por tenant lo hace Row-Level Security; acá se filtran los campos
 * del `detalle`, que es texto libre en JSON y podría arrastrar datos sensibles.
 */
@Injectable()
export class AuditoriaService {
  /** Claves del `detalle` que nunca se muestran al Operador Principal. */
  private static readonly CLAVES_RESERVADAS = [
    'nombre',
    'apellido',
    'nombre_completo',
    'telefono',
    'email',
    'direccion',
    'nota_descriptiva',
    'password',
    'pin',
    'usuario',
    'token',
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly contexto: RequestContextService,
  ) {}

  async listar(query: ListarAuditoriaQueryDto) {
    const where: Prisma.AuditLogWhereInput = {
      accion: query.action,
      entidadAfectada: query.entity,
      entidadId: query.entity_id,
      empresaRevendedoraId: query.reseller_id,
      creadoEn:
        query.from || query.to
          ? {
              gte: query.from ? new Date(query.from) : undefined,
              lte: query.to ? new Date(`${query.to.slice(0, 10)}T23:59:59.999Z`) : undefined,
            }
          : undefined,
    };

    const esCsv = query.esCsv;
    const [total, registros] = await Promise.all([
      this.prisma.db.auditLog.count({ where }),
      this.prisma.db.auditLog.findMany({
        where,
        include: {
          teamMember: { select: { id: true, email: true, nombre: true, rol: true } },
          empresaRevendedora: { select: { id: true, razonSocial: true } },
        },
        orderBy: { creadoEn: 'desc' },
        skip: esCsv ? undefined : query.skip,
        take: esCsv ? undefined : Math.min(query.take, 200),
      }),
    ]);

    const esOperador = this.contexto.esOperador;

    const data = registros.map((registro) => ({
      id: registro.id,
      accion: registro.accion,
      accion_etiqueta: ETIQUETAS_ACCION[registro.accion] ?? registro.accion,
      entidad: registro.entidadAfectada,
      entidad_id: registro.entidadId,
      // Al Operador Principal no se le muestra la razón social junto al detalle
      // de un Cliente Final: se identifica la Empresa Revendedora por ID, que es
      // lo que necesita para dar soporte.
      empresa_revendedora: registro.empresaRevendedora
        ? {
            id: registro.empresaRevendedora.id,
            razon_social: registro.empresaRevendedora.razonSocial,
          }
        : null,
      ejecutado_por: registro.teamMember
        ? {
            id: registro.teamMember.id,
            email: registro.teamMember.email,
            nombre: registro.teamMember.nombre,
            rol: registro.teamMember.rol,
          }
        : null,
      detalle: esOperador ? this.filtrarDetalle(registro.detalle) : registro.detalle,
      creado_en: registro.creadoEn,
    }));

    return PaginatedResponse.build(data, total, query.page ?? 1, query.per_page ?? 25);
  }

  /** Catálogo de acciones, para armar el filtro del panel. */
  acciones() {
    return Object.entries(ETIQUETAS_ACCION).map(([valor, etiqueta]) => ({ valor, etiqueta }));
  }

  entidades() {
    return Object.values(EntidadAuditada).map((valor) => ({ valor, etiqueta: valor }));
  }

  /**
   * Quita del JSON de detalle cualquier clave que pudiera identificar a un
   * Cliente Final o exponer credenciales. Se aplica solo para el Operador
   * Principal: su propia Empresa Revendedora sí puede ver sus datos.
   */
  private filtrarDetalle(detalle: Prisma.JsonValue | null): Prisma.JsonValue | null {
    if (!detalle || typeof detalle !== 'object' || Array.isArray(detalle)) return detalle;

    const limpio: Record<string, unknown> = {};
    for (const [clave, valor] of Object.entries(detalle as Record<string, unknown>)) {
      if (AuditoriaService.CLAVES_RESERVADAS.includes(clave)) continue;
      limpio[clave] =
        valor && typeof valor === 'object' && !Array.isArray(valor)
          ? (this.filtrarDetalle(valor as Prisma.JsonValue) as unknown)
          : valor;
    }
    return limpio as Prisma.JsonValue;
  }
}
