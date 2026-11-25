import { useState } from 'react';
import type { Ajustes } from '../lib/types';
import { CATALOGO, familiaCss, letraPorId } from '../lib/catalogo';

const COLORES = [
  { hex: '#000000', nombre: 'Negro' },
  { hex: '#333333', nombre: 'Gris oscuro' },
  { hex: '#1A3D8F', nombre: 'Azul' },
  { hex: '#B00020', nombre: 'Rojo' },
];

interface Props {
  ajustes: Ajustes;
  negritaActual: boolean;
  colorDetectado: string;
  /** Ids de letras de la más a la menos parecida (puede venir vacío). */
  sugeridas: string[];
  /** Palabra para la muestra de cada letra. */
  muestra: string;
  alCambiar: (a: Ajustes) => void;
}

function OpcionLetra({
  id,
  muestra,
  activa,
  etiqueta,
  negrita,
  cursiva,
  alElegir,
}: {
  id: string;
  muestra: string;
  activa: boolean;
  etiqueta?: string;
  negrita: boolean;
  cursiva: boolean;
  alElegir: () => void;
}) {
  const l = letraPorId(id);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={activa}
      className={`opcion-letra ${activa ? 'opcion-letra-activa' : ''}`}
      onClick={alElegir}
      data-letra={id}
    >
      <span
        className="opcion-letra-muestra"
        style={{ fontFamily: familiaCss(id), fontWeight: negrita ? 700 : 400, fontStyle: cursiva ? 'italic' : 'normal' }}
      >
        {muestra}
      </span>
      <span className="opcion-letra-nombre">
        {l.nombre}
        {l.parecida ? <span className="opcion-letra-ayuda"> · como {l.parecida}</span> : null}
      </span>
      {etiqueta ? <span className="opcion-letra-etiqueta">{etiqueta}</span> : null}
    </button>
  );
}

export default function SelectorEstilo({ ajustes, negritaActual, colorDetectado, sugeridas, muestra, alCambiar }: Props) {
  const [verTodas, setVerTodas] = useState(false);
  const cambiarEscala = (factor: number) =>
    alCambiar({ ...ajustes, escala: Math.min(2, Math.max(0.5, Math.round(ajustes.escala * factor * 100) / 100)) });
  const cambiarGrosor = (paso: number) =>
    alCambiar({ ...ajustes, grosor: Math.min(1.8, Math.max(0.5, Math.round(((ajustes.grosor ?? 1) + paso) * 100) / 100)) });
  const cambiarAncho = (paso: number) =>
    alCambiar({ ...ajustes, ancho: Math.min(1.4, Math.max(0.7, Math.round((ajustes.ancho + paso) * 100) / 100)) });

  // Las 3–4 más parecidas (y siempre la elegida, aunque no esté entre ellas).
  const principales = sugeridas.slice(0, 4);
  if (!principales.includes(ajustes.fuente)) principales.push(ajustes.fuente);
  const muestraCorta = (muestra || 'Texto').slice(0, 18);
  const opcion = (id: string, etiqueta?: string) => (
    <OpcionLetra
      key={id}
      id={id}
      muestra={muestraCorta}
      activa={ajustes.fuente === id}
      etiqueta={etiqueta}
      negrita={negritaActual}
      cursiva={ajustes.cursiva}
      alElegir={() => alCambiar({ ...ajustes, fuente: id })}
    />
  );

  return (
    <div className="selector-estilo">
      <div className="selector-bloque">
        <span className="selector-etiqueta" id="etq-letra">
          Letra
        </span>
        <div className="lista-letras" role="radiogroup" aria-labelledby="etq-letra">
          {principales.map((id, i) => opcion(id, i === 0 && sugeridas[0] === id ? 'La más parecida' : undefined))}
        </div>
        <button type="button" className="plegable" aria-expanded={verTodas} onClick={() => setVerTodas((v) => !v)}>
          {verTodas ? 'Ver menos' : 'Ver todas'} <span aria-hidden="true">{verTodas ? '▴' : '▾'}</span>
        </button>
        {verTodas ? (
          <div className="lista-letras" role="radiogroup" aria-label="Todas las letras">
            {CATALOGO.filter((l) => !principales.includes(l.id)).map((l) => opcion(l.id))}
          </div>
        ) : null}
      </div>

      <div className="selector-fila">
        <span className="selector-etiqueta">Tamaño</span>
        <div className="selector-grupo">
          <button type="button" className="boton-chico" onClick={() => cambiarEscala(1 / 1.06)} aria-label="Letra más chica">
            A−
          </button>
          <button type="button" className="boton-chico" onClick={() => cambiarEscala(1.06)} aria-label="Letra más grande">
            A+
          </button>
        </div>
      </div>

      <div className="selector-fila">
        <span className="selector-etiqueta">Ancho</span>
        <div className="selector-grupo">
          <button type="button" className="boton-chico" onClick={() => cambiarAncho(-0.03)} aria-label="Letras más angostas">
            −
          </button>
          <button type="button" className="boton-chico" onClick={() => cambiarAncho(0.03)} aria-label="Letras más anchas">
            +
          </button>
        </div>
      </div>

      <div className="selector-fila">
        <span className="selector-etiqueta">Grosor</span>
        <div className="selector-grupo">
          <button type="button" className="boton-chico" onClick={() => cambiarGrosor(-0.1)} aria-label="Trazo más delgado">
            −
          </button>
          <button type="button" className="boton-chico" onClick={() => cambiarGrosor(0.1)} aria-label="Trazo más grueso">
            +
          </button>
        </div>
      </div>

      <div className="selector-fila">
        <span className="selector-etiqueta" id="etq-negrita">
          Negrita
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={negritaActual}
          aria-labelledby="etq-negrita"
          className={`interruptor ${negritaActual ? 'interruptor-activo' : ''}`}
          onClick={() => alCambiar({ ...ajustes, negrita: !negritaActual })}
        >
          <span className="interruptor-bola" />
        </button>
      </div>

      <div className="selector-fila">
        <span className="selector-etiqueta" id="etq-cursiva">
          Inclinada (cursiva)
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={ajustes.cursiva}
          aria-labelledby="etq-cursiva"
          className={`interruptor ${ajustes.cursiva ? 'interruptor-activo' : ''}`}
          onClick={() => alCambiar({ ...ajustes, cursiva: !ajustes.cursiva })}
        >
          <span className="interruptor-bola" />
        </button>
      </div>

      <div className="selector-fila">
        <span className="selector-etiqueta">Color</span>
        <div className="selector-grupo" role="radiogroup" aria-label="Color del texto">
          {[{ hex: colorDetectado, nombre: 'Color detectado', detectado: true }, ...COLORES].map((c) => {
            const activo = 'detectado' in c ? ajustes.color === null : ajustes.color?.toLowerCase() === c.hex.toLowerCase();
            return (
              <button
                key={c.nombre}
                type="button"
                role="radio"
                aria-checked={activo}
                aria-label={c.nombre}
                title={c.nombre}
                className={`muestra-color ${activo ? 'muestra-activa' : ''}`}
                style={{ background: c.hex }}
                onClick={() => alCambiar({ ...ajustes, color: 'detectado' in c ? null : c.hex })}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
