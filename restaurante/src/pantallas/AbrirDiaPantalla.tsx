// Caja — Estado A: sin día abierto y sin cuentas. Tarjeta "Abrir el día" centrada (docs/diseno.md, 17.1).
import { useEffect, useState } from 'react';
import { api } from '../api';
import { FormAbrirDia } from '../componentes/FormAbrirDia';
import { navegar } from '../hooks/useRuta';
import type { JornadaActual } from '../tipos';

export function AbrirDiaPantalla({ alAbrir }: { alAbrir: (j: JornadaActual | null) => void }) {
  // "Ver el último corte" solo si existe alguno (lo dice el servidor, aunque se haya cerrado en otra computadora).
  const [hayCorte, setHayCorte] = useState(false);
  useEffect(() => {
    let vivo = true;
    api
      .ultimoCorte()
      .then(() => vivo && setHayCorte(true))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  return (
    <div className="abrir-dia-pantalla">
      <div className="tarjeta abrir-dia-pantalla__tarjeta">
        <FormAbrirDia alAbrir={alAbrir} />
      </div>
      {hayCorte && (
        <button type="button" className="boton boton--texto" onClick={() => navegar('/caja/corte')}>
          Ver el último corte
        </button>
      )}
    </div>
  );
}
