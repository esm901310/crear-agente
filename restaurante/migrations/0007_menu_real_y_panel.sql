-- Entrega 3: el restaurante real (El Lechón Playero, Honduras) y el panel del dueño.
--
-- Funciona sobre una base con datos de las Entregas 1 y 2:
--   * Crea `categorias` a partir del texto `productos.categoria` que ya existía.
--   * Reconstruye `productos` (el precio pasa a ser opcional: productos con
--     variantes o con precio abierto no tienen precio fijo) y `mesas` (el nombre
--     ya no es único en toda la tabla, solo entre las ACTIVAS, y se agrega `orden`).
--   * Agrega columnas a `items` y `usuarios`, la tabla `variantes` y triggers.
--   * El cierre de una cuenta ahora exige pagos = max(consumo, pasadía) + propina.
--
-- "nombre_clave" = nombre sin mayúsculas, sin acentos y con espacios simples.
-- Sirve para que la base de datos impida nombres repetidos entre los activos
-- ("Mesa 1" = "mesa  1", "Dueño" = "dueno"). La calcula el Worker
-- (worker/texto.ts, función claveNombre); aquí se calcula una sola vez, en SQL,
-- para los datos que ya existían (vocales acentuadas, ü, ñ, ç).

-- Se reconstruyen tablas a las que apuntan llaves foráneas (items → productos,
-- ordenes → mesas). Con esto la revisión de llaves foráneas se hace al final de
-- la migración. Forma de reconstruir (sin ALTER TABLE RENAME, que reescribiría
-- las llaves foráneas de las otras tablas): copia de los datos → DROP de la
-- tabla vieja → CREATE de la nueva con el MISMO nombre → INSERT con los mismos
-- ids (al reinsertar, SQLite da por resueltas las referencias pendientes).
PRAGMA defer_foreign_keys = on;

-- ---------------------------------------------------------------------------
-- Claves de nombres para los datos existentes

CREATE TABLE _claves (
  tabla  TEXT    NOT NULL,
  id     INTEGER,            -- NULL para las categorías (venían como texto)
  texto  TEXT    NOT NULL,
  clave  TEXT
);
INSERT INTO _claves (tabla, id, texto) SELECT 'usuarios', id, nombre FROM usuarios;
INSERT INTO _claves (tabla, id, texto) SELECT 'mesas', id, nombre FROM mesas;
INSERT INTO _claves (tabla, id, texto) SELECT 'productos', id, nombre FROM productos;
INSERT INTO _claves (tabla, id, texto) SELECT DISTINCT 'categorias', NULL, categoria FROM productos;

UPDATE _claves SET clave = trim(texto);
UPDATE _claves SET clave = replace(replace(replace(replace(replace(replace(replace(replace(clave,
  'á','a'),'à','a'),'ä','a'),'â','a'),'Á','a'),'À','a'),'Ä','a'),'Â','a');
UPDATE _claves SET clave = replace(replace(replace(replace(replace(replace(replace(replace(clave,
  'é','e'),'è','e'),'ë','e'),'ê','e'),'É','e'),'È','e'),'Ë','e'),'Ê','e');
UPDATE _claves SET clave = replace(replace(replace(replace(replace(replace(replace(replace(clave,
  'í','i'),'ì','i'),'ï','i'),'î','i'),'Í','i'),'Ì','i'),'Ï','i'),'Î','i');
UPDATE _claves SET clave = replace(replace(replace(replace(replace(replace(replace(replace(clave,
  'ó','o'),'ò','o'),'ö','o'),'ô','o'),'Ó','o'),'Ò','o'),'Ö','o'),'Ô','o');
UPDATE _claves SET clave = replace(replace(replace(replace(replace(replace(replace(replace(clave,
  'ú','u'),'ù','u'),'ü','u'),'û','u'),'Ú','u'),'Ù','u'),'Ü','u'),'Û','u');
UPDATE _claves SET clave = replace(replace(replace(replace(clave, 'ñ','n'),'Ñ','n'),'ç','c'),'Ç','c');
-- Espacios repetidos → uno (los nombres de ejemplo no traen más de dos seguidos).
UPDATE _claves SET clave = replace(replace(clave, '   ', ' '), '  ', ' ');
UPDATE _claves SET clave = lower(clave);

-- ---------------------------------------------------------------------------
-- Categorías del menú

CREATE TABLE categorias (
  id            INTEGER PRIMARY KEY,
  nombre        TEXT    NOT NULL CHECK (length(nombre) >= 1),
  nombre_clave  TEXT    NOT NULL,
  orden         INTEGER NOT NULL DEFAULT 0,
  -- 0 = sus platillos se cobran pero NO aparecen en Cocina (Bebidas, Bar, Actividades).
  va_a_cocina   INTEGER NOT NULL DEFAULT 1 CHECK (va_a_cocina IN (0, 1)),
  activa        INTEGER NOT NULL DEFAULT 1 CHECK (activa IN (0, 1))
);
-- Entre las categorías activas no se repiten nombres (sin mayúsculas ni acentos).
CREATE UNIQUE INDEX idx_categorias_nombre_activa ON categorias(nombre_clave) WHERE activa = 1;
CREATE INDEX idx_categorias_orden ON categorias(orden, id);

