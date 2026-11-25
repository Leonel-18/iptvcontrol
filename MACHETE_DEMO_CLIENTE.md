# MACHETE — Demo cliente IPTVControl

> Chuleta de un monitor para la videollamada. Corto, al pie.

## ANTES DE EMPEZAR
☐ Login empresa demo listo (usuario reseller_admin)
☐ Empresa demo con modalidad + precio cargados
☐ 1 Cuenta compartida VACÍA (para mostrar pendientes 1+1→2)
☐ 1 cliente de prueba (Juan Prueba)
☐ Servicios cargados (básico 1 incluido)
☐ No usar clientes reales ni cuentas productivas

## INTRO (2 min)
"Es un sistema para administrar tus cuentas IPTV y a quién se las vendés.
Vas a trabajar con: EMPRESA → CUENTA → CLIENTE → DISPOSITIVO."

## MOSTRAR (en orden)
1. **Login** — cada persona con su acceso; ves SOLO tu empresa.
2. **Dashboard** — clientes, cuentas, dispositivos, modalidad/precio, avisos.
3. **Cuentas → abrir compartida** — tipo, "Cupos 1+1: X de 3", pestañas.
4. **Clientes (pestaña)** — venta 1+1, reserva editable, columna **Pendientes**.
5. **Alta de cliente (wizard)** — 4 pasos; ID de gestión opcional (aviso si repetido).
6. **Resultado** — venta reservada; pendientes 2 (1+1) o 4 (2+2).
7. **Dispositivos** — "Consultar en el proveedor"; equipos no asociados = incidencias
   (Agregar a / Eliminar), NUNCA se borran solos.
8. **Estados cliente** — activo / suspendido (reserva) / baja definitiva (irreversible).
9. **Límites** — panel arriba del alta: total vs mensual.
10. **Errores** — aparecen dentro del formulario (no solo toast).

## RECORDAR EXPLICAR
- **Límite total ≠ límite mensual**
  - Total: cuántas cuentas PODÉS TENER.
  - Mensual: cuántas PODÉS CREAR este mes.
  - Ej: Límite 30 / actuales 20 / disponibles 10 · Mensual 10 / creadas 8 / quedan 2.
- **1+1 = 1 fijo + 1 móvil**. 2+2 = 2 fijos + 2 móviles. No existen 1+2 ni 2+1.
- **Pendiente ≠ dispositivo creado**. Es virtual (lo vendido − lo cargado).
  - 1+1 sin equipos → 2 pendientes. 2+2 sin equipos → 4 pendientes.
- **Aislamiento**: cada empresa ve solo lo suyo; el Operador NO ve nombres/credenciales de tus clientes.
- **Ventana de Alta**: tras una venta compartida, la Cuenta no recibe OTRO cliente nuevo por un rato (lo define cada empresa; 0 = desactivada).
- **Credenciales compartidas**: clientes de la misma Cuenta comparten usuario/contraseña; no se rota automáticamente.

## PREGUNTAS PROBABLES
1. ¿Desde cualquier compu? → Sí, con tu acceso.
2. ¿Cada empleado su usuario? → Hoy tu empresa tiene 1 acceso; se suman desde Equipo.
3. ¿Veo otra empresa? → No.
4. ¿Cuántas cuentas puedo crear? → Lo ves en el panel de límites.
5. ¿Qué pasa si llego al límite? → No creás más (total) / el mes que viene (mensual).
6. ¿Por qué dice "pendiente" si no cargó nada? → Es lo que falta cubrir, no un equipo real.
7. ¿Puedo borrar un cliente? → "Baja definitiva" (irreversible).
8. ¿Quién ve mis contraseñas? → Solo gente de tu empresa; el Operador no.
9. ¿Esto factura? → No; exportás CSV y la facturación es por fuera.
10. ¿Hay API? → No disponible todavía (futuro).

## NO PROMETER (si te preguntan)
- Cerrar/eliminar una cuenta desde el panel (no hay botón hoy).
- Rotación automática de contraseña.
- Cambiar el DNI de una cuenta (SENSA no lo permite).
- API pública, backups garantizados ni SLA (sin definir).

## SI ALGO FALLA
- Proveedor caído: "no respondió, no se perdió nada, reintentamos".
- Error 500: "error interno, lo revisamos". No muestres técnico.
- Botón que no aparece: revisá rol/estado; no inventes la función.
- Sin equipo físico: mostrá Pendientes y explicá el flujo conceptual.

## CIERRE
"¿Vamos con una venta de prueba 1+1? Después probamos estados y después vemos límites y exportación."
