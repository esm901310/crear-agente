-- Comparar Súper — medias libras en la lista.
-- Los productos de carne por libra (grupos con coincidencia 'corte') aceptan cantidades en
-- múltiplos de 0.5 (0.5 a 99 libras). La regla exacta (entero 1..99 para lo demás) la aplica
-- el servidor (validar.ts); aquí la base solo exige 0.5..99 en pasos de 0.5.
-- SQLite no permite cambiar un CHECK: se rehace la tabla conservando todos los datos.
PRAGMA defer_foreign_keys = true;

CREATE TABLE items_lista_nueva (
  id              TEXT PRIMARY KEY,              -- UUID
  usuario_id      TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  clave           TEXT NOT NULL,                 -- clave del grupo: "ean:...", "lacolonia:1598" o "corte:lacolonia:6382"
  cantidad        REAL NOT NULL CHECK (cantidad >= 0.5 AND cantidad <= 99 AND cantidad * 2 = CAST(cantidad * 2 AS INTEGER)),
  grupo_json      TEXT NOT NULL,                 -- Grupo (con los últimos precios consultados)
  sustitutos_json TEXT NOT NULL DEFAULT '{}',    -- Partial<Record<Tienda, PrecioTienda>>
  creado_en       INTEGER NOT NULL,
  actualizado_en  INTEGER NOT NULL,
  precios_consultados_en INTEGER,
  UNIQUE (usuario_id, clave)
);

INSERT INTO items_lista_nueva
  (id, usuario_id, clave, cantidad, grupo_json, sustitutos_json, creado_en, actualizado_en, precios_consultados_en)
SELECT id, usuario_id, clave, cantidad, grupo_json, sustitutos_json, creado_en, actualizado_en, precios_consultados_en
FROM items_lista;

DROP TABLE items_lista;
ALTER TABLE items_lista_nueva RENAME TO items_lista;
CREATE INDEX IF NOT EXISTS idx_items_usuario ON items_lista(usuario_id, creado_en);

PRAGMA defer_foreign_keys = false;
