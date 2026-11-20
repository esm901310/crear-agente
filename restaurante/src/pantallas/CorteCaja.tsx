// C3 — Corte para la caja (/caja/corte): el que regresó "Cerrar el día" o, si no lo tiene
// (recarga, otra computadora), el del último día cerrado. docs/diseno.md, 19 y 19.11.
import { useEffect, useState } from 'react';
import { api, ApiError } from '../api';
import { Cargando } from '../componentes/Cargando';
import { Encabezado } from '../componentes/Encabezado';
import { corteRecienCerrado, olvidarCorteReciente } from '../dia';
import { navegar } from '../hooks/useRuta';
import type { Corte } from '../tipos';
import { VistaCorte } from './corte/VistaCorte';

export function CorteCaja() {
  const [recien] = useState(corteRecienCerrado);
  const [corte, setCorte] = useState<Corte | null>(recien);
  const [conPasos, setConPasos] = useState(recien !== null);
  const [error, setError] = useState<ApiError | null>(null);
  const [intento, setIntento] = useState(0);

  // Los pasos ("✓ Cuentas por cobrar ─ ✓ Contar efectivo ─ ③ Corte") solo justo después de cerrar.
  useEffect(() => olvidarCorteReciente(), []);

  useEffect(() => {
    let vivo = true;
    setError(null);
    api
      .ultimoCorte()
      .then((c) => {
        if (!vivo) return;
        // Si desde otra computadora se cerró un día más nuevo, se muestra ese.
        setCorte((actual) => {
          if (actual && actual.jornada.id !== c.jornada.id) setConPasos(false);
          return actual && actual.jornada.id === c.jornada.id ? actual : c;
        });
      })
      .catch((e: unknown) => {
        if (!vivo) return;
        setError(e instanceof ApiError ? e : new ApiError(500, 'Algo salió mal.'));
      });
    return () => {
      vivo = false;
    };
  }, [intento]);

  let cuerpo;
  if (corte) {
    cuerpo = <VistaCorte corte={corte} conPasos={conPasos} alListo={() => navegar('/caja')} />;
  } else if (error) {
    const sinCortes = error.status === 404;
    const noDisponible = error.status === 403;
    cuerpo = (
      <div className="vacio">
        <p className="texto-grande">
          {sinCortes
            ? 'Todavía no hay cortes.'
            : noDisponible
              ? 'Ese corte ya no está disponible. Pídele al dueño que lo revise.'
              : 'No pudimos cargar el corte.'}
        </p>
        <div className="botones-fila">
          <button type="button" className="boton boton--secundario" onClick={() => navegar('/caja')}>
            ← Caja
          </button>
          {!sinCortes && !noDisponible && (
            <button type="button" className="boton boton--primario" onClick={() => setIntento((n) => n + 1)}>
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
      <Encabezado vista="Corte" />
      <main className="contenido contenido--corte">{cuerpo}</main>
    </>
  );
}