-- Una categoría por cada texto distinto que ya existía, en orden alfabético.
INSERT INTO categorias (nombre, nombre_clave, orden, va_a_cocina, activa)
SELECT MIN(texto), clave,
       ROW_NUMBER() OVER (ORDER BY clave),
       CASE WHEN clave IN ('bebidas', 'bar', 'actividades') THEN 0 ELSE 1 END,
       1
  FROM _claves WHERE tabla = 'categorias'
 GROUP BY clave;

-- ---------------------------------------------------------------------------
-- Productos (reconstruida)

CREATE TABLE _productos_copia AS
SELECT p.id,
       (SELECT c.id FROM categorias c
          JOIN _claves kc ON kc.tabla = 'categorias' AND kc.texto = p.categoria
         WHERE c.nombre_clave = kc.clave) AS categoria_id,
       p.nombre, kp.clave AS nombre_clave, p.precio, p.activo,
       ROW_NUMBER() OVER (PARTITION BY p.categoria ORDER BY p.nombre, p.id) AS orden
  FROM productos p
  JOIN _claves kp ON kp.tabla = 'productos' AND kp.id = p.id;

DROP TABLE productos;

CREATE TABLE productos (
  id              INTEGER PRIMARY KEY,
  categoria_id    INTEGER NOT NULL REFERENCES categorias(id),
  nombre          TEXT    NOT NULL CHECK (length(nombre) >= 1),
  nombre_clave    TEXT    NOT NULL,
  descripcion     TEXT    CHECK (descripcion IS NULL OR length(descripcion) <= 140),
  -- Precio fijo en centavos. NULL si el producto tiene variantes (el precio sale
  -- de la variante) o precio abierto (se escribe al pedir).
  precio          INTEGER CHECK (precio IS NULL OR precio >= 0),
  precio_abierto  INTEGER NOT NULL DEFAULT 0 CHECK (precio_abierto IN (0, 1)),
  agotado         INTEGER NOT NULL DEFAULT 0 CHECK (agotado IN (0, 1)),
  activo          INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
  orden           INTEGER NOT NULL DEFAULT 0,
  -- Pasadía: suma al "pasadía" de la cuenta (consumo mínimo), no al consumo.
  es_pasadia      INTEGER NOT NULL DEFAULT 0 CHECK (es_pasadia IN (0, 1)),
  -- Lista JSON de textos (p. ej. ["Carne","Camarón","Caracol"]); [] si no tiene.
  opciones        TEXT    NOT NULL DEFAULT '[]'
                  CHECK (json_valid(opciones) AND json_type(opciones) = 'array'),
  -- Precio abierto = sin precio fijo. (Que un producto sin precio fijo y sin
  -- precio abierto tenga al menos una variante lo revisa el Worker.)
  CHECK (precio_abierto = 0 OR precio IS NULL)
);

INSERT INTO productos
  (id, categoria_id, nombre, nombre_clave, descripcion, precio, precio_abierto, agotado, activo, orden, es_pasadia, opciones)
SELECT id, categoria_id, nombre, nombre_clave, NULL, precio, 0, 0, activo, orden, 0, '[]'
  FROM _productos_copia ORDER BY id;
DROP TABLE _productos_copia;
CREATE INDEX idx_productos_categoria ON productos(categoria_id, orden, id);
-- Dentro de una categoría no se repiten nombres de productos activos.
CREATE UNIQUE INDEX idx_productos_nombre_activo ON productos(categoria_id, nombre_clave) WHERE activo = 1;

-- Variantes (tamaños o porciones), cada una con su precio.
-- "Eliminar" una variante desde el panel la desactiva (activa = 0).
CREATE TABLE variantes (
  id            INTEGER PRIMARY KEY,
  producto_id   INTEGER NOT NULL REFERENCES productos(id),
  nombre        TEXT    NOT NULL CHECK (length(nombre) >= 1),
  nombre_clave  TEXT    NOT NULL,
  precio        INTEGER NOT NULL CHECK (precio >= 1),
  orden         INTEGER NOT NULL DEFAULT 0,
  activa        INTEGER NOT NULL DEFAULT 1 CHECK (activa IN (0, 1))
);
CREATE INDEX idx_variantes_producto ON variantes(producto_id, orden, id);
CREATE UNIQUE INDEX idx_variantes_nombre_activa ON variantes(producto_id, nombre_clave) WHERE activa = 1;

-- ---------------------------------------------------------------------------
-- Mesas (reconstruida: nombre único solo entre las activas, y orden)

CREATE TABLE _mesas_copia AS
SELECT m.id, m.nombre, k.clave AS nombre_clave, m.activo
  FROM mesas m JOIN _claves k ON k.tabla = 'mesas' AND k.id = m.id;
