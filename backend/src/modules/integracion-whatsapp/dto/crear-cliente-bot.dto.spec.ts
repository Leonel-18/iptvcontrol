import { TipoAltaClienteFinal } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CrearClienteBotDto } from './crear-cliente-bot.dto';

/**
 * Los flujos de mensajería mandan las variables vacías como `""`. Para los
 * campos opcionales debe equivaler a "no enviado" (undefined), no a un error de
 * validación.
 */
describe('CrearClienteBotDto', () => {
  const base = {
    nombre: 'Juan',
    dni: '30123456',
    tipo_alta: TipoAltaClienteFinal.cuenta_exclusiva,
  };

  it('convierte los campos opcionales vacíos a undefined y valida sin errores', async () => {
    const dto = plainToInstance(CrearClienteBotDto, {
      ...base,
      apellido: '',
      telefono: '',
      email: '',
      direccion: '',
      id_gestion_externo: '',
    });

    expect(dto.apellido).toBeUndefined();
    expect(dto.email).toBeUndefined();
    expect(dto.id_gestion_externo).toBeUndefined();
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('sigue rechazando un email con formato inválido (no vacío)', async () => {
    const dto = plainToInstance(CrearClienteBotDto, { ...base, email: 'no-es-mail' });

    const errores = await validate(dto);
    expect(errores.some((error) => error.property === 'email')).toBe(true);
  });

  it('sigue exigiendo el DNI', async () => {
    const dto = plainToInstance(CrearClienteBotDto, { ...base, dni: '' });

    const errores = await validate(dto);
    expect(errores.some((error) => error.property === 'dni')).toBe(true);
  });
});
