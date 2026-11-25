import { useEffect } from 'react';

interface Props {
  texto: string;
  accion?: { texto: string; alTocar: () => void };
  alCerrar: () => void;
  /** Cambia para reiniciar el temporizador. */
  clave: number;
}

export default function AvisoBreve({ texto, accion, alCerrar, clave }: Props) {
  useEffect(() => {
    const t = window.setTimeout(alCerrar, 3000);
    return () => window.clearTimeout(t);
  }, [clave, alCerrar]);

  return (
    <div className="aviso-breve" role="status" aria-live="polite">
      <span>{texto}</span>
      {accion ? (
        <button type="button" className="aviso-breve-accion" onClick={accion.alTocar}>
          {accion.texto}
        </button>
      ) : null}
    </div>
  );
}
