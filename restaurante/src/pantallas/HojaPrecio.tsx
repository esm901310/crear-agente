// M2 — Hoja de precio abierto (p. ej. la langosta según tamaño). Docs/diseno.md, 27.5.
// Se escribe como en una calculadora: "1250" → "L 1,250"; "." agrega hasta 2 decimales.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Dialogo } from '../componentes/Dialogo';
import { PRECIO_MAX } from '../config';
import { centavosATexto, dinero, textoACentavos } from '../formato';
import type { Producto } from '../tipos';

interface Props {
  producto: Producto;
  hoja: boolean;
  /** Para "✎ Cambiar": lo que ya se había capturado. */
  inicial?: { opcion: string | null; precio: number };
  alAgregar: (opcion: string | null, precio: number) => void;
  alCerrar: () => void;
}

const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'borrar'] as const;

/** Texto tecleado ("1250.5") → como se ve en el visor ("1,250.5"). */
function visor(texto: string): string {
  if (texto === '') return '0.00';
  const [e, d] = texto.split('.');
  const entero = Number(e || '0').toLocaleString('en-US');
  return d === undefined ? entero : `${entero}.${d}`;
}

/** Centavos → texto para seguir tecleando ("125000" → "1250", "125050" → "1250.5"). */
function aTexto(centavos: number): string {
  return centavosATexto(centavos).replace(/,/g, '').replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

export function HojaPrecio({ producto: p, hoja, inicial, alAgregar, alCerrar }: Props) {
  const [opcion, setOpcion] = useState<string | null>(inicial?.opcion ?? null);
  const [texto, setTexto] = useState(() => (inicial && inicial.precio > 0 ? aTexto(inicial.precio) : ''));
  const textoRef = useRef(texto);
  textoRef.current = texto;
  const centavos = textoACentavos(texto) ?? 0;
  const conOpciones = p.opciones.length > 0;
  const falta = (conOpciones && opcion === null) || centavos <= 0;

  const teclear = useCallback((t: string) => {
    const actual = textoRef.current;
    let nuevo = actual;
    if (t === 'borrar') nuevo = actual.slice(0, -1);
    else if (t === '.') nuevo = actual.includes('.') ? actual : `${actual === '' ? '0' : actual}.`;
    else {
      const [, d] = actual.split('.');
      if (d !== undefined && d.length >= 2) return;
      nuevo = actual === '0' ? t : actual + t;
    }
    const c = textoACentavos(nuevo);
    if (c === null || c > PRECIO_MAX) return; // el teclado no deja pasar del máximo
    setTexto(nuevo);
  }, []);

  // Teclado físico.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^\d$/.test(e.key) || e.key === '.' || e.key === ',') {
        e.preventDefault();
        teclear(e.key === ',' ? '.' : e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        teclear('borrar');
      }
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [teclear]);

  const razon = conOpciones ? 'Elige la preparación y escribe el precio.' : 'Escribe el precio.';

  return (
    <Dialogo titulo={p.nombre} alCerrar={alCerrar} hoja={hoja} className="dialogo--ancho hoja-precio">
      <div className="hoja-elegir__cabeza">
        <div>
          <h2 className="dialogo__titulo">{p.nombre}</h2>
          {p.descripcion && <p className="texto-2 texto-s">{p.descripcion}</p>}
        </div>
        <button type="button" className="boton-cerrar" aria-label="Cerrar" onClick={alCerrar}>
          ✕
        </button>
      </div>

      {conOpciones && (
        <fieldset className="hoja-elegir__grupo">
          <legend className="hoja-elegir__pregunta">Preparación</legend>
          <div className="chips chips--envolver">
            {p.opciones.map((o) => (
              <button key={o} type="button" className="chip chip--grande" aria-pressed={opcion === o} onClick={() => setOpcion(o)}>
                {o}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <div className="hoja-precio__campo">
        <p className="hoja-elegir__pregunta" id="etiqueta-precio">
          Precio · {p.nombre}
        </p>
        <output className="hoja-precio__visor" aria-labelledby="etiqueta-precio" aria-live="polite">
          <span aria-hidden="true">L</span>
          <span className="numeros">{visor(texto)}</span>
        </output>
      </div>

      <div className="hoja-precio__teclado" role="group" aria-label="Teclado de precio">
        {TECLAS.map((t) => (
          <button
            key={t}
            type="button"
            className={t === 'borrar' ? 'tecla tecla--precio tecla--borrar' : 'tecla tecla--precio'}
            aria-label={t === 'borrar' ? 'Borrar' : t === '.' ? 'Punto decimal' : undefined}
            onClick={() => teclear(t)}
          >
            {t === 'borrar' ? '⌫' : t}
          </button>
        ))}
      </div>

      <div className="dialogo__botones">
        <button type="button" className="boton boton--secundario" onClick={alCerrar}>
          Cancelar
        </button>
        <button
          type="button"
          className="boton boton--primario"
          disabled={falta}
          aria-describedby={falta ? 'razon-precio' : undefined}
          onClick={() => alAgregar(opcion, centavos)}
        >
          Agregar · {dinero(centavos)}
        </button>
      </div>
      {falta && (
        <p id="razon-precio" className="razon razon--derecha">
          {razon}
        </p>
      )}
    </Dialogo>
  );
}
