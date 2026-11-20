// C2 Paso 2½ — Confirmación fuerte antes de cerrar el día (docs/diseno.md, 18.3).
import { BotonAccion } from '../componentes/BotonAccion';
import { Dialogo } from '../componentes/Dialogo';
import { dinero } from '../formato';

interface Props {
  billetes: number;
  monedas: number;
  cerrando: boolean;
  alConfirmar: () => void;
  alCancelar: () => void;
}

export function DialogoCerrarDia({ billetes, monedas, cerrando, alConfirmar, alCancelar }: Props) {
  const total = billetes + monedas;
  return (
    <Dialogo titulo="Cerrar el día" alCerrar={() => !cerrando && alCancelar()}>
      <h2 className="dialogo__titulo">¿Cerrar el día con {dinero(total)} contado?</h2>
      <p>Ya no se puede modificar. Después verás el corte completo.</p>
      {total === 0 && (
        <p className="aviso aviso--alerta">No capturaste efectivo. ¿Seguro que la caja está vacía?</p>
      )}
      <p className="texto-2 texto-s">
        Billetes {dinero(billetes)} · Monedas {dinero(monedas)}
      </p>
      <div className="dialogo__botones">
        {/* El foco inicial va en "Seguir contando" para no cerrar por accidente con Enter. */}
        <button type="button" className="boton boton--secundario dialogo__izquierda" autoFocus disabled={cerrando} onClick={alCancelar}>
          Seguir contando
        </button>
        <BotonAccion type="button" className="boton boton--primario" ocupado={cerrando} textoOcupado="Cerrando el día…" onClick={alConfirmar}>
          Cerrar el día
        </BotonAccion>
      </div>
    </Dialogo>
  );
}
