/**
 * =============================================================================
 * Seed del primer Team Member root — `npm run seed:root`
 * =============================================================================
 * Resuelve el problema del "arranque en frío" (docs/04_Esqueleto_Tecnico_Inicial.md,
 * sección 4.6): el sistema exige un `operator_admin` para dar de alta cualquier
 * cosa, pero ese primer `operator_admin` no puede crearse desde el panel, porque
 * en ese momento no existe nadie con permisos para crearlo.
 *
 * Qué inserta, una sola vez:
 *   1. El Operador Principal (Tecnología Activa).
 *   2. El Proveedor SENSA.
 *   3. Un TeamMember con rol `operator_admin`, vinculado al usuario de Auth0.
 *
 * Variante implementada: **script manual**, ejecutado a mano una vez al
 * desplegar. La alternativa (seed automático disparado por `docker-compose up`
 * cuando la tabla `team_member` está vacía) sigue **pendiente de definición con
 * Federico** (docs/05_Decisiones_Pendientes.md, sección 2), así que no se decide
 * acá: el script es idempotente, de modo que si más adelante se lo engancha al
 * arranque del contenedor, correrlo dos veces no rompe nada.
 *
 * Sobre el usuario de Auth0:
 *   - Si se informa `SEED_ROOT_AUTH0_USER_ID`, se usa ese (usuario ya creado a
 *     mano en el dashboard de Auth0).
 *   - Si no, y hay credenciales de Management API, el script crea el usuario y
 *     muestra el link de invitación para que Bruno elija su contraseña.
 *   - Si no hay ninguna de las dos cosas, el TeamMember queda registrado sin
 *     `auth0_user_id` y el script explica cómo completarlo. Preferimos eso a
 *     fallar: el resto de la configuración inicial queda hecha igual.
 *
 * Se conecta con DATABASE_URL_MIGRATIONS (owner del schema) para no depender de
 * las políticas de Row-Level Security, que todavía no tienen contexto de tenant
 * al momento del bootstrap.
 * =============================================================================
 */
import { PrismaClient, RolTeamMember, EstadoTeamMember } from '@prisma/client';
import { createCipheriv, randomBytes, randomUUID } from 'node:crypto';

const CONECTOR_SENSA = 'sensa';

const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_URL_MIGRATIONS ?? process.env.DATABASE_URL ?? '' },
  },
});

/** Cifra igual que CryptoService, para no arrastrar todo NestJS al seed. */
const cifrar = (valor: string, claveHex: string): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(claveHex, 'hex'), iv);
  const datos = Buffer.concat([cipher.update(valor, 'utf8'), cipher.final()]);
  return [
    'v1',
    iv.toString('base64'),
    cipher.getAuthTag().toString('base64'),
    datos.toString('base64'),
  ].join(':');
};

async function crearUsuarioAuth0(
  email: string,
  operadorPrincipalId: string,
): Promise<{ auth0UserId: string | null; urlInvitacion: string | null }> {
  const dominio = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_MGMT_CLIENT_ID;
  const clientSecret = process.env.AUTH0_MGMT_CLIENT_SECRET;

  if (!dominio || !clientId || !clientSecret) {
    return { auth0UserId: null, urlInvitacion: null };
  }

  // Import diferido: si Auth0 no está configurado, no hace falta ni cargarlo.
  const { ManagementClient } = await import('auth0');
  const management = new ManagementClient({ domain: dominio, clientId, clientSecret });

  const existente = await management.usersByEmail
    .getByEmail({ email })
    .then((respuesta) => respuesta.data?.[0])
    .catch(() => undefined);

  const metadata = {
    rol: RolTeamMember.operator_admin,
    operador_principal_id: operadorPrincipalId,
    empresa_revendedora_id: null,
  };

  const usuario =
    existente ??
    (
      await management.users.create({
        connection: process.env.AUTH0_DB_CONNECTION ?? 'Username-Password-Authentication',
        email,
        password: `${randomUUID()}Aa1!`,
        email_verified: false,
        app_metadata: metadata,
      })
    ).data;

  if (existente) {
    await management.users.update(
      { id: usuario.user_id },
      { app_metadata: { ...(usuario.app_metadata ?? {}), ...metadata } },
    );
  }

  const ticket = await management.tickets.changePassword({
    user_id: usuario.user_id,
    result_url: `${process.env.APP_PUBLIC_URL ?? 'http://localhost:5173'}/welcome`,
    ttl_sec: Number(process.env.AUTH0_INVITATION_TTL_SEC ?? 259200),
  });

  return { auth0UserId: usuario.user_id, urlInvitacion: ticket.data.ticket };
}

