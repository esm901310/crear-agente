// P1 — ¿Quién eres?
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { Cargando } from '../componentes/Cargando';
import { APP_NOMBRE } from '../config';
import { NOMBRE_ROL, type Usuario } from '../tipos';

interface Props {
  sesionVencida: boolean;
  alElegir: (u: Usuario) => void;
}

export function ElegirNombre({ sesionVencida, alElegir }: Props) {
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

  return (
    <main className="entrada">
      <h1 className="entrada__app">{APP_NOMBRE}</h1>
      <h2 className="entrada__pregunta">¿Quién eres?</h2>

      {sesionVencida && (
        <p className="aviso aviso--alerta" role="alert">
          Tu sesión terminó. Vuelve a entrar.
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
