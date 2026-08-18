import '@testing-library/jest-dom/vitest';

/**
 * Configuración común de los tests del frontend.
 *
 * `matchMedia` no existe en jsdom y el proveedor de tema lo consulta al arrancar,
 * así que se lo simula para que los componentes se puedan montar.
 */
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});
