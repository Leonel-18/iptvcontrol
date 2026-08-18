import { Slot } from '@radix-ui/react-slot';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * =============================================================================
 * Primitivos de interfaz (patrón shadcn/ui: Radix + Tailwind, sin librería de
 * componentes cerrada)
 * =============================================================================
 * Radios de 6px, bordes de un pixel y superficies planas. La única concesión al
 * color fuerte es el azure del logo en la acción primaria y en el foco: en un
 * panel de trabajo, el color tiene que señalar dónde actuar, no decorar.
 */

// -----------------------------------------------------------------------------
// Botón
// -----------------------------------------------------------------------------

const botonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded font-medium ' +
    'transition-colors disabled:pointer-events-none disabled:opacity-50 ' +
    '[&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-azure-500 text-white hover:bg-azure-600 active:bg-azure-700',
        secondary:
          'superficie border text-[rgb(var(--tinta))] hover:bg-navy-50 dark:hover:bg-navy-800',
        ghost: 'text-[rgb(var(--tinta))] hover:bg-navy-100 dark:hover:bg-navy-800',
        danger: 'bg-alert text-white hover:brightness-95',
        link: 'text-azure-600 underline-offset-4 hover:underline dark:text-azure-400',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-9 px-4 text-sm',
        lg: 'h-11 px-5 text-base',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
);

export interface BotonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof botonVariants> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, BotonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Componente = asChild ? Slot : 'button';
    return (
      <Componente
        ref={ref}
        className={cn(botonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

// -----------------------------------------------------------------------------
// Tarjeta
// -----------------------------------------------------------------------------

export const Card = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('superficie rounded-lg border shadow-card', className)} {...props} />
);

export const CardHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col gap-1 border-b px-5 py-4', className)} {...props} />
);

export const CardTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h2 className={cn('font-display text-base font-semibold tracking-tight', className)} {...props} />
);

export const CardDescription = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn('text-sm texto-suave', className)} {...props} />
);

export const CardContent = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('px-5 py-4', className)} {...props} />
);

export const CardFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex items-center gap-2 border-t px-5 py-3 superficie-2', className)}
    {...props}
  />
);

// -----------------------------------------------------------------------------
// Badge / etiqueta de estado
// -----------------------------------------------------------------------------

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium',
  {
    variants: {
      tone: {
        neutral: 'border-navy-200 bg-navy-50 text-navy-700 dark:border-navy-700 dark:bg-navy-800 dark:text-navy-200',
        info: 'border-azure-200 bg-azure-50 text-azure-700 dark:border-azure-800 dark:bg-azure-900/40 dark:text-azure-200',
        success: 'border-[#B7E9CE] bg-[#E9F9F0] text-[#0E7A48] dark:border-[#17B26A]/40 dark:bg-[#17B26A]/15 dark:text-[#6EE7B0]',
        warning: 'border-[#F3DCA8] bg-[#FDF5E4] text-[#8A5B0B] dark:border-warn/40 dark:bg-warn/15 dark:text-[#F5D08A]',
        danger: 'border-[#F5C2C4] bg-[#FDECEC] text-[#A22025] dark:border-alert/40 dark:bg-alert/15 dark:text-[#F5A3A6]',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge = ({ className, tone, ...props }: BadgeProps) => (
  <span className={cn(badgeVariants({ tone }), className)} {...props} />
);

// -----------------------------------------------------------------------------
// Campos de formulario
// -----------------------------------------------------------------------------

export const Label = forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn('text-sm font-medium leading-none', className)}
    {...props}
  />
));
Label.displayName = 'Label';

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'superficie h-9 w-full rounded border px-3 text-sm placeholder:text-navy-400',
        'disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'superficie min-h-20 w-full rounded border px-3 py-2 text-sm placeholder:text-navy-400',
      className,
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

/** Campo con etiqueta, ayuda y error. Unifica el layout de todos los formularios. */
export const Field = ({
  label,
  htmlFor,
  help,
  error,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  help?: ReactNode;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) => (
  <div className={cn('space-y-1.5', className)}>
    <Label htmlFor={htmlFor}>
      {label}
      {required ? <span className="ml-1 text-alert">*</span> : null}
    </Label>
    {children}
    {help && !error ? <p className="text-xs texto-suave">{help}</p> : null}
    {error ? (
      <p className="text-xs font-medium text-alert" role="alert">
        {error}
      </p>
    ) : null}
  </div>
);

// -----------------------------------------------------------------------------
// Varios
// -----------------------------------------------------------------------------

export const Skeleton = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('animate-pulse rounded bg-navy-100 dark:bg-navy-800', className)}
    {...props}
  />
);

export const Separator = ({ className }: { className?: string }) => (
  <div className={cn('h-px w-full bg-[rgb(var(--borde))]', className)} role="separator" />
);

/**
 * Estado vacío. Se trata como una invitación a actuar, no como un cartel de
 * "no hay nada": siempre dice qué hacer a continuación.
 */
export const EmptyState = ({
  titulo,
  descripcion,
  accion,
  icono,
}: {
  titulo: string;
  descripcion: string;
  accion?: ReactNode;
  icono?: ReactNode;
}) => (
  <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
    {icono ? <div className="text-navy-300 dark:text-navy-600">{icono}</div> : null}
    <div className="space-y-1">
      <p className="font-display text-base font-semibold">{titulo}</p>
      <p className="mx-auto max-w-md text-sm texto-suave">{descripcion}</p>
    </div>
    {accion}
  </div>
);

/**
 * Aviso en bloque. `tone` sigue el mismo semáforo que los badges, así el
 * vocabulario visual es uno solo en todo el panel.
 */
export const Alert = ({
  tone = 'info',
  titulo,
  children,
  className,
}: {
  tone?: 'info' | 'warning' | 'danger' | 'success';
  titulo?: string;
  children?: ReactNode;
  className?: string;
}) => {
  const tonos = {
    info: 'border-azure-200 bg-azure-50 text-azure-900 dark:border-azure-800 dark:bg-azure-900/30 dark:text-azure-100',
    warning: 'border-[#F3DCA8] bg-[#FDF5E4] text-[#6B4708] dark:border-warn/40 dark:bg-warn/10 dark:text-[#F5D08A]',
    danger: 'border-[#F5C2C4] bg-[#FDECEC] text-[#8B1B20] dark:border-alert/40 dark:bg-alert/10 dark:text-[#F5A3A6]',
    success: 'border-[#B7E9CE] bg-[#E9F9F0] text-[#0B5F38] dark:border-signal/40 dark:bg-signal/10 dark:text-[#6EE7B0]',
  } as const;

  return (
    <div className={cn('rounded-lg border px-4 py-3 text-sm', tonos[tone], className)}>
      {titulo ? <p className="mb-0.5 font-semibold">{titulo}</p> : null}
      {children}
    </div>
  );
};
