// A4 — Cambiar PIN (480 px). Cierra las sesiones de esa persona; si es el propio,
// también la de este aparato y la app vuelve a la entrada. Docs/diseno.md, 30.4.
import { useState } from 'react';
import { api, mensajeDeError } from '../../api';
import { BotonAccion } from '../../componentes/BotonAccion';
import { Dialogo } from '../../componentes/Dialogo';
import { useToast } from '../../componentes/Toast';
import type { UsuarioAdmin } from '../../tipos';
import { CampoPin, pinFacil } from './CampoPin';

interface Props {
  usuario: UsuarioAdmin;
  esUnoMismo: boolean;
  alCambiado: () => void;
  alCerrar: () => void;
}

export function DialogoPin({ usuario, esUnoMismo, alCambiado, alCerrar }: Props) {
  const toast = useToast();
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [error, setError] = useState<{ campo: 'pin' | 'pin2'; texto: string } | null>(null);
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!/^\d{4}$/.test(pin)) {
      setError({ campo: 'pin', texto: 'El PIN debe tener 4 números.' });
      document.getElementById('pin-nuevo')?.focus();
      return;
    }
    if (pin2 !== pin) {
      setError({ campo: 'pin2', texto: 'Los PIN no coinciden.' });
      document.getElementById('pin-repite')?.focus();
      return;
    }
    setGuardando(true);
    try {
      await api.cambiarPin(usuario.id, pin);
      toast({ texto: `PIN de ${usuario.nombre} cambiado ✓`, tipo: 'ok' });
      alCambiado();
    } catch (e) {
      setGuardando(false);
      toast({ texto: mensajeDeError(e), tipo: 'error' });
    }
  };

  const n = usuario.sesiones_abiertas;
  return (
    <Dialogo titulo={`Cambiar PIN de ${usuario.nombre}`} alCerrar={() => !guardando && alCerrar()}>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void guardar();
        }}
      >
        <h2 className="dialogo__titulo">Cambiar PIN de {usuario.nombre}</h2>
        <CampoPin
          id="pin-nuevo"
          etiqueta="Nuevo PIN"
          valor={pin}
          autoFocus
          invalido={error?.campo === 'pin'}
          alCambiar={(p) => {
            setPin(p);
            setError(null);
          }}
        />
        {error?.campo === 'pin' && <p className="campo__error">{error.texto}</p>}
        {pinFacil(pin) && (
          <p className="aviso aviso--alerta" role="status">
            Ese PIN es fácil de adivinar. Mejor usa otro.
          </p>
        )}
        <CampoPin
          id="pin-repite"
          etiqueta="Repite el PIN"
          valor={pin2}
          invalido={error?.campo === 'pin2'}
          alCambiar={(p) => {
            setPin2(p);
            setError(null);
          }}
        />
        {error?.campo === 'pin2' && <p className="campo__error">{error.texto}</p>}
        <p className="aviso aviso--info">
          {esUnoMismo
            ? 'Se cerrará tu sesión en todos los aparatos, también en este. Vas a entrar de nuevo con el PIN nuevo.'
            : `Se cerrará la sesión de ${usuario.nombre} en los aparatos donde esté conectada (${n}).`}
        </p>
        <div className="dialogo__botones">
          <button type="button" className="boton boton--secundario" onClick={alCerrar} disabled={guardando}>
            Cancelar
          </button>
          <BotonAccion type="submit" className="boton boton--primario" ocupado={guardando} textoOcupado="Guardando…">
            Cambiar PIN
          </BotonAccion>
        </div>
      </form>
    </Dialogo>
  );
}
