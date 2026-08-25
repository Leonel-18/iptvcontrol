---
tags: [operacion, auditoria]
deriva-de: docs/03_Reglas_de_Negocio.md (sección 11)
implementado-en: backend/src/common/audit/ · backend/src/modules/auditoria/
---

# Registro de auditoría

Cada acción sensible queda registrada con **quién** la ejecutó, **cuándo** y **sobre qué**.

## Qué se registra

| Acción | Entidad |
|---|---|
| Alta, suspensión, reactivación y baja definitiva de Cliente Final | ClienteFinal |
| Alta, baja y resolución de descubrimiento ambiguo | Dispositivo |
| Liberación y reposición de reservas técnicas | Dispositivo |
| Alta y cierre de Cuenta | Cuenta |
| Cambio de modalidad comercial o de escala | EmpresaRevendedora |
| Cambio de precios | ModalidadComercial |
| Alta y baja de Empresa Revendedora | EmpresaRevendedora |
| Cambio de configuración del Proveedor | ConfiguracionProveedor |
| Alta, reenvío de invitación y baja de Team Member | TeamMember |

## Quién consulta qué

- El **Operador Principal** ve el log completo de todas sus Empresas Revendedoras.
- Cada **Empresa Revendedora** ve únicamente sus propias acciones.

Pero con una condición que se implementa en el backend: cuando un registro involucra a un Cliente
Final, el Operador Principal ve el **ID y el número de cliente**, nunca el nombre ni los datos de
contacto. El campo `detalle` se filtra por claves reservadas antes de serializarlo — si no, la
restricción de la [[Aislamiento multi-tenant|regla 4.2]] se filtraría por la ventana de atrás.

## Regla de oro para escribir en el log

> El `detalle` **no debe contener** credenciales de Cuenta ni datos de contacto de Clientes Finales.

Se registran IDs, números de cliente, tipos, estados y valores anterior/nuevo. Nunca nombres,
teléfonos, correos, notas descriptivas, contraseñas ni tokens.

## Lo que no incluye el MVP

> Alertas automáticas por correo o notificación push sobre eventos del log. Por ahora es **consulta
> manual** dentro del panel.

## Ver también

- [[Aislamiento multi-tenant]]
- [[Reporte de consumo]]
