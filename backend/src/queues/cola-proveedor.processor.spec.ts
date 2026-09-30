import { EstadoCuenta, EstadoDispositivo, EstadoSolicitudVinculacion } from '@prisma/client';
import { ColaProveedorProcessor } from './cola-proveedor.processor';
import { TRABAJOS_PROVEEDOR } from './cola-proveedor.constants';
import { PrismaService } from '../common/prisma/prisma.service';
import { ProveedorService } from '../proveedor/proveedor.service';
import { AuditService } from '../common/audit/audit.service';
import { ColaProveedorService } from './cola-proveedor.service';
import { CuentasProvisioningService } from '../modules/cuentas/cuentas-provisioning.service';
import { NotificacionesService } from '../modules/notificaciones/notificaciones.service';

/**
 * =============================================================================
 * Casos reales: Usuario 131 y limpieza de filas vacías (24/08/2026)
 * =============================================================================
 * Cuenta exclusiva, ventana de vinculación vencida sin ningún candidato
 * detectado (el equipo se conectó a SENSA recién después de los 10 minutos).
 * Antes, al vencer, se borraba también el Cliente Final del Dispositivo — el
 * sistema "olvidaba" que la Cuenta ya tenía dueño y el próximo alta creaba una
 * Cuenta nueva. Este test fija que, en una Cuenta exclusiva, el vínculo se
 * preserva (la fila "disponible" queda como marcador de dueño); en una
 * compartida, la fila "fantasma" se borra (nunca tuvo MAC ni
 * proveedor_device_id), pero la venta 1+1/2+2 NO se cancela: queda reservada
 * para que el Cliente Final cargue sus Dispositivos más adelante (Fase F).
 * =============================================================================
 */
describe('ColaProveedorProcessor — vencimiento de ventana de vinculación', () => {
  const solicitudBase = {
    id: 'solicitud-1',
    dispositivoId: 'dispositivo-1',
    cuentaId: 'cuenta-1',
    empresaRevendedoraId: 'empresa-1',
    estado: EstadoSolicitudVinculacion.observando,
    expiraEn: new Date(Date.now() - 60_000), // ya venció
    creaVentaCompartida: true,
    dispositivo: { clienteFinalId: 'cliente-usuario-131', estadoVinculacion: 'observando' },
  };

  const crearProcesador = (esExclusiva: boolean) => {
    const dispositivoUpdate = jest.fn().mockResolvedValue(undefined);
    const dispositivoDelete = jest.fn().mockResolvedValue(undefined);
    const ventaDeleteMany = jest.fn().mockResolvedValue({ count: 1 });
    const solicitudUpdate = jest.fn().mockResolvedValue(undefined);
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      solicitudVinculacionDispositivo: {
        findUnique: jest.fn().mockResolvedValue({
          ...solicitudBase,
          cuenta: { esExclusiva, proveedorCuentaId: '30000042' },
        }),
        update: solicitudUpdate,
      },
      dispositivo: {
        update: dispositivoUpdate,
        delete: dispositivoDelete,
        count: jest.fn().mockResolvedValue(0),
      },
      ventaCompartida: { deleteMany: ventaDeleteMany },
      ventanaCuriosidad: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };

    const prisma = {
      transactionComoOperador: jest
        .fn()
        .mockImplementation((_op: string, fn: (tx: unknown) => unknown) => fn(tx)),
    } as unknown as PrismaService;

    const provisioning = {
      sincronizarContadoresVenta: jest.fn().mockResolvedValue(undefined),
    } as unknown as CuentasProvisioningService;

    const proveedor = {} as unknown as ProveedorService;
    const audit = {} as unknown as AuditService;
    const cola = {
      encolarSincronizacionContadoresVenta: jest.fn().mockResolvedValue(undefined),
    } as unknown as ColaProveedorService;

    const procesador = new ColaProveedorProcessor(
      prisma,
      proveedor,
      audit,
      cola,
      provisioning,
      {} as NotificacionesService,
    );
    return { procesador, dispositivoUpdate, dispositivoDelete, ventaDeleteMany, provisioning, tx };
  };

  it('preserva el Cliente Final al vencer la ventana de una Cuenta exclusiva (no la borra)', async () => {
    const { procesador, dispositivoUpdate, dispositivoDelete, provisioning } =
      crearProcesador(true);

    await procesador.process({
      name: TRABAJOS_PROVEEDOR.SONDEAR_VINCULACION,
      data: { solicitudId: 'solicitud-1', operadorPrincipalId: 'operador-1', intento: 1 },
    } as never);

    expect(dispositivoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          estado: EstadoDispositivo.disponible,
          clienteFinalId: 'cliente-usuario-131',
        }),
      }),
    );
    expect(dispositivoDelete).not.toHaveBeenCalled();
    // Una Cuenta exclusiva nunca toca los contadores de venta.
    expect(provisioning.sincronizarContadoresVenta).not.toHaveBeenCalled();
  });

  it('borra la fila del Dispositivo al vencer la ventana de una Cuenta compartida (nunca tuvo MAC ni dueño)', async () => {
    const { procesador, dispositivoUpdate, dispositivoDelete, provisioning } =
      crearProcesador(false);

    await procesador.process({
      name: TRABAJOS_PROVEEDOR.SONDEAR_VINCULACION,
      data: { solicitudId: 'solicitud-1', operadorPrincipalId: 'operador-1', intento: 1 },
    } as never);

    expect(dispositivoDelete).toHaveBeenCalledWith({ where: { id: 'dispositivo-1' } });
    expect(dispositivoUpdate).not.toHaveBeenCalled();
    expect(provisioning.sincronizarContadoresVenta).toHaveBeenCalledWith('cuenta-1', 'operador-1');
  });

  it('no libera la venta si sólo vence el intento de agregar un Dispositivo a una venta existente', async () => {
    const { procesador, ventaDeleteMany, tx } = crearProcesador(false);
    tx.solicitudVinculacionDispositivo.findUnique.mockResolvedValue({
      ...solicitudBase,
      creaVentaCompartida: false,
      cuenta: { esExclusiva: false, proveedorCuentaId: '30000042' },
    });

    await procesador.process({
      name: TRABAJOS_PROVEEDOR.SONDEAR_VINCULACION,
      data: { solicitudId: 'solicitud-1', operadorPrincipalId: 'operador-1', intento: 1 },
    } as never);

    expect(ventaDeleteMany).not.toHaveBeenCalled();
  });

  it('Opción A: al vencer una venta nueva compartida sin equipos, la venta conserva su cupo técnico', async () => {
    const { procesador, dispositivoDelete, ventaDeleteMany, tx, provisioning } =
      crearProcesador(false);

    await procesador.process({
      name: TRABAJOS_PROVEEDOR.SONDEAR_VINCULACION,
      data: { solicitudId: 'solicitud-1', operadorPrincipalId: 'operador-1', intento: 1 },
    } as never);

    // La venta reservada NO se borra ni se cierra su Ventana de Alta (vence sola).
    expect(ventaDeleteMany).not.toHaveBeenCalled();
    expect(tx.ventanaCuriosidad.updateMany).not.toHaveBeenCalled();
    // La solicitud expira y la fila "fantasma" se limpia.
    expect(tx.solicitudVinculacionDispositivo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ estado: EstadoSolicitudVinculacion.expirado }),
      }),
    );
    expect(dispositivoDelete).toHaveBeenCalledWith({ where: { id: 'dispositivo-1' } });
    // Se re-sincroniza el contador contra las ventas reales: como la venta se
    // conserva, el cupo técnico reservado queda intacto para el Cliente Final.
    expect(provisioning.sincronizarContadoresVenta).toHaveBeenCalledWith('cuenta-1', 'operador-1');
  });
});

