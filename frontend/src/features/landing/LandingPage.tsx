import { useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import {
  ArrowRight,
  Check,
  CircleGauge,
  ContactRound,
  LayoutDashboard,
  LogIn,
  MessageCircle,
  MonitorPlay,
  Moon,
  RadioTower,
  ShieldCheck,
  Sun,
  UsersRound,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTema } from '@/lib/theme';
import { Cargando } from '@/components/layout/Gates';
import './landing.css';

const WHATSAPP_URL =
  'https://wa.me/5492615735355?text=Hola%2C%20quiero%20conocer%20m%C3%A1s%20sobre%20IPTVControl%20y%20c%C3%B3mo%20puede%20ayudarme%20a%20gestionar%20mi%20servicio%20de%20televisi%C3%B3n.';

const Brand = () => (
  <a className="landing-brand" href="#inicio" aria-label="IPTVControl, ir al inicio">
    <span className="landing-brand__mark">
      <img src="/logo_iptvcontrol.png" alt="" width="728" height="616" fetchPriority="high" />
    </span>
    <span>
      <strong translate="no">IPTVControl</strong>
      <small>Monitoreo · Gestión · Control</small>
    </span>
  </a>
);

const ThemeToggle = () => {
  const { tema, alternar } = useTema();

  return (
    <button
      className="landing-icon-button"
      type="button"
      onClick={alternar}
      aria-label={tema === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={tema === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
    >
      {tema === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
    </button>
  );
};

const SignalConsole = () => (
  <div className="signal-console" aria-label="Vista conceptual del control operativo">
    <div className="signal-console__topbar">
      <div className="signal-console__title">
        <RadioTower aria-hidden="true" />
        <span>Estado operativo</span>
      </div>
      <span className="signal-console__live">
        <i aria-hidden="true" /> Operación activa
      </span>
    </div>

    <div className="signal-console__body">
      <div className="signal-console__rail" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <div className="signal-console__nodes">
        <div className="signal-node signal-node--active">
          <span className="signal-node__icon">
            <UsersRound aria-hidden="true" />
          </span>
          <span>
            <small>Clientes</small>
            <strong>Organizados</strong>
          </span>
          <Check aria-hidden="true" />
        </div>
        <div className="signal-node">
          <span className="signal-node__icon">
            <LayoutDashboard aria-hidden="true" />
          </span>
          <span>
            <small>Cuentas</small>
            <strong>Centralizadas</strong>
          </span>
          <Check aria-hidden="true" />
        </div>
        <div className="signal-node">
          <span className="signal-node__icon">
            <MonitorPlay aria-hidden="true" />
          </span>
          <span>
            <small>Dispositivos</small>
            <strong>Supervisados</strong>
          </span>
          <Check aria-hidden="true" />
        </div>
      </div>

      <div className="signal-console__summary">
        <div>
          <span className="signal-console__summary-icon">
            <CircleGauge aria-hidden="true" />
          </span>
          <span>
            <small>Visión general</small>
            <strong>Todo en un mismo panel</strong>
          </span>
        </div>
        <span className="signal-console__status">Sin tareas dispersas</span>
      </div>
    </div>
  </div>
);

const capabilities = [
  {
    icon: UsersRound,
    title: 'Clientes bien organizados',
    text: 'Centralizá altas, estados y datos importantes para encontrar cada cliente sin perder tiempo.',
  },
  {
    icon: MonitorPlay,
    title: 'Dispositivos bajo control',
    text: 'Conocé qué dispositivo está activo, disponible o requiere atención desde una vista clara.',
  },
  {
    icon: CircleGauge,
    title: 'Operación visible',
    text: 'Consultá el estado general del servicio y anticipá necesidades antes de que se conviertan en problemas.',
  },
  {
    icon: ShieldCheck,
    title: 'Gestión con trazabilidad',
    text: 'Mantené un registro ordenado de los cambios importantes para operar con mayor seguridad.',
  },
];

const steps = [
  {
    label: 'Alta guiada',
    text: 'Cargá la información necesaria con un proceso simple y ordenado.',
  },
  {
    label: 'Asignación clara',
    text: 'Relacioná cada cliente con sus cuentas y dispositivos sin planillas paralelas.',
  },
  {
    label: 'Seguimiento diario',
    text: 'Consultá estados, capacidad y movimientos desde un único centro de trabajo.',
  },
];

export const LandingPage = () => {
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

  // Mientras Auth0 todavía está resolviendo el regreso del login (parseando el
  // token en la URL), `isAuthenticated` todavía es `false` por un instante: si
  // se dibuja la landing pública en ese momento, se ve un flash antes de que
  // el efecto de arriba redirija a `/dashboard`. Se evita no renderizando el
  // contenido público hasta que Auth0 termine de decidir.
  if (isLoading || isAuthenticated) {
    return <Cargando mensaje="Verificando su sesión…" />;
  }

  const iniciarSesion = () => {
    if (isAuthenticated) {
      navigate('/dashboard');
      return;
    }

    void loginWithRedirect({ appState: { returnTo: '/dashboard' } });
  };

  return (
    <div className="landing-shell" id="inicio">
      <a className="landing-skip" href="#contenido-principal">
        Saltar al contenido principal
      </a>

      <header className="landing-header">
        <div className="landing-container landing-header__inner">
          <Brand />
          <nav className="landing-nav" aria-label="Navegación principal">
            <a href="#producto">Qué resuelve</a>
            <a href="#operacion">Cómo funciona</a>
            <a href="#contacto">Contacto</a>
          </nav>
          <div className="landing-header__actions">
            <ThemeToggle />
            <button
              className="landing-login"
              type="button"
              onClick={iniciarSesion}
              disabled={isLoading}
            >
              <LogIn aria-hidden="true" />
              <span>{isLoading ? 'Verificando…' : 'Iniciar sesión'}</span>
            </button>
          </div>
        </div>
      </header>

      <main id="contenido-principal">
        <section className="landing-hero" aria-labelledby="titulo-principal">
          <div className="landing-container landing-hero__grid">
            <div className="landing-hero__copy">
              <p className="landing-kicker">
                <span aria-hidden="true" /> El centro de mando para tu servicio de TV
              </p>
              <h1 id="titulo-principal">
                Tu operación de televisión, <em>bajo control.</em>
              </h1>
              <p className="landing-hero__lead">
                Administrá cuentas, clientes y dispositivos desde un solo lugar. Menos tareas
                manuales, más claridad para operar todos los días.
              </p>
              <div className="landing-hero__actions">
                <a
                  className="landing-button landing-button--primary"
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle aria-hidden="true" />
                  Solicitar información
                  <ArrowRight aria-hidden="true" />
                </a>
                <button
                  className="landing-button landing-button--quiet"
                  type="button"
                  onClick={iniciarSesion}
                  disabled={isLoading}
                >
                  <LogIn aria-hidden="true" />
                  Ingresar al panel
                </button>
              </div>
              <ul className="landing-hero__proof" aria-label="Características principales">
                <li>
                  <Check aria-hidden="true" /> Acceso desde cualquier dispositivo
                </li>
                <li>
                  <Check aria-hidden="true" /> Interfaz clara y responsive
                </li>
              </ul>
            </div>

            <div className="landing-hero__visual">
              <div className="landing-hero__orbit landing-hero__orbit--one" aria-hidden="true" />
              <div className="landing-hero__orbit landing-hero__orbit--two" aria-hidden="true" />
              <SignalConsole />
              <p className="landing-hero__caption">
                <span>01</span> Una sola vista para entender qué está pasando.
              </p>
            </div>
          </div>
        </section>

        <section className="landing-capabilities" id="producto" aria-labelledby="producto-titulo">
          <div className="landing-container">
            <div className="landing-section-heading">
              <p className="landing-kicker">Control que se traduce en trabajo simple</p>
              <h2 id="producto-titulo">Una operación clara, incluso cuando crece.</h2>
              <p>
                IPTVControl reúne las tareas centrales de tu servicio de televisión para que el
                equipo trabaje con información consistente y siempre disponible.
              </p>
            </div>

            <div className="landing-capability-grid">
              {capabilities.map(({ icon: Icon, title, text }) => (
                <article className="landing-capability" key={title}>
                  <span className="landing-capability__icon">
                    <Icon aria-hidden="true" />
                  </span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-workflow" id="operacion" aria-labelledby="operacion-titulo">
          <div className="landing-container landing-workflow__grid">
            <div className="landing-workflow__intro">
              <p className="landing-kicker">Del alta al seguimiento</p>
              <h2 id="operacion-titulo">Cada movimiento sigue un recorrido visible.</h2>
              <p>
                El sistema acompaña el trabajo cotidiano con pasos concretos. El equipo sabe qué
                hacer, dónde mirar y qué cambió.
              </p>
              <a className="landing-text-link" href="#contacto">
                Conversemos sobre tu operación <ArrowRight aria-hidden="true" />
              </a>
            </div>

            <ol className="landing-steps">
              {steps.map((step, index) => (
                <li key={step.label}>
                  <span className="landing-step__number">0{index + 1}</span>
                  <span className="landing-step__line" aria-hidden="true" />
                  <div>
                    <h3>{step.label}</h3>
                    <p>{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="landing-contact" id="contacto" aria-labelledby="contacto-titulo">
          <div className="landing-container">
            <div className="landing-contact__panel">
              <span className="landing-contact__icon">
                <ContactRound aria-hidden="true" />
              </span>
              <div>
                <p className="landing-kicker">Contacto directo</p>
                <h2 id="contacto-titulo">¿Querés ordenar la gestión de tu servicio?</h2>
                <p>
                  Contanos cómo trabajás hoy. Te mostramos cómo IPTVControl puede acompañar tu
                  operación cotidiana.
                </p>
              </div>
              <a
                className="landing-button landing-button--light"
                href={WHATSAPP_URL}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle aria-hidden="true" />
                Escribir por WhatsApp
                <ArrowRight aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-container landing-footer__inner">
          <Brand />
          <p>Gestión simple para servicios de televisión.</p>
          <div className="landing-footer__links">
            <a href="#producto">Producto</a>
            <a href="#contacto">Contacto</a>
            <button type="button" onClick={iniciarSesion}>
              Iniciar sesión
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
