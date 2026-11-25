import { useEffect, useRef, useState } from 'react';
import PanelInferior from '../components/PanelInferior';
import CampoTexto from '../components/CampoTexto';
import SelectorEstilo from '../components/SelectorEstilo';
import BotonIcono from '../components/BotonIcono';
import BotonPrincipal from '../components/BotonPrincipal';
import BotonSecundario from '../components/BotonSecundario';
import BotonTexto from '../components/BotonTexto';
import type { EstiloFinal } from '../lib/edit';
import type { Ajustes, Caja } from '../lib/types';

interface Props {
  textoOriginal: string;
  texto: string;
  alCambiarTexto: (t: string) => void;
  ajustes: Ajustes;
  alCambiarAjustes: (a: Ajustes) => void;
  estilo: EstiloFinal;
  /** Se tuvo que achicar un poco el texto para que la línea quepa. */
  achicado: boolean;
  dudosa: boolean;
  yaEditada: boolean;
  /** Para la vista previa recortada. */
  lienzo: HTMLCanvasElement;
  /** Zona a mostrar en la vista previa (la línea completa). */
  caja: Caja;
  versionVista: number;
  alGuardar: () => void;
  alCancelar: () => void;
  alVolverOriginal: () => void;
  alElegirOtras: () => void;
  alCambiarAltura: (px: number) => void;
}

function VistaPrevia({ lienzo, caja, version }: { lienzo: HTMLCanvasElement; caja: Caja; version: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const alto = caja.y1 - caja.y0;
    const m = alto * 0.35;
    const x0 = Math.max(0, caja.x0 - m);
    const y0 = Math.max(0, caja.y0 - m);
    const x1 = Math.min(lienzo.width, caja.x1 + m);
    const y1 = Math.min(lienzo.height, caja.y1 + m);
    c.width = Math.max(1, Math.round(x1 - x0));
    c.height = Math.max(1, Math.round(y1 - y0));
    ctx.drawImage(lienzo, x0, y0, x1 - x0, y1 - y0, 0, 0, c.width, c.height);
  }, [lienzo, caja, version]);
  return <canvas ref={ref} className="vista-previa" aria-label="Vista previa del cambio" role="img" />;
}

export default function PanelEdicion(p: Props) {
  const campo = useRef<HTMLInputElement>(null);
  const [verEstilo, setVerEstilo] = useState(false);

  useEffect(() => {
    const el = campo.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    el.select();
  }, []);

  return (
    <PanelInferior etiqueta="Cambiar texto" alCerrar={p.alCancelar} alCambiarAltura={p.alCambiarAltura} className="panel-edicion">
      <div className="panel-encabezado">
        <h2 className="subtitulo">Cambiar texto</h2>
        <BotonIcono icono="cerrar" etiqueta="Cerrar" onClick={p.alCancelar} />
      </div>

      <p className="texto-leido">
        <span className="texto-leido-etiqueta">Texto que leímos: </span>
        <span className="texto-leido-valor">{p.textoOriginal}</span>
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          p.alGuardar();
        }}
      >
        <CampoTexto
          ref={campo}
          id="texto-nuevo"
          etiqueta="Texto nuevo"
          value={p.texto}
          onChange={(e) => p.alCambiarTexto(e.target.value)}
          enterKeyHint="done"
          aviso={
            p.dudosa ? 'Puede que no lo hayamos leído bien. Revísalo antes de guardar.' : undefined
          }
          ayuda={p.achicado ? 'El texto nuevo es más largo; lo haremos un poco más pequeño para que quepa.' : undefined}
        />

        <div className="vista-previa-cont">
          <span className="texto-ayuda">Así quedará:</span>
          <VistaPrevia lienzo={p.lienzo} caja={p.caja} version={p.versionVista} />
        </div>

        <button type="button" className="plegable" aria-expanded={verEstilo} onClick={() => setVerEstilo((v) => !v)}>
          Ajustar estilo <span aria-hidden="true">{verEstilo ? '▴' : '▾'}</span>
        </button>
        {verEstilo ? (
          <SelectorEstilo
            ajustes={p.ajustes}
            negritaActual={p.estilo.negrita}
            colorDetectado={p.estilo.colorDetectado}
            alCambiar={p.alCambiarAjustes}
          />
        ) : null}

        <div className="panel-enlaces">
          <BotonTexto onClick={p.alElegirOtras}>Elegir otras palabras</BotonTexto>
          {p.yaEditada ? (
            <BotonTexto peligro onClick={p.alVolverOriginal}>
              Volver al original
            </BotonTexto>
          ) : null}
        </div>

        <div className="fila-botones">
          <BotonSecundario className="tercio" onClick={p.alCancelar}>
            Cancelar
          </BotonSecundario>
          <BotonPrincipal type="submit" className="dos-tercios">
            Guardar cambio
          </BotonPrincipal>
        </div>
      </form>
    </PanelInferior>
  );
}