/**
 * HU-A03 — Fin automático del aislamiento de Cuenta por vencimiento. El job sólo
 * cierra las Cuentas que siguen aisladas y vencidas; si otra corrida ya lo hizo,
 * no repite el efecto ni la auditoría (idempotente).
 */
describe('ColaProveedorProcessor — fin automático de aislamiento (HU-A03)', () => {
  const crearProcesador = (
    vencidas: { id: string; empresaRevendedoraId: string }[],
    updateCount = 1,
  ) => {
    const cuentaUpdateMany = jest.fn().mockResolvedValue({ count: updateCount });
    const tx = {
      cuenta: {
        findMany: jest.fn().mockResolvedValue(vencidas),
        updateMany: cuentaUpdateMany,
      },
    };
    const prisma = {
      operadorPrincipal: { findMany: jest.fn().mockResolvedValue([{ id: 'operador-1' }]) },
      transactionComoOperador: jest
        .fn()
        .mockImplementation((_op: string, fn: (t: unknown) => unknown) => fn(tx)),
    } as unknown as PrismaService;
    const audit = {
      registrarEnTx: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;
    const procesador = new ColaProveedorProcessor(
      prisma,
      {} as ProveedorService,
      audit,
      {} as ColaProveedorService,
      {} as CuentasProvisioningService,
      {} as NotificacionesService,
    );
    return { procesador, cuentaUpdateMany, audit };
  };

  const disparar = (procesador: ColaProveedorProcessor) =>
    procesador.process({ name: TRABAJOS_PROVEEDOR.BARRER_AISLAMIENTOS } as never);

  it('cierra los aislamientos vencidos y audita como automático', async () => {
    const { procesador, cuentaUpdateMany, audit } = crearProcesador([
      { id: 'cuenta-1', empresaRevendedoraId: 'empresa-1' },
    ]);

    const resultado = await disparar(procesador);

    expect(cuentaUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { aislada: false, aislamientoFinEn: null } }),
    );
    expect(audit.registrarEnTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        accion: 'fin_aislamiento_cuenta',
        detalle: expect.objectContaining({ origen: 'automatico' }),
      }),
    );
    expect(resultado).toEqual({ cerrados: 1 });
  });

  it('es idempotente: si otra corrida ya lo cerró, no repite el efecto', async () => {
    const { procesador, audit } = crearProcesador(
      [{ id: 'cuenta-1', empresaRevendedoraId: 'empresa-1' }],
      0,
    );

    const resultado = await disparar(procesador);

    expect(audit.registrarEnTx).not.toHaveBeenCalled();
    expect(resultado).toEqual({ cerrados: 0 });
  });
});

