-- Entrega 1.1: evitar comandas duplicadas si se corta la conexión.
-- La tablet manda un identificador único por envío (UUID). Si reintenta el
-- mismo envío, el servidor lo reconoce y no crea otra comanda.
-- Nullable: las comandas anteriores y los envíos sin identificador quedan en NULL
-- (en SQLite varios NULL no chocan con el índice único).
ALTER TABLE comandas ADD COLUMN envio_id TEXT;
CREATE UNIQUE INDEX idx_comandas_envio_id ON comandas(envio_id) WHERE envio_id IS NOT NULL;
