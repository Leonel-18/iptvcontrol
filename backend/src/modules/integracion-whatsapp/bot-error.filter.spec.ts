import { ArgumentsHost, BadRequestException, ConflictException } from '@nestjs/common';
import {
  ProveedorAutenticacionError,
  ProveedorNoDisponibleError,
} from '../../common/errors/proveedor.errors';
import { RequestContextService } from '../../common/context/request-context.service';
import { BotErrorFilter } from './bot-error.filter';
import { mapearErrorBot } from './bot-error.mapper';

/**
 * El bot de WhatsApp necesita que TODO error llegue como HTTP 200 con
 * `whatsapp.mensaje`, porque ManyChat no mapea los campos de respuesta cuando el
 * status no es 2xx.
 */
describe('BotErrorFilter / mapearErrorBot', () => {
  describe('mapearErrorBot', () => {
    it('clasifica el duplicado local de ID de gestión como cuenta ya existente', () => {
      const error = new ConflictException({
        statusCode: 409,
        error: 'IdGestionExternoDuplicado',
        message: 'Ya existe un cliente con ese ID.',
      });

      expect(mapearErrorBot(error).code).toBe('ACCOUNT_ALREADY_EXISTS');
    });

    it('clasifica el duplicado en el proveedor como cuenta ya existente', () => {
      const error = new BadRequestException({
        statusCode: 400,
        error: 'CuentaDuplicadaEnProveedor',
        message: 'El DNI ya está registrado.',
      });

      expect(mapearErrorBot(error).code).toBe('ACCOUNT_ALREADY_EXISTS');
    });

    it('clasifica una validación de datos como INVALID_DATA', () => {
      expect(mapearErrorBot(new BadRequestException('Datos incompletos')).code).toBe(
        'INVALID_DATA',
      );
    });

    it('separa el error de autenticación contra el proveedor', () => {
      expect(mapearErrorBot(new ProveedorAutenticacionError('401')).code).toBe('PROVIDER_AUTH');
    });

    it('clasifica la caída del proveedor como PROVIDER_UNAVAILABLE', () => {
      expect(mapearErrorBot(new ProveedorNoDisponibleError('timeout')).code).toBe(
        'PROVIDER_UNAVAILABLE',
      );
    });

    it('clasifica un error inesperado como INTERNAL_ERROR y nivel error', () => {
      const mapeado = mapearErrorBot(new Error('boom interno'));
      expect(mapeado.code).toBe('INTERNAL_ERROR');
      expect(mapeado.nivelLog).toBe('error');
    });
  });

  describe('BotErrorFilter', () => {
    const crearHost = () => {
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const host = {
        switchToHttp: () => ({
          getResponse: () => res,
          getRequest: () => ({ method: 'POST', url: '/api/v1/integration/whatsapp/customers' }),
        }),
      } as unknown as ArgumentsHost;
      return { host, res };
    };

    const crearFiltro = () =>
      new BotErrorFilter({
        get: () => ({ requestId: 'req-1' }),
      } as unknown as RequestContextService);

    it('responde HTTP 200 con whatsapp.mensaje ante un error de negocio', () => {
      const { host, res } = crearHost();

      crearFiltro().catch(new BadRequestException('Datos incompletos'), host);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          whatsapp: expect.objectContaining({ mensaje: expect.any(String) }),
          cuenta: { usuario: null, password: null, pin: null },
          error: expect.objectContaining({ code: 'INVALID_DATA' }),
        }),
      );
    });

    it('responde HTTP 200 con mensaje genérico ante un error inesperado', () => {
      const { host, res } = crearHost();

      crearFiltro().catch(new Error('boom'), host);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: 'INTERNAL_ERROR' }),
        }),
      );
    });
  });
});
