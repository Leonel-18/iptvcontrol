-- Agrega el valor de auditoría para el cambio manual de contraseña de una
-- Cuenta (feature: la Empresa Revendedora puede reemplazar la contraseña
-- generada automáticamente por una propia, numérica, 8 a 20 dígitos).
ALTER TYPE "AccionAuditoria" ADD VALUE 'cambio_password_cuenta';
