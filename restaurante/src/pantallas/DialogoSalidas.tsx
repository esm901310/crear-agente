// Diálogo "Salidas de hoy": lista con "Anular" (pide confirmación). docs/diseno.md, 17.5.
import { useState } from 'react';
import { api, ApiError, mensajeDeError } from '../api';
import { BotonAccion } from '../componentes/BotonAccion';
import { Dialogo } from '../componentes/Dialogo';
import { FilaSalida } from '../componentes/FilaSalida';
import { useToast } from '../componentes/Toast';
import { dinero, hora } from '../formato';
import type { JornadaActual, Salida } from '../tipos';

interface Props {
  salidas: Salida[];
  /** Respuesta del servidor tras anular; null si el día ya se cerró (cerrar todo y recargar). */
  alActualizar: (jornada: JornadaActual | null) => void;
  alNuevaSalida: () => void;
  alCerrar: () => void;
}

export function DialogoSalidas({ salidas, alActualizar, alNuevaSalida, alCerrar }: Props) {
  const toast = useToast();
  const [porAnular, setPorAnular] = useState<Salida | null>(null);
  const [anulando, setAnulando] = useState(false);
  const lista = [...salidas].reverse(); // más reciente primero
  const total = salidas.filter((s) => !s.anulada).reduce((t, s) => t + s.monto, 0);

  const anular = async (s: Salida) => {
    setAnulando(true);
    try {
      const j = await api.anularSalida(s.id);
      toast({ texto: 'Salida anulada ✓', tipo: 'ok' });
      setPorAnular(null);
      alActualizar(j);
    } catch (e) {
      setPorAnular(null);
      if (e instanceof ApiError && e.status === 409) {
        toast({ texto: e.message || 'Este día ya se cerró; la salida no se puede anular.', tipo: 'error' });
        alActualizar(null);
      } else {
        toast({ texto: mensajeDeError(e), tipo: 'error' });
      }
    } finally {
      setAnulando(false);
    }
  };

  return (
    <Dialogo titulo="Salidas de hoy" alCerrar={() => !porAnular && alCerrar()} className="dialogo--ancho">
      <div className="dialogo__cabeza">
        <h2 className="dialogo__titulo">Salidas de hoy</h2>
        <button type="button" className="boton-icono boton-icono--neutro" aria-label="Cerrar" onClick={alCerrar}>
          ✕
        </button>
      </div>
      <div className="dialogo__scroll">
        {lista.length === 0 ? (
          <p className="texto-2">No hay salidas hoy.</p>
        ) : (
          <ul className="salidas">
            {lista.map((s) => (
              <FilaSalida
                key={s.id}
                salida={s}
                accion={
                  <button
                    type="button"
                    className="boton boton--secundario boton--mini boton--peligro-texto"
                    aria-label={`Anular salida ${s.motivo} de ${dinero(s.monto)}`}
                    onClick={() => setPorAnular(s)}
                  >
                    Anular
                  </button>
                }
              />
            ))}
          </ul>
        )}
      </div>
      <div className="salidas__total">
        <span>Total de salidas</span>
        <span className="numeros">{dinero(total)}</span>
      </div>
      <div className="dialogo__botones">
        <button type="button" className="boton boton--secundario dialogo__izquierda" onClick={alNuevaSalida}>
          − Nueva salida
        </button>
        <button type="button" className="boton boton--primario" onClick={alCerrar}>
          Cerrar
        </button>
      </div>

      {porAnular && (
        <Dialogo titulo="¿Anular esta salida?" alCerrar={() => !anulando && setPorAnular(null)}>
          <h2 className="dialogo__titulo">¿Anular esta salida?</h2>
          <p>
            {porAnular.motivo} · {dinero(porAnular.monto)} · {hora(porAnular.creada)}. Quedará registrada como anulada y
            ya no se descontará de la caja.
          </p>
          <div className="dialogo__botones">
            <button
              type="button"
              className="boton boton--secundario"
              autoFocus
              disabled={anulando}
              onClick={() => setPorAnular(null)}
            >
              No, dejarla
            </button>
            <BotonAccion
              type="button"
              className="boton boton--peligro"
              ocupado={anulando}
              textoOcupado="Anulando…"
              onClick={() => void anular(porAnular)}
            >
              Anular salida
            </BotonAccion>
          </div>
        </Dialogo>
      )}
    </Dialogo>
  );
}