/**
 * HU-P06 — Vencimiento automático de cuentas de prueba. Cierra la Cuenta en el
 * Proveedor y desvincula al Cliente Final (sin darlo de baja); si el Proveedor
 * falla, no toca el estado local y audita el fallo para reintentar.
 */
describe('ColaProveedorProcessor — vencimiento de cuentas de prueba (HU-P06)', () => {
  const PRUEBA = {
    id: 'cuenta-1',
    empresaRevendedoraId: 'empresa-1',
    proveedorCuentaId: '30000042',
  };

  const crearProcesador = (opciones: {
    vencidas?: (typeof PRUEBA)[];
    updateCount?: number;
    cerrarFalla?: boolean;
    falloReciente?: boolean;
  }) => {
    const cuentaUpdateMany = jest.fn().mockResolvedValue({ count: opciones.updateCount ?? 1 });
    const tx = {
      cuenta: {
        findMany: jest.fn().mockResolvedValue(opciones.vencidas ?? []),
        updateMany: cuentaUpdateMany,
      },
      solicitudVinculacionDispositivo: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      dispositivo: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      ventaCompartida: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      auditLog: {
        findFirst: jest.fn().mockResolvedValue(opciones.falloReciente ? { id: 'audit-1' } : null),
      },
    };
    const prisma = {
      operadorPrincipal: { findMany: jest.fn().mockResolvedValue([{ id: 'operador-1' }]) },
      transactionComoOperador: jest
        .fn()
        .mockImplementation((_op: string, fn: (t: unknown) => unknown) => fn(tx)),
    } as unknown as PrismaService;

    const cerrarCuenta = opciones.cerrarFalla
      ? jest.fn().mockRejectedValue(new Error('SENSA caído'))
      : jest.fn().mockResolvedValue(undefined);
    const proveedor = { cerrarCuenta } as unknown as ProveedorService;
    const audit = {
      registrarEnTx: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;

    const procesador = new ColaProveedorProcessor(
      prisma,
      proveedor,
      audit,
      {} as ColaProveedorService,
      {} as CuentasProvisioningService,
      {} as NotificacionesService,
    );
    return { procesador, cuentaUpdateMany, cerrarCuenta, audit, tx };
  };

  const disparar = (procesador: ColaProveedorProcessor) =>
    procesador.process({ name: TRABAJOS_PROVEEDOR.BARRER_PRUEBAS_VENCIDAS } as never);

  it('cierra la prueba vencida en el Proveedor, desvincula y audita como sistema', async () => {
    const { procesador, cerrarCuenta, cuentaUpdateMany, audit, tx } = crearProcesador({
      vencidas: [PRUEBA],
    });

    const resultado = await disparar(procesador);

    expect(cerrarCuenta).toHaveBeenCalledWith('operador-1', '30000042');
    expect(cuentaUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          estado: EstadoCuenta.cerrada,
          esPrueba: false,
          pruebaVenceEn: null,
        }),
      }),
    );
    // El Cliente Final NO se elimina: sólo se desvinculan sus Dispositivos.
    expect(tx.dispositivo.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ clienteFinalId: null }),
      }),
    );
    expect(tx.ventaCompartida.deleteMany).toHaveBeenCalledWith({
      where: { cuentaId: 'cuenta-1' },
    });
    expect(audit.registrarEnTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        accion: 'cierre_automatico_cuenta_prueba',
        operadorPrincipalId: 'operador-1',
        detalle: expect.objectContaining({ origen: 'automatico' }),
      }),
    );
    expect(resultado).toEqual({ cerradas: 1, fallidas: 0 });
  });

  it('es idempotente: si otra corrida ya la cerró, no repite el efecto', async () => {
    const { procesador, audit } = crearProcesador({ vencidas: [PRUEBA], updateCount: 0 });

    const resultado = await disparar(procesador);

    expect(audit.registrarEnTx).not.toHaveBeenCalled();
    expect(resultado).toEqual({ cerradas: 0, fallidas: 0 });
  });

  it('si el Proveedor falla, no toca el estado local y audita el fallo', async () => {
    const { procesador, cuentaUpdateMany, audit } = crearProcesador({
      vencidas: [PRUEBA],
      cerrarFalla: true,
    });

    const resultado = await disparar(procesador);

    // No se marcó nada localmente: sigue activa para reintentar.
    expect(cuentaUpdateMany).not.toHaveBeenCalled();
    expect(audit.registrarEnTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        accion: 'fallo_cierre_cuenta_prueba',
        detalle: expect.objectContaining({ origen: 'automatico' }),
      }),
    );
    expect(resultado).toEqual({ cerradas: 0, fallidas: 1 });
  });

  it('no duplica la auditoría de fallo mientras el Proveedor sigue caído', async () => {
    const { procesador, audit } = crearProcesador({
      vencidas: [PRUEBA],
      cerrarFalla: true,
      falloReciente: true,
    });

    const resultado = await disparar(procesador);

    expect(audit.registrarEnTx).not.toHaveBeenCalled();
    expect(resultado).toEqual({ cerradas: 0, fallidas: 1 });
  });
});

