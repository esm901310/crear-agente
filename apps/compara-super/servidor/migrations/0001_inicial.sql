-- Comparar Súper — esquema inicial (D1 / SQLite)
-- Fechas: *_en en milisegundos desde 1970 (INTEGER) para comparar fácil.

CREATE TABLE IF NOT EXISTS usuarios (
  id           TEXT PRIMARY KEY,                 -- UUID
  correo       TEXT NOT NULL UNIQUE,             -- siempre en minúsculas
  hash         TEXT NOT NULL,                    -- PBKDF2-SHA256 (base64)
  sal          TEXT NOT NULL,                    -- 16 bytes aleatorios (base64)
  iteraciones  INTEGER NOT NULL,
  creado_en    INTEGER NOT NULL,
  CHECK (correo = lower(correo))
);

CREATE TABLE IF NOT EXISTS sesiones (
  token_hash   TEXT PRIMARY KEY,                 -- SHA-256 (hex) del token de la cookie
  usuario_id   TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  creado_en    INTEGER NOT NULL,
  vence_en     INTEGER NOT NULL                  -- creado_en + 30 días
);
CREATE INDEX IF NOT EXISTS idx_sesiones_usuario ON sesiones(usuario_id);

CREATE TABLE IF NOT EXISTS items_lista (
  id              TEXT PRIMARY KEY,              -- UUID
  usuario_id      TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  clave           TEXT NOT NULL,                 -- clave del grupo: "ean:0707517002083" o "lacolonia:1598"
  cantidad        INTEGER NOT NULL CHECK (cantidad BETWEEN 1 AND 99),
  grupo_json      TEXT NOT NULL,                 -- Grupo (con los últimos precios consultados)
  sustitutos_json TEXT NOT NULL DEFAULT '{}',    -- Partial<Record<Tienda, PrecioTienda>>
  creado_en       INTEGER NOT NULL,
  actualizado_en  INTEGER NOT NULL,
  UNIQUE (usuario_id, clave)
);
CREATE INDEX IF NOT EXISTS idx_items_usuario ON items_lista(usuario_id, creado_en);

-- Caché de búsquedas en las tiendas (30 min). Una fila por tienda + texto normalizado.
CREATE TABLE IF NOT EXISTS cache_busquedas (
  clave          TEXT PRIMARY KEY,               -- "<modo>:<tienda>:<texto normalizado>"
  resultado_json TEXT NOT NULL,                  -- Producto[]
  guardado_en    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cache_guardado ON cache_busquedas(guardado_en);

-- Límites simples (intentos de inicio de sesión por correo, búsquedas por usuario, etc.)
CREATE TABLE IF NOT EXISTS limites (
  clave           TEXT PRIMARY KEY,              -- p. ej. "entrar:ana@correo.com", "buscar:<usuario_id>"
  contador        INTEGER NOT NULL,
  ventana_inicio  INTEGER NOT NULL,
  bloqueado_hasta INTEGER NOT NULL DEFAULT 0
);
