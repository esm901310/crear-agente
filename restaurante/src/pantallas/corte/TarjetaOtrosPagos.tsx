// Corte — "Tarjeta y transferencia": para comparar con la terminal y el banco.
import { dinero } from '../../formato';
import type { Corte } from '../../tipos';

export function TarjetaOtrosPagos({ porMetodo }: { porMetodo: Corte['por_metodo'] }) {
  const total = porMetodo.efectivo + porMetodo.tarjeta + porMetodo.transferencia;
  return (
    <section className="tarjeta corte__otros" aria-labelledby="titulo-otros">
      <h3 id="titulo-otros" className="tarjeta__titulo">
        Tarjeta y transferencia
      </h3>
      <div className="metodo">
        <p className="metodo__fila">
          <span>Tarjeta</span>
          <span className="metodo__monto">{dinero(porMetodo.tarjeta)}</span>
        </p>
        <p className="ayuda">Compara con los vouchers de la terminal.</p>
      </div>
      <div className="metodo">
        <p className="metodo__fila">
          <span>Transferencia</span>
          <span className="metodo__monto">{dinero(porMetodo.transferencia)}</span>
        </p>
        <p className="ayuda">Compara con los depósitos del banco.</p>
      </div>
      <hr className="separador" />
      <div className="metodo">
        <p className="metodo__fila metodo__fila--total">
          <span>Total cobrado</span>
          <span className="numeros">{dinero(total)}</span>
        </p>
        <p className="ayuda">(todas las formas, con propinas)</p>
      </div>
    </section>
  );
}