DROP TABLE mesas;
CREATE TABLE mesas (
  id            INTEGER PRIMARY KEY,
  nombre        TEXT    NOT NULL CHECK (length(nombre) >= 1),
  nombre_clave  TEXT    NOT NULL,
  activo        INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
  orden         INTEGER NOT NULL DEFAULT 0
);
INSERT INTO mesas (id, nombre, nombre_clave, activo, orden)
SELECT id, nombre, nombre_clave, activo, id FROM _mesas_copia ORDER BY id;
DROP TABLE _mesas_copia;
CREATE UNIQUE INDEX idx_mesas_nombre_activa ON mesas(nombre_clave) WHERE activo = 1;
CREATE INDEX idx_mesas_orden ON mesas(orden, id);

-- ---------------------------------------------------------------------------
-- Usuarios: nombre único entre los activos

ALTER TABLE usuarios ADD COLUMN nombre_clave TEXT NOT NULL DEFAULT '';
UPDATE usuarios SET nombre_clave = (SELECT clave FROM _claves WHERE tabla = 'usuarios' AND id = usuarios.id);
CREATE UNIQUE INDEX idx_usuarios_nombre_activo ON usuarios(nombre_clave) WHERE activo = 1;

-- ---------------------------------------------------------------------------
-- Items: se copian del menú al enviar (igual que nombre y precio).
-- Los items que ya existían fueron a cocina y no son pasadía (valores por omisión).

ALTER TABLE items ADD COLUMN variante    TEXT;
ALTER TABLE items ADD COLUMN opcion      TEXT;
ALTER TABLE items ADD COLUMN va_a_cocina INTEGER NOT NULL DEFAULT 1 CHECK (va_a_cocina IN (0, 1));
ALTER TABLE items ADD COLUMN es_pasadia  INTEGER NOT NULL DEFAULT 0 CHECK (es_pasadia IN (0, 1));

DROP TABLE _claves;

-- ---------------------------------------------------------------------------
-- Reglas (triggers)

-- Cierre de cuenta: ahora subtotal = max(consumo, pasadía).
--   consumo = suma de items que NO son pasadía; pasadía = suma de items de pasadía.
-- (La misma regla está en el Worker: worker/montos.ts.)
DROP TRIGGER trg_ordenes_cierre_cuadra;
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
     <> MAX(
          (SELECT COALESCE(SUM(i.precio * i.cantidad), 0)
             FROM items i JOIN comandas c ON c.id = i.comanda_id
            WHERE c.orden_id = NEW.id AND i.es_pasadia = 0),
          (SELECT COALESCE(SUM(i.precio * i.cantidad), 0)
             FROM items i JOIN comandas c ON c.id = i.comanda_id
            WHERE c.orden_id = NEW.id AND i.es_pasadia = 1)
        ) + NEW.propina;
END;

-- Solo se piden productos disponibles: activos, no agotados y de una categoría
-- activa (aunque el dueño o la cocina lo cambien justo mientras se envía).
CREATE TRIGGER trg_items_producto_disponible
BEFORE INSERT ON items
WHEN NOT EXISTS (
  SELECT 1 FROM productos p JOIN categorias c ON c.id = p.categoria_id
   WHERE p.id = NEW.producto_id AND p.activo = 1 AND p.agotado = 0 AND c.activa = 1
)
BEGIN
  SELECT RAISE(ABORT, 'PRODUCTO_NO_DISPONIBLE');
END;

-- No se abren cuentas en mesas desactivadas.
CREATE TRIGGER trg_ordenes_mesa_activa
BEFORE INSERT ON ordenes
WHEN (SELECT activo FROM mesas WHERE id = NEW.mesa_id) IS NOT 1
BEGIN
  SELECT RAISE(ABORT, 'MESA_INACTIVA');
END;

-- No se desactiva una mesa con cuenta abierta.
CREATE TRIGGER trg_mesas_no_desactivar_con_cuenta
BEFORE UPDATE OF activo ON mesas
WHEN NEW.activo = 0 AND OLD.activo = 1
 AND EXISTS (SELECT 1 FROM ordenes WHERE mesa_id = OLD.id AND estado = 'abierta')
BEGIN
  SELECT RAISE(ABORT, 'MESA_CON_CUENTA');
END;

-- Siempre queda al menos un dueño activo (no se le quita el rol ni se desactiva
-- al último), aunque dos cambios lleguen al mismo tiempo.
CREATE TRIGGER trg_usuarios_ultimo_dueno
BEFORE UPDATE OF rol, activo ON usuarios
WHEN OLD.rol = 'dueno' AND OLD.activo = 1
 AND (NEW.rol IS NOT 'dueno' OR NEW.activo IS NOT 1)
 AND NOT EXISTS (SELECT 1 FROM usuarios WHERE id <> OLD.id AND rol = 'dueno' AND activo = 1)
BEGIN
  SELECT RAISE(ABORT, 'ULTIMO_DUENO');
END;
