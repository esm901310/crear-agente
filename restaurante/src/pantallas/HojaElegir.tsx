// M2 — Hoja "Elegir" talla/tamaño u opción (docs/diseno.md, 27.4).
// Si el producto pide una sola cosa, tocarla agrega 1 y cierra. Si pide las dos, se eligen
// como chips y se confirma con "Agregar · L 460.00".
import { useState } from 'react';
import { Dialogo } from '../componentes/Dialogo';
import { dinero } from '../formato';
import { sustantivoVariantes } from '../menu';
import type { Producto, Variante } from '../tipos';

interface Props {
  producto: Producto;
  hoja: boolean;
  /** Piezas en el pedido por variante (id) y por opción (texto). */
  cantidadVariante: (varianteId: number) => number;
  cantidadOpcion: (opcion: string) => number;
  alElegir: (variante: Variante | null, opcion: string | null) => void;
  alCerrar: () => void;
}

export function HojaElegir({ producto: p, hoja, cantidadVariante, cantidadOpcion, alElegir, alCerrar }: Props) {
  const conVariantes = p.variantes.length > 0;
  const conOpciones = p.opciones.length > 0;
  const ambas = conVariantes && conOpciones;
  const [variante, setVariante] = useState<Variante | null>(null);
  const [opcion, setOpcion] = useState<string | null>(null);
  const pregunta = conVariantes ? `Elige ${sustantivoVariantes(p, false) === 'talla' ? 'la talla' : 'el tamaño'}` : 'Elige una opción';
  const listo = (!conVariantes || variante !== null) && (!conOpciones || opcion !== null);
  const precio = variante?.precio ?? p.precio ?? 0;

  const circulo = (n: number) =>
    n > 0 ? (
      <span className="hoja-elegir__cantidad">
        <span className="solo-lectores">, ya hay </span>
        {n}
        <span className="solo-lectores"> en el pedido</span>
      </span>
    ) : null;

  return (
    <Dialogo titulo={p.nombre} alCerrar={alCerrar} hoja={hoja} className="dialogo--ancho hoja-elegir">
      <div className="hoja-elegir__cabeza">
        <div>
          <h2 className="dialogo__titulo">{p.nombre}</h2>
          {p.descripcion && <p className="texto-2 texto-s">{p.descripcion}</p>}
        </div>
        <button type="button" className="boton-cerrar" aria-label="Cerrar" onClick={alCerrar}>
          ✕
        </button>
      </div>

      {ambas ? (
        <>
          <fieldset className="hoja-elegir__grupo">
            <legend className="hoja-elegir__pregunta">{pregunta}</legend>
            <div className="chips chips--envolver">
              {p.variantes.map((v) => (
                <button key={v.id} type="button" className="chip chip--grande" aria-pressed={variante?.id === v.id} onClick={() => setVariante(v)}>
                  {v.nombre} · {dinero(v.precio)}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="hoja-elegir__grupo">
            <legend className="hoja-elegir__pregunta">Elige una opción</legend>
            <div className="chips chips--envolver">
              {p.opciones.map((o) => (
                <button key={o} type="button" className="chip chip--grande" aria-pressed={opcion === o} onClick={() => setOpcion(o)}>
                  {o}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="hoja-elegir__pie">
            <button
              type="button"
              className="boton boton--primario boton--ancho"
              disabled={!listo}
              aria-describedby={!listo ? 'razon-elegir' : undefined}
              onClick={() => alElegir(variante, opcion)}
            >
              Agregar · {dinero(precio)}
            </button>
            {!listo && (
              <p id="razon-elegir" className="razon">
                Elige {sustantivoVariantes(p, false) === 'talla' ? 'la talla' : 'el tamaño'} y una opción.
              </p>
            )}
          </div>
        </>
      ) : conVariantes ? (
        <fieldset className="hoja-elegir__grupo">
          <legend className="hoja-elegir__pregunta">{pregunta}</legend>
          <ul className="hoja-elegir__variantes">
            {p.variantes.map((v) => (
              <li key={v.id}>
                <button type="button" className="opcion-grande" onClick={() => alElegir(v, null)}>
                  <span className="opcion-grande__nombre">{v.nombre}</span>
                  {circulo(cantidadVariante(v.id))}
                  <span className="opcion-grande__precio">{dinero(v.precio)}</span>
                </button>
              </li>
            ))}
          </ul>
        </fieldset>
      ) : (
        <fieldset className="hoja-elegir__grupo">
          <legend className="hoja-elegir__pregunta">{pregunta}</legend>
          <p className="texto-2">{dinero(p.precio ?? 0)} · el precio es el mismo</p>
          <ul className="hoja-elegir__opciones">
            {p.opciones.map((o) => (
              <li key={o}>
                <button type="button" className="opcion-grande opcion-grande--centro" onClick={() => alElegir(null, o)}>
                  <span className="opcion-grande__nombre">{o}</span>
                  {circulo(cantidadOpcion(o))}
                </button>
              </li>
            ))}
          </ul>
        </fieldset>
      )}
    </Dialogo>
  );
}
