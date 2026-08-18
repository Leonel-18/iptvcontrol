-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ModalidadComercialTipo" AS ENUM ('menudeo', 'obligacion_mensual');

-- CreateEnum
CREATE TYPE "EstadoEmpresaRevendedora" AS ENUM ('activa', 'suspendida');

-- CreateEnum
CREATE TYPE "TipoAltaClienteFinal" AS ENUM ('cuenta_exclusiva', 'dispositivo_compartido');

-- CreateEnum
CREATE TYPE "EstadoClienteFinal" AS ENUM ('activo', 'suspendido', 'dado_de_baja');

-- CreateEnum
CREATE TYPE "EstadoCuenta" AS ENUM ('activa', 'cerrada');

-- CreateEnum
CREATE TYPE "TipoDispositivo" AS ENUM ('fijo', 'movil');

-- CreateEnum
CREATE TYPE "EstadoDispositivo" AS ENUM ('activo', 'bloqueado_por_suspension', 'disponible', 'dado_de_baja');

-- CreateEnum
CREATE TYPE "RolTeamMember" AS ENUM ('operator_admin', 'operator_staff', 'reseller_admin', 'reseller_staff');

-- CreateEnum
CREATE TYPE "EstadoTeamMember" AS ENUM ('invitado', 'activo', 'inactivo');

-- CreateEnum
CREATE TYPE "AccionAuditoria" AS ENUM ('alta_cliente', 'suspension_cliente', 'reactivacion_cliente', 'baja_cliente', 'reasignacion_dispositivo', 'alta_dispositivo', 'baja_dispositivo', 'migracion_cuenta', 'alta_cuenta', 'cierre_cuenta', 'cambio_modalidad_comercial', 'cambio_precio', 'alta_empresa_revendedora', 'baja_empresa_revendedora', 'cambio_configuracion_proveedor', 'alta_team_member', 'reenvio_invitacion_team_member', 'baja_team_member');

-- CreateEnum
CREATE TYPE "EntidadAuditada" AS ENUM ('ClienteFinal', 'Dispositivo', 'Cuenta', 'EmpresaRevendedora', 'ModalidadComercial', 'ConfiguracionProveedor', 'TeamMember');

-- CreateEnum
CREATE TYPE "EstadoLlamadaProveedor" AS ENUM ('exitosa', 'fallida');

