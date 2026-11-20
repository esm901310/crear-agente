// P2 — PIN de 4 dígitos. Se envía solo al completar el 4.º dígito.
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../api';
import type { Usuario } from '../tipos';

interface Props {
  usuario: Usuario;
  alCambiar: () => void;
  alEntrar: (token: string, usuario: Usuario) => void;
}

const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'borrar'] as const;

export function TecladoPin({ usuario, alCambiar, alEntrar }: Props) {
  const [pin, setPin] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [sacudir, setSacudir] = useState(0);
  const enviandoRef = useRef(false);
  const pinRef = useRef('');

  const cambiarPin = (nuevo: string) => {
    pinRef.current = nuevo;
    setPin(nuevo);
  };

  const enviar = useCallback(
    (completo: string) => {
      enviandoRef.current = true;
      setEnviando(true);
      api
        .login(usuario.id, completo)
        .then((r) => alEntrar(r.token, r.usuario))
        .catch((e: unknown) => {
          enviandoRef.current = false;
          setEnviando(false);
          cambiarPin('');
          if (e instanceof ApiError && e.esRed) setError('No hay conexión. Intenta de nuevo.');
          else if (e instanceof ApiError && e.status === 401) {
            setError('PIN incorrecto. Intenta de nuevo.');
            setSacudir((n) => n + 1);
          } else if (e instanceof ApiError) {
            setError(e.message); // 429 (demasiados intentos) u otro mensaje del servidor
            setSacudir((n) => n + 1);
          } else setError('Algo salió mal. Intenta de nuevo.');
        });
    },
    [usuario.id, alEntrar],
  );

  const teclear = useCallback(
    (tecla: string) => {
      if (enviandoRef.current) return;
      if (tecla === 'borrar') {
        cambiarPin(pinRef.current.slice(0, -1));
        return;
      }
      if (pinRef.current.length >= 4) return;
      setError('');
      const nuevo = pinRef.current + tecla;
      cambiarPin(nuevo);
      if (nuevo.length === 4) enviar(nuevo);
    },
    [enviar],
  );

  // Teclado físico (útil en la Caja).
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^\d$/.test(e.key)) {
        e.preventDefault();
        teclear(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        teclear('borrar');
      }
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [teclear]);

  return (
    <main className="pin">
      <button type="button" className="boton boton--texto pin__cambiar" onClick={alCambiar}>
        ← Cambiar
      </button>
      <span className="inicial inicial--grande" aria-hidden="true">
        {usuario.nombre.charAt(0).toUpperCase()}
      </span>
      <h1 className="pin__hola">Hola, {usuario.nombre}</h1>
      <p className="pin__instruccion" id="pin-instruccion">
        Escribe tu PIN
      </p>

      <div
        key={sacudir}
        className={`pin__puntos ${sacudir > 0 ? 'pin__puntos--sacudir' : ''} ${enviando ? 'pin__puntos--esperando' : ''}`}
        role="img"
        aria-label={`${pin.length} de 4 dígitos escritos`}
      >
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={i < pin.length ? 'pin__punto pin__punto--lleno' : 'pin__punto'} />
        ))}
      </div>

      <p className="pin__error" aria-live="assertive">
        {error}
      </p>

      <div className="teclado" aria-describedby="pin-instruccion">
        {TECLAS.map((t, i) =>
          t === '' ? (
            <span key={i} />
          ) : (
            <button
              key={i}
              type="button"
              className={t === 'borrar' ? 'tecla tecla--borrar' : 'tecla'}
              aria-label={t === 'borrar' ? 'Borrar' : undefined}
              disabled={enviando}
              onClick={() => teclear(t)}
            >
              {t === 'borrar' ? '⌫' : t}
            </button>
          ),
        )}
      </div>
    </main>
  );
}