/**
 * HU-N03 — Avisos de cuentas de prueba próximas a vencer. Se genera un aviso por
 * cada hito configurado que ya se alcanzó; el mismo hito no se repite (la clave
 * lo hace idempotente). Una prueba convertida o cerrada no aparece en el barrido.
 */
describe('ColaProveedorProcessor — avisos de pruebas por vencer (HU-N03)', () => {
  const DIA_MS = 24 * 60 * 60_000;

  const crearProcesador = (opciones: {
    pruebas?: {
      id: string;
      empresaRevendedoraId: string;
      pruebaVenceEn: Date;
      empresaRevendedora: { pruebasHabilitadas: boolean; pruebasAvisosDias: number[] };
    }[];
    creada?: boolean;
  }) => {
    const tx = { cuenta: { findMany: jest.fn().mockResolvedValue(opciones.pruebas ?? []) } };
    const prisma = {
      operadorPrincipal: { findMany: jest.fn().mockResolvedValue([{ id: 'operador-1' }]) },
      transactionComoOperador: jest
        .fn()
        .mockImplementation((_op: string, fn: (t: unknown) => unknown) => fn(tx)),
    } as unknown as PrismaService;

    const crearEnTx = jest.fn().mockResolvedValue({ id: 'n1', creada: opciones.creada ?? true });
    const notificaciones = { crearEnTx } as unknown as NotificacionesService;

    const procesador = new ColaProveedorProcessor(
      prisma,
      {} as ProveedorService,
      {} as AuditService,
      {} as ColaProveedorService,
      {} as CuentasProvisioningService,
      notificaciones,
    );
    return { procesador, crearEnTx };
  };

  const disparar = (procesador: ColaProveedorProcessor) =>
    procesador.process({ name: TRABAJOS_PROVEEDOR.BARRER_PRUEBAS_POR_VENCER } as never);

  it('crea un aviso por cada hito alcanzado y lleva a la cuenta', async () => {
    const { procesador, crearEnTx } = crearProcesador({
      pruebas: [
        {
          id: 'cuenta-1',
          empresaRevendedoraId: 'empresa-1',
          pruebaVenceEn: new Date(Date.now() + 2 * DIA_MS),
          empresaRevendedora: { pruebasHabilitadas: true, pruebasAvisosDias: [7, 3, 1] },
        },
      ],
    });

    const resultado = await disparar(procesador);

    // Faltan ~2 días: se disparan los hitos 7 y 3; el de 1 todavía no.
    expect(crearEnTx).toHaveBeenCalledTimes(2);
    expect(crearEnTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tipo: 'prueba_por_vencer',
        accionTipo: 'ver_cuenta',
        accionRefId: 'cuenta-1',
        clave: 'prueba_por_vencer:cuenta-1:7',
      }),
    );
    expect(crearEnTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ clave: 'prueba_por_vencer:cuenta-1:3' }),
    );
    expect(resultado).toEqual({ creadas: 2 });
  });

  it('no avisa si el módulo de pruebas está deshabilitado para la empresa', async () => {
    const { procesador, crearEnTx } = crearProcesador({
      pruebas: [
        {
          id: 'cuenta-1',
          empresaRevendedoraId: 'empresa-1',
          pruebaVenceEn: new Date(Date.now() + 1 * DIA_MS),
          empresaRevendedora: { pruebasHabilitadas: false, pruebasAvisosDias: [7, 3, 1] },
        },
      ],
    });

    const resultado = await disparar(procesador);

    expect(crearEnTx).not.toHaveBeenCalled();
    expect(resultado).toEqual({ creadas: 0 });
  });

  it('no avisa sobre una prueba ya vencida (la cierra el otro barrido)', async () => {
    const { procesador, crearEnTx } = crearProcesador({
      pruebas: [
        {
          id: 'cuenta-1',
          empresaRevendedoraId: 'empresa-1',
          pruebaVenceEn: new Date(Date.now() - 60_000),
          empresaRevendedora: { pruebasHabilitadas: true, pruebasAvisosDias: [7, 3, 1] },
        },
      ],
    });

    const resultado = await disparar(procesador);

    expect(crearEnTx).not.toHaveBeenCalled();
    expect(resultado).toEqual({ creadas: 0 });
  });

  it('no cuenta como nueva una notificación ya existente (idempotencia por clave)', async () => {
    const { procesador } = crearProcesador({
      creada: false,
      pruebas: [
        {
          id: 'cuenta-1',
          empresaRevendedoraId: 'empresa-1',
          pruebaVenceEn: new Date(Date.now() + 1 * DIA_MS),
          empresaRevendedora: { pruebasHabilitadas: true, pruebasAvisosDias: [1] },
        },
      ],
    });

    const resultado = await disparar(procesador);

    expect(resultado).toEqual({ creadas: 0 });
  });
});