-- CreateTable
CREATE TABLE "operador_principal" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(160) NOT NULL,
    "proveedor_activo_id" UUID,
    "dni_inicial_sensa" INTEGER NOT NULL,
    "dni_actual_sensa" INTEGER NOT NULL,
    "umbral_alerta_capacidad" INTEGER NOT NULL DEFAULT 2,
    "max_reintentos_dni" INTEGER NOT NULL DEFAULT 25,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operador_principal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proveedor" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "tipo_conector" VARCHAR(40) NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracion_proveedor" (
    "id" UUID NOT NULL,
    "operador_principal_id" UUID NOT NULL,
    "proveedor_id" UUID NOT NULL,
    "server" VARCHAR(200) NOT NULL,
    "port" INTEGER NOT NULL,
    "usuario" VARCHAR(120) NOT NULL,
    "token_cifrado" TEXT NOT NULL,
    "ciudad_por_defecto" VARCHAR(80) NOT NULL DEFAULT 'Mendoza',
    "servicios_por_defecto" VARCHAR(40) NOT NULL DEFAULT '1',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracion_proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "empresa_revendedora" (
    "id" UUID NOT NULL,
    "operador_principal_id" UUID NOT NULL,
    "razon_social" VARCHAR(160) NOT NULL,
    "cuit" VARCHAR(11) NOT NULL,
    "direccion" VARCHAR(200) NOT NULL,
    "nombre_contacto" VARCHAR(80) NOT NULL,
    "apellido_contacto" VARCHAR(80) NOT NULL,
    "telefono_contacto" VARCHAR(30) NOT NULL,
    "email_contacto" VARCHAR(160) NOT NULL,
    "sitio_web" VARCHAR(200),
    "modalidad_comercial_id" UUID,
    "estado" "EstadoEmpresaRevendedora" NOT NULL DEFAULT 'activa',
    "secuencia_numero_cliente" INTEGER NOT NULL DEFAULT 0,
    "secuencia_email_cuenta" INTEGER NOT NULL DEFAULT 0,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empresa_revendedora_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cliente_final" (
    "id" UUID NOT NULL,
    "empresa_revendedora_id" UUID NOT NULL,
    "numero_cliente" INTEGER NOT NULL,
    "id_gestion_externo" VARCHAR(40),
    "nombre" VARCHAR(120) NOT NULL,
    "apellido" VARCHAR(120),
    "telefono" VARCHAR(30),
    "email" VARCHAR(160),
    "direccion" VARCHAR(200),
    "tipo_alta" "TipoAltaClienteFinal" NOT NULL,
    "estado" "EstadoClienteFinal" NOT NULL DEFAULT 'activo',
    "suspendido_en" TIMESTAMP(3),
    "dado_de_baja_en" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cliente_final_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuenta" (
    "id" UUID NOT NULL,
    "empresa_revendedora_id" UUID NOT NULL,
    "proveedor_id" UUID NOT NULL,
    "proveedor_cuenta_id" VARCHAR(60),
    "dni_alta_sensa" VARCHAR(12) NOT NULL,
    "usuario" VARCHAR(120) NOT NULL,
    "password_cifrado" TEXT NOT NULL,
    "pin_cifrado" TEXT NOT NULL,
    "email_contacto" VARCHAR(180) NOT NULL,
    "es_exclusiva" BOOLEAN NOT NULL DEFAULT false,
    "servicios" VARCHAR(40) NOT NULL DEFAULT '1',
    "dispositivos_fijos_habilitados" INTEGER NOT NULL DEFAULT 1,
    "dispositivos_moviles_habilitados" INTEGER NOT NULL DEFAULT 1,
    "estado" "EstadoCuenta" NOT NULL DEFAULT 'activa',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cuenta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispositivo" (
    "id" UUID NOT NULL,
    "cuenta_id" UUID NOT NULL,
    "empresa_revendedora_id" UUID NOT NULL,
    "cliente_final_id" UUID,
    "proveedor_device_id" VARCHAR(60),
    "mac" VARCHAR(12),
    "tipo" "TipoDispositivo" NOT NULL,
    "estado" "EstadoDispositivo" NOT NULL DEFAULT 'activo',
    "nota_descriptiva" VARCHAR(200),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dispositivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_member" (
    "id" UUID NOT NULL,
    "operador_principal_id" UUID,
    "empresa_revendedora_id" UUID,
    "auth0_user_id" VARCHAR(120),
    "email" VARCHAR(160) NOT NULL,
    "nombre" VARCHAR(120),
    "rol" "RolTeamMember" NOT NULL,
    "estado" "EstadoTeamMember" NOT NULL DEFAULT 'invitado',
    "ultimo_acceso_en" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modalidad_comercial" (
    "id" UUID NOT NULL,
    "operador_principal_id" UUID NOT NULL,
    "tipo" "ModalidadComercialTipo" NOT NULL,
    "escala" VARCHAR(40) NOT NULL,
    "precio_por_cuenta" DECIMAL(12,2) NOT NULL,
    "ritmo_incremento" INTEGER,
    "tope_cuentas_activas" INTEGER,
    "vigente_desde" TIMESTAMP(3) NOT NULL,
    "vigente_hasta" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modalidad_comercial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "team_member_id" UUID,
    "empresa_revendedora_id" UUID,
    "operador_principal_id" UUID,
    "accion" "AccionAuditoria" NOT NULL,
    "entidad_afectada" "EntidadAuditada" NOT NULL,
    "entidad_id" VARCHAR(60),
    "detalle" JSONB,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llamada_proveedor" (
    "id" UUID NOT NULL,
    "operador_principal_id" UUID,
    "operacion" VARCHAR(60) NOT NULL,
    "metodo" VARCHAR(10) NOT NULL,
    "ruta" VARCHAR(200) NOT NULL,
    "estado" "EstadoLlamadaProveedor" NOT NULL,
    "codigo" INTEGER,
    "duracion_ms" INTEGER NOT NULL,
    "mensaje" VARCHAR(500),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llamada_proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "proveedor_nombre_key" ON "proveedor"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "configuracion_proveedor_operador_principal_id_proveedor_id_key" ON "configuracion_proveedor"("operador_principal_id", "proveedor_id");

-- CreateIndex
CREATE UNIQUE INDEX "empresa_revendedora_cuit_key" ON "empresa_revendedora"("cuit");

-- CreateIndex
CREATE INDEX "empresa_revendedora_operador_principal_id_idx" ON "empresa_revendedora"("operador_principal_id");

-- CreateIndex
CREATE INDEX "cliente_final_empresa_revendedora_id_estado_idx" ON "cliente_final"("empresa_revendedora_id", "estado");

-- CreateIndex
CREATE INDEX "cliente_final_empresa_revendedora_id_id_gestion_externo_idx" ON "cliente_final"("empresa_revendedora_id", "id_gestion_externo");

-- CreateIndex
CREATE UNIQUE INDEX "cliente_final_empresa_revendedora_id_numero_cliente_key" ON "cliente_final"("empresa_revendedora_id", "numero_cliente");

-- CreateIndex
CREATE UNIQUE INDEX "cuenta_dni_alta_sensa_key" ON "cuenta"("dni_alta_sensa");

-- CreateIndex
CREATE UNIQUE INDEX "cuenta_email_contacto_key" ON "cuenta"("email_contacto");

-- CreateIndex
CREATE INDEX "cuenta_empresa_revendedora_id_estado_idx" ON "cuenta"("empresa_revendedora_id", "estado");

-- CreateIndex
CREATE INDEX "dispositivo_empresa_revendedora_id_estado_idx" ON "dispositivo"("empresa_revendedora_id", "estado");

-- CreateIndex
CREATE INDEX "dispositivo_cuenta_id_tipo_estado_idx" ON "dispositivo"("cuenta_id", "tipo", "estado");

-- CreateIndex
CREATE INDEX "dispositivo_cliente_final_id_idx" ON "dispositivo"("cliente_final_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_member_auth0_user_id_key" ON "team_member"("auth0_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_member_email_key" ON "team_member"("email");

-- CreateIndex
CREATE INDEX "team_member_empresa_revendedora_id_idx" ON "team_member"("empresa_revendedora_id");

-- CreateIndex
CREATE INDEX "team_member_operador_principal_id_idx" ON "team_member"("operador_principal_id");

-- CreateIndex
CREATE INDEX "modalidad_comercial_operador_principal_id_tipo_idx" ON "modalidad_comercial"("operador_principal_id", "tipo");

-- CreateIndex
CREATE INDEX "audit_log_empresa_revendedora_id_creado_en_idx" ON "audit_log"("empresa_revendedora_id", "creado_en");

-- CreateIndex
CREATE INDEX "audit_log_accion_creado_en_idx" ON "audit_log"("accion", "creado_en");

-- CreateIndex
CREATE INDEX "audit_log_entidad_afectada_entidad_id_idx" ON "audit_log"("entidad_afectada", "entidad_id");

-- CreateIndex
CREATE INDEX "llamada_proveedor_creado_en_idx" ON "llamada_proveedor"("creado_en");

-- CreateIndex
CREATE INDEX "llamada_proveedor_estado_creado_en_idx" ON "llamada_proveedor"("estado", "creado_en");

-- AddForeignKey
ALTER TABLE "operador_principal" ADD CONSTRAINT "operador_principal_proveedor_activo_id_fkey" FOREIGN KEY ("proveedor_activo_id") REFERENCES "proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuracion_proveedor" ADD CONSTRAINT "configuracion_proveedor_operador_principal_id_fkey" FOREIGN KEY ("operador_principal_id") REFERENCES "operador_principal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuracion_proveedor" ADD CONSTRAINT "configuracion_proveedor_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empresa_revendedora" ADD CONSTRAINT "empresa_revendedora_operador_principal_id_fkey" FOREIGN KEY ("operador_principal_id") REFERENCES "operador_principal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empresa_revendedora" ADD CONSTRAINT "empresa_revendedora_modalidad_comercial_id_fkey" FOREIGN KEY ("modalidad_comercial_id") REFERENCES "modalidad_comercial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cliente_final" ADD CONSTRAINT "cliente_final_empresa_revendedora_id_fkey" FOREIGN KEY ("empresa_revendedora_id") REFERENCES "empresa_revendedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuenta" ADD CONSTRAINT "cuenta_empresa_revendedora_id_fkey" FOREIGN KEY ("empresa_revendedora_id") REFERENCES "empresa_revendedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuenta" ADD CONSTRAINT "cuenta_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispositivo" ADD CONSTRAINT "dispositivo_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "cuenta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispositivo" ADD CONSTRAINT "dispositivo_empresa_revendedora_id_fkey" FOREIGN KEY ("empresa_revendedora_id") REFERENCES "empresa_revendedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispositivo" ADD CONSTRAINT "dispositivo_cliente_final_id_fkey" FOREIGN KEY ("cliente_final_id") REFERENCES "cliente_final"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_operador_principal_id_fkey" FOREIGN KEY ("operador_principal_id") REFERENCES "operador_principal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_empresa_revendedora_id_fkey" FOREIGN KEY ("empresa_revendedora_id") REFERENCES "empresa_revendedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modalidad_comercial" ADD CONSTRAINT "modalidad_comercial_operador_principal_id_fkey" FOREIGN KEY ("operador_principal_id") REFERENCES "operador_principal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_team_member_id_fkey" FOREIGN KEY ("team_member_id") REFERENCES "team_member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_empresa_revendedora_id_fkey" FOREIGN KEY ("empresa_revendedora_id") REFERENCES "empresa_revendedora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_operador_principal_id_fkey" FOREIGN KEY ("operador_principal_id") REFERENCES "operador_principal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llamada_proveedor" ADD CONSTRAINT "llamada_proveedor_operador_principal_id_fkey" FOREIGN KEY ("operador_principal_id") REFERENCES "operador_principal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

