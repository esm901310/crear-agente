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

/** Hasta cuándo (ms) está frenado el PIN de cada usuario y por qué, para que "← Cambiar" y volver no lo libere. */
const frenos = new Map<number, { hasta: number; texto: string }>();

/** Texto corto del freno; la cuenta regresiva va debajo ("Espera 2:59."). */
function textoFreno(mensaje: string): string {
  // El servidor frena por usuario (PIN incorrecto varias veces) o por lugar (muchos fallos desde esta red).
  return /PIN incorrecto/i.test(mensaje) ? 'Demasiados intentos con PIN incorrecto.' : 'Demasiados intentos en este lugar.';
}

/** Segundos → "0:42", "1:05". */
function reloj(segundos: number): string {
  return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`;
}

export function TecladoPin({ usuario, alCambiar, alEntrar }: Props) {
  const [pin, setPin] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(() => {
    const f = frenos.get(usuario.id);
    return f && f.hasta > Date.now() ? f.texto : '';
  });
  const [sacudir, setSacudir] = useState(0);
  const enviandoRef = useRef(false);
  const pinRef = useRef('');
  // Demasiados intentos (429 con retry_after): teclado desactivado con cuenta regresiva.
  const [frenoHasta, setFrenoHasta] = useState<number | null>(() => {
    const f = frenos.get(usuario.id);
    return f && f.hasta > Date.now() ? f.hasta : null;
  });
  const [ahora, setAhora] = useState(() => Date.now());
  const frenado = frenoHasta !== null && frenoHasta > ahora;
  const frenadoRef = useRef(frenado);
  frenadoRef.current = frenado;
  const segundos = frenoHasta === null ? 0 : Math.max(0, Math.ceil((frenoHasta - ahora) / 1000));

  useEffect(() => {
    if (frenoHasta === null) return;
    const id = setInterval(() => {
      const t = Date.now();
      setAhora(t);
      if (t >= frenoHasta) {
        clearInterval(id);
        frenos.delete(usuario.id);
        setFrenoHasta(null);
        setError('');
      }
    }, 250);
    return () => clearInterval(id);
  }, [frenoHasta, usuario.id]);

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
          } else if (e instanceof ApiError && e.status === 429 && e.esperarSegundos) {
            // Demasiados intentos: se desactiva el teclado el tiempo que diga el servidor.
            const hasta = Date.now() + e.esperarSegundos * 1000;
            const texto = textoFreno(e.message);
            frenos.set(usuario.id, { hasta, texto });
            setAhora(Date.now());
            setFrenoHasta(hasta);
            setError(texto);
            setSacudir((n) => n + 1);
          } else if (e instanceof ApiError) {
            setError(e.message); // otro mensaje del servidor
            setSacudir((n) => n + 1);
          } else setError('Algo salió mal. Intenta de nuevo.');
        });
    },
    [usuario.id, alEntrar],
  );

  const teclear = useCallback(
    (tecla: string) => {
      if (enviandoRef.current || frenadoRef.current) return;
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
      {frenado && (
        <p className="pin__espera" role="timer" aria-live="off" aria-label={`Espera ${segundos} segundos`}>
          Espera {reloj(segundos)}.
        </p>
      )}

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
              disabled={enviando || frenado}
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
