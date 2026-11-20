// Diálogo con un solo campo "Nombre" (agregar o renombrar una mesa).
import { useState } from 'react';
import { ApiError, mensajeDeError } from '../../api';
import { BotonAccion } from '../../componentes/BotonAccion';
import { Dialogo } from '../../componentes/Dialogo';
import { useToast } from '../../componentes/Toast';

const NOMBRE_MAX = 60;

interface Props {
  titulo: string;
  etiqueta: string;
  inicial: string;
  textoGuardar: string;
  /** Mensaje si el nombre está vacío. */
  errorVacio: string;
  /** Mensaje si el servidor dice que el nombre ya existe (409). */
  errorRepetido: string;
  /** Guarda; si falla, lanza el error del servidor. */
  alGuardar: (nombre: string) => Promise<void>;
  alCerrar: () => void;
}

export function DialogoNombre({ titulo, etiqueta, inicial, textoGuardar, errorVacio, errorRepetido, alGuardar, alCerrar }: Props) {
  const toast = useToast();
  const [nombre, setNombre] = useState(inicial);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    const limpio = nombre.trim().replace(/\s+/g, ' ');
    if (!limpio) {
      setError(errorVacio);
      return;
    }
    setGuardando(true);
    try {
      await alGuardar(limpio);
    } catch (e) {
      setGuardando(false);
      if (e instanceof ApiError && e.status === 409 && /existe/i.test(e.message)) setError(errorRepetido);
      else if (e instanceof ApiError && e.status === 400) setError(e.message);
      else toast({ texto: mensajeDeError(e), tipo: 'error' });
    }
  };

  return (
    <Dialogo titulo={titulo} alCerrar={() => !guardando && alCerrar()}>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void guardar();
        }}
      >
        <h2 className="dialogo__titulo">{titulo}</h2>
        <div className="campo">
          <label className="campo__etiqueta" htmlFor="dialogo-nombre">
            {etiqueta}
          </label>
          <input
            id="dialogo-nombre"
            className="campo__entrada"
            value={nombre}
            maxLength={NOMBRE_MAX}
            autoFocus
            onFocus={(e) => e.target.select()}
            aria-invalid={error !== ''}
            aria-describedby="dialogo-nombre-error"
            onChange={(e) => {
              setNombre(e.target.value);
              setError('');
            }}
          />
          <p id="dialogo-nombre-error" className="campo__error" role={error ? 'alert' : undefined}>
            {error}
          </p>
        </div>
        <div className="dialogo__botones">
          <button type="button" className="boton boton--secundario" onClick={alCerrar} disabled={guardando}>
            Cancelar
          </button>
          <BotonAccion type="submit" className="boton boton--primario" ocupado={guardando} textoOcupado="Guardando…">
            {textoGuardar}
          </BotonAccion>
        </div>
      </form>
    </Dialogo>
  );
}
