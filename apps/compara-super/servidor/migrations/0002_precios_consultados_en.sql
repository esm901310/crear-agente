-- Comparar Súper — fecha de consulta de precios por producto de la lista.
-- precios_consultados_en: cuándo se consultaron en las tiendas los precios guardados en grupo_json
-- (milisegundos). NULL = no se sabe (productos ya existentes o agregados sin fecha de búsqueda):
-- la app lo trata como "precios viejos" y vuelve a comparar.
-- Editar cantidad o sustitutos NO la cambia; comparar la pone en la hora de la comparación.
ALTER TABLE items_lista ADD COLUMN precios_consultados_en INTEGER;
