-- =============================================================================
-- Verificación manual del aislamiento multi-tenant (Row-Level Security)
-- =============================================================================
-- Se ejecuta como el usuario de aplicación (iptvcontrol_app), NO como owner:
--
--   psql "postgresql://iptvcontrol_app:<pass>@localhost:5432/iptvcontrol" \
--        -f prisma/verificar-rls.sql
--
-- Qué prueba: que una Empresa Revendedora sólo vea sus propias filas, incluso
-- ejecutando un SELECT sin ninguna cláusula WHERE — o sea, incluso si la capa de
-- aplicación se equivocara. Es la razón de ser de la segunda capa de defensa.
--
-- Resultado esperado en el bloque final: dos filas para el operador (o las que
-- haya), una sola para el tenant A, una sola para el tenant B, y CERO cuando no
-- hay contexto seteado.
--
-- ATENCIÓN: el script crea dos Empresas Revendedoras y dos Clientes Finales de
-- prueba, y al final los borra. Aun así, correrlo contra la base de producción
-- no tiene sentido: usalo en un entorno de prueba.
-- =============================================================================

\echo '== Preparación: dos Empresas Revendedoras de prueba =='

BEGIN;

-- Contexto de operador para poder insertar las empresas de prueba.
SELECT set_config(
  'app.current_operador',
  (SELECT id::text FROM operador_principal ORDER BY creado_en LIMIT 1),
  TRUE
);
SELECT set_config('app.is_operator', 'on', TRUE);
SELECT set_config('app.current_tenant', '', TRUE);

INSERT INTO empresa_revendedora (
  id, operador_principal_id, razon_social, cuit, direccion, nombre_contacto,
  apellido_contacto, telefono_contacto, email_contacto, creado_en, actualizado_en
)
SELECT
  '11111111-1111-1111-1111-111111111111',
  (SELECT id FROM operador_principal ORDER BY creado_en LIMIT 1),
  'ISP Prueba A', '30000000001', 'Calle A 100', 'Ana', 'Alvarez',
  '2610000001', 'contacto@isp-a.test', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM empresa_revendedora WHERE id = '11111111-1111-1111-1111-111111111111'
);

INSERT INTO empresa_revendedora (
  id, operador_principal_id, razon_social, cuit, direccion, nombre_contacto,
  apellido_contacto, telefono_contacto, email_contacto, creado_en, actualizado_en
)
SELECT
  '22222222-2222-2222-2222-222222222222',
  (SELECT id FROM operador_principal ORDER BY creado_en LIMIT 1),
  'ISP Prueba B', '30000000002', 'Calle B 200', 'Beto', 'Benitez',
  '2610000002', 'contacto@isp-b.test', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM empresa_revendedora WHERE id = '22222222-2222-2222-2222-222222222222'
);

-- Un Cliente Final para cada una. Se necesita contexto de tenant porque la
-- política de escritura de cliente_final sólo admite el propio tenant.
SELECT set_config('app.is_operator', 'off', TRUE);

SELECT set_config('app.current_tenant', '11111111-1111-1111-1111-111111111111', TRUE);
INSERT INTO cliente_final (
  id, empresa_revendedora_id, numero_cliente, nombre, tipo_alta, estado,
  creado_en, actualizado_en
)
SELECT
  '1a1a1a1a-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  1, 'Cliente de A', 'dispositivo_compartido', 'activo', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM cliente_final WHERE id = '1a1a1a1a-1111-1111-1111-111111111111'
);

SELECT set_config('app.current_tenant', '22222222-2222-2222-2222-222222222222', TRUE);
INSERT INTO cliente_final (
  id, empresa_revendedora_id, numero_cliente, nombre, tipo_alta, estado,
  creado_en, actualizado_en
)
SELECT
  '2b2b2b2b-2222-2222-2222-222222222222',
  '22222222-2222-2222-2222-222222222222',
  1, 'Cliente de B', 'dispositivo_compartido', 'activo', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM cliente_final WHERE id = '2b2b2b2b-2222-2222-2222-222222222222'
);

COMMIT;

\echo ''
\echo '== 1) Contexto del tenant A: debe ver SOLO su cliente =='
BEGIN;
  SELECT set_config('app.is_operator', 'off', TRUE);
  SELECT set_config('app.current_operador', '', TRUE);
  SELECT set_config('app.current_tenant', '11111111-1111-1111-1111-111111111111', TRUE);
  -- SELECT sin WHERE a propósito: así se ve que el filtro lo hace Postgres.
  SELECT nombre, empresa_revendedora_id FROM cliente_final;
COMMIT;

\echo ''
\echo '== 2) Contexto del tenant B: debe ver SOLO su cliente =='
BEGIN;
  SELECT set_config('app.is_operator', 'off', TRUE);
  SELECT set_config('app.current_operador', '', TRUE);
  SELECT set_config('app.current_tenant', '22222222-2222-2222-2222-222222222222', TRUE);
  SELECT nombre, empresa_revendedora_id FROM cliente_final;
COMMIT;

\echo ''
\echo '== 3) Contexto del Operador Principal: alcanza las filas (para contar) =='
BEGIN;
  SELECT set_config('app.is_operator', 'on', TRUE);
  SELECT set_config(
    'app.current_operador',
    (SELECT id::text FROM operador_principal ORDER BY creado_en LIMIT 1),
    TRUE
  );
  SELECT set_config('app.current_tenant', '', TRUE);
  SELECT count(*) AS clientes_visibles_para_el_operador FROM cliente_final;
COMMIT;

