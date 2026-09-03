import { PageHeader } from '@/components/common';
import { CuriosityWindowSettings } from './CuriosityWindowSettings';
import { WhatsappTemplateSettings } from './WhatsappTemplateSettings';

/**
 * Configuración de la Empresa Revendedora — `/settings`.
 *
 * Agrupa los ajustes propios del tenant: la Ventana de Alta (duración por
 * defecto de bloqueo entre ventas compartidas) y la Plantilla de WhatsApp
 * (mensaje parametrizable que se copia al pasarle credenciales a un cliente).
 */
export const ResellerSettingsView = () => {
  return (
    <>
      <PageHeader
        eyebrow="Configuración"
        titulo="Configuración de mi empresa"
        descripcion="Comportamiento de las ventas compartidas y el mensaje que se les envía a los clientes con sus datos de acceso."
      />
      <div className="grid max-w-4xl gap-4">
        <CuriosityWindowSettings />
        <WhatsappTemplateSettings />
      </div>
    </>
  );
};
