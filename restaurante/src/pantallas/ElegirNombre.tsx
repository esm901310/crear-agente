// P1 — ¿Quién eres?
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { Cargando } from '../componentes/Cargando';
import { APP_LUGAR, APP_NOMBRE } from '../config';
import { frenoLugarHasta, reloj } from '../freno';
import { NOMBRE_ROL, type Usuario } from '../tipos';

interface Props {
  sesionVencida: boolean;
  aviso?: string | null;
  alElegir: (u: Usuario) => void;
}

export function ElegirNombre({ sesionVencida, aviso = null, alElegir }: Props) {
  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null);
  const [error, setError] = useState(false);

  const cargar = useCallback(() => {
    setError(false);
    setUsuarios(null);
    api
      .usuariosLogin()
      .then(setUsuarios)
      .catch(() => setError(true));
  }, []);

  useEffect(cargar, [cargar]);

  // Freno por lugar (todo el aparato): aviso con cuenta regresiva; los nombres se pueden tocar igual.
  const [frenoHasta, setFrenoHasta] = useState(() => frenoLugarHasta());
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    if (frenoHasta === null) return;
    const id = setInterval(() => {
      const t = Date.now();
      setAhora(t);
      if (t >= frenoHasta) setFrenoHasta(frenoLugarHasta(t));
    }, 500);
    return () => clearInterval(id);
  }, [frenoHasta]);
  const segundos = frenoHasta === null ? 0 : Math.max(0, Math.ceil((frenoHasta - ahora) / 1000));

  return (
    <main className="entrada">
      <div className="entrada__marca">
        <h1 className="entrada__app">{APP_NOMBRE}</h1>
        <p className="entrada__lugar">{APP_LUGAR}</p>
      </div>
      <h2 className="entrada__pregunta">¿Quién eres?</h2>

      {aviso && (
        <p className="aviso aviso--info" role="status">
          {aviso}
        </p>
      )}
      {sesionVencida && !aviso && (
        <p className="aviso aviso--alerta" role="alert">
          Tu sesión terminó. Vuelve a entrar.
        </p>
      )}

      {frenoHasta !== null && segundos > 0 && (
        <p className="aviso aviso--alerta" role="status">
          Demasiados intentos en este aparato. Espera {reloj(segundos)} para volver a intentar.
        </p>
      )}

      {error ? (
        <div className="vacio">
          <p>No pudimos cargar los nombres. Revisa la conexión.</p>
          <button type="button" className="boton boton--primario" onClick={cargar}>
            Reintentar
          </button>
        </div>
      ) : usuarios === null ? (
        <Cargando />
      ) : usuarios.length === 0 ? (
        <p className="vacio">No hay usuarios registrados. Pide ayuda al dueño.</p>
      ) : (
        <ul className="usuarios">
          {usuarios.map((u) => (
            <li key={u.id}>
              <button type="button" className="usuario-tarjeta" onClick={() => alElegir(u)}>
                <span className="inicial" aria-hidden="true">
                  {u.nombre.charAt(0).toUpperCase()}
                </span>
                <span className="usuario-tarjeta__nombre">{u.nombre}</span>
                <span className="usuario-tarjeta__rol">{NOMBRE_ROL[u.rol]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
