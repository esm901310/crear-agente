import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { api } from '../api';
import { ErrorApi } from '../api/cliente';
import { BandaError } from '../componentes/BandaError';
import { BarraInferior } from '../componentes/BarraInferior';
import { CampoTexto } from '../componentes/CampoTexto';
import { Encabezado } from '../componentes/Encabezado';
import { useSesion } from '../estado/sesion';
import { useSegundosRestantes } from '../ganchos/useSegundosRestantes';
import { correoValido, mensajeDeError, mensajeEntradaPausada } from '../logica/mensajes';

/** P3 — Iniciar sesión. (P4 Recuperar contraseña queda para otra entrega.) */
export function IniciarSesion() {
  const { iniciar } = useSesion();
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const correoInicial = (ubicacion.state as { correo?: string } | null)?.correo ?? '';
  const [correo, setCorreo] = useState(correoInicial);
  const [contrasena, setContrasena] = useState('');
  const [intentado, setIntentado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  /** Tras un 429: hasta cuándo (ms) el servidor pausó el inicio de sesión y de qué correo. */
  const [pausa, setPausa] = useState<{ hasta: number; correo: string } | null>(null);
  const segundosPausa = useSegundosRestantes(pausa?.hasta ?? null);
  // La pausa es de esa cuenta: si la persona escribe otro correo, puede intentar.
  const pausado = pausa !== null && segundosPausa > 0 && pausa.correo === correo.trim().toLowerCase();

  const errorCorreo = intentado && !correoValido(correo) ? 'Revisa tu correo, parece que le falta algo.' : null;
  const errorContrasena = intentado && contrasena.length === 0 ? 'Escribe tu contraseña.' : null;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setIntentado(true);
    if (pausado) return;
    setErrorGeneral(null);
    setPausa(null);
    if (!correoValido(correo) || contrasena.length === 0) return;
    setEnviando(true);
    try {
      const usuario = await api.entrar(correo.trim(), contrasena);
      iniciar(usuario);
      navegar('/lista', { replace: true });
    } catch (error) {
      if (error instanceof ErrorApi && error.estado === 429) {
        setPausa({ hasta: error.esperarHasta ?? Date.now() + 60_000, correo: correo.trim().toLowerCase() });
      } else if (error instanceof ErrorApi && (error.estado === 401 || error.estado === 400 || error.estado === 404)) {
        setErrorGeneral('El correo o la contraseña no coinciden. Intenta de nuevo.');
      } else {
        setErrorGeneral(mensajeDeError(error));
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="pantalla" onSubmit={enviar} noValidate>
      <Encabezado titulo="Qué bueno verte" volverA="/" />
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
          alCambiar={setCorreo}
          error={errorCorreo}
        />
        <CampoTexto
          etiqueta="Contraseña"
          conMostrar
          autoComplete="current-password"
          valor={contrasena}
          alCambiar={setContrasena}
          error={errorContrasena}
        />
      </main>
      <BarraInferior>
        {pausado && (
          <div role="status">
            <BandaError tono="ambar">{mensajeEntradaPausada(segundosPausa)}</BandaError>
          </div>
        )}
        {errorGeneral && <BandaError>{errorGeneral}</BandaError>}
        <button type="submit" className="boton boton-principal" disabled={enviando || pausado} aria-busy={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
        <p className="texto-pequeno-centro">
          ¿No tienes cuenta?{' '}
          <Link to="/crear-cuenta" replace className="enlace-fuerte">
            Crear cuenta
          </Link>
        </p>
      </BarraInferior>
    </form>
  );
}
