import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

type Tema = 'light' | 'dark';

interface ContextoTema {
  tema: Tema;
  alternar: () => void;
}

const CLAVE = 'iptvcontrol:theme';
const TemaContext = createContext<ContextoTema | null>(null);

/**
 * Modo claro y modo oscuro en todos los paneles (requisito transversal,
 * docs/03_Reglas_de_Negocio.md sección 9).
 *
 * La preferencia se guarda en el navegador. El primer render ya llega con la
 * clase aplicada gracias al script inline de index.html, así que no hay
 * destello blanco al entrar en modo oscuro.
 */
export const ProveedorDeTema = ({ children }: { children: ReactNode }) => {
  const [tema, setTema] = useState<Tema>(() => {
    if (typeof document === 'undefined') return 'light';
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', tema === 'dark');
    document.documentElement.style.colorScheme = tema;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', tema === 'dark' ? '#08111F' : '#F4F8FC');
    try {
      localStorage.setItem(CLAVE, tema);
    } catch {
      /* modo privado sin localStorage: la preferencia dura la sesión */
    }
  }, [tema]);

  const alternar = useCallback(() => {
    setTema((actual) => (actual === 'dark' ? 'light' : 'dark'));
  }, []);

  return <TemaContext.Provider value={{ tema, alternar }}>{children}</TemaContext.Provider>;
};

export const useTema = (): ContextoTema => {
  const contexto = useContext(TemaContext);
  if (!contexto) throw new Error('useTema debe usarse dentro de ProveedorDeTema.');
  return contexto;
};
