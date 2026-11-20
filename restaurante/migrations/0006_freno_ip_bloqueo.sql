-- Entrega 2.1: freno por IP más tolerante (todas las tablets del restaurante
-- salen por la misma IP).
-- Al llegar a 50 PIN evaluados e incorrectos en la ventana de 10 min, la IP se
-- bloquea SOLO 3 minutos (bloqueado_hasta). Al terminar el bloqueo el contador
-- baja a la mitad (no se reinicia) y empieza una ventana nueva, así un atacante
-- insistente vuelve a bloquearse pronto.
-- NULL = sin bloqueo (también para las filas que ya existían).
ALTER TABLE freno_ip ADD COLUMN bloqueado_hasta TEXT;  -- ISO 8601 UTC
