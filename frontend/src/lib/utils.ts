import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Combina clases de Tailwind resolviendo conflictos (patrón de shadcn/ui). */
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

/** Fecha corta en formato argentino: 14/08/2026. */
export const formatearFecha = (valor?: string | Date | null): string => {
  if (!valor) return "—";
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return "—";
  return fecha.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

/** Fecha y hora, para el registro de auditoría y la salud de la integración. */
export const formatearFechaHora = (valor?: string | Date | null): string => {
  if (!valor) return "—";
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return "—";
  return fecha.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/** Importes en pesos argentinos. El sistema no factura, pero sí muestra precios. */
export const formatearImporte = (valor?: number | null): string => {
  if (valor === null || valor === undefined) return "—";
  return valor.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  });
};

export const formatearNumero = (valor?: number | null): string =>
  valor === null || valor === undefined ? "—" : valor.toLocaleString("es-AR");

/** "hace 5 minutos", para la última llamada al proveedor. */
export const tiempoRelativo = (valor?: string | Date | null): string => {
  if (!valor) return "—";
  const fecha = new Date(valor).getTime();
  if (Number.isNaN(fecha)) return "—";

  const segundos = Math.round((Date.now() - fecha) / 1000);
  if (segundos < 60) return "hace instantes";
  const minutos = Math.round(segundos / 60);
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.round(horas / 24);
  return `hace ${dias} d`;
};

/** Copia al portapapeles. Devuelve false si el navegador no lo permite. */
export const copiarAlPortapapeles = async (texto: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
};

/** Formatea una MAC para lectura: 03AC1AE60CA7 → 03:AC:1A:E6:0C:A7 */
export const formatearMac = (mac?: string | null): string => {
  if (!mac) return "—";
  return /^[0-9a-fA-F]{12}$/.test(mac)
    ? mac.replace(/(.{2})(?=.)/g, "$1:")
    : mac;
};

/**
 * Arma el texto listo para pegar en WhatsApp con las credenciales del cliente
 * y un mini instructivo de acceso. El PIN sólo se incluye en una Cuenta
 * exclusiva: en una Cuenta compartida, varios clientes usan el mismo PIN de
 * control parental de la Cuenta, y no tiene sentido de negocio entregárselo a
 * cada uno como si fuera propio.
 */
export const construirPlantillaWhatsApp = (params: {
  usuario: string;
  password: string;
  pin?: string | null;
  esExclusiva: boolean;
}): string => {
  const { usuario, password, pin, esExclusiva } = params;
  const lineas = [
    "¡Hola! 👋 Ya podés empezar a disfrutar tu servicio de IPTV.",
    "",
    "📺 *Datos de acceso*",
    `Usuario: ${usuario}`,
    `Contraseña: ${password}`,
  ];
  if (esExclusiva && pin) {
    lineas.push(`PIN de control parental: ${pin}`);
  }
  lineas.push(
    "",
    "📲 *Cómo ingresar*",
    "1. Si vas a mirar desde el celular, tablet o PC, entrá a player.sensa.com.ar desde el navegador.",
    "2. Si tenés un decodificador/TV, encendelo: ya viene configurado con este mismo usuario.",
    "3. Ingresá el Usuario y la Contraseña de arriba.",
    "4. ¡Listo! Ya podés elegir qué mirar.",
    "",
    "Ante cualquier duda, escribinos por acá.",
  );
  return lineas.join("\n");
};