/**
 * HU-N04 — Avisos de ventanas de alta próximas a vencer. Mismo esquema que N03
 * pero sobre `ventana_curiosidad`: un aviso por hito alcanzado, idempotente, y
 * sólo para ventanas vigentes (no revocadas ni vencidas).
 */
describe('ColaProveedorProcessor — avisos de ventanas de alta por vencer (HU-N04)', () => {
  const DIA_MS = 24 * 60 * 60_000;

  const crearProcesador = (opciones: {
    ventanas?: {
      id: string;
      cuentaId: string;
      empresaRevendedoraId: string;
      finPrevistoEn: Date;
      empresaRevendedora: { notifVentanaAlta: boolean; notifVentanaAltaDias: number[] };
    }[];
    creada?: boolean;
  }) => {
    const tx = {
      ventanaCuriosidad: { findMany: jest.fn().mockResolvedValue(opciones.ventanas ?? []) },
    };
    const prisma = {
      operadorPrincipal: { findMany: jest.fn().mockResolvedValue([{ id: 'operador-1' }]) },
      transactionComoOperador: jest
        .fn()
        .mockImplementation((_op: string, fn: (t: unknown) => unknown) => fn(tx)),
    } as unknown as PrismaService;

    const crearEnTx = jest.fn().mockResolvedValue({ id: 'n1', creada: opciones.creada ?? true });
    const notificaciones = { crearEnTx } as unknown as NotificacionesService;

    const procesador = new ColaProveedorProcessor(
      prisma,
      {} as ProveedorService,
      {} as AuditService,
      {} as ColaProveedorService,
      {} as CuentasProvisioningService,
      notificaciones,
    );
    return { procesador, crearEnTx };
  };

  const disparar = (procesador: ColaProveedorProcessor) =>
    procesador.process({ name: TRABAJOS_PROVEEDOR.BARRER_VENTANAS_POR_VENCER } as never);

  const VENTANA = {
    id: 'ventana-1',
    cuentaId: 'cuenta-1',
    empresaRevendedoraId: 'empresa-1',
    finPrevistoEn: new Date(Date.now() + 2 * DIA_MS),
    empresaRevendedora: { notifVentanaAlta: true, notifVentanaAltaDias: [3, 1] },
  };

  it('crea un aviso por cada hito alcanzado y lleva a la cuenta', async () => {
    const { procesador, crearEnTx } = crearProcesador({ ventanas: [VENTANA] });

    const resultado = await disparar(procesador);

    // Faltan ~2 días: se dispara el hito 3; el de 1 todavía no.
    expect(crearEnTx).toHaveBeenCalledTimes(1);
    expect(crearEnTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tipo: 'ventana_alta_por_vencer',
        accionTipo: 'ver_cuenta',
        accionRefId: 'cuenta-1',
        clave: 'ventana_alta_por_vencer:ventana-1:3',
      }),
    );
    expect(resultado).toEqual({ creadas: 1 });
  });

  it('no avisa si la Empresa Revendedora desactivó los avisos de ventana', async () => {
    const { procesador, crearEnTx } = crearProcesador({
      ventanas: [
        {
          ...VENTANA,
          empresaRevendedora: { notifVentanaAlta: false, notifVentanaAltaDias: [3, 1] },
        },
      ],
    });

    const resultado = await disparar(procesador);

    expect(crearEnTx).not.toHaveBeenCalled();
    expect(resultado).toEqual({ creadas: 0 });
  });

  it('no avisa sobre una ventana ya vencida', async () => {
    const { procesador, crearEnTx } = crearProcesador({
      ventanas: [{ ...VENTANA, finPrevistoEn: new Date(Date.now() - 60_000) }],
    });

    const resultado = await disparar(procesador);

    expect(crearEnTx).not.toHaveBeenCalled();
    expect(resultado).toEqual({ creadas: 0 });
  });

  it('no cuenta como nueva una notificación ya existente (idempotencia por clave)', async () => {
    const { procesador } = crearProcesador({ ventanas: [VENTANA], creada: false });

    const resultado = await disparar(procesador);

    expect(resultado).toEqual({ creadas: 0 });
  });
});

/**
 * HU-D01 — Detección de dispositivos sin Cliente Final. El barrido de inventario
 * reutiliza la incidencia existente (un único evento por dispositivo/cuenta) y
 * guarda cuántos Clientes Finales ACTIVOS tenía la Cuenta al detectarlo.
 */
