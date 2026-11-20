-- Entrega 2: jornadas (el "día" de la caja), salidas de efectivo y corte.
-- Dinero en centavos enteros; fechas ISO 8601 UTC.
--
-- Una jornada la abre la caja capturando el fondo y la cierra con el corte
-- (conteo del efectivo). Solo puede haber UNA abierta a la vez. Cada cobro
-- queda ligado a la jornada abierta en ese momento (ordenes.jornada_id).

CREATE TABLE jornadas (
  id           INTEGER PRIMARY KEY,
  estado       TEXT    NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta', 'cerrada')),
  fondo        INTEGER NOT NULL CHECK (fondo >= 0),
  abierta_por  INTEGER NOT NULL REFERENCES usuarios(id),
  abierta_en   TEXT    NOT NULL,
  cerrada_por  INTEGER REFERENCES usuarios(id),
  cerrada_en   TEXT,
  -- Conteo del efectivo al cerrar: JSON { "denominación en centavos": cantidad }.
  conteo       TEXT    CHECK (conteo IS NULL OR json_valid(conteo)),
  -- Efectivo contado (lo calcula el servidor a partir del conteo).
  contado      INTEGER CHECK (contado IS NULL OR contado >= 0),
  -- Abierta: sin datos de cierre. Cerrada: con todos los datos de cierre.
  CHECK (
    (estado = 'abierta' AND cerrada_por IS NULL AND cerrada_en IS NULL AND conteo IS NULL AND contado IS NULL)
    OR
    (estado = 'cerrada' AND cerrada_por IS NOT NULL AND cerrada_en IS NOT NULL AND conteo IS NOT NULL AND contado IS NOT NULL)
  )
);
-- Solo puede haber UNA jornada abierta (aunque dos cajas abran al mismo tiempo).
CREATE UNIQUE INDEX idx_jornadas_una_abierta ON jornadas(estado) WHERE estado = 'abierta';
CREATE INDEX idx_jornadas_abierta_en ON jornadas(abierta_en);
CREATE INDEX idx_jornadas_cerrada_en ON jornadas(estado, cerrada_en);

-- Salidas de efectivo durante el día (pago a proveedor, compra de hielo...).
-- No se borran: si fue un error de captura se ANULAN (quedan registradas).
CREATE TABLE salidas (
  id           INTEGER PRIMARY KEY,
  jornada_id   INTEGER NOT NULL REFERENCES jornadas(id),
  monto        INTEGER NOT NULL CHECK (monto > 0),
  motivo       TEXT    NOT NULL CHECK (length(motivo) BETWEEN 1 AND 80),
  usuario_id   INTEGER NOT NULL REFERENCES usuarios(id),
  creada       TEXT    NOT NULL,
  anulada_por  INTEGER REFERENCES usuarios(id),
  anulada_en   TEXT,
  CHECK ((anulada_por IS NULL) = (anulada_en IS NULL))
);
CREATE INDEX idx_salidas_jornada ON salidas(jornada_id);

-- Jornada en la que se cobró la cuenta. NULL en cuentas abiertas y en las
-- cobradas antes de la Entrega 2.
ALTER TABLE ordenes ADD COLUMN jornada_id INTEGER REFERENCES jornadas(id);
CREATE INDEX idx_ordenes_jornada ON ordenes(jornada_id);

-- ---------------------------------------------------------------------------
-- Reglas que protege la propia base de datos (a prueba de acciones simultáneas)

-- Una cuenta solo se cobra si queda ligada a una jornada ABIERTA. Si el día se
-- cierra justo al mismo tiempo, el cobro se rechaza completo (no queda ligado
-- a una jornada ya cerrada).
CREATE TRIGGER trg_ordenes_pago_requiere_jornada
BEFORE UPDATE OF estado ON ordenes
WHEN NEW.estado = 'pagada' AND OLD.estado = 'abierta'
BEGIN
  SELECT RAISE(ABORT, 'JORNADA_NO_ABIERTA')
  WHERE NEW.jornada_id IS NULL
     OR (SELECT estado FROM jornadas WHERE id = NEW.jornada_id) IS NOT 'abierta';
END;

-- La jornada de una cuenta ya cobrada no se cambia.
CREATE TRIGGER trg_ordenes_jornada_fija
BEFORE UPDATE OF jornada_id ON ordenes
WHEN OLD.estado = 'pagada' AND NEW.jornada_id IS NOT OLD.jornada_id
BEGIN
  SELECT RAISE(ABORT, 'ORDEN_YA_PAGADA');
END;

-- Las cuentas de una jornada cerrada ya no se modifican.
CREATE TRIGGER trg_ordenes_jornada_cerrada_inmutable
BEFORE UPDATE ON ordenes
WHEN OLD.jornada_id IS NOT NULL
 AND (SELECT estado FROM jornadas WHERE id = OLD.jornada_id) = 'cerrada'
BEGIN
  SELECT RAISE(ABORT, 'JORNADA_CERRADA');
END;

-- Una jornada cerrada no se modifica (ni se reabre).
CREATE TRIGGER trg_jornadas_cerrada_inmutable
BEFORE UPDATE ON jornadas
WHEN OLD.estado = 'cerrada'
BEGIN
  SELECT RAISE(ABORT, 'JORNADA_CERRADA');
END;

-- Al cerrar: no puede haber cuentas abiertas (se revisa en el mismo instante
-- del cierre, aunque un mesero abra una mesa al mismo tiempo).
CREATE TRIGGER trg_jornadas_cierre_sin_cuentas_abiertas
BEFORE UPDATE OF estado ON jornadas
WHEN NEW.estado = 'cerrada' AND OLD.estado = 'abierta'
BEGIN
  SELECT RAISE(ABORT, 'CUENTAS_ABIERTAS')
  WHERE EXISTS (SELECT 1 FROM ordenes WHERE estado = 'abierta');
END;

-- Solo se registran salidas en una jornada abierta.
CREATE TRIGGER trg_salidas_solo_jornada_abierta
BEFORE INSERT ON salidas
WHEN (SELECT estado FROM jornadas WHERE id = NEW.jornada_id) IS NOT 'abierta'
BEGIN
  SELECT RAISE(ABORT, 'JORNADA_NO_ABIERTA');
END;

-- Una salida solo puede cambiar para anularse, una vez, con su jornada abierta.
CREATE TRIGGER trg_salidas_solo_anular
BEFORE UPDATE ON salidas
BEGIN
  SELECT RAISE(ABORT, 'JORNADA_CERRADA')
  WHERE (SELECT estado FROM jornadas WHERE id = OLD.jornada_id) IS NOT 'abierta';
  SELECT RAISE(ABORT, 'SALIDA_YA_ANULADA')
  WHERE OLD.anulada_en IS NOT NULL;
  SELECT RAISE(ABORT, 'SALIDA_INMUTABLE')
  WHERE NEW.jornada_id IS NOT OLD.jornada_id
     OR NEW.monto      IS NOT OLD.monto
     OR NEW.motivo     IS NOT OLD.motivo
     OR NEW.usuario_id IS NOT OLD.usuario_id
     OR NEW.creada     IS NOT OLD.creada
     OR NEW.anulada_en IS NULL;
END;
