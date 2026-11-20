// Caja — confirmación después de cobrar (el cambio, lo más grande de la pantalla).
import { dinero } from '../formato';
import type { Orden } from '../tipos';

interface Props {
  orden: Orden;
  cambio: number | null;
  alSiguiente: () => void;
}

export function CobroExitoso({ orden, cambio, alSiguiente }: Props) {
  return (
    <section className="caja__cobro" aria-labelledby="titulo-cobrada">
      <div className="cobro-exitoso" role="status">
        <h2 id="titulo-cobrada" className="cobro-exitoso__titulo">
          Cuenta cobrada ✓
        </h2>
        <p className="cobro-exitoso__resumen">
          {orden.mesa_nombre} · Total {dinero(orden.total)}
        </p>
        {cambio !== null && (
          <p className="cobro-exitoso__cambio">
            <span className="cobro-exitoso__cambio-etiqueta">Cambio:</span> {dinero(cambio)}
          </p>
        )}
        <button type="button" className="boton boton--primario boton--ancho" autoFocus onClick={alSiguiente}>
          Siguiente cuenta
        </button>
      </div>
    </section>
  );
}
