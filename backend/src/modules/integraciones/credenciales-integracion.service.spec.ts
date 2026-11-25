import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { RequestContextService } from '../../common/context/request-context.service';
import { CredencialesIntegracionService } from './credenciales-integracion.service';

describe('CredencialesIntegracionService — autenticación', () => {
  const crearServicio = (opciones: {
    credencial?: Record<string, unknown> | null;
    envApiKey?: string;
    envEmpresa?: string;
    fallback?: boolean;
  }) => {
    const findUnique = jest.fn().mockResolvedValue(opciones.credencial ?? null);
    const prisma = {
      sinContexto: { integracionCredencial: { findUnique } },
    } as unknown as PrismaService;
    const config = {
      get: jest.fn((clave: string) => {
        if (clave === 'integraciones.fallbackEnv') return opciones.fallback ?? true;
        if (clave === 'whatsappBot.apiKey') return opciones.envApiKey;
        if (clave === 'whatsappBot.empresaRevendedoraId') return opciones.envEmpresa;
        if (clave === 'whatsappBot.teamMemberId') return 'team-1';
        return undefined;
      }),
    } as unknown as ConfigService;
    const servicio = new CredencialesIntegracionService(
      config,
      prisma,
      {} as AuditService,
      {} as RequestContextService,
    );
    return { servicio, findUnique };
  };

  it('resuelve una credencial activa de la base y devuelve su Empresa', async () => {
    const { servicio, findUnique } = crearServicio({
      credencial: {
        id: 'cred-1',
        empresaRevendedoraId: 'empresa-1',
        teamMemberId: 'team-1',
        activa: true,
        revocadoEn: null,
      },
    });

    const resultado = await servicio.autenticar('iptv_key', 'whatsapp_bot');

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { keyHash: expect.stringMatching(/^[0-9a-f]{64}$/) } }),
    );
    expect(resultado).toMatchObject({
      empresaRevendedoraId: 'empresa-1',
      teamMemberId: 'team-1',
      credencialId: 'cred-1',
      origen: 'base',
    });
  });

  it('rechaza una credencial revocada sin caer al fallback del .env', async () => {
    const { servicio } = crearServicio({
      credencial: {
        id: 'cred-1',
        empresaRevendedoraId: 'empresa-1',
        activa: false,
        revocadoEn: new Date(),
      },
      envApiKey: 'env-key',
      envEmpresa: 'empresa-env',
    });

    await expect(servicio.autenticar('env-key', 'whatsapp_bot')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('la misma credencial sirve para cualquier API', async () => {
    const { servicio } = crearServicio({
      credencial: {
        id: 'cred-1',
        empresaRevendedoraId: 'empresa-1',
        activa: true,
        revocadoEn: null,
      },
    });

    await expect(servicio.autenticar('iptv_key', 'portal_cliente')).resolves.toMatchObject({
      empresaRevendedoraId: 'empresa-1',
      credencialId: 'cred-1',
      origen: 'base',
    });
  });

  it('usa las variables de entorno cuando la key no existe en la base', async () => {
    const { servicio } = crearServicio({
      credencial: null,
      envApiKey: 'env-key',
      envEmpresa: 'empresa-env',
      fallback: true,
    });

    await expect(servicio.autenticar('env-key', 'whatsapp_bot')).resolves.toMatchObject({
      empresaRevendedoraId: 'empresa-env',
      teamMemberId: 'team-1',
      credencialId: null,
      origen: 'env',
    });
  });

  it('rechaza el fallback cuando está deshabilitado', async () => {
    const { servicio } = crearServicio({
      credencial: null,
      envApiKey: 'env-key',
      envEmpresa: 'empresa-env',
      fallback: false,
    });

    await expect(servicio.autenticar('env-key', 'whatsapp_bot')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

describe('CredencialesIntegracionService — creación', () => {
  it('genera una key una sola vez y guarda solo su hash', async () => {
    const create = jest.fn().mockImplementation(({ data }) => ({
      id: 'cred-nueva',
      ...data,
      empresaRevendedora: { id: 'empresa-1', razonSocial: 'Empresa 1' },
      teamMember: null,
      ultimoUsoEn: null,
      revocadoEn: null,
      creadoEn: new Date('2026-11-25T12:00:00Z'),
    }));
    const prisma = {
      db: {
        empresaRevendedora: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ id: 'empresa-1', operadorPrincipalId: 'operador-1' }),
        },
        integracionCredencial: { create },
      },
    } as unknown as PrismaService;
    const audit = { registrar: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService;
    const servicio = new CredencialesIntegracionService(
      { get: jest.fn() } as unknown as ConfigService,
      prisma,
      audit,
      { operadorPrincipalId: 'operador-1' } as unknown as RequestContextService,
    );

    const resultado = await servicio.crear({
      empresaRevendedoraId: 'empresa-1',
      nombre: 'Bot producción',
    });

    expect(resultado.api_key).toMatch(/^iptv_[0-9a-f]{64}$/);
    expect(resultado.credencial.prefijo).toHaveLength(12);
    const data = create.mock.calls[0][0].data;
    expect(data.keyHash).toMatch(/^[0-9a-f]{64}$/);
    expect(data.keyHash).not.toContain(resultado.api_key);
  });
});
