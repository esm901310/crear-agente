// Caja — lista de cuentas abiertas (izquierda). Se navega también con ↑/↓.
import type { KeyboardEvent } from 'react';
import { Insignia } from '../componentes/Insignia';
import { dinero, minutosDesde, transcurrido } from '../formato';
import type { Orden } from '../tipos';

interface Props {
  ordenes: Orden[];
  seleccionada: number | null;
  ahora: number;
  alElegir: (id: number) => void;
}

export function ListaCuentas({ ordenes, seleccionada, ahora, alElegir }: Props) {
  const alTeclear = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const actual = ordenes.findIndex((o) => o.id === seleccionada);
    const siguiente = Math.min(ordenes.length - 1, Math.max(0, actual + (e.key === 'ArrowDown' ? 1 : -1)));
    const o = ordenes[siguiente];
    if (!o) return;
    alElegir(o.id);
    e.currentTarget.querySelectorAll<HTMLButtonElement>('button')[siguiente]?.focus();
  };

  return (
    <nav className="caja__lista" aria-labelledby="titulo-cuentas">
      <h2 id="titulo-cuentas" className="caja__titulo-columna">
        Cuentas abiertas ({ordenes.length})
      </h2>
      <ul onKeyDown={alTeclear}>
        {ordenes.map((o) => {
          const enCocina = o.comandas.some((c) => c.estado === 'pendiente');
          const activa = o.id === seleccionada;
          return (
            <li key={o.id}>
              <button
                type="button"
                className={activa ? 'cuenta-fila cuenta-fila--activa' : 'cuenta-fila'}
                aria-current={activa ? 'true' : undefined}
                onClick={() => alElegir(o.id)}
              >
                <span className="cuenta-fila__linea">
                  <span className="cuenta-fila__mesa">{o.mesa_nombre}</span>
                  <span className="cuenta-fila__total">{dinero(o.subtotal)}</span>
                </span>
                <span className="cuenta-fila__linea cuenta-fila__linea--2">
                  <span>
                    {o.mesero_nombre} · {transcurrido(minutosDesde(o.creada, ahora))}
                  </span>
                  {enCocina && <Insignia tipo="alerta">En cocina</Insignia>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
