import { useEffect, useRef } from 'react';

interface Props {
  pregunta: string;
  textoSi: string;
  textoNo: string;
  alSi: () => void;
  alNo: () => void;
  peligro?: boolean;
}

export default function DialogoConfirmar({ pregunta, textoSi, textoNo, alSi, alNo, peligro }: Props) {
  const noRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    noRef.current?.focus();
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') alNo();
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [alNo]);

  return (
    <div className="dialogo-fondo" onClick={alNo}>
      <div className="dialogo" role="alertdialog" aria-modal="true" aria-labelledby="dialogo-pregunta" onClick={(e) => e.stopPropagation()}>
        <p id="dialogo-pregunta" className="dialogo-pregunta">
          {pregunta}
        </p>
        <div className="dialogo-botones">
          <button ref={noRef} type="button" className="boton boton-secundario" onClick={alNo}>
            {textoNo}
          </button>
          <button type="button" className={`boton ${peligro ? 'boton-peligro' : 'boton-principal'}`} onClick={alSi}>
            {textoSi}
          </button>
        </div>
      </div>
    </div>
  );
}
