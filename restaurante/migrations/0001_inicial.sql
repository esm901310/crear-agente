-- Entrega 1: estructura inicial de la base de datos (D1 / SQLite).
-- Dinero: siempre en centavos enteros. Fechas: texto ISO 8601 en UTC
-- (ej. 2026-11-20T18:30:00.000Z), comparables como texto.
-- D1 aplica las llaves foráneas siempre (no hace falta PRAGMA).


-- Personas que usan la app. El PIN nunca se guarda en texto plano:
-- pin_hash = SHA-256( pin_sal + pin ) en hexadecimal.
CREATE TABLE usuarios (
  id                INTEGER PRIMARY KEY,
  nombre            TEXT    NOT NULL,
  rol               TEXT    NOT NULL CHECK (rol IN ('mesero', 'cocina', 'caja', 'dueno')),
  pin_hash          TEXT    NOT NULL,
  pin_sal           TEXT    NOT NULL,
  activo            INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
  -- Freno contra adivinar PINs.
  intentos_fallidos INTEGER NOT NULL DEFAULT 0,
  bloqueado_hasta   TEXT,
  creado            TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Sesiones abiertas. Se guarda el SHA-256 del token (no el token), así una
-- copia de la base de datos no sirve para entrar.
CREATE TABLE sesiones (
  id          INTEGER PRIMARY KEY,
  token_hash  TEXT    NOT NULL UNIQUE,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  creada      TEXT    NOT NULL,
  expira      TEXT    NOT NULL
);
CREATE INDEX idx_sesiones_usuario ON sesiones(usuario_id);
CREATE INDEX idx_sesiones_expira  ON sesiones(expira);

CREATE TABLE mesas (
  id      INTEGER PRIMARY KEY,
  nombre  TEXT    NOT NULL UNIQUE,
  activo  INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1))
);

CREATE TABLE productos (
  id         INTEGER PRIMARY KEY,
  nombre     TEXT    NOT NULL,
  categoria  TEXT    NOT NULL,
  precio     INTEGER NOT NULL CHECK (precio >= 0),
  activo     INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1))
);
CREATE INDEX idx_productos_categoria ON productos(activo, categoria, nombre);

-- Una "cuenta" de una mesa.
CREATE TABLE ordenes (
  id           INTEGER PRIMARY KEY,
  mesa_id      INTEGER NOT NULL REFERENCES mesas(id),
  mesero_id    INTEGER NOT NULL REFERENCES usuarios(id),
  estado       TEXT    NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta', 'pagada')),
  propina      INTEGER NOT NULL DEFAULT 0 CHECK (propina >= 0),
  creada       TEXT    NOT NULL,
  pagada_en    TEXT,
  cobrado_por  INTEGER REFERENCES usuarios(id)
);
-- Solo puede haber UNA cuenta abierta por mesa.
CREATE UNIQUE INDEX idx_ordenes_una_abierta_por_mesa ON ordenes(mesa_id) WHERE estado = 'abierta';
CREATE INDEX idx_ordenes_estado    ON ordenes(estado, creada);
CREATE INDEX idx_ordenes_pagada_en ON ordenes(pagada_en);  -- para el corte de caja (Entrega 2)
CREATE INDEX idx_ordenes_mesero    ON ordenes(mesero_id);

-- Cada envío a cocina.
CREATE TABLE comandas (
  id        INTEGER PRIMARY KEY,
  orden_id  INTEGER NOT NULL REFERENCES ordenes(id),
  estado    TEXT    NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'listo')),
  creada    TEXT    NOT NULL,
  listo_en  TEXT
);
CREATE INDEX idx_comandas_orden   ON comandas(orden_id);
CREATE INDEX idx_comandas_estado  ON comandas(estado, creada);
CREATE INDEX idx_comandas_listo   ON comandas(estado, listo_en);

-- Platillos de una comanda. nombre y precio se COPIAN del producto al enviar.
CREATE TABLE items (
  id           INTEGER PRIMARY KEY,
  comanda_id   INTEGER NOT NULL REFERENCES comandas(id),
  producto_id  INTEGER NOT NULL REFERENCES productos(id),
  nombre       TEXT    NOT NULL,
  precio       INTEGER NOT NULL CHECK (precio >= 0),
  cantidad     INTEGER NOT NULL CHECK (cantidad >= 1),
  nota         TEXT    CHECK (nota IS NULL OR length(nota) <= 140)
);
CREATE INDEX idx_items_comanda ON items(comanda_id);

CREATE TABLE pagos (
  id        INTEGER PRIMARY KEY,
  orden_id  INTEGER NOT NULL REFERENCES ordenes(id),
  metodo    TEXT    NOT NULL CHECK (metodo IN ('efectivo', 'tarjeta', 'transferencia')),
  monto     INTEGER NOT NULL CHECK (monto > 0),
  creado    TEXT    NOT NULL
);
CREATE INDEX idx_pagos_orden ON pagos(orden_id);

-- Reglas que protege la propia base de datos (aunque dos personas
-- actúen al mismo tiempo):

-- No se pueden enviar comandas a una cuenta que ya no está abierta.
CREATE TRIGGER trg_comandas_solo_orden_abierta
BEFORE INSERT ON comandas
WHEN (SELECT estado FROM ordenes WHERE id = NEW.orden_id) IS NOT 'abierta'
BEGIN
  SELECT RAISE(ABORT, 'ORDEN_NO_ABIERTA');
END;

-- No se pueden registrar pagos en una cuenta que ya no está abierta.
CREATE TRIGGER trg_pagos_solo_orden_abierta
BEFORE INSERT ON pagos
WHEN (SELECT estado FROM ordenes WHERE id = NEW.orden_id) IS NOT 'abierta'
BEGIN
  SELECT RAISE(ABORT, 'ORDEN_NO_ABIERTA');
END;

-- Al cerrar una cuenta: debe tener platillos y los pagos deben cuadrar
-- exactamente con subtotal + propina.
CREATE TRIGGER trg_ordenes_cierre_cuadra
BEFORE UPDATE OF estado ON ordenes
WHEN NEW.estado = 'pagada' AND OLD.estado = 'abierta'
BEGIN
  SELECT RAISE(ABORT, 'ORDEN_SIN_ITEMS')
  WHERE NOT EXISTS (
    SELECT 1 FROM items i JOIN comandas c ON c.id = i.comanda_id WHERE c.orden_id = NEW.id
  );
  SELECT RAISE(ABORT, 'PAGOS_NO_CUADRAN')
  WHERE (SELECT COALESCE(SUM(monto), 0) FROM pagos WHERE orden_id = NEW.id)
     <> (SELECT COALESCE(SUM(i.precio * i.cantidad), 0)
           FROM items i JOIN comandas c ON c.id = i.comanda_id
          WHERE c.orden_id = NEW.id) + NEW.propina;
END;

-- Una cuenta pagada no se vuelve a abrir.
CREATE TRIGGER trg_ordenes_no_reabrir
BEFORE UPDATE OF estado ON ordenes
WHEN OLD.estado = 'pagada' AND NEW.estado <> 'pagada'
BEGIN
  SELECT RAISE(ABORT, 'ORDEN_YA_PAGADA');
END;
