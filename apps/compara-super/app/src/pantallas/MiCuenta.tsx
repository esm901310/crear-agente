import { useState } from 'react';
import { useNavigate } from 'react-router';
import { BandaError } from '../componentes/BandaError';
import { Encabezado } from '../componentes/Encabezado';
import { HojaInferior } from '../componentes/HojaInferior';
import { useAvisos } from '../estado/avisos';
import { useSesion } from '../estado/sesion';
import { mensajeDeError } from '../logica/mensajes';
import { TIENDAS_ANUNCIADAS, unirNombres } from '../logica/tiendas';

/** P10 — Mi cuenta */
export function MiCuenta() {
  const { usuario, salir, borrarCuenta } = useSesion();
  const { mostrar } = useAvisos();
  const navegar = useNavigate();
  const [saliendo, setSaliendo] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [errorBorrar, setErrorBorrar] = useState<string | null>(null);

  async function cerrarSesion() {
    setSaliendo(true);
    try {
      await salir();
      navegar('/', { replace: true });
    } catch (e) {
      mostrar(mensajeDeError(e));
      setSaliendo(false);
    }
  }

  async function borrar() {
    setBorrando(true);
    setErrorBorrar(null);
    try {
      await borrarCuenta();
      navegar('/', { replace: true });
      mostrar('Borramos tu cuenta y tu lista.');
    } catch (e) {
      setErrorBorrar(mensajeDeError(e));
      setBorrando(false);
    }
  }

  return (
    <main className="pantalla">
      <Encabezado titulo="Mi cuenta" volverA="/lista">
        <p className="subtitulo">{usuario?.correo}</p>
      </Encabezado>

      <section className="seccion" aria-labelledby="sobre-precios">
        <h2 id="sobre-precios" className="titulo-seccion">
          Sobre los precios
        </h2>
        <p>
          Consultamos los precios en las páginas de {unirNombres(TIENDAS_ANUNCIADAS, 'y', true)}. Pueden cambiar o
          ser distintos en la tienda. Comparar Súper no tiene relación con estos supermercados.
        </p>
      </section>

      <div className="cuenta-acciones">
        <button
          type="button"
          className="boton boton-secundario"
          onClick={cerrarSesion}
          disabled={saliendo}
          aria-busy={saliendo}
        >
          {saliendo ? 'Cerrando sesión…' : 'Cerrar sesión'}
        </button>
        <button type="button" className="boton-texto boton-texto-peligro boton-texto-centro" onClick={() => setConfirmar(true)}>
          Borrar mi cuenta
        </button>
        <p className="version">Versión 1.0</p>
      </div>

      <HojaInferior
        abierta={confirmar}
        alCerrar={() => !borrando && setConfirmar(false)}
        titulo="¿Borrar tu cuenta?"
        conCerrar={false}
        pie={
          <>
            <button type="button" className="boton boton-peligro" onClick={borrar} disabled={borrando} aria-busy={borrando}>
              {borrando ? 'Borrando…' : 'Sí, borrar'}
            </button>
            <button type="button" className="boton boton-principal" onClick={() => setConfirmar(false)} disabled={borrando}>
              Cancelar
            </button>
          </>
        }
      >
        <p>Se borrarán tu cuenta y tu lista. No se puede deshacer.</p>
        {errorBorrar && <BandaError>{errorBorrar}</BandaError>}
      </HojaInferior>
    </main>
  );
}
