import { NextFunction, Request, Response } from 'express';
import { crearProteccionSwagger } from './swagger.guard';

/**
 * Tests de la protección de la documentación de la API.
 * Requisito: Swagger visible sólo con login.
 */
describe('crearProteccionSwagger', () => {
  const armarRes = () => {
    const res = {
      setHeader: jest.fn(),
      status: jest.fn(),
      send: jest.fn(),
    } as unknown as Response & { setHeader: jest.Mock; status: jest.Mock; send: jest.Mock };
    (res.status as jest.Mock).mockReturnValue(res);
    return res;
  };

  const armarReq = (usuario?: string, password?: string): Request =>
    ({
      headers:
        usuario !== undefined
          ? {
              authorization: `Basic ${Buffer.from(`${usuario}:${password ?? ''}`).toString('base64')}`,
            }
          : {},
    }) as Request;

  it('no expone la documentación en producción si no hay credenciales', () => {
    // Preferimos no publicar la documentación antes que publicarla abierta.
    expect(crearProteccionSwagger({ esProduccion: true })).toBeNull();
  });

  it('la expone libre en desarrollo si no hay credenciales', () => {
    const middleware = crearProteccionSwagger({ esProduccion: false });
    expect(middleware).not.toBeNull();

    const next = jest.fn() as NextFunction;
    middleware!(armarReq(), armarRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it('rechaza el acceso sin cabecera de autorización', () => {
    const middleware = crearProteccionSwagger({
      usuario: 'docs',
      password: 'secreta',
      esProduccion: true,
    })!;
    const res = armarRes();
    const next = jest.fn() as NextFunction;

    middleware(armarReq(), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    // Sin esta cabecera, el navegador no muestra el diálogo de credenciales.
    expect(res.setHeader).toHaveBeenCalledWith(
      'WWW-Authenticate',
      expect.stringContaining('Basic'),
    );
  });

  it('rechaza credenciales incorrectas', () => {
    const middleware = crearProteccionSwagger({
      usuario: 'docs',
      password: 'secreta',
      esProduccion: true,
    })!;
    const next = jest.fn() as NextFunction;
    const res = armarRes();

    middleware(armarReq('docs', 'otra'), res, next);
    expect(next).not.toHaveBeenCalled();

    middleware(armarReq('otro', 'secreta'), res, next);
    expect(next).not.toHaveBeenCalled();
  });

  it('deja pasar con las credenciales correctas', () => {
    const middleware = crearProteccionSwagger({
      usuario: 'docs',
      password: 'secreta',
      esProduccion: true,
    })!;
    const next = jest.fn() as NextFunction;

    middleware(armarReq('docs', 'secreta'), armarRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it('admite contraseñas que contienen dos puntos', () => {
    const middleware = crearProteccionSwagger({
      usuario: 'docs',
      password: 'con:dos:puntos',
      esProduccion: true,
    })!;
    const next = jest.fn() as NextFunction;

    middleware(armarReq('docs', 'con:dos:puntos'), armarRes(), next);
    expect(next).toHaveBeenCalled();
  });
});
