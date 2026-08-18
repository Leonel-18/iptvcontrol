import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  MonitorPlay,
  Smartphone,
  UserPlus,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { CustomerDetail, ExternalIdMatch } from '@/lib/types';
import {
  customerIntakeHelp,
  customerIntakeLabels,
  deviceTypeHelp,
  deviceTypeLabels,
} from '@/i18n/entityLabels';
import { PageHeader } from '@/components/common';
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardFooter,
  Field,
  Input,
  Textarea,
} from '@/components/ui/primitives';

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
 *   3. Dispositivo: categoría, MAC opcional y nota interna.
 *   4. Confirmación: se resume qué va a pasar antes de tocar el proveedor.
 * =============================================================================
 */

type MetodoAlta = 'cuenta_exclusiva' | 'dispositivo_compartido';
type TipoDispositivo = 'fijo' | 'movil';

interface EstadoFormulario {
  nombre: string;
  apellido: string;
  telefono: string;
  email: string;
  direccion: string;
  idGestionExterno: string;
  metodoAlta: MetodoAlta;
  tipoDispositivo: TipoDispositivo;
  mac: string;
  notaDescriptiva: string;
}

const INICIAL: EstadoFormulario = {
  nombre: '',
  apellido: '',
  telefono: '',
  email: '',
  direccion: '',
  idGestionExterno: '',
  metodoAlta: 'dispositivo_compartido',
  tipoDispositivo: 'fijo',
  mac: '',
  notaDescriptiva: '',
};

const PASOS = ['Cliente', 'Método de alta', 'Dispositivo', 'Confirmar'] as const;

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
            telefono: valores.telefono.trim() || undefined,
            email: valores.email.trim() || undefined,
            direccion: valores.direccion.trim() || undefined,
            id_gestion_externo: valores.idGestionExterno.trim() || undefined,
            tipo_alta: valores.metodoAlta,
            dispositivo: {
              tipo: valores.tipoDispositivo,
              mac: valores.mac.replace(/[^0-9a-fA-F]/g, '').toUpperCase() || undefined,
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
          'El dispositivo queda a la espera del primer inicio de sesión para capturar su ID.',
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
      if (valores.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valores.email.trim())) {
        nuevos.email = 'Revise el correo: no parece válido.';
      }
      if (coincidencias.length > 0 && !decisionDuplicado) {
        nuevos.idGestionExterno = 'Elija si agrupa el dispositivo o crea un cliente nuevo.';
      }
      setErrores(nuevos);
      return Object.keys(nuevos).length === 0;
    }

    if (paso === 2 && valores.mac) {
      const limpia = valores.mac.replace(/[^0-9a-fA-F]/g, '');
      if (limpia.length !== 12) {
        setErrores({ mac: 'La MAC debe tener 12 dígitos hexadecimales (ej. 03AC1AE60CA7).' });
        return false;
      }
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
          {/* Paso 3 — Dispositivo                                             */}
          {/* ---------------------------------------------------------------- */}
          {paso === 2 ? (
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-sm font-medium">Categoría del dispositivo</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(['fijo', 'movil'] as TipoDispositivo[]).map((tipo) => {
                    const Icono = tipo === 'fijo' ? MonitorPlay : Smartphone;
                    return (
                      <button
                        key={tipo}
                        type="button"
                        onClick={() => actualizar('tipoDispositivo', tipo)}
                        className={cn(
                          'flex items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                          valores.tipoDispositivo === tipo
                            ? 'border-azure-500 bg-azure-50 dark:bg-azure-900/30'
                            : 'hover:bg-navy-50 dark:hover:bg-navy-800',
                        )}
                      >
                        <Icono className="mt-0.5 size-4 shrink-0 texto-suave" />
                        <div>
                          <p className="font-medium">{deviceTypeLabels[tipo]}</p>
                          <p className="text-xs texto-suave">{deviceTypeHelp[tipo]}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs texto-suave">
                  Cada categoría tiene su propio tope de 3 dispositivos por cuenta.
                </p>
              </div>

              <Field
                label="MAC del equipo"
                htmlFor="mac"
                error={errores.mac}
                help="Opcional. Si la informa, el dispositivo se da de alta en el proveedor ahora mismo. Si no, se activa solo cuando el cliente inicie sesión."
              >
                <Input
                  id="mac"
                  value={valores.mac}
                  placeholder="03AC1AE60CA7"
                  onChange={(evento) => actualizar('mac', evento.target.value)}
                  className="font-mono"
                />
              </Field>

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
                {valores.idGestionExterno ? (
                  <Resumen etiqueta="ID de gestión">
                    <span className="id-tecnico">{valores.idGestionExterno}</span>
                  </Resumen>
                ) : null}
                <Resumen etiqueta="Método de alta">
                  {decisionDuplicado?.tipo === 'agrupar'
                    ? `Dispositivo adicional para ${decisionDuplicado.nombre}`
                    : customerIntakeLabels[valores.metodoAlta]}
                </Resumen>
                <Resumen etiqueta="Dispositivo">
                  {deviceTypeLabels[valores.tipoDispositivo]}
                  {valores.mac ? (
                    <span className="id-tecnico ml-2">
                      {valores.mac.replace(/[^0-9a-fA-F]/g, '').toUpperCase()}
                    </span>
                  ) : null}
                </Resumen>
                {valores.notaDescriptiva ? (
                  <Resumen etiqueta="Nota">{valores.notaDescriptiva}</Resumen>
                ) : null}
              </dl>

              <Alert tone="info" titulo="Qué va a pasar al confirmar">
                {valores.metodoAlta === 'cuenta_exclusiva' &&
                decisionDuplicado?.tipo !== 'agrupar' ? (
                  <p>
                    Se crea una cuenta nueva en el proveedor (parametrizada en 1 fijo + 1 móvil) y se
                    activa el dispositivo de este cliente.
                  </p>
                ) : (
                  <p>
                    El sistema busca una cuenta propia con lugar en esa categoría. Si encuentra,
                    amplía su parametrización de a un dispositivo; si no, crea una cuenta nueva.
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

        <CardFooter className="justify-between">
          <Button variant="ghost" onClick={anterior} disabled={paso === 0 || crear.isPending}>
            <ArrowLeft />
            Atrás
          </Button>

          {paso < PASOS.length - 1 ? (
            <Button variant="primary" onClick={siguiente}>
              Continuar
              <ArrowRight />
            </Button>
          ) : (
            <Button variant="primary" onClick={() => crear.mutate()} disabled={crear.isPending}>
              {crear.isPending ? (
                'Dando de alta…'
              ) : (
                <>
                  <UserPlus />
                  Dar de alta
                </>
              )}
            </Button>
          )}
        </CardFooter>
      </Card>

      {crear.isPending ? (
        <p className="mt-3 flex items-center gap-2 text-sm texto-suave">
          <CircleAlert className="size-4" />
          Estamos hablando con el proveedor. No cierre esta pantalla.
        </p>
      ) : null}
    </>
  );
};

const Resumen = ({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-4">
    <dt className="eyebrow sm:w-40 sm:shrink-0">{etiqueta}</dt>
    <dd>{children}</dd>
  </div>
);
