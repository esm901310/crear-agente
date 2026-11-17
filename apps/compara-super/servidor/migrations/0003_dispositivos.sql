-- Comparar Súper — dispositivos de confianza.
-- Al entrar (o registrarse) bien, el navegador recibe la cookie "dispositivo" (token aleatorio, 1 año).
-- Aquí solo se guarda el SHA-256 del token, ligado a la cuenta. Los intentos de entrar que traen
-- un dispositivo de confianza de ESA cuenta no sufren los límites por IP ni por correo global
-- (ver docs/datos-y-api.md, "Entrar: límites"). Un mismo navegador puede ser de confianza para
-- varias cuentas (teléfono compartido): una fila por (token, cuenta).
CREATE TABLE IF NOT EXISTS dispositivos (
  token_hash  TEXT NOT NULL,                     -- SHA-256 (hex) del token de la cookie
  usuario_id  TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  creado_en   INTEGER NOT NULL,
  usado_en    INTEGER NOT NULL,                  -- último inicio de sesión correcto con él
  vence_en    INTEGER NOT NULL,                  -- usado_en + 1 año
  PRIMARY KEY (token_hash, usuario_id)
);
CREATE INDEX IF NOT EXISTS idx_dispositivos_usuario ON dispositivos(usuario_id, usado_en);
