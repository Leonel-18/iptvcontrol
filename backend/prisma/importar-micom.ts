/**
 * =============================================================================
 * Importación de Cuentas y Clientes Finales de Micom ya existentes en SENSA
 * =============================================================================
 * Uso (desde el contenedor del backend):
 *   npm run import:micom              -> DRY-RUN, no escribe nada, sólo reporta
 *   npm run import:micom -- --commit  -> escribe de verdad
 *
 * IMPORTANTE — el archivo de datos NO se versiona (contiene nombre, email,
 * teléfono y dirección reales de terceros): `backend/prisma/data/` está en
 * `.gitignore`. Hay que copiar `importar-micom.json` a mano a esa ruta en la
 * VPS (ej. `scp`) antes de correr este script — no llega solo con `git pull`.
 *
 * Reglas aplicadas (confirmadas con Bruno, 27/08/2026, sobre 101 filas reales
 * de Micom filtradas por él mismo en Excel — ver conversación de esa fecha):
 *
 *  - Cada fila es una Cuenta EXCLUSIVA que YA EXISTE en SENSA: este script
 *    NUNCA llama a la API del Proveedor, sólo registra localmente lo que ya
 *    está allá. Por eso corre con Prisma directo, no vía HTTP.
 *  - `usuario` = columna "DNI(Usuario)"; `dni_alta_sensa` = el mismo valor.
 *  - `password` = el DNI invertido dígito por dígito (ej. 11000001 ->
 *    10000011). Confirmado con un login real contra player.sensa.com.ar el
 *    27/08/2026 — no es una convención inventada por IPTVControl.
 *  - `pin` = columna PIN del CSV, tal cual.
 *  - `proveedor_cuenta_id` = columna "ID Interno", tal cual (en casi todas las
 *    filas coincide con el DNI, pero no siempre — no se asume, se respeta el
 *    valor real que reportó SENSA).
 *  - `servicios`: se mapean los nombres de la columna "Servicios" a los
 *    códigos de `SENSA_SERVICIOS` (backend/src/proveedor/sensa/sensa.constants.ts).
 *  - `estado`: "Fecha baja" = SINFECHA -> activo/activa; con fecha real ->
 *    dado_de_baja/cerrada.
 *  - nombre/apellido/teléfono genéricos ("Micom"/"Internet", mismo teléfono
 *    repetido en casi todas las filas): se mantienen tal cual el CSV, a
 *    pedido explícito de Bruno — se corrigen después, fila por fila, si hace
 *    falta.
 *  - NO se crean Dispositivos: el CSV no tiene MAC ni proveedor_device_id, así
 *    que inventarlos sería peor que no tenerlos. Se resuelven después con el
 *    botón "Consultar al proveedor" (`POST /accounts/:id/sync-devices`) en
 *    cada Cuenta importada — ese flujo ya existe y trae el inventario real.
 *  - Idempotente: si ya existe una Cuenta con ese `dni_alta_sensa`,
 *    `proveedor_cuenta_id` o `email_contacto`, la fila se saltea y se reporta
 *    (permite reintentar sin duplicar si el script se corta a mitad de camino).
 * =============================================================================
 */
import {
  EstadoClienteFinal,
  EstadoCuenta,
  PrismaClient,
  TipoAltaClienteFinal,
} from '@prisma/client';
import { createCipheriv, randomBytes } from 'node:crypto';
import filas from './data/importar-micom.json';

const EMPRESA_REVENDEDORA_ID = '4b317832-561c-4675-ae50-64e4f54eea5a';
const NOMBRE_PROVEEDOR = 'SENSA';
/** Máximo comercial global de una Cuenta (docs/02, sección "Cuenta"). */
const LIMITE_DISPOSITIVOS = 3;

/** Debe coincidir con SENSA_SERVICIOS de backend/src/proveedor/sensa/sensa.constants.ts */
const CODIGO_POR_NOMBRE: Record<string, string> = {
  BASICO: '1',
  'HOT PACK': '2',
  'UNIVERSAL+': '3',
  'PACK FUTBOL': '4',
  'HBO PACK': '5',
  'GOLF TV': '6',
  CINDIE: '7',
};

interface FilaCsv {
  'DNI(Usuario)': string;
  PIN: string;
  'ID Interno': string;
  Nombre: string;
  Apellido: string;
  Email: string;
  Telf: string;
  Dirección: string;
  'Fecha alta': string;
  'Fecha baja': string;
  'Dispositivos móviles': string;
  'Dispositivos fijos': string;
  Servicios: string;
}

const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_URL_MIGRATIONS ?? process.env.DATABASE_URL ?? '' },
  },
});

/** Cifra igual que CryptoService (AES-256-GCM), sin arrastrar todo NestJS. */
const cifrar = (valor: string, claveHex: string): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(claveHex, 'hex'), iv);
  const cifrado = Buffer.concat([cipher.update(valor, 'utf8'), cipher.final()]);
  return [
    'v1',
    iv.toString('base64'),
    cipher.getAuthTag().toString('base64'),
    cifrado.toString('base64'),
  ].join(':');
};

const invertirDni = (dni: string): string => dni.split('').reverse().join('');

const mapearServicios = (texto: string): string => {
  const codigos = texto
    .split('&')
    .map((nombre) => nombre.trim())
    .map((nombre) => {
      const codigo = CODIGO_POR_NOMBRE[nombre];
      if (!codigo) throw new Error(`Servicio desconocido en el CSV: "${nombre}"`);
      return codigo;
    });
  return [...new Set(codigos)].sort((a, b) => Number(a) - Number(b)).join('|');
};