describe('ColaProveedorProcessor — dispositivos sin cliente (HU-D01)', () => {
  const crearProcesador = (opciones: {
    inventario?: { proveedorDeviceId: string; mac?: string; tipo?: string }[];
    conocidos?: { proveedorDeviceId: string | null }[];
    existente?: { id: string; estado: string } | null;
    clientesActivos?: number;
    ventanasAbiertas?: number;
  }) => {
    const incidenciaCreate = jest
      .fn()
      .mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
        id: 'inc-1',
        ...data,
      }));
    const incidenciaUpdate = jest.fn().mockResolvedValue({ id: 'inc-1' });
    const clientes = Array.from({ length: opciones.clientesActivos ?? 0 }, (_, i) => ({
      id: `cli-${i + 1}`,
    }));
    const clienteFinalFindMany = jest.fn().mockResolvedValue(clientes);

    const tx = {
      $queryRaw: jest
        .fn()
        .mockResolvedValue([
          { id: 'cuenta-1', empresa_revendedora_id: 'empresa-1', proveedor_cuenta_id: '30000001' },
        ]),
      dispositivo: { findMany: jest.fn().mockResolvedValue(opciones.conocidos ?? []) },
      solicitudVinculacionDispositivo: {
        count: jest.fn().mockResolvedValue(opciones.ventanasAbiertas ?? 0),
      },
      incidenciaDispositivoProveedor: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(opciones.existente ?? null),
        create: incidenciaCreate,
        update: incidenciaUpdate,
      },
      clienteFinal: { findMany: clienteFinalFindMany },
    };
    const prisma = {
      operadorPrincipal: { findMany: jest.fn().mockResolvedValue([{ id: 'operador-1' }]) },
      transactionComoOperador: jest
        .fn()
        .mockImplementation((_op: string, fn: (t: unknown) => unknown) => fn(tx)),
    } as unknown as PrismaService;

    const proveedor = {
      listarDispositivos: jest.fn().mockResolvedValue(opciones.inventario ?? []),
    } as unknown as ProveedorService;
    const audit = {
      registrarEnTx: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;
    const notificaciones = {
      crearEnTx: jest.fn().mockResolvedValue({ id: 'n1', creada: true }),
    } as unknown as NotificacionesService;

    const procesador = new ColaProveedorProcessor(
      prisma,
      proveedor,
      audit,
      {} as ColaProveedorService,
      {} as CuentasProvisioningService,
      notificaciones,
    );
    return { procesador, incidenciaCreate, incidenciaUpdate, clienteFinalFindMany, audit };
  };

  const disparar = (procesador: ColaProveedorProcessor) =>
    procesador.process({ name: TRABAJOS_PROVEEDOR.BARRER_INVENTARIO_CUENTAS } as never);

  it('registra el evento pendiente con la cantidad de clientes activos y lo audita', async () => {
    const { procesador, incidenciaCreate, clienteFinalFindMany, audit } = crearProcesador({
      inventario: [{ proveedorDeviceId: 'dev-1', mac: 'AA', tipo: 'stationary' }],
      clientesActivos: 2,
    });

    await disparar(procesador);

    expect(clienteFinalFindMany).toHaveBeenCalled();
    expect(incidenciaCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cuentaId: 'cuenta-1',
          proveedorDeviceId: 'dev-1',
          clientesActivosAlDetectar: 2,
        }),
      }),
    );
    expect(audit.registrarEnTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        accion: 'deteccion_dispositivo_no_autorizado',
        detalle: expect.objectContaining({ cuenta_id: 'cuenta-1', clientes_activos: 2 }),
      }),
    );
  });

  it('no duplica el evento: refresca la incidencia pendiente en vez de crear otra', async () => {
    const { procesador, incidenciaCreate, incidenciaUpdate } = crearProcesador({
      inventario: [{ proveedorDeviceId: 'dev-1' }],
      existente: { id: 'inc-1', estado: 'pendiente' },
      clientesActivos: 2,
    });

    await disparar(procesador);

    expect(incidenciaCreate).not.toHaveBeenCalled();
    expect(incidenciaUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'inc-1' },
        data: expect.objectContaining({ clientesActivosAlDetectar: 2 }),
      }),
    );
  });

  it('no registra eventos mientras hay una ventana de vinculación abierta', async () => {
    const { procesador, incidenciaCreate, clienteFinalFindMany } = crearProcesador({
      inventario: [{ proveedorDeviceId: 'dev-1' }],
      ventanasAbiertas: 1,
    });

    await disparar(procesador);

    expect(incidenciaCreate).not.toHaveBeenCalled();
    expect(clienteFinalFindMany).not.toHaveBeenCalled();
  });
});

/**
 * HU-D02 — Autoasignación con un único Cliente Final activo. Se reutiliza el
 * mismo criterio de la resolución manual: se reclama un Dispositivo pendiente o
 * se crea uno vinculado, respetando el cupo; el evento queda resuelto.
 */
