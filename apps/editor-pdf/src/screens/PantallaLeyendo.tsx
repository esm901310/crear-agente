import { useState } from 'react';
import BarraSuperior from '../components/BarraSuperior';
import BarraProgreso from '../components/BarraProgreso';
import DialogoConfirmar from '../components/DialogoConfirmar';
import type { Progreso } from '../hooks/useCarga';
import type { Pagina } from '../lib/types';

interface Props {
  nombre: string;
  progreso: Progreso;
  paginas: Pagina[];
  alCancelar: () => void;
}

export default function PantallaLeyendo({ nombre, progreso, paginas, alCancelar }: Props) {
  const [confirmar, setConfirmar] = useState(false);
  const preparando = progreso.etapa === 'preparando';
  const miniatura = paginas[Math.max(0, progreso.pagina - 1)]?.miniatura;

  return (
    <div className="pantalla">
      <BarraSuperior
        titulo={nombre}
        acciones={
          <button type="button" className="boton-texto" onClick={() => setConfirmar(true)}>
            Cancelar
          </button>
        }
      />
      <main className="leyendo">
        <div className="leyendo-miniatura brillo">
          {miniatura ? <img src={miniatura} alt="" /> : <div className="leyendo-hoja-vacia" />}
        </div>
        <h2 className="titulo-pantalla">{preparando ? 'Preparando tus páginas…' : 'Leyendo el texto…'}</h2>
        {progreso.total > 0 ? (
          <p>
            Página {progreso.pagina} de {progreso.total}
          </p>
        ) : (
          <p>&nbsp;</p>
        )}
        {!preparando ? <BarraProgreso valor={progreso.fraccion} /> : null}
        <p className="texto-ayuda">Esto toma unos segundos por página. No cierres esta pestaña.</p>
      </main>
      {confirmar ? (
        <DialogoConfirmar
          pregunta="¿Dejar de leer este PDF?"
          textoSi="Sí, cancelar"
          textoNo="Seguir leyendo"
          alSi={alCancelar}
          alNo={() => setConfirmar(false)}
        />
      ) : null}
    </div>
  );
}
