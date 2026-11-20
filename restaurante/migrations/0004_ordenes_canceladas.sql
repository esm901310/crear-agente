-- Entrega 1.2: registro de cuentas canceladas (abiertas por error, sin platillos).
-- Al cancelar, la cuenta se BORRA de `ordenes` y queda aquí un registro de
-- quién la canceló y cuándo. Además, este registro evita que SQLite reutilice
-- el id borrado: al abrir una cuenta nueva el id se calcula como
-- MAX(id de ordenes, id de ordenes_canceladas) + 1. Así una tablet que todavía
-- tenga en pantalla la cuenta cancelada nunca manda platillos a otra mesa.
CREATE TABLE ordenes_canceladas (
  id              INTEGER PRIMARY KEY,           -- mismo id que tenía en ordenes
  mesa_id         INTEGER NOT NULL REFERENCES mesas(id),
  mesero_id       INTEGER NOT NULL REFERENCES usuarios(id),
  creada          TEXT    NOT NULL,
  cancelada       TEXT    NOT NULL,
  cancelada_por   INTEGER NOT NULL REFERENCES usuarios(id)
);
CREATE INDEX idx_ordenes_canceladas_fecha ON ordenes_canceladas(cancelada);