describe('ColaProveedorProcessor — autoasignación con un solo cliente (HU-D02)', () => {
  const crearProcesador = (opciones: {
    clientesActivos?: number;
    esExclusiva?: boolean;
    clienteFinalExclusivoId?: string | null;
    venta?: { cuposPorCategoria: number } | null;
    ocupados?: number;
    tipo?: string;
  }) => {
    const incidenciaCreate = jest
      .fn()
      .mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
        id: 'inc-1',
        ...data,
      }));
    const incidenciaUpdate = jest.fn().mockResolvedValue({ id: 'inc-1' });
    const dispositivoCreate = jest.fn().mockResolvedValue({ id: 'disp-1' });
    const dispositivoUpdate = jest.fn().mockResolvedValue({ id: 'disp-1' });
    const cuentaUpdate = jest.fn().mockResolvedValue(undefined);

    const clientes = Array.from({ length: opciones.clientesActivos ?? 1 }, (_, i) => ({
      id: `cli-${i + 1}`,
    }));

    const tx = {
      $queryRaw: jest
        .fn()
        .mockResolvedValue([
          { id: 'cuenta-1', empresa_revendedora_id: 'empresa-1', proveedor_cuenta_id: '30000001' },
        ]),
      dispositivo: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(opciones.ocupados ?? 0),
        findFirst: jest.fn().mockResolvedValue(null),
        create: dispositivoCreate,
        update: dispositivoUpdate,
      },
      solicitudVinculacionDispositivo: {
        count: jest.fn().mockResolvedValue(0),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      incidenciaDispositivoProveedor: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        create: incidenciaCreate,
        update: incidenciaUpdate,
      },
      clienteFinal: { findMany: jest.fn().mockResolvedValue(clientes) },
      cuenta: {
        findUnique: jest.fn().mockResolvedValue({
          esExclusiva: opciones.esExclusiva ?? false,
          clienteFinalExclusivoId: opciones.clienteFinalExclusivoId ?? null,
        }),
        update: cuentaUpdate,
      },
      ventaCompartida: {
        findUnique: jest
          .fn()
          .mockResolvedValue(
            opciones.venta === undefined ? { cuposPorCategoria: 1 } : opciones.venta,
          ),
      },
    };
    const prisma = {
      operadorPrincipal: { findMany: jest.fn().mockResolvedValue([{ id: 'operador-1' }]) },
      transactionComoOperador: jest
        .fn()
        .mockImplementation((_op: string, fn: (t: unknown) => unknown) => fn(tx)),
    } as unknown as PrismaService;

    const proveedor = {
      listarDispositivos: jest
        .fn()
        .mockResolvedValue([
          { proveedorDeviceId: 'dev-1', mac: 'AA', tipo: opciones.tipo ?? 'stationary' },
        ]),
    } as unknown as ProveedorService;
    const audit = {
      registrarEnTx: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;
    const notificaciones = {
      crearEnTx: jest.fn().mockResolvedValue({ id: 'n1', creada: true }),
    } as unknown as NotificacionesService;

    const procesador = new ColaProveedorProcessor(
      prisma,
      proveedor,
      audit,
      {} as ColaProveedorService,
      {} as CuentasProvisioningService,
      notificaciones,
    );
    return { procesador, incidenciaUpdate, dispositivoCreate, cuentaUpdate, audit };
  };

  const disparar = (procesador: ColaProveedorProcessor) =>
    procesador.process({ name: TRABAJOS_PROVEEDOR.BARRER_INVENTARIO_CUENTAS } as never);

  it('asigna el dispositivo al único cliente activo de una compartida y resuelve el evento', async () => {
    const { procesador, dispositivoCreate, incidenciaUpdate, audit } = crearProcesador({
      clientesActivos: 1,
    });

    await disparar(procesador);

    expect(dispositivoCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cuentaId: 'cuenta-1',
          clienteFinalId: 'cli-1',
          proveedorDeviceId: 'dev-1',
          tipo: 'fijo',
        }),
      }),
    );
    expect(incidenciaUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ estado: 'reconocido' }) }),
    );
    expect(audit.registrarEnTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        accion: 'resolucion_incidencia_dispositivo',
        detalle: expect.objectContaining({ origen: 'automatico', cliente_final_id: 'cli-1' }),
      }),
    );
  });

  it('funciona también en una Cuenta exclusiva (asigna el titular)', async () => {
    const { procesador, dispositivoCreate, cuentaUpdate } = crearProcesador({
      clientesActivos: 1,
      esExclusiva: true,
    });

    await disparar(procesador);

    expect(dispositivoCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ clienteFinalId: 'cli-1' }) }),
    );
    expect(cuentaUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { clienteFinalExclusivoId: 'cli-1' } }),
    );
  });

  it('no asigna si hay dos o más clientes activos', async () => {
    const { procesador, dispositivoCreate } = crearProcesador({ clientesActivos: 2 });

    await disparar(procesador);

    expect(dispositivoCreate).not.toHaveBeenCalled();
  });

  it('no asigna si el cupo de la categoría está lleno', async () => {
    const { procesador, dispositivoCreate } = crearProcesador({
      clientesActivos: 1,
      ocupados: 1,
      venta: { cuposPorCategoria: 1 },
    });

    await disparar(procesador);

    expect(dispositivoCreate).not.toHaveBeenCalled();
  });

  it('no asigna si el Proveedor no informa una categoría reconocida', async () => {
    const { procesador, dispositivoCreate } = crearProcesador({
      clientesActivos: 1,
      tipo: 'desconocido',
    });

    await disparar(procesador);

    expect(dispositivoCreate).not.toHaveBeenCalled();
  });
});

