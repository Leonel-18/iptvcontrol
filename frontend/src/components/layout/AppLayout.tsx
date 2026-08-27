import {
  Building2,
  ClipboardList,
  Cog,
  CreditCard,
  FileBarChart,
  LayoutDashboard,
  LogOut,
  Menu,
  MonitorPlay,
  Moon,
  Radio,
  Sun,
  Users,
  UsersRound,
  X,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { navLabels } from '@/i18n/entityLabels';
import { useSesion } from '@/lib/session';
import { useTema } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { Button, Separator } from '../ui/primitives';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/overlays';

/**
 * =============================================================================
 * AppLayout — el marco de los dos paneles
 * =============================================================================
 * Es un solo layout para el Operador Principal y para las Empresas Revendedoras.
 * Lo que cambia es el menú, y lo decide el rol de la sesión, no la URL: la misma
 * ruta `/customers` sirve a los dos (multi-tenancy invisible en la URL).
 *
 * Responsive: el panel del Operador Principal es desktop-first, pero el de la
 * Empresa Revendedora tiene que andar 100% en celular, porque los revendedores
 * operan mayormente desde el teléfono. De ahí que el menú lateral se convierta en
 * un panel deslizable y que las acciones principales queden al alcance del pulgar.
 * =============================================================================
 */

interface ItemMenu {
  to: string;
  label: string;
  icono: ReactNode;
  /** Visible sólo para el Operador Principal. */
  soloOperador?: boolean;
}

const ITEMS: ItemMenu[] = [
  { to: '/dashboard', label: navLabels.dashboard, icono: <LayoutDashboard /> },
  { to: '/resellers', label: navLabels.resellers, icono: <Building2 />, soloOperador: true },
  { to: '/accounts', label: navLabels.accounts, icono: <CreditCard /> },
  { to: '/customers', label: navLabels.customers, icono: <Users /> },
  { to: '/devices', label: navLabels.devices, icono: <MonitorPlay /> },
  { to: '/commercial-plans', label: navLabels.commercialPlans, icono: <FileBarChart /> },
  { to: '/reports', label: navLabels.reports, icono: <FileBarChart />, soloOperador: true },
  { to: '/providers', label: navLabels.providers, icono: <Radio />, soloOperador: true },
  { to: '/audit-log', label: navLabels.auditLog, icono: <ClipboardList /> },
  { to: '/team-members', label: navLabels.teamMembers, icono: <UsersRound /> },
  { to: '/settings', label: navLabels.settings, icono: <Cog />, soloOperador: true },
];

const Logo = ({ compacto = false }: { compacto?: boolean }) => (
  <div className="flex items-center gap-2.5">
    <img
      src="/logo_iptvcontrol.png"
      alt="IPTVControl"
      className="size-9 shrink-0 object-contain"
      width={36}
      height={36}
    />
    {!compacto ? (
      <div className="leading-none">
        <p className="font-display text-sm font-bold tracking-tight">IPTVControl</p>
        <p className="mt-0.5 font-mono text-[0.5625rem] uppercase tracking-[0.18em] texto-suave">
          Monitoreo · Gestión · Control
        </p>
      </div>
    ) : null}
  </div>
);

const NavItems = ({ onNavegar }: { onNavegar?: () => void }) => {
  const { esOperador } = useSesion();

  return (
    <nav className="flex flex-col gap-0.5" aria-label="Secciones">
      {ITEMS.filter((item) => !item.soloOperador || esOperador).map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={onNavegar}
          className={({ isActive }) =>
            cn(
              'group relative flex items-center gap-2.5 rounded px-2.5 py-2 text-sm font-medium transition-colors',
              '[&_svg]:size-4 [&_svg]:shrink-0',
              isActive
                ? 'bg-azure-50 text-azure-700 dark:bg-azure-900/40 dark:text-azure-200'
                : 'texto-suave hover:bg-navy-100 hover:text-[rgb(var(--tinta))] dark:hover:bg-navy-800',
            )
          }
        >
          {({ isActive }) => (
            <>
              {/* Marca de activo: una barra azure a la izquierda, del ancho de
                  las barras del isotipo. */}
              <span
                className={cn(
                  'absolute left-0 h-5 w-[3px] rounded-r',
                  isActive ? 'bg-azure-500' : 'bg-transparent',
                )}
              />
              {item.icono}
              <span>{item.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
};

const ThemeToggle = () => {
  const { tema, alternar } = useTema();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={alternar}
      aria-label={tema === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
    >
      {tema === 'dark' ? <Sun /> : <Moon />}
    </Button>
  );
};

const MenuUsuario = () => {
  const { sesion, cerrarSesion, esOperador } = useSesion();

  const nombre = sesion?.nombre || sesion?.email || 'Sesión';
  const iniciales = nombre
    .split(' ')
    .map((parte) => parte[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded border px-2 py-1.5 text-sm hover:bg-navy-50 dark:hover:bg-navy-800"
        >
          <span className="grid size-6 place-items-center rounded-full bg-azure-500 font-mono text-2xs font-semibold text-white">
            {iniciales}
          </span>
          <span className="hidden max-w-[160px] truncate sm:block">{nombre}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>
          {esOperador ? 'Operador Principal' : (sesion?.empresa_revendedora?.razon_social ?? 'Empresa')}
        </DropdownMenuLabel>
        <div className="px-2.5 pb-2 text-xs texto-suave">{sesion?.email}</div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={cerrarSesion}>
          <LogOut className="size-4" />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const AppLayout = () => {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const { sesion, esOperador } = useSesion();

  return (
    <div className="flex min-h-full">
      {/* Menú lateral fijo en desktop */}
      <aside className="superficie hidden w-60 shrink-0 flex-col border-r lg:flex">
        <div className="px-4 py-4">
          <Logo />
        </div>
        <Separator />
        <div className="flex-1 overflow-y-auto px-2 py-3">
          <NavItems />
        </div>
        <div className="px-4 py-3">
          <p className="font-mono text-2xs uppercase tracking-[0.1em] texto-suave">
            {esOperador ? 'Panel del operador' : 'Panel de la empresa'}
          </p>
          <p className="mt-0.5 truncate text-xs texto-suave">
            {esOperador
              ? (sesion?.operador_principal?.nombre ?? '—')
              : (sesion?.empresa_revendedora?.razon_social ?? '—')}
          </p>
        </div>
      </aside>

      {/* Menú deslizable en mobile/tablet */}
      {menuAbierto ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Cerrar menú"
            className="absolute inset-0 bg-navy-950/50"
            onClick={() => setMenuAbierto(false)}
          />
          <div className="superficie animate-slide-in absolute inset-y-0 left-0 flex w-72 flex-col border-r">
            <div className="flex items-center justify-between px-4 py-4">
              <Logo />
              <Button variant="ghost" size="icon" onClick={() => setMenuAbierto(false)}>
                <X />
              </Button>
            </div>
            <Separator />
            <div className="flex-1 overflow-y-auto px-2 py-3">
              <NavItems onNavegar={() => setMenuAbierto(false)} />
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="superficie sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b px-3 sm:px-5">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMenuAbierto(true)}
              aria-label="Abrir menú"
            >
              <Menu />
            </Button>
            <div className="lg:hidden">
              <Logo compacto />
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <MenuUsuario />
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] flex-1 px-3 py-5 sm:px-5 sm:py-6">
          <Outlet />
        </main>

        <footer className="px-3 pb-5 pt-2 text-center sm:px-5">
          <p className="text-2xs texto-suave">IPTVControl</p>
        </footer>
      </div>
    </div>
  );
};
