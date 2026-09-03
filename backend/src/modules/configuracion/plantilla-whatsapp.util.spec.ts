import { BadRequestException } from '@nestjs/common';
import {
  PLANTILLA_DEFAULT_WHATSAPP,
  renderizarPlantilla,
  validarPlantilla,
} from './plantilla-whatsapp.util';

describe('plantilla-whatsapp.util', () => {
  it('acepta tokens conocidos y reporta cuáles se usaron', () => {
    const usados = validarPlantilla('Usuario: {{usuario}}\nClave: {{password}}');
    expect(usados).toEqual(['usuario', 'password']);
  });

  it('rechaza tokens desconocidos', () => {
    expect(() => validarPlantilla('PIN: {{pin}}')).toThrow(BadRequestException);
    expect(() => validarPlantilla('Correo: {{email}}')).toThrow(BadRequestException);
  });

  it('rechaza llaves desbalanceadas', () => {
    expect(() => validarPlantilla('{{usuario sin cerrar')).toThrow(BadRequestException);
    expect(() => validarPlantilla('cierre de más }}')).toThrow(BadRequestException);
  });

  it('la plantilla por defecto sólo usa tokens disponibles', () => {
    const usados = validarPlantilla(PLANTILLA_DEFAULT_WHATSAPP);
    expect(usados).toEqual(['usuario', 'password', 'empresa']);
  });

  it('reemplaza tokens por sus valores y deja intactos los que no vienen', () => {
    const texto = renderizarPlantilla('U: {{usuario}} C: {{password}} S: {{servicios}}', {
      usuario: '30000001',
      password: '12345678',
    });
    expect(texto).toContain('U: 30000001');
    expect(texto).toContain('C: 12345678');
    expect(texto).toContain('{{servicios}}');
  });
});
