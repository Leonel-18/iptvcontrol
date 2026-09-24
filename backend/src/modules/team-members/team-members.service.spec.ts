import { BadRequestException } from '@nestjs/common';
import { EstadoTeamMember, RolTeamMember } from '@prisma/client';
import { TeamMembersService } from './team-members.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { RequestContextService } from '../../common/context/request-context.service';
import { Auth0ManagementService } from '../../common/auth/auth0-management.service';

/**
 * Reactivación y baja definitiva de Team Members.
 *
 * Caso real: se dio de baja por error a alguien que todavía no había aceptado la
 * invitación, y al querer darlo de alta de vuelta el email ya existía. Reactivar
 * resuelve ese caso sin borrar nada; la baja definitiva queda para reutilizar el
 * email desde cero.
 */
describe('TeamMembersService — reactivar y baja definitiva', () => {
  const miembroBase = {
    id: 'team-1',
    email: 'persona@isp.com',
    nombre: 'Persona',
    rol: RolTeamMember.reseller_admin,
    estado: EstadoTeamMember.inactivo,
    auth0UserId: 'auth0|abc',
    empresaRevendedoraId: 'empresa-1',
    operadorPrincipalId: null,
    ultimoAccesoEn: null,
  };

  const crearServicio = (miembro: Record<string, unknown> | null = miembroBase) => {
    const tx = {
      teamMember: {
        update: jest.fn().mockResolvedValue(miembro),
        delete: jest.fn().mockResolvedValue(undefined),
      },
    };
    const prisma = {
      db: {
        teamMember: {
          findUnique: jest.fn().mockResolvedValue(miembro),
          count: jest.fn().mockResolvedValue(2),
        },
      },
      transaction: jest.fn().mockImplementation((fn: (t: unknown) => unknown) => fn(tx)),
    } as unknown as PrismaService;

    const audit = { registrarEnTx: jest.fn() } as unknown as AuditService;
    const contexto = { teamMemberId: 'actor-1' } as unknown as RequestContextService;
    const auth0 = {
      habilitado: true,
      desbloquearUsuario: jest.fn().mockResolvedValue(undefined),
      eliminarUsuario: jest.fn().mockResolvedValue(undefined),
      reenviarInvitacion: jest.fn().mockResolvedValue({
        urlInvitacion: 'https://auth0/ticket',
        expiraEnSegundos: 259200,
      }),
    } as unknown as Auth0ManagementService;

    const servicio = new TeamMembersService(prisma, audit, contexto, auth0);
    return { servicio, tx, audit, auth0, prisma };
  };

  describe('reactivar', () => {
    it('si nunca accedió, la deja invitada y genera un link nuevo', async () => {
      const { servicio, tx, auth0 } = crearServicio({ ...miembroBase, ultimoAccesoEn: null });

      const resultado = await servicio.reactivar('team-1');

      expect(tx.teamMember.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { estado: EstadoTeamMember.invitado } }),
      );
      expect(auth0.desbloquearUsuario).toHaveBeenCalledWith('auth0|abc');
      expect(resultado.estado).toBe(EstadoTeamMember.invitado);
      expect(resultado.url_invitacion).toBe('https://auth0/ticket');
    });

    it('si ya había accedido, la deja activa y conserva su contraseña', async () => {
      const { servicio, tx, auth0 } = crearServicio({
        ...miembroBase,
        ultimoAccesoEn: new Date('2026-09-01T10:00:00Z'),
      });

      const resultado = await servicio.reactivar('team-1');

      expect(tx.teamMember.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { estado: EstadoTeamMember.activo } }),
      );
      expect(auth0.desbloquearUsuario).toHaveBeenCalled();
      expect(resultado.estado).toBe(EstadoTeamMember.activo);
      expect(resultado.url_invitacion).toBeUndefined();
    });

    it('rechaza reactivar a alguien que no está dado de baja', async () => {
      const { servicio } = crearServicio({ ...miembroBase, estado: EstadoTeamMember.activo });

      await expect(servicio.reactivar('team-1')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('eliminarDefinitivamente', () => {
    it('borra en Auth0 y en la base a un Team Member invitado', async () => {
      const { servicio, tx, auth0 } = crearServicio({
        ...miembroBase,
        estado: EstadoTeamMember.invitado,
      });

      await servicio.eliminarDefinitivamente('team-1');

      expect(auth0.eliminarUsuario).toHaveBeenCalledWith('auth0|abc');
      expect(tx.teamMember.delete).toHaveBeenCalledWith({ where: { id: 'team-1' } });
    });

    it('rechaza eliminar un acceso activo', async () => {
      const { servicio, auth0 } = crearServicio({
        ...miembroBase,
        estado: EstadoTeamMember.activo,
      });

      await expect(servicio.eliminarDefinitivamente('team-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(auth0.eliminarUsuario).not.toHaveBeenCalled();
    });

    it('no permite eliminarse a sí mismo', async () => {
      const { servicio } = crearServicio({ ...miembroBase, id: 'actor-1' });

      await expect(servicio.eliminarDefinitivamente('actor-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
