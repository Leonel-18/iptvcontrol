import { generarCsv } from './csv.util';

/**
 * Tests de la exportación a CSV (docs/03_Reglas_de_Negocio.md, sección 13).
 * El archivo lo abre una persona en Excel para conciliar con su CRM, así que el
 * formato importa tanto como el contenido.
 */
describe('generarCsv', () => {
  interface Fila {
    nombre: string;
    numero: number | null;
    nota?: string;
  }

  const columnas = [
    { encabezado: 'Nombre', valor: (fila: Fila) => fila.nombre },
    { encabezado: 'Número', valor: (fila: Fila) => fila.numero },
    { encabezado: 'Nota', valor: (fila: Fila) => fila.nota },
  ];

  it('arranca con BOM UTF-8 para que Excel muestre bien los acentos', () => {
    const csv = generarCsv([{ nombre: 'Pérez', numero: 1 }], columnas);
    expect(csv.startsWith('\uFEFF')).toBe(true);
  });

  it('usa punto y coma como separador (Excel en español)', () => {
    const csv = generarCsv([{ nombre: 'Juan', numero: 7 }], columnas);
    expect(csv).toContain('Nombre;Número;Nota');
    expect(csv).toContain('Juan;7;');
  });

  it('escapa comillas, punto y coma y saltos de línea', () => {
    const csv = generarCsv(
      [{ nombre: 'Casa "grande"; con nota', numero: 1, nota: 'linea1\nlinea2' }],
      columnas,
    );

    expect(csv).toContain('"Casa ""grande""; con nota"');
    expect(csv).toContain('"linea1\nlinea2"');
  });

  it('neutraliza la inyección de fórmulas', () => {
    // Un CSV con "=1+1" ejecutado en Excel es un vector de ataque real: si la
    // Empresa Revendedora cargó eso como nota, no debe ejecutarse.
    const csv = generarCsv(
      [
        { nombre: '=1+1', numero: 1 },
        { nombre: '@SUM(A1)', numero: 2 },
        { nombre: '-2+3', numero: 3 },
        { nombre: '+cmd', numero: 4 },
      ],
      columnas,
    );

    expect(csv).toContain("'=1+1");
    expect(csv).toContain("'@SUM(A1)");
    expect(csv).toContain("'-2+3");
    expect(csv).toContain("'+cmd");
  });

  it('deja vacíos los valores nulos o ausentes', () => {
    const csv = generarCsv([{ nombre: 'Ana', numero: null }], columnas);
    expect(csv).toContain('Ana;;');
  });

  it('genera sólo el encabezado si no hay filas', () => {
    const csv = generarCsv<Fila>([], columnas);
    expect(csv).toBe('\uFEFFNombre;Número;Nota\r\n');
  });

  it('separa las filas con CRLF', () => {
    const csv = generarCsv(
      [
        { nombre: 'A', numero: 1 },
        { nombre: 'B', numero: 2 },
      ],
      columnas,
    );
    expect(csv.split('\r\n').filter(Boolean)).toHaveLength(3); // encabezado + 2
  });
});
