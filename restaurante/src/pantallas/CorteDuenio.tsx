// D2 — Detalle del corte para el dueño (/cortes/:id). Si el día sigue abierto es un corte
// parcial y se actualiza cada 30 s. docs/diseno.md, 20.4.
import { useEffect, useState } from 'react';
import { api } from '../api';
import { Cargando } from '../componentes/Cargando';
import { Encabezado } from '../componentes/Encabezado';
import { RECARGA_CORTES_MS } from '../config';
import { usePolling } from '../hooks/usePolling';
import { navegar } from '../hooks/useRuta';
import { VistaCorte } from './corte/VistaCorte';

export function CorteDuenio({ jornadaId }: { jornadaId: number }) {
  const { datos, error, recargar } = usePolling(() => api.corte(jornadaId), jornadaId, RECARGA_CORTES_MS);
  const [actualizado, setActualizado] = useState(() => Date.now());
  useEffect(() => {
    if (datos) setActualizado(Date.now());
  }, [datos]);

  let cuerpo;
  if (datos) {
    cuerpo = <VistaCorte corte={datos} actualizadoEn={actualizado} />;
  } else if (error) {
    const noExiste = error.status === 404 || error.status === 403;
    cuerpo = (
      <div className="vacio">
        <p className="texto-grande">{noExiste ? 'No encontramos ese corte.' : 'No pudimos cargar el corte.'}</p>
        <div className="botones-fila">
          <button type="button" className="boton boton--secundario" onClick={() => navegar('/cortes')}>
            ← Cortes
          </button>
          {!noExiste && (
            <button type="button" className="boton boton--primario" onClick={recargar}>
              Reintentar
            </button>
          )}
        </div>
      </div>
    );
  } else {
    cuerpo = <Cargando />;
  }

  return (
    <>
      <Encabezado vista="Corte" regreso={{ texto: '← Cortes', alTocar: () => navegar('/cortes') }} />
      <main className="contenido contenido--corte">{cuerpo}</main>
    </>
  );
}
