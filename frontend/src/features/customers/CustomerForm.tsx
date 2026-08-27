import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { CustomerDetail, ExternalIdMatch, ServiceCatalogItem } from '@/lib/types';
import { customerIntakeHelp, customerIntakeLabels } from '@/i18n/entityLabels';
import { PageHeader } from '@/components/common';
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardFooter,
  Field,
  Input,
  Skeleton,
  Textarea,
} from '@/components/ui/primitives';

/** Leyendas que van rotando mientras se procesa el alta (mismo lenguaje que la
 * pantalla de inicio de sesión: logo + texto suave + barras de progreso). */
const LEYENDAS_ALTA = [
  'Dando de alta al cliente…',
  'Generando credenciales en el proveedor…',
  'Sincronizando dispositivos…',
  'Ya casi terminamos…',
];

const CargandoAlta = () => {
  const [indice, setIndice] = useState(0);
  useEffect(() => {
    const intervalo = setInterval(
      () => setIndice((actual) => (actual + 1) % LEYENDAS_ALTA.length),
      2200,
    );
    return () => clearInterval(intervalo);
  }, []);

  return (
    <div className="grid min-h-[360px] place-items-center p-6">
      <div className="w-full max-w-sm space-y-4 text-center">
        <img
          src="/logo_iptvcontrol.png"
          alt="IPTVControl"
          className="mx-auto size-16 object-contain"
        />
        <p className="text-sm texto-suave">{LEYENDAS_ALTA[indice]}</p>
        <div className="space-y-2">
          <Skeleton className="h-2 w-full" />
          <Skeleton className="mx-auto h-2 w-2/3" />
        </div>
        <p className="text-xs texto-suave">No cierre esta pantalla.</p>
      </div>
    </div>
  );
};

/**
 * =============================================================================
 * CustomerForm — alta de Cliente Final como asistente paso a paso
 * =============================================================================
 * Está pedido explícitamente como wizard y no como formulario único
 * (docs/04_Esqueleto_Tecnico_Inicial.md, sección 5), y con razón: el alta tiene
 * dos decisiones que cambian el resultado —el método de alta y qué hacer si el
 * ID de gestión externa está repetido— y en un formulario largo esas decisiones
 * se toman sin leerlas.
 *
 * Los cuatro pasos:
 *   1. Datos del cliente (acá se valida el ID de gestión externa).
 *   2. Método de alta: cuenta exclusiva o dispositivo en cuenta compartida.
 *   3. Servicios: paquetes de contenido y nota interna del Dispositivo.
 *   4. Confirmación: se resume qué va a pasar antes de tocar el proveedor.
 * =============================================================================
 */

type MetodoAlta = 'cuenta_exclusiva' | 'dispositivo_compartido';

interface EstadoFormulario {
  nombre: string;
  apellido: string;
  dni: string;
  telefono: string;
  email: string;
  direccion: string;
  idGestionExterno: string;
  metodoAlta: MetodoAlta;
  servicios: string[];
  notaDescriptiva: string;
}

const INICIAL: EstadoFormulario = {
  nombre: '',
  apellido: '',
  dni: '',
  telefono: '',
  email: '',
  direccion: '',
  idGestionExterno: '',
  metodoAlta: 'dispositivo_compartido',
  servicios: ['1'],
  notaDescriptiva: '',
};

const PASOS = ['Cliente', 'Método de alta', 'Servicios', 'Confirmar'] as const;

