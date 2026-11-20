-- Entrega 1.2: freno contra adivinar PINs desde una misma conexión (IP).
-- Cuenta los intentos de inicio de sesión fallidos por IP dentro de una
-- ventana de 10 minutos. El servidor incrementa el contador en UNA sola
-- sentencia atómica (INSERT ... ON CONFLICT ... RETURNING) ANTES de revisar el
-- PIN, así muchas peticiones simultáneas no pueden saltarse el límite.
-- Las filas con ventana vencida se borran de vez en cuando.
CREATE TABLE freno_ip (
  ip              TEXT    PRIMARY KEY,
  intentos        INTEGER NOT NULL DEFAULT 0,
  ventana_inicio  TEXT    NOT NULL   -- ISO 8601 UTC
);
CREATE INDEX idx_freno_ip_ventana ON freno_ip(ventana_inicio);
