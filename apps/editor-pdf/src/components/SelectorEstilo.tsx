import type { Ajustes, Fuente } from '../lib/types';

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
  alCambiar: (a: Ajustes) => void;
}

export default function SelectorEstilo({ ajustes, negritaActual, colorDetectado, alCambiar }: Props) {
  const cambiarEscala = (factor: number) =>
    alCambiar({ ...ajustes, escala: Math.min(2, Math.max(0.5, Math.round(ajustes.escala * factor * 100) / 100)) });
  const fuente = (f: Fuente) => alCambiar({ ...ajustes, fuente: f });

  return (
    <div className="selector-estilo">
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
                className={`muestra-color ${activo ? 'muestra-activa' : ''} ${'detectado' in c ? 'muestra-detectada' : ''}`}
                style={{ background: c.hex }}
                onClick={() => alCambiar({ ...ajustes, color: 'detectado' in c ? null : c.hex })}
              />
            );
          })}
        </div>
      </div>

      <div className="selector-fila">
        <span className="selector-etiqueta">Letra</span>
        <div className="selector-grupo" role="radiogroup" aria-label="Tipo de letra">
          <button type="button" role="radio" aria-checked={ajustes.fuente === 'sans'} className={`boton-chico ${ajustes.fuente === 'sans' ? 'boton-chico-activo' : ''}`} style={{ fontFamily: 'Arial, Helvetica, sans-serif' }} onClick={() => fuente('sans')}>
            Simple
          </button>
          <button type="button" role="radio" aria-checked={ajustes.fuente === 'serif'} className={`boton-chico ${ajustes.fuente === 'serif' ? 'boton-chico-activo' : ''}`} style={{ fontFamily: '"Times New Roman", Times, serif' }} onClick={() => fuente('serif')}>
            Clásica
          </button>
        </div>
      </div>
    </div>
  );
}
