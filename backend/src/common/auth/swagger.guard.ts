import { Logger } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { timingSafeEqual } from 'node:crypto';

/**
 * Protección de la documentación de la API (`/api/docs`).
 *
 * Requisito: Swagger visible **sólo con login** (docs/01_Instrucciones_del_Proyecto.md y
 * docs/04, sección 2.1). El detalle técnico es que Swagger UI se sirve como
 * middleware de Express, así que los guards de NestJS —que protegen los
 * *endpoints*— no lo alcanzan: hay que protegerlo antes.
 *
 * Se usa HTTP Basic Auth y no el JWT de Auth0 porque Swagger UI es una página que
 * el navegador abre directo, sin pasar por el panel: no tiene de dónde sacar un
 * access token. Basic Auth es el mecanismo que el navegador sí sabe negociar solo.
 *
 * Comportamiento según la configuración:
 *  - Con `SWAGGER_USER` y `SWAGGER_PASSWORD` → pide usuario y contraseña.
 *  - Sin credenciales y en producción → **no se expone Swagger**. Preferimos no
 *    publicar la documentación de la API antes que publicarla abierta.
 *  - Sin credenciales y en desarrollo → se expone libre, para poder trabajar.
 */
export interface OpcionesSwagger {
  usuario?: string;
  password?: string;
  esProduccion: boolean;
}

const logger = new Logger('SwaggerAuth');

/** Comparación en tiempo constante, para no filtrar el usuario por timing. */
const iguales = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
};

/**
 * Devuelve el middleware que protege Swagger, o `null` si la documentación no
 * debe exponerse en absoluto.
 */
export const crearProteccionSwagger = (
  opciones: OpcionesSwagger,
): ((req: Request, res: Response, next: NextFunction) => void) | null => {
  const { usuario, password, esProduccion } = opciones;

  if (!usuario || !password) {
    if (esProduccion) {
      logger.warn(
        'SWAGGER_USER / SWAGGER_PASSWORD no están configurados: la documentación de la API NO se ' +
          'expone en producción. Configurelos si quiere publicarla con login.',
      );
      return null;
    }
    logger.log('Documentación de la API expuesta sin credenciales (entorno de desarrollo).');
    return (_req, _res, next) => next();
  }

  return (req: Request, res: Response, next: NextFunction) => {
    const cabecera = req.headers.authorization ?? '';
    const [esquema, credenciales] = cabecera.split(' ');

    if (esquema === 'Basic' && credenciales) {
      const [usuarioRecibido, ...resto] = Buffer.from(credenciales, 'base64')
        .toString('utf8')
        .split(':');
      const passwordRecibida = resto.join(':');

      if (iguales(usuarioRecibido ?? '', usuario) && iguales(passwordRecibida, password)) {
        next();
        return;
      }
    }

    res.setHeader('WWW-Authenticate', 'Basic realm="IPTVControl API", charset="UTF-8"');
    res.status(401).send('Credenciales requeridas para ver la documentación de la API.');
  };
};
