// Corte — "Propinas por mesa": lista simple, 8 a la vista y "Ver todas".
import { useState } from 'react';
import { dinero, plural } from '../../formato';
import type { PropinaMesa } from '../../tipos';

const VISIBLES = 8;

export function TarjetaPropinasMesa({ filas }: { filas: PropinaMesa[] }) {
  const [todas, setTodas] = useState(false);
  const hayPropinas = filas.some((f) => f.total > 0);
  return (
    <section className="tarjeta corte__mesas" aria-labelledby="titulo-mesas">
      <h3 id="titulo-mesas" className="tarjeta__titulo">
        Propinas por mesa
      </h3>
      {!hayPropinas ? (
        <p className="texto-2">No hubo propinas este día.</p>
      ) : (
        <>
          <ul className="lista-simple">
            {filas.map((f, i) => (
              // Las que pasan de 8 se ocultan en pantalla, pero sí se imprimen.
              <li key={f.mesa_id} className={!todas && i >= VISIBLES ? 'lista-simple__fila oculta-en-pantalla' : 'lista-simple__fila'}>
                <span className="fuerte-ligero">{f.nombre}</span>
                <span className="texto-2">{plural(f.cuentas, 'cuenta')}</span>
                <span className="lista-simple__monto">{dinero(f.total)}</span>
              </li>
            ))}
          </ul>
          {filas.length > VISIBLES && (
            <button type="button" className="boton boton--texto boton--alinear-izq no-imprimir" onClick={() => setTodas((t) => !t)}>
              {todas ? 'Ver menos ▴' : `Ver todas (${filas.length}) ▾`}
            </button>
          )}
        </>
      )}
    </section>
  );
}
