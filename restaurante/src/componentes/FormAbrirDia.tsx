// Formulario "Abrir el día": captura el fondo de caja (docs/diseno.md, 17.1).
// Se usa a pantalla completa (sin día y sin cuentas) y dentro del diálogo "Abrir el día".
import { useState } from 'react';
import { api, ApiError, mensajeDeError } from '../api';
import { FONDOS_RAPIDOS } from '../config';
import { centavosATexto, dinero, dineroCorto, textoACentavos } from '../formato';
import type { JornadaActual } from '../tipos';
import { BotonAccion } from './BotonAccion';
import { CampoDinero } from './CampoDinero';
import { useToast } from './Toast';

interface Props {
  /** El día quedó abierto (con la respuesta del servidor) o ya lo estaba (null: hay que recargar). */
  alAbrir: (jornada: JornadaActual | null) => void;
  /** Si existe, se muestra el botón "Cancelar" (versión diálogo). */
  alCancelar?: () => void;
  /** Para avisar al diálogo que no se cierre mientras espera. */
  alCambiarOcupado?: (ocupado: boolean) => void;
}

export function FormAbrirDia({ alAbrir, alCancelar, alCambiarOcupado }: Props) {
  const toast = useToast();
  const [texto, setTexto] = useState('');
  const [abriendo, setAbriendo] = useState(false);
  const fondo = texto.trim() === '' ? null : textoACentavos(texto);
  const valido = fondo !== null;

  const ocupar = (v: boolean) => {
    setAbriendo(v);
    alCambiarOcupado?.(v);
  };

  const abrir = async () => {
    if (!valido || abriendo) return;
    ocupar(true);
    try {
      const j = await api.abrirJornada(fondo);
      toast({ texto: 'Día abierto ✓', tipo: 'ok' });
      ocupar(false);
      alAbrir(j);
    } catch (e) {
      ocupar(false);
      if (e instanceof ApiError && e.status === 409) {
        toast({ texto: e.message || 'El día ya está abierto.', tipo: 'error' });
        alAbrir(null);
        return;
      }
      toast({ texto: mensajeDeError(e), tipo: 'error' });
    }
  };

  let textoBoton = 'Abrir el día';
  if (fondo === 0) textoBoton = 'Abrir el día sin fondo';
  else if (fondo !== null) textoBoton = `Abrir el día con ${dinero(fondo)}`;

  return (
    <form
      className="abrir-dia"
      onSubmit={(e) => {
        e.preventDefault();
        void abrir();
      }}
    >
      <h2 className="abrir-dia__titulo">Abrir el día</h2>
      <p className="texto-2">Cuenta el efectivo con el que empieza la caja (el fondo para dar cambio).</p>
      <CampoDinero
        id="fondo-caja"
        etiqueta="Fondo de caja"
        valor={texto}
        alCambiar={setTexto}
        vacioPermitido
        autoFocus
        className="campo-dinero--grande"
      />
      <div className="chips" role="group" aria-label="Atajos de fondo">
        {FONDOS_RAPIDOS.map((f) => (
          <button
            key={f}
            type="button"
            className="chip"
            aria-pressed={fondo === f}
            onClick={() => setTexto(centavosATexto(f))}
          >
            {dineroCorto(f)}
          </button>
        ))}
      </div>
      <p className="ayuda">El fondo no se puede cambiar después.</p>
      <div className={alCancelar ? 'dialogo__botones' : undefined}>
        {alCancelar && (
          <button type="button" className="boton boton--secundario dialogo__izquierda" disabled={abriendo} onClick={alCancelar}>
            Cancelar
          </button>
        )}
        <BotonAccion
          type="submit"
          className={alCancelar ? 'boton boton--primario' : 'boton boton--primario boton--ancho boton--grande'}
          ocupado={abriendo}
          textoOcupado="Abriendo…"
          disabled={!valido}
        >
          {textoBoton}
        </BotonAccion>
      </div>
    </form>
  );
}