export const CustomerForm = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [paso, setPaso] = useState(0);
  const [valores, setValores] = useState<EstadoFormulario>(INICIAL);
  const [errores, setErrores] = useState<Partial<Record<keyof EstadoFormulario, string>>>({});
  const [coincidencias, setCoincidencias] = useState<ExternalIdMatch[]>([]);
  /** Decisión tomada frente al ID duplicado: agrupar en un cliente o seguir. */
  const [decisionDuplicado, setDecisionDuplicado] = useState<
    { tipo: 'agrupar'; clienteId: string; nombre: string } | { tipo: 'crear' } | null
  >(null);

  const catalogo = useQuery({
    queryKey: ['providers-catalog'],
    queryFn: () => api<ServiceCatalogItem[]>('/providers/services-catalog'),
    staleTime: Infinity,
  });

  const serviciosContratados = (catalogo.data ?? []).filter((servicio) => servicio.contratado);
  const catalogoDisponible = catalogo.isSuccess && serviciosContratados.length > 0;

  // Por defecto se ofrece la venta unitaria con TODOS los servicios contratados
  // marcados (igual que la Cuenta completa): la Empresa Revendedora desmarca lo
  // que no corresponda, en vez de tener que marcar uno por uno. Sólo se aplica
  // una vez, cuando el catálogo termina de cargar y todavía no se tocó nada.
  useEffect(() => {
    if (catalogoDisponible && valores.servicios.length <= 1) {
      setValores((actual) => ({
        ...actual,
        servicios: serviciosContratados.map((servicio) => servicio.codigo),
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogoDisponible]);

  const actualizar = <K extends keyof EstadoFormulario>(clave: K, valor: EstadoFormulario[K]) => {
    setValores((actual) => ({ ...actual, [clave]: valor }));
    setErrores((actual) => ({ ...actual, [clave]: undefined }));
  };

  // ---------------------------------------------------------------------------
  // Validación del ID de gestión externa (regla 2.4)
  // ---------------------------------------------------------------------------

  const verificarIdExterno = useMutation({
    mutationFn: (valor: string) =>
      api<{ hay_coincidencias: boolean; coincidencias: ExternalIdMatch[] }>(
        '/customers/check-external-id',
        { params: { value: valor } },
      ),
    onSuccess: (resultado) => {
      setCoincidencias(resultado.coincidencias);
      // El sistema avisa, pero no bloquea ni agrupa por su cuenta: la decisión es
      // de la Empresa Revendedora.
      if (!resultado.hay_coincidencias) setDecisionDuplicado(null);
    },
  });

  const crear = useMutation({
    mutationFn: () =>
      api<{ cliente: CustomerDetail; cuenta_creada: boolean; dispositivo_pendiente_de_activacion: boolean }>(
        '/customers',
        {
          metodo: 'POST',
          body: {
            nombre: valores.nombre.trim(),
            apellido: valores.apellido.trim() || undefined,
            dni: valores.dni.trim(),
            telefono: valores.telefono.trim() || undefined,
            email: valores.email.trim() || undefined,
            direccion: valores.direccion.trim() || undefined,
            id_gestion_externo: valores.idGestionExterno.trim() || undefined,
            tipo_alta: valores.metodoAlta,
            ...(decisionDuplicado?.tipo !== 'agrupar' &&
            valores.metodoAlta === 'dispositivo_compartido'
              ? { servicios: valores.servicios }
              : {}),
            dispositivo: {
              nota_descriptiva: valores.notaDescriptiva.trim() || undefined,
            },
            confirmar_duplicado: decisionDuplicado?.tipo === 'crear' ? true : undefined,
            agrupar_en_cliente_id:
              decisionDuplicado?.tipo === 'agrupar' ? decisionDuplicado.clienteId : undefined,
          },
        },
      ),
    onSuccess: (resultado) => {
      const cliente = (resultado as { cliente: CustomerDetail; agrupado_en?: string }).cliente;
      toast.success(
        resultado.cuenta_creada
          ? 'Cliente dado de alta. Se creó una cuenta nueva en el proveedor.'
          : 'Cliente dado de alta en una cuenta existente.',
      );
      if (resultado.dispositivo_pendiente_de_activacion) {
        toast.info(
          'Se abrirá una ventana de vinculación cuando el cliente inicie sesión por primera vez.',
          { duration: 6000 },
        );
      }
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      navigate(`/customers/${cliente.id}`);
    },
    onError: (causa: ApiError) => {
      // El backend puede devolver la advertencia de duplicado si se llegó acá sin
      // haber decidido (por ejemplo, si otro operador cargó el mismo ID mientras
      // este alta estaba abierta).
      if (causa.esDuplicadoGestionExterna) {
        const lista = (causa.payload?.coincidencias as ExternalIdMatch[]) ?? [];
        setCoincidencias(lista);
        setPaso(0);
        toast.warning('Ya existe un cliente con ese ID de gestión. Elija cómo continuar.');
        return;
      }
      toast.error(causa.message);
    },
  });

  // ---------------------------------------------------------------------------
  // Navegación entre pasos
  // ---------------------------------------------------------------------------

  const validarPaso = (): boolean => {
    if (paso === 0) {
      const nuevos: typeof errores = {};
      if (valores.nombre.trim().length < 2) {
        nuevos.nombre = 'Ingrese el nombre del cliente.';
      }
      if (!/^\d{6,10}$/.test(valores.dni.trim())) {
        nuevos.dni = 'Ingrese un DNI válido (6 a 10 dígitos, sin puntos).';
      }
      if (valores.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valores.email.trim())) {
        nuevos.email = 'Revise el correo: no parece válido.';
      }
      if (coincidencias.length > 0 && !decisionDuplicado) {
        nuevos.idGestionExterno = 'Elija si agrupa el dispositivo o crea un cliente nuevo.';
      }
      setErrores(nuevos);
      return Object.keys(nuevos).length === 0;
    }

    if (paso === 2 && decisionDuplicado?.tipo !== 'agrupar' && !catalogoDisponible) {
      return false;
    }

    return true;
  };

  const siguiente = () => {
    if (!validarPaso()) return;
    // Si se eligió agrupar, el método de alta lo define el flujo de dispositivo
    // adicional: se saltea ese paso.
    if (paso === 0 && decisionDuplicado?.tipo === 'agrupar') {
      setPaso(2);
      return;
    }
    setPaso((actual) => Math.min(actual + 1, PASOS.length - 1));
  };

  const anterior = () => {
    if (paso === 2 && decisionDuplicado?.tipo === 'agrupar') {
      setPaso(0);
      return;
    }
    setPaso((actual) => Math.max(actual - 1, 0));
  };

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-3 -ml-2" onClick={() => navigate('/customers')}>
        <ArrowLeft />
        Volver a clientes
      </Button>

      <PageHeader
        eyebrow="Alta"
        titulo="Nuevo cliente final"
        descripcion="El asistente decide en qué cuenta entra el dispositivo y, si hace falta, crea una cuenta nueva en el proveedor."
      />

      {/* Progreso: los pasos son una secuencia real, así que numerarlos aporta. */}
      <ol className="mb-5 flex flex-wrap gap-2" aria-label="Progreso del alta">
        {PASOS.map((etiqueta, indice) => {
          const activo = indice === paso;
          const completado = indice < paso;
          return (
            <li key={etiqueta} className="flex items-center gap-2">
              <span
                className={cn(
                  'grid size-6 place-items-center rounded-full font-mono text-2xs font-semibold',
                  activo && 'bg-azure-500 text-white',
                  completado && 'bg-signal text-white',
                  !activo && !completado && 'border texto-suave',
                )}
              >
                {completado ? <Check className="size-3" /> : indice + 1}
              </span>
              <span
                className={cn(
                  'text-sm',
                  activo ? 'font-medium' : 'texto-suave',
                  'hidden sm:inline',
                )}
              >
                {etiqueta}
              </span>
              {indice < PASOS.length - 1 ? (
                <span className="mx-1 h-px w-4 bg-[rgb(var(--borde))] sm:w-8" />
              ) : null}
            </li>
          );
        })}
      </ol>

      <Card className="max-w-3xl">
        {crear.isPending ? (
          <CardContent>
            <CargandoAlta />
          </CardContent>
        ) : (
        <CardContent className="space-y-4">
          {/* ---------------------------------------------------------------- */}
          {/* Paso 1 — Datos del cliente                                       */}
          {/* ---------------------------------------------------------------- */}
          {paso === 0 ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nombre" htmlFor="nombre" required error={errores.nombre}>
                  <Input
                    id="nombre"
                    value={valores.nombre}
                    onChange={(evento) => actualizar('nombre', evento.target.value)}
                    autoFocus
                  />
                </Field>
                <Field label="Apellido" htmlFor="apellido">
                  <Input
                    id="apellido"
                    value={valores.apellido}
                    onChange={(evento) => actualizar('apellido', evento.target.value)}
                  />
                </Field>
                <Field
                  label="DNI"
                  htmlFor="dni"
                  required
                  error={errores.dni}
                  help="Dato administrativo del cliente. No se envía al proveedor."
                >
                  <Input
                    id="dni"
                    inputMode="numeric"
                    value={valores.dni}
                    onChange={(evento) =>
                      actualizar('dni', evento.target.value.replace(/\D/g, '').slice(0, 10))
                    }
                  />
                </Field>
                <Field label="Teléfono" htmlFor="telefono">
                  <Input
                    id="telefono"
                    value={valores.telefono}
                    onChange={(evento) => actualizar('telefono', evento.target.value)}
                  />
                </Field>
                <Field label="Correo" htmlFor="email" error={errores.email}>
                  <Input
                    id="email"
                    type="email"
                    value={valores.email}
                    onChange={(evento) => actualizar('email', evento.target.value)}
                  />
                </Field>
                <Field label="Dirección" htmlFor="direccion" className="sm:col-span-2">
                  <Input
                    id="direccion"
                    value={valores.direccion}
                    onChange={(evento) => actualizar('direccion', evento.target.value)}
                  />
                </Field>
              </div>

              <Field
                label="ID en su sistema de gestión"
                htmlFor="id-gestion"
                help="Opcional. Sirve para conciliar este cliente con su CRM o facturación."
                error={errores.idGestionExterno}
              >
                <div className="flex gap-2">
                  <Input
                    id="id-gestion"
                    value={valores.idGestionExterno}
                    onChange={(evento) => {
                      actualizar('idGestionExterno', evento.target.value);
                      setCoincidencias([]);
                      setDecisionDuplicado(null);
                    }}
                    onBlur={(evento) => {
                      const valor = evento.target.value.trim();
                      if (valor) verificarIdExterno.mutate(valor);
                    }}
                  />
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const valor = valores.idGestionExterno.trim();
                      if (valor) verificarIdExterno.mutate(valor);
                    }}
                    disabled={!valores.idGestionExterno.trim() || verificarIdExterno.isPending}
                  >
                    {verificarIdExterno.isPending ? 'Verificando…' : 'Verificar'}
                  </Button>
                </div>
              </Field>

              {/* Advertencia de duplicado con las dos opciones de la regla 2.4 */}
              {coincidencias.length > 0 ? (
                <Alert tone="warning" titulo="Ya existe un cliente con ese ID de gestión">
                  <p className="mb-3">
                    Puede agrupar el dispositivo nuevo en el cliente que ya está registrado, o crear
                    un cliente independiente aunque comparta el ID.
                  </p>
                  <ul className="space-y-2">
                    {coincidencias.map((coincidencia) => (
                      <li
                        key={coincidencia.id}
                        className="superficie flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-medium">{coincidencia.nombre}</p>
                          <p className="font-mono text-2xs texto-suave">
                            N° {coincidencia.numero_cliente} · {coincidencia.dispositivos}{' '}
                            dispositivo(s) · {coincidencia.estado}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant={
                            decisionDuplicado?.tipo === 'agrupar' &&
                            decisionDuplicado.clienteId === coincidencia.id
                              ? 'primary'
                              : 'secondary'
                          }
                          onClick={() =>
                            setDecisionDuplicado({
                              tipo: 'agrupar',
                              clienteId: coincidencia.id,
                              nombre: coincidencia.nombre,
                            })
                          }
                        >
                          Agrupar acá
                        </Button>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3">
                    <Button
                      size="sm"
                      variant={decisionDuplicado?.tipo === 'crear' ? 'primary' : 'secondary'}
                      onClick={() => setDecisionDuplicado({ tipo: 'crear' })}
                    >
                      Crear un cliente nuevo de todos modos
                    </Button>
                  </div>
                </Alert>
              ) : null}

              {decisionDuplicado?.tipo === 'agrupar' ? (
                <Alert tone="info" titulo="Se va a agrupar el dispositivo">
                  El dispositivo se agrega a <strong>{decisionDuplicado.nombre}</strong>. Si su
                  cuenta actual está en el tope, el sistema le asigna una cuenta con capacidad y
                  migra sus dispositivos.
                </Alert>
              ) : null}
            </>
          ) : null}

          {/* ---------------------------------------------------------------- */}
          {/* Paso 2 — Método de alta                                          */}
          {/* ---------------------------------------------------------------- */}
          {paso === 1 ? (
            <div className="space-y-3">
              <p className="text-sm texto-suave">
                Elija cómo se le entrega el servicio a este cliente.
              </p>
              {(Object.keys(customerIntakeLabels) as MetodoAlta[]).map((metodo) => (
                <button
                  key={metodo}
                  type="button"
                  onClick={() => actualizar('metodoAlta', metodo)}
                  className={cn(
                    'w-full rounded-lg border p-4 text-left transition-colors',
                    valores.metodoAlta === metodo
                      ? 'border-azure-500 bg-azure-50 dark:bg-azure-900/30'
                      : 'hover:bg-navy-50 dark:hover:bg-navy-800',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{customerIntakeLabels[metodo]}</p>
                      <p className="mt-0.5 text-sm texto-suave">{customerIntakeHelp[metodo]}</p>
                    </div>
                    <span
                      className={cn(
                        'mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border',
                        valores.metodoAlta === metodo && 'border-azure-500 bg-azure-500',
                      )}
                    >
                      {valores.metodoAlta === metodo ? (
                        <Check className="size-2.5 text-white" />
                      ) : null}
                    </span>
                  </div>
                </button>
              ))}

              <Alert tone="info">
                En una cuenta compartida, todos los clientes finales que estén ahí usan las mismas
                credenciales. Es la contrapartida de aprovechar mejor cada cuenta.
              </Alert>
            </div>
          ) : null}

          {/* ---------------------------------------------------------------- */}
          {/* Paso 3 — Servicios                                               */}
          {/* ---------------------------------------------------------------- */}
          {paso === 2 ? (
            <div className="space-y-4">
              {decisionDuplicado?.tipo === 'agrupar' ? (
                <Alert tone="info" titulo="Servicios heredados">
                  Este Dispositivo adicional usará los mismos servicios de la Cuenta actual de{' '}
                  <strong>{decisionDuplicado.nombre}</strong>. No hace falta seleccionarlos otra vez.
                </Alert>
              ) : catalogo.isPending ? (
                <Alert tone="info" titulo="Cargando servicios">
                  Estamos consultando los servicios contratados. Espere para continuar.
                </Alert>
              ) : catalogo.isError ? (
                <Alert tone="danger" titulo="No se pudo cargar el catálogo">
                  <p className="mb-3">
                    Revise su conexión e intente nuevamente. El alta no puede continuar sin esta
                    información.
                  </p>
                  <Button variant="secondary" size="sm" onClick={() => void catalogo.refetch()}>
                    Reintentar
                  </Button>
                </Alert>
              ) : serviciosContratados.length === 0 ? (
                <Alert tone="warning" titulo="No hay servicios contratados disponibles">
                  No se puede continuar con el alta hasta que el Operador Principal disponga de al
                  menos un servicio contratado.
                </Alert>
              ) : valores.metodoAlta === 'cuenta_exclusiva' ? (
                <div className="space-y-3">
                  <Alert tone="info" titulo="Todos los servicios están incluidos">
                    La Cuenta completa recibe automáticamente todos los servicios contratados. No es
                    necesario elegirlos.
                  </Alert>
                  <ul className="grid gap-2 sm:grid-cols-2" aria-label="Servicios incluidos">
                    {serviciosContratados.map((servicio) => (
                      <li
                        key={servicio.codigo}
                        className="flex items-start gap-3 rounded-lg border px-3 py-3"
                      >
                        <Check className="mt-0.5 size-4 shrink-0 text-signal" aria-hidden="true" />
                        <div>
                          <p className="text-sm font-medium">{servicio.nombre}</p>
                          {servicio.nota ? (
                            <p className="mt-0.5 text-xs texto-suave">{servicio.nota}</p>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="space-y-3">
                  <Alert tone="info">
                    Una Cuenta sólo se comparte con otras ventas que tengan exactamente la misma
                    selección de servicios.
                  </Alert>
                  <fieldset>
                    <legend className="mb-2 text-sm font-medium">Servicios de esta venta</legend>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {serviciosContratados.map((servicio) => {
                        const esBasico = servicio.codigo === '1';
                        const seleccionado = esBasico || valores.servicios.includes(servicio.codigo);
                        return (
                          <label
                            key={servicio.codigo}
                            className={cn(
                              'flex items-start gap-3 rounded-lg border p-3 transition-colors',
                              seleccionado
                                ? 'border-azure-500 bg-azure-50 dark:bg-azure-900/30'
                                : 'cursor-pointer hover:bg-navy-50 dark:hover:bg-navy-800',
                              esBasico && 'cursor-not-allowed',
                            )}
                          >
                            <input
                              type="checkbox"
                              name="servicios"
                              value={servicio.codigo}
                              checked={seleccionado}
                              disabled={esBasico}
                              onChange={(evento) =>
                                actualizar(
                                  'servicios',
                                  evento.target.checked
                                    ? [...valores.servicios, servicio.codigo]
                                    : valores.servicios.filter(
                                        (codigo) => codigo !== servicio.codigo,
                                      ),
                                )
                              }
                              className="mt-0.5 size-4 shrink-0 accent-azure-500"
                            />
                            <span>
                              <span className="block text-sm font-medium">
                                {servicio.nombre}
                                {esBasico ? (
                                  <span className="ml-2 text-xs font-normal texto-suave">
                                    Siempre incluido
                                  </span>
                                ) : null}
                              </span>
                              {servicio.nota ? (
                                <span className="mt-0.5 block text-xs texto-suave">
                                  {servicio.nota}
                                </span>
                              ) : null}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                </div>
              )}

              <Field
                label="Nota interna"
                htmlFor="nota"
                help='Para identificarlo en su panel, por ejemplo "TV del living". No se envía al proveedor.'
              >
                <Textarea
                  id="nota"
                  value={valores.notaDescriptiva}
                  onChange={(evento) => actualizar('notaDescriptiva', evento.target.value)}
                  rows={2}
                />
              </Field>
            </div>
          ) : null}

          {/* ---------------------------------------------------------------- */}
          {/* Paso 4 — Confirmación                                            */}
          {/* ---------------------------------------------------------------- */}
          {paso === 3 ? (
            <div className="space-y-4">
              <dl className="divide-y divide-[rgb(var(--borde))] text-sm">
                <Resumen etiqueta="Cliente">
                  {[valores.nombre, valores.apellido].filter(Boolean).join(' ')}
                </Resumen>
                <Resumen etiqueta="DNI">
                  <span className="id-tecnico">{valores.dni}</span>
                </Resumen>
                {valores.idGestionExterno ? (
                  <Resumen etiqueta="ID de gestión">
                    <span className="id-tecnico">{valores.idGestionExterno}</span>
                  </Resumen>
                ) : null}
                <Resumen etiqueta="Modalidad">
                  {decisionDuplicado?.tipo === 'agrupar'
                    ? `Dispositivo adicional para ${decisionDuplicado.nombre}`
                    : customerIntakeLabels[valores.metodoAlta]}
                </Resumen>
                <Resumen etiqueta="Servicios">
                  {decisionDuplicado?.tipo === 'agrupar' ? (
                    'Heredados de la Cuenta existente'
                  ) : (
                    <ul className="space-y-0.5">
                      {serviciosContratados
                        .filter(
                          (servicio) =>
                            valores.metodoAlta === 'cuenta_exclusiva' ||
                            valores.servicios.includes(servicio.codigo),
                        )
                        .map((servicio) => (
                          <li key={servicio.codigo}>{servicio.nombre}</li>
                        ))}
                    </ul>
                  )}
                </Resumen>
                <Resumen etiqueta="Nota">
                  {valores.notaDescriptiva || 'Sin nota interna'}
                </Resumen>
              </dl>

              <Alert tone="info" titulo="Qué va a pasar al confirmar">
                {decisionDuplicado?.tipo === 'agrupar' ? (
                  <p>
                    Se autoriza un Dispositivo adicional con los servicios de la Cuenta existente
                    (hasta 1 fijo + 1 móvil por venta, en una Cuenta compartida).
                  </p>
                ) : valores.metodoAlta === 'cuenta_exclusiva' ? (
                  <p>
                    La Cuenta completa incluye todos los servicios contratados y permite hasta 3
                    fijos + 3 móviles para este cliente.
                  </p>
                ) : (
                  <p>
                    La venta unitaria autoriza hasta 1 Dispositivo fijo + 1 móvil para este cliente,
                    en una Cuenta compartida sólo con otras ventas de exactamente la misma selección
                    de servicios.
                  </p>
                )}
              </Alert>

              {crear.isError && crear.error instanceof ApiError && crear.error.esProveedorCaido ? (
                <Alert tone="danger" titulo="El proveedor no respondió">
                  {crear.error.message}
                </Alert>
              ) : null}
            </div>
          ) : null}
        </CardContent>
        )}

        {!crear.isPending ? (
          <CardFooter className="justify-between">
            <Button variant="ghost" onClick={anterior} disabled={paso === 0}>
              <ArrowLeft />
              Atrás
            </Button>

            {paso < PASOS.length - 1 ? (
              <Button
                variant="primary"
                onClick={siguiente}
                disabled={
                  paso === 2 && decisionDuplicado?.tipo !== 'agrupar' && !catalogoDisponible
                }
              >
                Continuar
                <ArrowRight />
              </Button>
            ) : (
              <Button variant="primary" onClick={() => crear.mutate()}>
                <UserPlus />
                Dar de alta
              </Button>
            )}
          </CardFooter>
        ) : null}
      </Card>
    </>
  );
};

const Resumen = ({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-4">
    <dt className="eyebrow sm:w-40 sm:shrink-0">{etiqueta}</dt>
    <dd>{children}</dd>
  </div>
);
