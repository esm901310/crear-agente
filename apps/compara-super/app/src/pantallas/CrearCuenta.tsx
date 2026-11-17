import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { api } from '../api';
import { ErrorApi } from '../api/cliente';
import { BandaError } from '../componentes/BandaError';
import { BarraInferior } from '../componentes/BarraInferior';
import { CampoTexto } from '../componentes/CampoTexto';
import { Encabezado } from '../componentes/Encabezado';
import { useSesion } from '../estado/sesion';
import { correoValido, mensajeDeError } from '../logica/mensajes';

const ERROR_CORREO = 'Revisa tu correo, parece que le falta algo.';
const ERROR_CONTRASENA = 'Tu contraseña necesita al menos 8 caracteres.';

/** P2 — Crear cuenta */
export function CrearCuenta() {
  const { iniciar } = useSesion();
  const navegar = useNavigate();
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [intentado, setIntentado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [correoRegistrado, setCorreoRegistrado] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);

  const errorCorreo = intentado && !correoValido(correo) ? ERROR_CORREO : null;
  const errorContrasena = intentado && contrasena.length < 8 ? ERROR_CONTRASENA : null;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setIntentado(true);
    setErrorGeneral(null);
    setCorreoRegistrado(false);
    if (!correoValido(correo) || contrasena.length < 8) return;
    setEnviando(true);
    try {
      const usuario = await api.registro(correo.trim(), contrasena);
      iniciar(usuario);
      navegar('/lista', { replace: true });
    } catch (error) {
      if (error instanceof ErrorApi && error.estado === 409) setCorreoRegistrado(true);
      else if (error instanceof ErrorApi && error.estado === 400) setErrorGeneral(error.message);
      else setErrorGeneral(mensajeDeError(error));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="pantalla" onSubmit={enviar} noValidate>
      <Encabezado titulo="Crea tu cuenta" volverA="/">
        <p className="subtitulo">Así guardamos tu lista para la próxima vez.</p>
      </Encabezado>
      <main className="formulario">
        <CampoTexto
          etiqueta="Correo electrónico"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="nombre@correo.com"
          valor={correo}
          alCambiar={(v) => {
            setCorreo(v);
            setCorreoRegistrado(false);
          }}
          error={
            errorCorreo ??
            (correoRegistrado ? (
              <>
                Ese correo ya tiene cuenta. ¿Quieres{' '}
                <Link to="/entrar" replace state={{ correo }} className="enlace-fuerte">
                  entrar
                </Link>
                ?
              </>
            ) : null)
          }
        />
        <CampoTexto
          etiqueta="Contraseña"
          conMostrar
          autoComplete="new-password"
          valor={contrasena}
          alCambiar={setContrasena}
          error={errorContrasena}
          ayuda={errorContrasena ? undefined : 'Mínimo 8 caracteres.'}
        />
      </main>
      <BarraInferior>
        {errorGeneral && <BandaError>{errorGeneral}</BandaError>}
        <button type="submit" className="boton boton-principal" disabled={enviando} aria-busy={enviando}>
          {enviando ? 'Creando tu cuenta…' : 'Crear mi cuenta'}
        </button>
        <p className="texto-pequeno-centro">
          ¿Ya tienes cuenta?{' '}
          <Link to="/entrar" replace className="enlace-fuerte">
            Entrar
          </Link>
        </p>
      </BarraInferior>
    </form>
  );
}
