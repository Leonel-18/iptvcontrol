import { Check, Copy, Eye, EyeOff } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  accountStatusLabels,
  customerStatusLabels,
  deviceStatusHelp,
  deviceStatusLabels,
  deviceBindingHelp,
  deviceBindingLabels,
  deviceTypeLabels,
  healthStatusLabels,
  providerDeviceClassHelp,
  providerDeviceClassLabels,
  resellerStatusLabels,
  teamMemberStatusLabels,
  traducir,
} from "@/i18n/entityLabels";
import { cn, copiarAlPortapapeles } from "@/lib/utils";
import { Alert, Badge, Button, type BadgeProps } from "./ui/primitives";
import { Tooltip } from "./ui/overlays";

/**
 * Componentes compartidos entre secciones.
 *
 * Criterio de vocabulario: todo texto visible sale de `entityLabels.ts`, no se
 * escribe suelto acá. Así el glosario oficial en español queda en un solo lugar
 * y los componentes siguen nombrados en inglés genérico.
 */

// -----------------------------------------------------------------------------
// Encabezado de página
// -----------------------------------------------------------------------------

export const PageHeader = ({
  eyebrow,
  titulo,
  descripcion,
  acciones,
}: {
  eyebrow?: string;
  titulo: string;
  descripcion?: string;
  acciones?: ReactNode;
}) => (
  <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div className="space-y-1">
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h1 className="font-display text-xl font-bold tracking-tight sm:text-2xl">
        {titulo}
      </h1>
      {descripcion ? (
        <p className="max-w-2xl text-sm texto-suave">{descripcion}</p>
      ) : null}
    </div>
    {acciones ? (
      <div className="flex flex-wrap items-center gap-2">{acciones}</div>
    ) : null}
  </header>
);

// -----------------------------------------------------------------------------
// Identificadores técnicos
// -----------------------------------------------------------------------------

/**
 * Identificador copiable (ID de Cuenta en el proveedor, DNI de alta, ID de
 * dispositivo, MAC).
 *
 * Van en monoespaciada y con botón de copiar porque su uso real es dictarlos por
 * teléfono a soporte de SENSA o pegarlos en un ticket. Es el detalle que más se
 * agradece cuando se trabaja con esto todos los días.
 */
export const CopyableId = ({
  valor,
  etiqueta,
  className,
  mono = true,
}: {
  valor?: string | null;
  etiqueta?: string;
  className?: string;
  mono?: boolean;
}) => {
  const [copiado, setCopiado] = useState(false);

  if (!valor) return <span className="texto-suave">—</span>;

  const copiar = async () => {
    const ok = await copiarAlPortapapeles(valor);
    if (!ok) {
      toast.error("No se pudo copiar. Seleccione el texto y copie a mano.");
      return;
    }
    setCopiado(true);
    toast.success(`${etiqueta ?? "Dato"} copiado`);
    setTimeout(() => setCopiado(false), 1500);
  };

  return (
    <span className={cn("group inline-flex items-center gap-1.5", className)}>
      <span className={mono ? "id-tecnico" : "text-sm"}>{valor}</span>
      <button
        type="button"
        onClick={copiar}
        aria-label={`Copiar ${etiqueta ?? valor}`}
        className="rounded p-0.5 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
      >
        {copiado ? (
          <Check className="size-3.5 text-signal" />
        ) : (
          <Copy className="size-3.5 texto-suave" />
        )}
      </button>
    </span>
  );
};

/**
 * Credencial oculta por defecto (contraseña y PIN de Cuenta).
 *
 * Se muestra tapada y hay que pedir verla. El resguardo definitivo de estos
 * campos (quién puede verlos, si se registra cada consulta) sigue pendiente de
 * definición con Federico — docs/05_Decisiones_Pendientes.md, sección 3 —, así
 * que por ahora la interfaz al menos evita exponerlos de casualidad en pantalla
 * frente a otra persona.
 */
