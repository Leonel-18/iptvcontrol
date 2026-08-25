import { BadRequestException } from '@nestjs/common';
import {
  normalizarServicios,
  serviciosContratados,
  validarServiciosContratados,
} from './servicios.util';

describe('servicios de Cuenta', () => {
  const licencias = {
    compradas: { '1': 10, '3': 5, '5': 0 },
    usadas: { '1': 2, '3': 1 },
  };

  it('agrega el básico y genera una firma estable', () => {
    expect(normalizarServicios(['3', '1', '3'])).toBe('1|3');
  });

  it('resuelve todos los servicios contratados', () => {
    expect(serviciosContratados(licencias)).toBe('1|3');
  });

  it('rechaza una selección no contratada', () => {
    expect(() => validarServiciosContratados('1|5', licencias)).toThrow(BadRequestException);
  });
});
