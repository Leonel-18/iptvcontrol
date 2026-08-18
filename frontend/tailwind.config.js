/**
 * Sistema de diseño de IPTVControl.
 *
 * Los colores salen del logo definitivo (branding/logo_iptvcontrol.png):
 * la nube y el botón de play en azul azure, el isotipo y el lettering "IPTV" en
 * azul-negro, y el tagline en gris. No se inventó una paleta nueva: se leyó la
 * que ya existe.
 *
 *   azure  #1E88E5  → acción primaria, foco, dato activo
 *   navy   #0F1B2D  → tinta en modo claro / fondo en modo oscuro
 *   slate  #5B6B7F  → texto secundario (el gris del tagline)
 *   signal #17B26A / warn #E8A93A / alert #E5484D → semáforo de estados
 *
 * Tipografías:
 *   Archivo        → títulos (grotesca técnica, ancha, cercana al lettering)
 *   IBM Plex Sans  → interfaz y tablas densas
 *   IBM Plex Mono  → TODOS los identificadores técnicos (DNI de alta, ID de
 *                    Cuenta en el proveedor, MAC, PIN, contraseña). Es la
 *                    decisión de diseño más deliberada del panel: son datos que
 *                    la gente lee en voz alta por teléfono y copia y pega en
 *                    soporte, así que se leen en monoespaciada con cifras
 *                    tabulares en lugar de perderse dentro de un párrafo.
 */
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        azure: {
          50: '#EFF7FE',
          100: '#D9ECFD',
          200: '#B4D9FA',
          300: '#7FBEF6',
          400: '#4BA2F0',
          500: '#1E88E5',
          600: '#136DC2',
          700: '#11569B',
          800: '#134A80',
          900: '#143F6B',
        },
        navy: {
          50: '#F4F6F9',
          100: '#E6EAF1',
          200: '#C9D2E0',
          300: '#9EACC3',
          400: '#6B7C99',
          500: '#4A5B77',
          600: '#33445E',
          700: '#22314A',
          800: '#16233A',
          900: '#0F1B2D',
          950: '#0A1220',
        },
        slate2: '#5B6B7F',
        signal: '#17B26A',
        warn: '#E8A93A',
        alert: '#E5484D',
      },
      fontFamily: {
        display: ['Archivo', 'Segoe UI', 'system-ui', 'sans-serif'],
        sans: ['"IBM Plex Sans"', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'Consolas', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        // Escala compacta: es un panel de trabajo, no una landing.
        '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.04em' }],
      },
      borderRadius: {
        DEFAULT: '6px',
        lg: '8px',
        xl: '12px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 27, 45, 0.06), 0 1px 3px rgba(15, 27, 45, 0.04)',
        pop: '0 8px 24px rgba(15, 27, 45, 0.16)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in': {
          from: { opacity: '0', transform: 'translateX(-8px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 160ms ease-out',
        'slide-in': 'slide-in 160ms ease-out',
      },
    },
  },
  plugins: [],
};
