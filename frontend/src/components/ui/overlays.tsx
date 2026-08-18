import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as DropdownPrimitive from '@radix-ui/react-dropdown-menu';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import * as SelectPrimitive from '@radix-ui/react-select';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { Check, ChevronDown, X } from 'lucide-react';
import { forwardRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './primitives';

/**
 * Capas flotantes: diálogos, menús, pestañas, selects, switches y tooltips.
 * Todo sobre Radix, que ya resuelve foco, teclado y lectores de pantalla —
 * detalles que a mano se hacen mal y se notan al operar el panel todo el día.
 */

// -----------------------------------------------------------------------------
// Diálogo
// -----------------------------------------------------------------------------

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export const DialogContent = ({
  children,
  className,
  titulo,
  descripcion,
}: {
  children: ReactNode;
  className?: string;
  titulo: string;
  descripcion?: string;
}) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-navy-950/50 backdrop-blur-[2px]" />
    <DialogPrimitive.Content
      className={cn(
        'superficie fixed left-1/2 top-1/2 z-50 max-h-[92vh] w-[calc(100vw-2rem)] max-w-lg',
        '-translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border shadow-pop',
        'animate-fade-in',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
        <div className="space-y-1">
          <DialogPrimitive.Title className="font-display text-base font-semibold">
            {titulo}
          </DialogPrimitive.Title>
          {descripcion ? (
            <DialogPrimitive.Description className="text-sm texto-suave">
              {descripcion}
            </DialogPrimitive.Description>
          ) : null}
        </div>
        <DialogPrimitive.Close asChild>
          <Button variant="ghost" size="icon" aria-label="Cerrar">
            <X />
          </Button>
        </DialogPrimitive.Close>
      </div>
      <div className="px-5 py-4">{children}</div>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
);

/**
 * Confirmación de acciones sensibles (suspender, dar de baja).
 *
 * El botón repite el verbo de la acción en lugar de un "Aceptar" genérico: la
 * persona tiene que leer qué va a pasar, no confirmar por reflejo.
 */
export const ConfirmDialog = ({
  abierto,
  onCambio,
  titulo,
  descripcion,
  etiquetaConfirmar,
  tono = 'primary',
  cargando,
  onConfirmar,
  children,
}: {
  abierto: boolean;
  onCambio: (abierto: boolean) => void;
  titulo: string;
  descripcion: string;
  etiquetaConfirmar: string;
  tono?: 'primary' | 'danger';
  cargando?: boolean;
  onConfirmar: () => void;
  children?: ReactNode;
}) => (
  <Dialog open={abierto} onOpenChange={onCambio}>
    <DialogContent titulo={titulo} descripcion={descripcion} className="max-w-md">
      {children}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={() => onCambio(false)} disabled={cargando}>
          Cancelar
        </Button>
        <Button variant={tono} onClick={onConfirmar} disabled={cargando}>
          {cargando ? 'Procesando…' : etiquetaConfirmar}
        </Button>
      </div>
    </DialogContent>
  </Dialog>
);

// -----------------------------------------------------------------------------
// Menú desplegable
// -----------------------------------------------------------------------------

export const DropdownMenu = DropdownPrimitive.Root;
export const DropdownMenuTrigger = DropdownPrimitive.Trigger;

export const DropdownMenuContent = ({
  children,
  align = 'end',
}: {
  children: ReactNode;
  align?: 'start' | 'center' | 'end';
}) => (
  <DropdownPrimitive.Portal>
    <DropdownPrimitive.Content
      align={align}
      sideOffset={6}
      className="superficie z-50 min-w-48 overflow-hidden rounded-lg border p-1 shadow-pop animate-fade-in"
    >
      {children}
    </DropdownPrimitive.Content>
  </DropdownPrimitive.Portal>
);

export const DropdownMenuItem = ({
  children,
  onSelect,
  disabled,
  tone,
}: {
  children: ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
  tone?: 'danger';
}) => (
  <DropdownPrimitive.Item
    disabled={disabled}
    onSelect={onSelect}
    className={cn(
      'flex cursor-pointer items-center gap-2 rounded px-2.5 py-2 text-sm outline-none',
      'data-[highlighted]:bg-navy-100 dark:data-[highlighted]:bg-navy-800',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      tone === 'danger' && 'text-alert',
    )}
  >
    {children}
  </DropdownPrimitive.Item>
);

export const DropdownMenuSeparator = () => (
  <DropdownPrimitive.Separator className="my-1 h-px bg-[rgb(var(--borde))]" />
);

export const DropdownMenuLabel = ({ children }: { children: ReactNode }) => (
  <DropdownPrimitive.Label className="px-2.5 py-1.5 font-mono text-2xs uppercase tracking-[0.1em] texto-suave">
    {children}
  </DropdownPrimitive.Label>
);

// -----------------------------------------------------------------------------
// Pestañas
// -----------------------------------------------------------------------------

export const Tabs = TabsPrimitive.Root;

export const TabsList = ({ children }: { children: ReactNode }) => (
  <TabsPrimitive.List className="scrollbar-fina flex gap-1 overflow-x-auto border-b">
    {children}
  </TabsPrimitive.List>
);

export const TabsTrigger = ({ value, children }: { value: string; children: ReactNode }) => (
  <TabsPrimitive.Trigger
    value={value}
    className={cn(
      'relative whitespace-nowrap px-3 py-2.5 text-sm font-medium texto-suave transition-colors',
      'hover:text-[rgb(var(--tinta))]',
      'data-[state=active]:text-azure-600 dark:data-[state=active]:text-azure-400',
      'after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-transparent',
      'data-[state=active]:after:bg-azure-500',
    )}
  >
    {children}
  </TabsPrimitive.Trigger>
);

export const TabsContent = ({ value, children }: { value: string; children: ReactNode }) => (
  <TabsPrimitive.Content value={value} className="pt-4 animate-fade-in">
    {children}
  </TabsPrimitive.Content>
);

// -----------------------------------------------------------------------------
// Select
// -----------------------------------------------------------------------------

export interface OpcionSelect {
  value: string;
  label: string;
  help?: string;
}

export const Select = ({
  value,
  onChange,
  opciones,
  placeholder = 'Seleccione…',
  id,
  className,
  disabled,
}: {
  value?: string;
  onChange: (valor: string) => void;
  opciones: OpcionSelect[];
  placeholder?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
}) => (
  <SelectPrimitive.Root value={value} onValueChange={onChange} disabled={disabled}>
    <SelectPrimitive.Trigger
      id={id}
      className={cn(
        'superficie flex h-9 w-full items-center justify-between gap-2 rounded border px-3 text-sm',
        'disabled:opacity-60 data-[placeholder]:text-navy-400',
        className,
      )}
    >
      <SelectPrimitive.Value placeholder={placeholder} />
      <SelectPrimitive.Icon>
        <ChevronDown className="size-4 texto-suave" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        position="popper"
        sideOffset={4}
        className="superficie z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border p-1 shadow-pop"
      >
        <SelectPrimitive.Viewport>
          {opciones.map((opcion) => (
            <SelectPrimitive.Item
              key={opcion.value}
              value={opcion.value}
              className={cn(
                'flex cursor-pointer flex-col gap-0.5 rounded px-2.5 py-2 text-sm outline-none',
                'data-[highlighted]:bg-navy-100 dark:data-[highlighted]:bg-navy-800',
              )}
            >
              <span className="flex items-center gap-2">
                <SelectPrimitive.ItemText>{opcion.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator>
                  <Check className="size-3.5 text-azure-500" />
                </SelectPrimitive.ItemIndicator>
              </span>
              {opcion.help ? <span className="text-xs texto-suave">{opcion.help}</span> : null}
            </SelectPrimitive.Item>
          ))}
        </SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  </SelectPrimitive.Root>
);

// -----------------------------------------------------------------------------
// Switch
// -----------------------------------------------------------------------------

export const Switch = forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      'peer inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-transparent transition-colors',
      'data-[state=checked]:bg-azure-500 data-[state=unchecked]:bg-navy-200 dark:data-[state=unchecked]:bg-navy-700',
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb className="pointer-events-none block size-4 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0" />
  </SwitchPrimitive.Root>
));
Switch.displayName = 'Switch';

// -----------------------------------------------------------------------------
// Tooltip
// -----------------------------------------------------------------------------

export const TooltipProvider = TooltipPrimitive.Provider;

export const Tooltip = ({
  children,
  contenido,
}: {
  children: ReactNode;
  contenido: ReactNode;
}) => (
  <TooltipPrimitive.Root delayDuration={200}>
    <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={6}
        className="z-50 max-w-xs rounded-lg bg-navy-900 px-3 py-2 text-xs text-white shadow-pop dark:bg-navy-800"
      >
        {contenido}
        <TooltipPrimitive.Arrow className="fill-navy-900 dark:fill-navy-800" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  </TooltipPrimitive.Root>
);