async function main(): Promise<void> {
  const commit = process.argv.includes('--commit');
  const claveMaestra = process.env.ENCRYPTION_MASTER_KEY ?? '';
  if (!/^[0-9a-fA-F]{64}$/.test(claveMaestra)) {
    throw new Error('ENCRYPTION_MASTER_KEY inválida o ausente en el entorno.');
  }

  const empresa = await prisma.empresaRevendedora.findUnique({
    where: { id: EMPRESA_REVENDEDORA_ID },
  });
  if (!empresa) {
    throw new Error(`No existe la Empresa Revendedora ${EMPRESA_REVENDEDORA_ID}.`);
  }

  const proveedor = await prisma.proveedor.findUnique({ where: { nombre: NOMBRE_PROVEEDOR } });
  if (!proveedor) {
    throw new Error(`No existe el Proveedor "${NOMBRE_PROVEEDOR}".`);
  }

  const datos = filas as FilaCsv[];
  console.log(
    `== Importación Micom (${commit ? 'COMMIT — escribe de verdad' : 'DRY-RUN — no escribe nada'}) ` +
      `— Empresa "${empresa.razonSocial}" — ${datos.length} filas ==\n`,
  );

  let procesadas = 0;
  let salteadas = 0;
  let errores = 0;

  for (const fila of datos) {
    const dni = fila['DNI(Usuario)'].trim();
    const pin = fila.PIN.trim();
    const proveedorCuentaId = fila['ID Interno'].trim();
    const email = fila.Email.trim().toLowerCase();

    try {
      const yaExiste = await prisma.cuenta.findFirst({
        where: {
          OR: [{ dniAltaSensa: dni }, { proveedorCuentaId }, { emailContacto: email }],
        },
      });
      if (yaExiste) {
        console.log(`  [SALTEADA] DNI ${dni}: ya existe una Cuenta local (id ${yaExiste.id}).`);
        salteadas += 1;
        continue;
      }

      const password = invertirDni(dni);
      const estaDeBaja = fila['Fecha baja'] !== 'SINFECHA';
      const servicios = mapearServicios(fila.Servicios);
      const fijos = Number(fila['Dispositivos fijos']) || 1;
      const moviles = Number(fila['Dispositivos móviles']) || 1;

      console.log(
        `  [${commit ? 'CREANDO' : 'PREVIEW'}] DNI=${dni} usuario=${dni} password=${password} pin=${pin} ` +
          `proveedor_cuenta_id=${proveedorCuentaId} servicios=${servicios} ` +
          `estado=${estaDeBaja ? 'BAJA' : 'ACTIVO'} email=${email}`,
      );

      if (commit) {
        await prisma.$transaction(async (tx) => {
          const secuencia = await tx.$queryRaw<{ secuencia_numero_cliente: number }[]>`
            UPDATE "empresa_revendedora"
               SET "secuencia_numero_cliente" = "secuencia_numero_cliente" + 1,
                   "actualizado_en" = NOW()
             WHERE "id" = ${EMPRESA_REVENDEDORA_ID}::uuid
            RETURNING "secuencia_numero_cliente"`;
          const numeroCliente = secuencia[0].secuencia_numero_cliente;

          await tx.cuenta.create({
            data: {
              empresaRevendedoraId: EMPRESA_REVENDEDORA_ID,
              proveedorId: proveedor.id,
              proveedorCuentaId,
              dniAltaSensa: dni,
              usuario: dni,
              passwordCifrado: cifrar(password, claveMaestra),
              pinCifrado: cifrar(pin, claveMaestra),
              emailContacto: email,
              esExclusiva: true,
              servicios,
              limiteDispositivos: LIMITE_DISPOSITIVOS,
              dispositivosFijosHabilitados: fijos,
              dispositivosMovilesHabilitados: moviles,
              estado: estaDeBaja ? EstadoCuenta.cerrada : EstadoCuenta.activa,
            },
          });

          await tx.clienteFinal.create({
            data: {
              empresaRevendedoraId: EMPRESA_REVENDEDORA_ID,
              numeroCliente,
              nombre: fila.Nombre.trim() || 'Micom',
              apellido: fila.Apellido.trim() || null,
              dni,
              telefono: fila.Telf.trim() || null,
              email,
              direccion: fila.Dirección.trim() || null,
              tipoAlta: TipoAltaClienteFinal.cuenta_exclusiva,
              estado: estaDeBaja ? EstadoClienteFinal.dado_de_baja : EstadoClienteFinal.activo,
              dadoDeBajaEn: estaDeBaja ? new Date(fila['Fecha baja']) : null,
            },
          });
        });
      }

      procesadas += 1;
    } catch (error) {
      errores += 1;
      console.error(`  [ERROR] DNI ${dni}: ${(error as Error).message}`);
    }
  }

  console.log(
    `\n== Resumen: ${procesadas} ${commit ? 'creadas' : 'a crear'}, ${salteadas} salteadas (ya existían), ` +
      `${errores} con error ==`,
  );
  if (!commit) {
    console.log('\nEsto fue un DRY-RUN: no se escribió nada en la base.');
    console.log('Para confirmar de verdad: npm run import:micom -- --commit');
  }
}

main()
  .catch((error) => {
    console.error('\nLa importación falló:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
