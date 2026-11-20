// Lo que ya se mandó a cocina, con su estado. La más reciente primero.
import { useEffect, useRef, useState } from 'react';
import { EstadoComanda } from '../componentes/EstadoComanda';
import { dinero, hora } from '../formato';
import type { Orden } from '../tipos';

export function YaEnviado({ orden }: { orden: Orden | null }) {
  const [destellos, setDestellos] = useState<Set<number>>(new Set());
  const anteriores = useRef<Map<number, string>>(new Map());

  // Destello verde cuando una comanda pasa de "En preparación" a "Listo".
  useEffect(() => {
    if (!orden) return;
    const nuevos: number[] = [];
    for (const c of orden.comandas) {
      if (anteriores.current.get(c.id) === 'pendiente' && c.estado === 'listo') nuevos.push(c.id);
      anteriores.current.set(c.id, c.estado);
    }
    if (nuevos.length === 0) return;
    setDestellos((s) => new Set([...s, ...nuevos]));
    // Sin limpieza a propósito: el destello debe terminar aunque llegue otra consulta.
    setTimeout(() => {
      setDestellos((s) => {
        const copia = new Set(s);
        nuevos.forEach((id) => copia.delete(id));
        return copia;
      });
    }, 700);
  }, [orden]);

  const comandas = orden ? [...orden.comandas].reverse() : [];

  return (
    <section className="enviado" aria-labelledby="titulo-ya-enviado">
      <h2 id="titulo-ya-enviado" className="titulo-seccion">
        Ya enviado
      </h2>
      {comandas.length === 0 ? (
        <p className="texto-2">Aún no se ha enviado nada a cocina.</p>
      ) : (
        <>
          <ul className="enviado__comandas">
            {comandas.map((c) => (
              <li key={c.id} className={destellos.has(c.id) ? 'enviado__comanda destello-ok' : 'enviado__comanda'}>
                <div className="enviado__encabezado">
                  <span>{hora(c.creada)}</span>
                  <EstadoComanda estado={c.estado} />
                </div>
                <ul>
                  {c.items.map((i) => (
                    <li key={i.id} className="enviado__item">
                      <div className="enviado__item-fila">
                        <span>
                          {i.cantidad}× {i.nombre}
                        </span>
                        <span className="texto-2 numeros">{dinero(i.precio * i.cantidad)}</span>
                      </div>
                      {i.nota && <p className="nota-italica">{i.nota}</p>}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          <div className="enviado__subtotal">
            <span>Subtotal</span>
            <span className="monto-2xl">{dinero(orden?.subtotal ?? 0)}</span>
          </div>
        </>
      )}
    </section>
  );
}
