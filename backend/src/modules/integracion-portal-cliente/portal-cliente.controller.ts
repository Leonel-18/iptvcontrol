import { Body, Controller, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/auth/decorators';
import { PortalApiKeyGuard } from './portal-api-key.guard';
import { PortalClienteService } from './portal-cliente.service';
import {
  BajaDispositivoPortalDto,
  CambiarPasswordPortalDto,
  CambiarPinPortalDto,
  CambiarServiciosPortalDto,
  ReclamarDispositivoPortalDto,
  SesionPortalDto,
  SincronizarDispositivosPortalDto,
} from './dto/portal-cliente.dto';

/**
 * Portal de Cliente externo.
 *
 * Fuera del flujo del panel: se autentica con `x-api-key` (tenant fijo) y no con
 * un token de Auth0. `@Public()` evita que los guards globales de JWT y Team
 * Member exijan un usuario humano; el guard propio fija el tenant y el actor.
 */
@ApiTags('integration')
@Controller('integration/portal-cliente')
@UseGuards(PortalApiKeyGuard)
export class PortalClienteController {
  constructor(private readonly portal: PortalClienteService) {}

  @Post('session')
  @Public()
  // El endpoint expone credenciales: se limita más fuerte que el resto.
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiHeader({
    name: 'x-api-key',
    description: 'API key de la integración (PORTAL_CLIENTE_API_KEY del servidor).',
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

  @Patch('accounts/:cuentaId/password')
  @Public()
  @ApiOperation({ summary: 'Cambia la contraseña de una cuenta exclusiva.' })
  cambiarPassword(
    @Param('cuentaId', ParseUUIDPipe) cuentaId: string,
    @Body() dto: CambiarPasswordPortalDto,
  ) {
    return this.portal.cambiarPassword(dto.dni, cuentaId, dto.password);
  }

  @Patch('accounts/:cuentaId/pin')
  @Public()
  @ApiOperation({ summary: 'Cambia el PIN de una cuenta exclusiva.' })
  cambiarPin(@Param('cuentaId', ParseUUIDPipe) cuentaId: string, @Body() dto: CambiarPinPortalDto) {
    return this.portal.cambiarPin(dto.dni, cuentaId, dto.pin);
  }

  @Patch('accounts/:cuentaId/services')
  @Public()
  @ApiOperation({ summary: 'Cambia los servicios de una cuenta exclusiva.' })
  cambiarServicios(
    @Param('cuentaId', ParseUUIDPipe) cuentaId: string,
    @Body() dto: CambiarServiciosPortalDto,
  ) {
    return this.portal.cambiarServicios(dto.dni, cuentaId, dto.servicios);
  }

  @Post('accounts/:cuentaId/devices/sync')
  @Public()
  @ApiOperation({ summary: 'Consulta el inventario de dispositivos del proveedor.' })
  sincronizarDispositivos(
    @Param('cuentaId', ParseUUIDPipe) cuentaId: string,
    @Body() dto: SincronizarDispositivosPortalDto,
  ) {
    return this.portal.sincronizarDispositivos(dto.dni, cuentaId);
  }

  @Post('accounts/:cuentaId/devices/claim')
  @Public()
  @ApiOperation({ summary: 'Asigna al titular un dispositivo detectado sin dueño.' })
  reclamarDispositivo(
    @Param('cuentaId', ParseUUIDPipe) cuentaId: string,
    @Body() dto: ReclamarDispositivoPortalDto,
  ) {
    return this.portal.reclamarDispositivo(dto.dni, cuentaId, dto.proveedor_device_id);
  }

  @Post('accounts/:cuentaId/devices/:dispositivoId/remove')
  @Public()
  @ApiOperation({
    summary: 'Baja definitiva de un dispositivo propio.',
    description: 'Elimina el Dispositivo en el proveedor y borra la fila local. Irreversible.',
  })
  darDeBaja(
    @Param('cuentaId', ParseUUIDPipe) cuentaId: string,
    @Param('dispositivoId', ParseUUIDPipe) dispositivoId: string,
    @Body() dto: BajaDispositivoPortalDto,
  ) {
    return this.portal.darDeBajaDispositivo(dto.dni, cuentaId, dispositivoId);
  }
}