export const SecretValue = ({
  valor,
  etiqueta,
}: {
  valor?: string | null;
  etiqueta: string;
}) => {
  const [visible, setVisible] = useState(false);

  if (!valor) return <span className="texto-suave">—</span>;

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="id-tecnico">
        {visible ? valor : "•".repeat(Math.min(valor.length, 10))}
      </span>
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? `Ocultar ${etiqueta}` : `Mostrar ${etiqueta}`}
        className="rounded p-0.5"
      >
        {visible ? (
          <EyeOff className="size-3.5 texto-suave" />
        ) : (
          <Eye className="size-3.5 texto-suave" />
        )}
      </button>
      {visible ? (
        <CopyableId
          valor={valor}
          etiqueta={etiqueta}
          className="[&>span]:sr-only"
        />
      ) : null}
    </span>
  );
};

// -----------------------------------------------------------------------------
// Estados
// -----------------------------------------------------------------------------

const tonoPorEstado: Record<string, BadgeProps["tone"]> = {
  // Cuenta / Empresa Revendedora
  activa: "success",
  cerrada: "neutral",
  suspendida: "warning",
  // Cliente Final / Dispositivo
  activo: "success",
  suspendido: "warning",
  dado_de_baja: "neutral",
  bloqueado_por_suspension: "warning",
  disponible: "info",
  pendiente: "info",
  observando: "info",
  vinculado: "success",
  ambiguo: "warning",
  expirado: "danger",
  cancelado: "neutral",
  reserva_tecnica: "neutral",
  desconocido: "danger",
  // Team Member
  invitado: "info",
  inactivo: "neutral",
};

export const AccountStatusBadge = ({ estado }: { estado: string }) => (
  <Badge tone={tonoPorEstado[estado] ?? "neutral"}>
    {traducir(accountStatusLabels, estado)}
  </Badge>
);

export const CustomerStatusBadge = ({ estado }: { estado: string }) => (
  <Badge tone={tonoPorEstado[estado] ?? "neutral"}>
    {traducir(customerStatusLabels, estado)}
  </Badge>
);

export const ResellerStatusBadge = ({ estado }: { estado: string }) => (
  <Badge tone={tonoPorEstado[estado] ?? "neutral"}>
    {traducir(resellerStatusLabels, estado)}
  </Badge>
);

export const TeamMemberStatusBadge = ({ estado }: { estado: string }) => (
  <Badge tone={tonoPorEstado[estado] ?? "neutral"}>
    {traducir(teamMemberStatusLabels, estado)}
  </Badge>
);

/**
 * Estado de Dispositivo con su explicación al costado.
 * "Bloqueado" es el estado que más consultas genera, así que la ayuda va pegada.
 */
export const DeviceStatusBadge = ({
  estado,
  vinculacion,
}: {
  estado: string;
  vinculacion?: string;
}) => {
  const mostrarVinculacion =
    estado === "activo" && vinculacion && vinculacion !== "vinculado";
  const clave = mostrarVinculacion ? vinculacion : estado;
  const etiqueta = mostrarVinculacion
    ? traducir(deviceBindingLabels, vinculacion)
    : traducir(deviceStatusLabels, estado);
  const ayuda = mostrarVinculacion
    ? (deviceBindingHelp[vinculacion] ?? etiqueta)
    : (deviceStatusHelp[estado] ?? etiqueta);
  return (
    <Tooltip contenido={ayuda}>
      <span>
        <Badge tone={tonoPorEstado[clave] ?? "neutral"}>{etiqueta}</Badge>
      </span>
    </Tooltip>
  );
};

export const DeviceTypeBadge = ({ tipo }: { tipo: string | null }) => (
  <Badge tone="neutral">{traducir(deviceTypeLabels, tipo)}</Badge>
);

/**
 * Clasificación de un Dispositivo tal como lo reporta el Proveedor al
 * sincronizar una Cuenta: vendido, reserva técnica, o no autorizado.
 */
export const ProviderDeviceClassBadge = ({
  clasificacion,
}: {
  clasificacion: string;
}) => (
  <Tooltip contenido={providerDeviceClassHelp[clasificacion] ?? clasificacion}>
    <span>
      <Badge tone={tonoPorEstado[clasificacion] ?? "neutral"}>
        {traducir(providerDeviceClassLabels, clasificacion)}
      </Badge>
    </span>
  </Tooltip>
);

