import {
  Cuenta,
  Dispositivo,
  EstadoCuenta,
  EstadoDispositivo,
  EstadoVinculacionDispositivo,
  TipoDispositivo,
} from '@prisma/client';
import {
  mapCuentaParaOperador,
  mapCuentaParaRevendedora,
  mapDispositivoParaOperador,
  mapDispositivoParaRevendedora,
  nombresDeServicios,
} from './cuentas.mapper';
import { calcularCapacidad } from './capacidad.util';

/**
 * Tests de la tabla NORMATIVA de campos permitidos/prohibidos
 * (docs/03_Reglas_de_Negocio.md, sección 4.2).
 *
 * Por qué es tan importante: el Operador Principal también vende IPTV, así que
 * no puede tener visibilidad comercial sobre la cartera de sus Empresas
 * Revendedoras. Y la protección no es "ocultarlo en la pantalla": los campos
 * prohibidos no deben salir del backend.
 */
describe('serialización de Cuentas y Dispositivos según el rol', () => {
  const cuenta: Cuenta = {
    id: 'cuenta-1',
    empresaRevendedoraId: 'empresa-1',
    proveedorId: 'proveedor-1',
    proveedorCuentaId: '30000001',
    dniAltaSensa: '30000001',
    usuario: '30000001',
    passwordCifrado: 'v1:xx:yy:zz',
    pinCifrado: 'v1:aa:bb:cc',
    emailContacto: 'contacto1@isp.com',
    esExclusiva: false,
    clienteFinalExclusivoId: null,
    servicios: '1|3|5',
    limiteDispositivos: 3,
    dispositivosFijosHabilitados: 2,
    dispositivosMovilesHabilitados: 1,
    estado: EstadoCuenta.activa,
    creadoEn: new Date('2026-08-01T10:00:00Z'),
    actualizadoEn: new Date('2026-08-01T10:00:00Z'),
  };

  const dispositivo: Dispositivo = {
    id: 'dispositivo-1',
    cuentaId: 'cuenta-1',
    empresaRevendedoraId: 'empresa-1',
    clienteFinalId: 'cliente-1',
    proveedorDeviceId: '830792',
    mac: '03AC1AE60CA7',
    tipo: TipoDispositivo.fijo,
    tipoProveedor: 'stationary',
    estado: EstadoDispositivo.activo,
    estadoVinculacion: EstadoVinculacionDispositivo.vinculado,
    notaDescriptiva: 'TV living',
    creadoEn: new Date('2026-08-01T10:00:00Z'),
    actualizadoEn: new Date('2026-08-01T10:00:00Z'),
  };

  const capacidad = calcularCapacidad({
    esExclusiva: false,
    dispositivos: [
      { tipo: TipoDispositivo.fijo, estado: EstadoDispositivo.activo, clienteFinalId: 'cliente-1' },
    ],
  });

  describe('vista del Operador Principal', () => {
    const vista = mapCuentaParaOperador(cuenta, capacidad);

    it('expone el ID interno y el ID en el proveedor (necesarios para soporte)', () => {
      expect(vista.id).toBe('cuenta-1');
      expect(vista.proveedor_cuenta_id).toBe('30000001');
      expect(vista.estado).toBe(EstadoCuenta.activa);
    });

    it('expone el conteo de dispositivos ocupados sobre el habilitado por la venta activa', () => {
      expect(vista.fijos.resumen).toBe('1 de 1');
      expect(vista.moviles.resumen).toBe('0 de 1');
    });

    it('NO expone usuario, contraseña ni PIN de la Cuenta', () => {
      const claves = Object.keys(vista);
      expect(claves).not.toContain('usuario');
      expect(claves).not.toContain('password');
      expect(claves).not.toContain('pin');
      // Tampoco el valor cifrado: no tiene por qué salir del backend.
      expect(JSON.stringify(vista)).not.toContain('v1:');
    });

    it('NO expone el email de contacto ni la parametrización de contenido', () => {
      expect(Object.keys(vista)).not.toContain('email_contacto');
      expect(Object.keys(vista)).not.toContain('servicios');
    });

    it('informa sin revelar secretos cuando una Cuenta importada tiene contraseña pendiente', () => {
      expect(
        mapCuentaParaOperador({ ...cuenta, passwordCifrado: null }, capacidad).password_pendiente,
      ).toBe(true);
    });

    it('en Dispositivos NO expone la nota descriptiva ni el cliente', () => {
      const vistaDispositivo = mapDispositivoParaOperador(dispositivo);

      // La nota es texto libre y podría contener el nombre del cliente igual,
      // aunque el campo "nombre" esté oculto.
      expect(Object.keys(vistaDispositivo)).not.toContain('nota_descriptiva');
      expect(Object.keys(vistaDispositivo)).not.toContain('cliente_final');
      expect(Object.keys(vistaDispositivo)).not.toContain('mac');
      // Sí expone el ID del dispositivo en el proveedor, tipo y estado.
      expect(vistaDispositivo.proveedor_device_id).toBe('830792');
      expect(vistaDispositivo.tipo).toBe(TipoDispositivo.fijo);
      expect(vistaDispositivo.estado).toBe(EstadoDispositivo.activo);
    });
  });

  describe('vista de la Empresa Revendedora', () => {
    it('incluye credenciales cuando se piden explícitamente', () => {
      const vista = mapCuentaParaRevendedora(cuenta, capacidad, {
        password: '1234567890',
        pin: '1234',
      });

      expect(vista.usuario).toBe('30000001');
      expect(vista.password).toBe('1234567890');
      expect(vista.pin).toBe('1234');
      expect(vista.email_contacto).toBe('contacto1@isp.com');
    });

    it('no incluye credenciales en los listados (no se descifran de más)', () => {
      const vista = mapCuentaParaRevendedora(cuenta, capacidad, null);

      expect(vista.password).toBeUndefined();
      expect(vista.pin).toBeUndefined();
      // El usuario sí, porque no es secreto y sirve para identificar la Cuenta.
      expect(vista.usuario).toBe('30000001');
    });

    it('traduce los códigos de servicio a nombres de paquetes', () => {
      const vista = mapCuentaParaRevendedora(cuenta, capacidad, null);
      expect(vista.servicios).toBe('1|3|5');
      expect(vista.servicios_nombres).toEqual(['Básico', 'Universal Plus', 'HBO Premium']);
    });

    it('en Dispositivos incluye nota, MAC y el cliente asociado', () => {
      const vista = mapDispositivoParaRevendedora({
        ...dispositivo,
        clienteFinal: { id: 'cliente-1', numeroCliente: 42, nombre: 'Juan', apellido: 'Pérez' },
      });

      expect(vista.nota_descriptiva).toBe('TV living');
      expect(vista.mac).toBe('03AC1AE60CA7');
      expect(vista.cliente_final).toEqual({
        id: 'cliente-1',
        numero_cliente: 42,
        nombre: 'Juan Pérez',
      });
    });
  });

  describe('nombresDeServicios', () => {
    it('resuelve los códigos del Anexo de Servicios', () => {
      expect(nombresDeServicios('1')).toEqual(['Básico']);
      expect(nombresDeServicios('1|2|4|6|7')).toEqual([
        'Básico',
        'Hot Pack',
        'Pack Futbol',
        'GOLF TV',
        'CINDIE',
      ]);
    });

    it('tolera cadenas vacías o códigos desconocidos', () => {
      expect(nombresDeServicios('')).toEqual([]);
      expect(nombresDeServicios('9')).toEqual(['Servicio 9']);
    });
  });
});
