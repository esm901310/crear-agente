// Diálogo de confirmación (480 px): título, texto y "Cancelar" / acción.
import type { ReactNode } from 'react';
import { BotonAccion } from './BotonAccion';
import { Dialogo } from './Dialogo';

interface Props {
  titulo: string;
  children?: ReactNode;
  textoConfirmar: string;
  textoCancelar?: string;
  /** Botón de acción en rojo (quitar, desactivar). */
  peligro?: boolean;
  ocupado?: boolean;
  textoOcupado?: string;
  alConfirmar: () => void;
  alCancelar: () => void;
}

export function Confirmar({
  titulo,
  children,
  textoConfirmar,
  textoCancelar = 'Cancelar',
  peligro = false,
  ocupado = false,
  textoOcupado = 'Guardando…',
  alConfirmar,
  alCancelar,
}: Props) {
  return (
    <Dialogo titulo={titulo} alCerrar={() => !ocupado && alCancelar()}>
      <h2 className="dialogo__titulo">{titulo}</h2>
      {children}
      <div className="dialogo__botones">
        <button type="button" className="boton boton--secundario" onClick={alCancelar} disabled={ocupado}>
          {textoCancelar}
        </button>
        <BotonAccion
          type="button"
          className={peligro ? 'boton boton--peligro' : 'boton boton--primario'}
          ocupado={ocupado}
          textoOcupado={textoOcupado}
          onClick={alConfirmar}
          autoFocus
        >
          {textoConfirmar}
        </BotonAccion>
      </div>
    </Dialogo>
  );
}