async function main(): Promise<void> {
  const nombreOperador = process.env.SEED_OPERADOR_NOMBRE ?? 'TECNOLOGIA ACTIVA S.A.S.';
  const emailRoot = process.env.SEED_ROOT_EMAIL;
  const dniInicial = Number(process.env.SEED_DNI_INICIAL_SENSA ?? 30000000);
  const claveMaestra = process.env.ENCRYPTION_MASTER_KEY ?? '';

  if (!emailRoot) {
    throw new Error(
      'Falta SEED_ROOT_EMAIL: es el email del primer operator_admin (el login de Bruno).',
    );
  }
  if (!/^\d{7,8}$/.test(String(dniInicial))) {
    throw new Error(
      `SEED_DNI_INICIAL_SENSA inválido (${dniInicial}): el proveedor exige 7 u 8 dígitos.`,
    );
  }

  console.log('== Seed inicial de IPTVControl ==');

  // 1. Proveedor SENSA -------------------------------------------------------
  const proveedor = await prisma.proveedor.upsert({
    where: { nombre: 'SENSA' },
    update: { tipoConector: CONECTOR_SENSA },
    create: { nombre: 'SENSA', tipoConector: CONECTOR_SENSA },
  });
  console.log(`   Proveedor SENSA listo (${proveedor.id}).`);

  // 2. Operador Principal ----------------------------------------------------
  const operadorExistente = await prisma.operadorPrincipal.findFirst({
    where: { nombre: nombreOperador },
  });

  const operador =
    operadorExistente ??
    (await prisma.operadorPrincipal.create({
      data: {
        nombre: nombreOperador,
        proveedorActivoId: proveedor.id,
        dniInicialSensa: dniInicial,
        // Arranca en inicial - 1: el primer alta consume exactamente el inicial.
        dniActualSensa: dniInicial - 1,
      },
    }));

  if (operadorExistente && !operadorExistente.proveedorActivoId) {
    await prisma.operadorPrincipal.update({
      where: { id: operador.id },
      data: { proveedorActivoId: proveedor.id },
    });
  }
  console.log(`   Operador Principal "${operador.nombre}" listo (${operador.id}).`);

  // 3. Configuración del Proveedor (placeholder, se completa desde el panel) --
  const configuracionExistente = await prisma.configuracionProveedor.findUnique({
    where: {
      operadorPrincipalId_proveedorId: {
        operadorPrincipalId: operador.id,
        proveedorId: proveedor.id,
      },
    },
  });

  if (!configuracionExistente && /^[0-9a-fA-F]{64}$/.test(claveMaestra)) {
    // Se crea una fila vacía sólo si hay clave de cifrado disponible; el token
    // real lo carga Bruno desde Configuración → Conexión con el proveedor.
    await prisma.configuracionProveedor.create({
      data: {
        operadorPrincipalId: operador.id,
        proveedorId: proveedor.id,
        server: process.env.SEED_SENSA_SERVER ?? 'api.sensa.com.ar',
        port: Number(process.env.SEED_SENSA_PORT ?? 443),
        usuario: process.env.SEED_SENSA_USER ?? 'pendiente',
        tokenCifrado: cifrar(process.env.SEED_SENSA_TOKEN ?? 'pendiente', claveMaestra),
      },
    });
    console.log(
      '   Configuración del proveedor creada como placeholder: completar servidor, usuario y ' +
        'token desde el panel (Configuración → Conexión con el proveedor).',
    );
  }

  // 4. Primer Team Member root ----------------------------------------------
  const email = emailRoot.trim().toLowerCase();
  const yaExiste = await prisma.teamMember.findUnique({ where: { email } });

  if (yaExiste) {
    console.log(`   El Team Member ${email} ya existe (${yaExiste.id}). No se vuelve a crear.`);
  } else {
    const auth0IdManual = process.env.SEED_ROOT_AUTH0_USER_ID?.trim();
    let auth0UserId: string | null = auth0IdManual || null;
    let urlInvitacion: string | null = null;

    if (!auth0UserId) {
      const resultado = await crearUsuarioAuth0(email, operador.id).catch((error) => {
        console.warn(`   No se pudo crear el usuario en Auth0: ${(error as Error).message}`);
        return { auth0UserId: null, urlInvitacion: null };
      });
      auth0UserId = resultado.auth0UserId;
      urlInvitacion = resultado.urlInvitacion;
    }

    const teamMember = await prisma.teamMember.create({
      data: {
        operadorPrincipalId: operador.id,
        email,
        nombre: 'Administrador',
        rol: RolTeamMember.operator_admin,
        estado: auth0UserId ? EstadoTeamMember.invitado : EstadoTeamMember.invitado,
        auth0UserId,
      },
    });

    console.log(`   Team Member root creado: ${email} (${teamMember.id}).`);

    if (urlInvitacion) {
      console.log('\n   Link de un solo uso para definir la contraseña:');
      console.log(`   ${urlInvitacion}\n`);
    } else if (!auth0UserId) {
      console.log(
        '\n   ATENCIÓN: el Team Member quedó sin usuario de Auth0.\n' +
          '   Para habilitar el login hay que, por fuera de este repositorio:\n' +
          `     1. Crear el usuario ${email} en el tenant de Auth0.\n` +
          '     2. Copiar su user_id (ej. auth0|abc123) en SEED_ROOT_AUTH0_USER_ID.\n' +
          '     3. Volver a ejecutar `npm run seed:root`, o actualizar la columna\n' +
          '        team_member.auth0_user_id directamente.\n',
      );
    }
  }

  // 5. Modalidades comerciales de arranque ----------------------------------
  // Valores de referencia de la propuesta comercial. Los precios definitivos los
  // parametriza el Operador Principal desde el panel; se siembran dos modalidades
  // de ejemplo para que el alta de la primera Empresa Revendedora no quede
  // bloqueada esperando que alguien cree una modalidad a mano.
  const modalidades = await prisma.modalidadComercial.count({
    where: { operadorPrincipalId: operador.id },
  });

  if (modalidades === 0) {
    await prisma.modalidadComercial.createMany({
      data: [
        {
          operadorPrincipalId: operador.id,
          tipo: 'menudeo',
          escala: 'Menudeo 1-50',
          precioPorCuenta: 0,
          vigenteDesde: new Date(),
        },
        {
          operadorPrincipalId: operador.id,
          tipo: 'obligacion_mensual',
          escala: 'X5',
          precioPorCuenta: 0,
          ritmoIncremento: 5,
          vigenteDesde: new Date(),
        },
      ],
    });
    console.log(
      '   Modalidades comerciales de arranque creadas con precio 0: cargar los precios reales ' +
        'desde Planes comerciales.',
    );
  }

  console.log('\n== Seed completado ==');
  console.log('   Próximos pasos en el panel:');
  console.log('     1. Configuración → Conexión con el proveedor (servidor, usuario, token).');
  console.log('     2. Planes comerciales → cargar precios reales.');
  console.log('     3. Empresas Revendedoras → dar de alta la primera.');
}

main()
  .catch((error) => {
    console.error('\nEl seed falló:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