/** Semáforo de la salud de la integración con el proveedor. */
export const HealthBadge = ({ estado }: { estado: string }) => {
  const tonos: Record<string, BadgeProps["tone"]> = {
    ok: "success",
    atencion: "warning",
    critico: "danger",
  };
  return (
    <Badge tone={tonos[estado] ?? "neutral"}>
      <span
        className={cn(
          "size-1.5 rounded-full",
          estado === "ok" && "bg-signal",
          estado === "atencion" && "bg-warn",
          estado === "critico" && "bg-alert",
        )}
      />
      {traducir(healthStatusLabels, estado)}
    </Badge>
  );
};

// -----------------------------------------------------------------------------
// Métricas
// -----------------------------------------------------------------------------

/**
 * Métrica del dashboard.
 *
 * Se evita a propósito el "número gigante con etiqueta chica y degradado": el
 * valor va grande pero la etiqueta arriba en mono, para que la lectura sea
 * "qué es" antes que "cuánto".
 */
export const Metric = ({
  etiqueta,
  valor,
  detalle,
  tono,
  icono,
}: {
  etiqueta: string;
  valor: ReactNode;
  detalle?: string;
  tono?: "azure" | "signal" | "warn" | "alert";
  icono?: ReactNode;
}) => (
  <div className="superficie rounded-lg border p-4 shadow-card">
    <div className="flex items-start justify-between gap-2">
      <p className="eyebrow">{etiqueta}</p>
      {icono ? <span className="texto-suave">{icono}</span> : null}
    </div>
    <p
      className={cn(
        "mt-2 font-display text-2xl font-bold tabular-nums",
        tono === "azure" && "text-azure-600 dark:text-azure-400",
        tono === "signal" && "text-signal",
        tono === "warn" && "text-warn",
        tono === "alert" && "text-alert",
      )}
    >
      {valor}
    </p>
    {detalle ? <p className="mt-1 text-xs texto-suave">{detalle}</p> : null}
  </div>
);

/** Par etiqueta/valor para las vistas de detalle. */
export const DetailRow = ({
  etiqueta,
  children,
  className,
}: {
  etiqueta: string;
  children: ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      "flex flex-col gap-0.5 py-2 sm:flex-row sm:items-center sm:gap-4",
      className,
    )}
  >
    <dt className="eyebrow sm:w-56 sm:shrink-0">{etiqueta}</dt>
    <dd className="text-sm">{children}</dd>
  </div>
);

/** Botón de exportación a CSV, con estado de descarga. */
export const ExportCsvButton = ({
  onExportar,
  etiqueta = "Exportar CSV",
}: {
  onExportar: () => Promise<void>;
  etiqueta?: string;
}) => {
  const [descargando, setDescargando] = useState(false);

  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={descargando}
      onClick={async () => {
        setDescargando(true);
        try {
          await onExportar();
        } catch {
          toast.error("No se pudo generar el archivo. Intente nuevamente.");
        } finally {
          setDescargando(false);
        }
      }}
    >
      {descargando ? "Generando…" : etiqueta}
    </Button>
  );
};

/**
 * Aviso de ventana de vinculación en curso (hasta 10 min desde el alta,
 * SENSA se revisa cada 30 s).
 *
 * Se agrega porque el único aviso que existía era un toast que dura unos
 * segundos y se pierde si la persona navega rápido: sin esto, es fácil
 * asumir apresuradamente que algo falló al primer minuto sin ver el equipo
 * vinculado (caso reportado 25/08/2026).
 */
export const VinculacionEnCursoAlert = ({ expiraEn }: { expiraEn: string }) => {
  const expira = new Date(expiraEn);
  const minutosRestantes = Math.max(
    0,
    Math.round((expira.getTime() - Date.now()) / 60_000),
  );
  const hora = expira.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Alert tone="info" titulo="Esperando que el equipo se conecte">
      Estamos revisando cada 30 segundos si ya inició sesión en el proveedor con las
      credenciales de esta cuenta. Puede tardar hasta 10 minutos desde el alta — todavía
      no significa que algo esté mal.{" "}
      {minutosRestantes > 0
        ? `Si no detecta nada, esta ventana vence a las ${hora} (dentro de ${minutosRestantes} min).`
        : `Está por vencer (${hora}).`}
    </Alert>
  );
};
