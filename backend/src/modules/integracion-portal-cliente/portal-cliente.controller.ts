import { Body, Controller, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/auth/decorators';
import { RequierePermisoIntegracion } from '../integraciones/integracion-permiso.decorator';
import { PortalApiKeyGuard } from './portal-api-key.guard';
import { PortalClienteService } from './portal-cliente.service';
import {
  CambiarPasswordPortalDto,
  CambiarPinPortalDto,
  CambiarServiciosPortalDto,
  ReclamarDispositivoPortalDto,
  SesionPortalDto,
} from './dto/portal-cliente.dto';

/**
 * Portal de Cliente externo.
 *
 * Fuera del flujo del panel: se autentica con `x-api-key` (tenant fijo) y no con
 * un token de Auth0. `@Public()` evita que los guards globales de JWT y Team
 * Member exijan un usuario humano; el guard propio fija el tenant y el actor.
 *
 * Las operaciones sobre una Cuenta usan su **ID en el Proveedor**
 * (`proveedorCuentaId`), no el UUID interno ni el DNI del Cliente. Funcionan
 * igual en Cuentas exclusivas y compartidas.
 */
@ApiTags('integration')
@Controller('integration/portal-cliente')
@UseGuards(PortalApiKeyGuard)
export class PortalClienteController {
  constructor(private readonly portal: PortalClienteService) {}

  @Post('session')
  @Public()
  @RequierePermisoIntegracion('clientes.leer')
  // El endpoint expone credenciales: se limita más fuerte que el resto.
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiHeader({
    name: 'x-api-key',
    description:
      'Credencial de integración de la Empresa Revendedora (Configuración → Integraciones).',
    required: true,
  })
  @ApiOperation({
    summary: 'Sesión del Cliente Final por DNI.',
    description:
      'Devuelve el cliente y todas sus cuentas con usuario, contraseña, PIN, servicios y ' +
      'dispositivos. En cuentas compartidas sólo los dispositivos asignados al cliente.',
  })
  sesion(@Body() dto: SesionPortalDto) {
    return this.portal.sesion(dto.dni);
  }

  @Patch('accounts/:proveedorCuentaId/password')
  @Public()
  @RequierePermisoIntegracion('cuentas.editar')
  @ApiOperation({
    summary: 'Cambia la contraseña de una Cuenta (exclusiva o compartida).',
    description:
      'La Cuenta se identifica por su ID en el Proveedor. En una compartida la contraseña ' +
      'es de todos los Clientes Finales: se exige `confirmar_cambio_compartida: true` y la ' +
      'respuesta incluye una advertencia.',
  })
  cambiarPassword(
    @Param('proveedorCuentaId') proveedorCuentaId: string,
    @Body() dto: CambiarPasswordPortalDto,
  ) {
    return this.portal.cambiarPassword(
      proveedorCuentaId,
      dto.password,
      dto.confirmar_cambio_compartida,
    );
  }

  @Patch('accounts/:proveedorCuentaId/pin')
  @Public()
  @RequierePermisoIntegracion('cuentas.editar')
  @ApiOperation({
    summary: 'Cambia el PIN de una Cuenta (exclusiva o compartida).',
    description:
      'En una compartida el PIN es de todos los Clientes: se exige ' +
      '`confirmar_cambio_compartida: true`.',
  })
  cambiarPin(
    @Param('proveedorCuentaId') proveedorCuentaId: string,
    @Body() dto: CambiarPinPortalDto,
  ) {
    return this.portal.cambiarPin(
      proveedorCuentaId,
      dto.pin,
      dto.confirmar_cambio_compartida,
    );
  }

  @Patch('accounts/:proveedorCuentaId/services')
  @Public()
  @RequierePermisoIntegracion('cuentas.editar')
  @ApiOperation({
    summary: 'Cambia los servicios de una Cuenta (exclusiva o compartida).',
    description:
      'En una compartida el contenido es de todos los Clientes: se exige ' +
      '`confirmar_cambio_compartida: true`.',
  })
  cambiarServicios(
    @Param('proveedorCuentaId') proveedorCuentaId: string,
    @Body() dto: CambiarServiciosPortalDto,
  ) {
    return this.portal.cambiarServicios(
      proveedorCuentaId,
      dto.servicios,
      dto.confirmar_cambio_compartida,
    );
  }

  @Post('accounts/:proveedorCuentaId/devices/sync')
  @Public()
  @RequierePermisoIntegracion('dispositivos.leer')
  @ApiOperation({
    summary: 'Consulta el inventario de dispositivos del proveedor.',
    description: 'Funciona para Cuentas exclusivas y compartidas.',
  })
  sincronizarDispositivos(@Param('proveedorCuentaId') proveedorCuentaId: string) {
    return this.portal.sincronizarDispositivos(proveedorCuentaId);
  }

  @Post('accounts/:proveedorCuentaId/devices/claim')
  @Public()
  @RequierePermisoIntegracion('dispositivos.gestionar')
  @ApiOperation({
    summary: 'Asigna a un Cliente Final un dispositivo detectado sin dueño.',
    description:
      'El DNI sigue siendo necesario porque define a qué Cliente Final se le asigna.',
  })
  reclamarDispositivo(
    @Param('proveedorCuentaId') proveedorCuentaId: string,
    @Body() dto: ReclamarDispositivoPortalDto,
  ) {
    return this.portal.reclamarDispositivo(
      proveedorCuentaId,
      dto.dni,
      dto.proveedor_device_id,
    );
  }

  @Post('accounts/:proveedorCuentaId/devices/:proveedorDeviceId/remove')
  @Public()
  @RequierePermisoIntegracion('dispositivos.gestionar')
  @ApiOperation({
    summary: 'Baja definitiva de un dispositivo por su ID en el proveedor.',
    description:
      'Elimina el Dispositivo en el proveedor y borra la fila local. Irreversible. ' +
      'Funciona para Cuentas exclusivas y compartidas.',
  })
  darDeBaja(
    @Param('proveedorCuentaId') proveedorCuentaId: string,
    @Param('proveedorDeviceId') proveedorDeviceId: string,
  ) {
    return this.portal.darDeBajaDispositivo(proveedorCuentaId, proveedorDeviceId);
  }
}