/**
 * HU-D03 — Notificación cuando la autoasignación no es segura (0 o 2+ clientes
 * activos). No crea un flujo de asignación: sólo notifica con `Ver cuenta`.
 */
describe('ColaProveedorProcessor — notificación de dispositivo pendiente (HU-D03)', () => {
  const crearProcesador = (opciones: { clientesActivos?: number }) => {
    const incidenciaCreate = jest
      .fn()
      .mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
        id: 'inc-1',
        ...data,
      }));
    const dispositivoCreate = jest.fn().mockResolvedValue({ id: 'disp-1' });
    const clientes = Array.from({ length: opciones.clientesActivos ?? 0 }, (_, i) => ({
      id: `cli-${i + 1}`,
    }));

    const tx = {
      $queryRaw: jest
        .fn()
        .mockResolvedValue([
          { id: 'cuenta-1', empresa_revendedora_id: 'empresa-1', proveedor_cuenta_id: '30000001' },
        ]),
      dispositivo: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null),
        create: dispositivoCreate,
        update: jest.fn().mockResolvedValue({ id: 'disp-1' }),
      },
      solicitudVinculacionDispositivo: {
        count: jest.fn().mockResolvedValue(0),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      incidenciaDispositivoProveedor: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        create: incidenciaCreate,
        update: jest.fn().mockResolvedValue({ id: 'inc-1' }),
      },
      clienteFinal: { findMany: jest.fn().mockResolvedValue(clientes) },
      cuenta: {
        findUnique: jest.fn().mockResolvedValue({
          esExclusiva: false,
          clienteFinalExclusivoId: null,
        }),
        update: jest.fn().mockResolvedValue(undefined),
      },
      ventaCompartida: { findUnique: jest.fn().mockResolvedValue({ cuposPorCategoria: 1 }) },
    };
    const prisma = {
      operadorPrincipal: { findMany: jest.fn().mockResolvedValue([{ id: 'operador-1' }]) },
      transactionComoOperador: jest
        .fn()
        .mockImplementation((_op: string, fn: (t: unknown) => unknown) => fn(tx)),
    } as unknown as PrismaService;

    const proveedor = {
      listarDispositivos: jest
        .fn()
        .mockResolvedValue([{ proveedorDeviceId: 'dev-1', mac: 'AA', tipo: 'stationary' }]),
    } as unknown as ProveedorService;
    const audit = {
      registrarEnTx: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;
    const crearEnTx = jest.fn().mockResolvedValue({ id: 'n1', creada: true });
    const notificaciones = { crearEnTx } as unknown as NotificacionesService;

    const procesador = new ColaProveedorProcessor(
      prisma,
      proveedor,
      audit,
      {} as ColaProveedorService,
      {} as CuentasProvisioningService,
      notificaciones,
    );
    return { procesador, dispositivoCreate, crearEnTx };
  };

  const disparar = (procesador: ColaProveedorProcessor) =>
    procesador.process({ name: TRABAJOS_PROVEEDOR.BARRER_INVENTARIO_CUENTAS } as never);

  it('Caso A — 0 clientes activos: no asigna y notifica el faltante de clientes', async () => {
    const { procesador, dispositivoCreate, crearEnTx } = crearProcesador({ clientesActivos: 0 });

    await disparar(procesador);

    expect(dispositivoCreate).not.toHaveBeenCalled();
    expect(crearEnTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tipo: 'dispositivo_pendiente',
        titulo: 'Dispositivo en una cuenta sin clientes activos',
        accionTipo: 'ver_cuenta',
        accionRefId: 'cuenta-1',
      }),
    );
  });

  it('Caso B — 2 o más clientes activos: no asigna y notifica la ambigüedad', async () => {
    const { procesador, dispositivoCreate, crearEnTx } = crearProcesador({ clientesActivos: 3 });

    await disparar(procesador);

    expect(dispositivoCreate).not.toHaveBeenCalled();
    expect(crearEnTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tipo: 'dispositivo_pendiente',
        titulo: 'Dispositivo nuevo sin dueño definido',
        accionTipo: 'ver_cuenta',
        accionRefId: 'cuenta-1',
      }),
    );
  });

  it('con un único cliente activo se autoasigna y NO se notifica', async () => {
    const { procesador, dispositivoCreate, crearEnTx } = crearProcesador({ clientesActivos: 1 });

    await disparar(procesador);

    expect(dispositivoCreate).toHaveBeenCalled();
    expect(crearEnTx).not.toHaveBeenCalled();
  });
});
