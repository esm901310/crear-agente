// Caja — cuenta abierta sin platillos: en vez de cobrar, se ofrece liberar la mesa.
import { useState } from 'react';
import { api, ApiError, mensajeDeError } from '../api';
import { BotonAccion } from '../componentes/BotonAccion';
import { Dialogo } from '../componentes/Dialogo';
import { useToast } from '../componentes/Toast';
import type { Orden } from '../tipos';

interface Props {
  orden: Orden;
  /** La cuenta se borró (o ya no existía): la mesa quedó libre. */
  alLiberar: () => void;
  recargar: () => void;
}

export function LiberarMesa({ orden, alLiberar, recargar }: Props) {
  const toast = useToast();
  const [confirmando, setConfirmando] = useState(false);
  const [liberando, setLiberando] = useState(false);

  const liberar = async () => {
    setLiberando(true);
    try {
      await api.cancelarOrden(orden.id);
      toast({ texto: `${orden.mesa_nombre} quedó libre ✓`, tipo: 'ok' });
      alLiberar();
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        // Alguien más ya la cerró: el resultado es el mismo.
        toast({ texto: `${orden.mesa_nombre} ya estaba libre.`, tipo: 'ok' });
        alLiberar();
        return;
      }
      setLiberando(false);
      setConfirmando(false);
      if (e instanceof ApiError && e.status === 409) {
        toast({ texto: 'Esta cuenta ya tiene platillos. Revisa el total.', tipo: 'error' });
        recargar();
      } else {
        toast({ texto: mensajeDeError(e), tipo: 'error' });
      }
    }
  };

  return (
    <section className="caja__cobro" aria-labelledby="titulo-cobrar">
      <div className="cobro__cabeza">
        <h2 id="titulo-cobrar" className="caja__titulo-columna">
          Cobrar
        </h2>
      </div>
      <div className="liberar-mesa">
        <p className="texto-grande">Esta cuenta no tiene platillos</p>
        <p className="texto-2">
          No hay nada que cobrar. Libérala para que la mesa vuelva a aparecer como libre.
        </p>
        <button type="button" className="boton boton--secundario boton--ancho" onClick={() => setConfirmando(true)}>
          Liberar mesa
        </button>
      </div>

      {confirmando && (
        <Dialogo titulo={`Liberar ${orden.mesa_nombre}`} alCerrar={() => !liberando && setConfirmando(false)}>
          <h2 className="dialogo__titulo">¿Liberar {orden.mesa_nombre}?</h2>
          <p>Se borra esta cuenta vacía y la mesa queda libre.</p>
          <div className="dialogo__botones">
            <button
              type="button"
              className="boton boton--secundario"
              autoFocus
              disabled={liberando}
              onClick={() => setConfirmando(false)}
            >
              Cancelar
            </button>
            <BotonAccion
              type="button"
              className="boton boton--primario"
              ocupado={liberando}
              textoOcupado="Liberando…"
              onClick={() => void liberar()}
            >
              Liberar mesa
            </BotonAccion>
          </div>
        </Dialogo>
      )}
    </section>
  );
}
