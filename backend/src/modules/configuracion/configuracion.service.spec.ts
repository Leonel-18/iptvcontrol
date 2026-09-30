import { ConfiguracionService } from './configuracion.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { AuditService } from '../../common/audit/audit.service';
import { RequestContextService } from '../../common/context/request-context.service';
import { ProveedorService } from '../../proveedor/proveedor.service';

const EMPRESA = {
  notifDispositivos: true,
  notifDispositivosFrecuenciaHoras: 24,
  notifVentanaAlta: true,
  notifVentanaAltaDias: [3, 1],
  pruebasHabilitadas: true,
  pruebasAvisosDias: [7, 3, 1],
};

const crearServicio = (opciones: { esOperador?: boolean; empresa?: typeof EMPRESA } = {}) => {
  const empresa = opciones.empresa ?? EMPRESA;
  const empresaUpdate = jest.fn().mockResolvedValue(undefined);
  const tx = {
    empresaRevendedora: {
      findUniqueOrThrow: jest.fn().mockResolvedValue(empresa),
      update: empresaUpdate,
    },
  };
  const prisma = {
    db: { empresaRevendedora: { findUniqueOrThrow: jest.fn().mockResolvedValue(empresa) } },
    transaction: jest.fn().mockImplementation((fn: (t: unknown) => unknown) => fn(tx)),
  } as unknown as PrismaService;
  const audit = {
    registrarEnTx: jest.fn().mockResolvedValue(undefined),
  } as unknown as AuditService;
  const contexto = {
    esOperador: opciones.esOperador ?? false,
    empresaRevendedoraId: opciones.esOperador ? null : 'empresa-1',
  } as unknown as RequestContextService;

  const servicio = new ConfiguracionService(
    prisma,
    {} as CryptoService,
    audit,
    contexto,
    {} as ProveedorService,
  );
  return { servicio, empresaUpdate, audit };
};

describe('ConfiguracionService — notificaciones (HU-N02)', () => {
  it('devuelve las preferencias y los hitos de prueba como referencia', async () => {
    const { servicio } = crearServicio();

    await expect(servicio.obtenerNotificaciones()).resolves.toEqual({
      dispositivos: { habilitados: true, frecuencia_horas: 24 },
      ventana_alta: { habilitados: true, dias: [3, 1] },
      pruebas: { habilitadas: true, dias: [7, 3, 1] },
    });
  });

  it('guarda las preferencias del tenant y las audita', async () => {
    const { servicio, empresaUpdate, audit } = crearServicio();

    await servicio.actualizarNotificaciones({
      dispositivos_habilitados: false,
      dispositivos_frecuencia_horas: 48,
      ventana_alta_habilitados: true,
      ventana_alta_dias: [5, 2],
    });

    expect(empresaUpdate).toHaveBeenCalledWith({
      where: { id: 'empresa-1' },
      data: {
        notifDispositivos: false,
        notifDispositivosFrecuenciaHoras: 48,
        notifVentanaAlta: true,
        notifVentanaAltaDias: [5, 2],
      },
    });
    expect(audit.registrarEnTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        accion: 'cambio_configuracion_notificaciones',
        detalle: expect.objectContaining({ ventana_alta_dias: [5, 2] }),
      }),
    );
  });

  it('reserva la configuración al panel de la Empresa Revendedora', async () => {
    const { servicio } = crearServicio({ esOperador: true });

    await expect(servicio.obtenerNotificaciones()).rejects.toThrow('Empresa Revendedora');
  });
});