\echo ''
\echo '== 4) Sin contexto: no debe ver NINGUN cliente =='
BEGIN;
  SELECT set_config('app.is_operator', 'off', TRUE);
  SELECT set_config('app.current_operador', '', TRUE);
  SELECT set_config('app.current_tenant', '', TRUE);
  SELECT count(*) AS clientes_visibles_sin_contexto FROM cliente_final;
COMMIT;

\echo ''
\echo '== 5) El tenant A no puede escribir en el tenant B =='
BEGIN;
  SELECT set_config('app.is_operator', 'off', TRUE);
  SELECT set_config('app.current_tenant', '11111111-1111-1111-1111-111111111111', TRUE);
  -- Se espera 0 filas afectadas: la política USING no alcanza la fila de B.
  UPDATE cliente_final SET nombre = 'INTENTO DE INTRUSION'
   WHERE id = '2b2b2b2b-2222-2222-2222-222222222222';
COMMIT;

\echo ''
\echo '== Comprobación final: el cliente de B quedó intacto =='
BEGIN;
  SELECT set_config('app.current_tenant', '22222222-2222-2222-2222-222222222222', TRUE);
  SELECT nombre FROM cliente_final WHERE id = '2b2b2b2b-2222-2222-2222-222222222222';
COMMIT;

\echo ''
\echo '== Limpieza: se borran los datos de prueba =='
BEGIN;
  -- El borrado necesita el contexto de cada tenant, por la misma política que
  -- impidió la intrusión del punto 5. Es otra forma de comprobar que funciona.
  SELECT set_config('app.is_operator', 'off', TRUE);

  SELECT set_config('app.current_tenant', '11111111-1111-1111-1111-111111111111', TRUE);
  DELETE FROM cliente_final WHERE id = '1a1a1a1a-1111-1111-1111-111111111111';

  SELECT set_config('app.current_tenant', '22222222-2222-2222-2222-222222222222', TRUE);
  DELETE FROM cliente_final WHERE id = '2b2b2b2b-2222-2222-2222-222222222222';

  SELECT set_config('app.is_operator', 'on', TRUE);
  SELECT set_config(
    'app.current_operador',
    (SELECT id::text FROM operador_principal ORDER BY creado_en LIMIT 1),
    TRUE
  );
  SELECT set_config('app.current_tenant', '', TRUE);
  DELETE FROM empresa_revendedora
   WHERE id IN (
     '11111111-1111-1111-1111-111111111111',
     '22222222-2222-2222-2222-222222222222'
   );
COMMIT;

\echo 'Verificación finalizada.'

-- =============================================================================
-- Prueba adicional: el Operador Principal puede administrar el login de sus
-- Empresas Revendedoras (docs/04, sección 4.7), sin alcanzar los de otro Operador.
-- =============================================================================

\echo ''
\echo '== 6) El Operador puede crear el reseller_admin de su Empresa Revendedora =='
BEGIN;
  SELECT set_config('app.is_operator', 'on', TRUE);
  SELECT set_config(
    'app.current_operador',
    (SELECT id::text FROM operador_principal ORDER BY creado_en LIMIT 1),
    TRUE
  );
  SELECT set_config('app.current_tenant', '', TRUE);

  -- Una Empresa Revendedora de prueba, para no depender del orden de ejecución.
  INSERT INTO empresa_revendedora (
    id, operador_principal_id, razon_social, cuit, direccion, nombre_contacto,
    apellido_contacto, telefono_contacto, email_contacto, creado_en, actualizado_en
  )
  SELECT
    '33333333-3333-3333-3333-333333333333',
    (SELECT id FROM operador_principal ORDER BY creado_en LIMIT 1),
    'ISP Prueba C', '30000000003', 'Calle C 300', 'Carla', 'Cabral',
    '2610000003', 'contacto@isp-c.test', NOW(), NOW()
  WHERE NOT EXISTS (
    SELECT 1 FROM empresa_revendedora WHERE id = '33333333-3333-3333-3333-333333333333'
  );

  -- Esto es lo que fallaba antes de la migración 20260814120200: el
  -- reseller_admin tiene operador_principal_id NULL y lo crea el Operador.
  INSERT INTO team_member (
    id, operador_principal_id, empresa_revendedora_id, email, rol, estado,
    creado_en, actualizado_en
  )
  SELECT
    '3c3c3c3c-3333-3333-3333-333333333333',
    NULL,
    '33333333-3333-3333-3333-333333333333',
    'admin@isp-c.test', 'reseller_admin', 'invitado', NOW(), NOW()
  WHERE NOT EXISTS (
    SELECT 1 FROM team_member WHERE id = '3c3c3c3c-3333-3333-3333-333333333333'
  );

  SELECT count(*) AS team_members_visibles_para_el_operador FROM team_member;
COMMIT;

\echo ''
\echo '== 7) La Empresa Revendedora ve su propio login y ninguno más =='
BEGIN;
  SELECT set_config('app.is_operator', 'off', TRUE);
  SELECT set_config('app.current_operador', '', TRUE);
  SELECT set_config('app.current_tenant', '33333333-3333-3333-3333-333333333333', TRUE);
  SELECT email FROM team_member;
COMMIT;

\echo ''
\echo '== Limpieza de la prueba de logins =='
BEGIN;
  SELECT set_config('app.is_operator', 'on', TRUE);
  SELECT set_config(
    'app.current_operador',
    (SELECT id::text FROM operador_principal ORDER BY creado_en LIMIT 1),
    TRUE
  );
  SELECT set_config('app.current_tenant', '', TRUE);
  DELETE FROM team_member WHERE id = '3c3c3c3c-3333-3333-3333-333333333333';
  DELETE FROM empresa_revendedora WHERE id = '33333333-3333-3333-3333-333333333333';
COMMIT;
