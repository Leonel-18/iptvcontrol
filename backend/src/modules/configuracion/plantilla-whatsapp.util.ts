import { BadRequestException } from '@nestjs/common';

/**
 * Tokens disponibles en la plantilla de WhatsApp de cada Empresa Revendedora.
 *
 * Decisión de negocio: NO se ofrecen tokens sensibles (PIN de la Cuenta, DNI,
 * correo o dirección del Cliente Final). El mensaje es de credenciales de
 * acceso + instructivo, y esos datos no aportan y exponen de más.
 */
export const TOKENS_PLANTILLA_WHATSAPP: Array<{
  token: string;
  etiqueta: string;
  ayuda: string;
}> = [
  { token: 'usuario', etiqueta: 'Usuario de la Cuenta', ayuda: 'Identificador de acceso.' },
  { token: 'password', etiqueta: 'Contraseña de la Cuenta', ayuda: 'Clave numérica de acceso.' },
  {
    token: 'servicios',
    etiqueta: 'Servicios contratados',
    ayuda: 'Listado de paquetes de la Cuenta.',
  },
  {
    token: 'empresa',
    etiqueta: 'Razón social de mi empresa',
    ayuda: 'Aparece el nombre de la Empresa Revendedora.',
  },
];

/** Plantilla por defecto si la Empresa Revendedora todavía no guardó la suya. */
export const PLANTILLA_DEFAULT_WHATSAPP = `¡Hola! 👋 Ya podés empezar a disfrutar tu servicio de IPTV.

📺 *Datos de acceso*
Usuario: {{usuario}}
Contraseña: {{password}}

📲 *Cómo ingresar*
1. Si vas a mirar desde el celular, tablet o PC, entrá al reproductor web desde el navegador (te pasamos el link al contratar).
2. Si tenés un decodificador/TV, encendelo: ya viene configurado con este mismo usuario.
3. Ingresá el Usuario y la Contraseña de arriba.
4. ¡Listo! Ya podés elegir qué mirar.

Ante cualquier duda, escribinos por acá. {{empresa}}`;

const PATRON_TOKEN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/** Valida el contenido y devuelve la lista de tokens usados. Lanza si hay tokens desconocidos. */
export function validarPlantilla(contenido: string): string[] {
  const usados = new Set<string>();
  let match: RegExpExecArray | null;
  PATRON_TOKEN.lastIndex = 0;
  while ((match = PATRON_TOKEN.exec(contenido)) !== null) {
    usados.add(match[1]);
  }

  const conocidos = new Set(TOKENS_PLANTILLA_WHATSAPP.map((item) => item.token));
  const desconocidos = [...usados].filter((token) => !conocidos.has(token));
  if (desconocidos.length > 0) {
    throw new BadRequestException(
      `La plantilla usa tokens no disponibles: ${desconocidos.map((t) => `{{${t}}}`).join(', ')}. ` +
        'Use sólo los tokens del editor.',
    );
  }

  // Llaves desbalanceadas: un "{{" sin cierre deja el texto roto.
  const abiertas = (contenido.match(/\{\{/g) ?? []).length;
  const cerradas = (contenido.match(/\}\}/g) ?? []).length;
  if (abiertas !== cerradas) {
    throw new BadRequestException(
      'La plantilla tiene llaves desbalanceadas. Revise los tokens {{...}}.',
    );
  }
  return [...usados];
}

export interface ValoresPlantilla {
  usuario?: string | null;
  password?: string | null;
  servicios?: string | null;
  empresa?: string | null;
}

/** Reemplaza los tokens conocidos por sus valores. Los que no vienen quedan igual. */
export function renderizarPlantilla(contenido: string, valores: ValoresPlantilla): string {
  return contenido.replace(PATRON_TOKEN, (original, token: string) => {
    const clave = token as keyof ValoresPlantilla;
    const valor = valores[clave];
    return valor === undefined || valor === null || valor === '' ? original : String(valor);
  });
}
