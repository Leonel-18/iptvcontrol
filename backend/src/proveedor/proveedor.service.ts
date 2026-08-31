import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  ActivarDispositivoParams,
  ActualizarCapacidadParams,
  ActualizarPasswordParams,
  ActualizarServiciosParams,
  CredencialesProveedor,
  CrearCuentaParams,
  CuentaProveedor,
  DispositivoProveedor,
  LicenciasProveedor,
  PROVEEDOR_ADAPTERS,
  ProveedorAdapter,
  ResultadoPrueba,
  ServiciosCuenta,
} from './proveedor-adapter.interface';
import {
  ConfiguracionProveedorResuelta,
  ConfiguracionProveedorService,
} from './configuracion-proveedor.service';

/**
 * Fachada que usa la lógica de negocio para hablar con el Proveedor.
 *
 * Resuelve dos cosas que a los módulos de negocio no les interesan:
 *   1. Qué adapter corresponde (hoy siempre SensaAdapter, mañana el que sea).
 *   2. De dónde salen las credenciales y cómo se descifran.
 *
 * Los servicios de negocio llaman `proveedor.crearCuenta(operadorId, params)` y
 * listo: no conocen SENSA, no conocen el token, no conocen los códigos de error
 * del tercero. Esa separación es la que permite sumar Proveedores nuevos sin
 * tocar el núcleo (docs/04_Esqueleto_Tecnico_Inicial.md, sección 3).
 */
@Injectable()
export class ProveedorService {
  constructor(
    @Inject(PROVEEDOR_ADAPTERS) private readonly adapters: ProveedorAdapter[],
    private readonly configuracion: ConfiguracionProveedorService,
  ) {}

  /** Configuración + adapter listos para operar. */
  async resolver(
    operadorPrincipalId: string,
  ): Promise<{ adapter: ProveedorAdapter; configuracion: ConfiguracionProveedorResuelta }> {
    const configuracion = await this.configuracion.obtener(operadorPrincipalId);
    return { adapter: this.adapterPara(configuracion.tipoConector), configuracion };
  }

  /** Devuelve el adapter registrado para un `tipoConector`. */
  adapterPara(tipoConector: string): ProveedorAdapter {
    const adapter = this.adapters.find((candidato) => candidato.tipoConector === tipoConector);
    if (!adapter) {
      throw new InternalServerErrorException(
        `No hay un conector implementado para el proveedor "${tipoConector}".`,
      );
    }
    return adapter;
  }

  /**
   * Prueba de conexión con credenciales explícitas (botón "Probar conexión" del
   * Menú de Parametrización, antes de guardar). Se ejecuta server-side.
   */
  async probarConexionCon(
    tipoConector: string,
    credenciales: CredencialesProveedor,
  ): Promise<ResultadoPrueba> {
    return this.adapterPara(tipoConector).probarConexion(credenciales);
  }

  async probarConexion(operadorPrincipalId: string): Promise<ResultadoPrueba> {
    const { adapter, configuracion } = await this.resolver(operadorPrincipalId);
    return adapter.probarConexion(configuracion.credenciales);
  }

  async crearCuenta(
    operadorPrincipalId: string,
    params: CrearCuentaParams,
  ): Promise<CuentaProveedor> {
    const { adapter, configuracion } = await this.resolver(operadorPrincipalId);
    return adapter.crearCuenta(configuracion.credenciales, params);
  }

  async actualizarCapacidadDispositivos(
    operadorPrincipalId: string,
    params: ActualizarCapacidadParams,
  ): Promise<void> {
    const { adapter, configuracion } = await this.resolver(operadorPrincipalId);
    await adapter.actualizarCapacidadDispositivos(configuracion.credenciales, params);
  }

  async actualizarPassword(
    operadorPrincipalId: string,
    params: ActualizarPasswordParams,
  ): Promise<void> {
    const { adapter, configuracion } = await this.resolver(operadorPrincipalId);
    await adapter.actualizarPassword(configuracion.credenciales, params);
  }

  async actualizarServicios(
    operadorPrincipalId: string,
    params: ActualizarServiciosParams,
  ): Promise<void> {
    const { adapter, configuracion } = await this.resolver(operadorPrincipalId);
    await adapter.actualizarServicios(configuracion.credenciales, params);
  }

  async activarDispositivo(
    operadorPrincipalId: string,
    params: ActivarDispositivoParams,
  ): Promise<DispositivoProveedor | null> {
    const { adapter, configuracion } = await this.resolver(operadorPrincipalId);
    return adapter.activarDispositivo(configuracion.credenciales, params);
  }

  async eliminarDispositivo(operadorPrincipalId: string, proveedorDeviceId: string): Promise<void> {
    const { adapter, configuracion } = await this.resolver(operadorPrincipalId);
    await adapter.eliminarDispositivo(configuracion.credenciales, proveedorDeviceId);
  }

  async reasignarDispositivo(
    operadorPrincipalId: string,
    params: { mac: string; proveedorCuentaId: string },
  ): Promise<DispositivoProveedor> {
    const { adapter, configuracion } = await this.resolver(operadorPrincipalId);
    return adapter.reasignarDispositivo(configuracion.credenciales, params);
  }

  async listarDispositivos(
    operadorPrincipalId: string,
    proveedorCuentaId: string,
  ): Promise<DispositivoProveedor[]> {
    const { adapter, configuracion } = await this.resolver(operadorPrincipalId);
    return adapter.listarDispositivos(configuracion.credenciales, proveedorCuentaId);
  }

  async consultarCuenta(
    operadorPrincipalId: string,
    proveedorCuentaId: string,
  ): Promise<CuentaProveedor | null> {
    const { adapter, configuracion } = await this.resolver(operadorPrincipalId);
    return adapter.consultarCuenta(configuracion.credenciales, proveedorCuentaId);
  }

  async consultarServicios(
    operadorPrincipalId: string,
    proveedorCuentaId: string,
  ): Promise<ServiciosCuenta> {
    const { adapter, configuracion } = await this.resolver(operadorPrincipalId);
    return adapter.consultarServicios(configuracion.credenciales, proveedorCuentaId);
  }

  async cerrarCuenta(operadorPrincipalId: string, proveedorCuentaId: string): Promise<void> {
    const { adapter, configuracion } = await this.resolver(operadorPrincipalId);
    await adapter.cerrarCuenta(configuracion.credenciales, proveedorCuentaId);
  }

  async consultarLicencias(operadorPrincipalId: string): Promise<LicenciasProveedor> {
    const { adapter, configuracion } = await this.resolver(operadorPrincipalId);
    return adapter.consultarLicencias(configuracion.credenciales);
  }
}
