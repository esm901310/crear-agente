// C2 Paso 2 — Contar efectivo por denominación (docs/diseno.md, 18.2).
// Corte a ciegas: aquí no aparece lo que "debería" haber, solo lo que se cuenta.
import { useEffect, useRef } from 'react';
import { DENOMINACIONES } from '../config';
import { totalConteo } from '../dia';
import { dinero } from '../formato';
import type { Conteo } from '../tipos';
import { FilaDenominacion } from './FilaDenominacion';

interface Props {
  conteo: Conteo;
  alCambiar: (conteo: Conteo) => void;
  alEmpezarDeNuevo: () => void;
  alRevisar: () => void;
}

export function ConteoEfectivo({ conteo, alCambiar, alEmpezarDeNuevo, alRevisar }: Props) {
  const campos = useRef<(HTMLInputElement | null)[]>([]);
  const billetes = totalConteo(conteo, 'billete');
  const monedas = totalConteo(conteo, 'moneda');

  // Foco inicial en el campo de $1,000.
  useEffect(() => {
    campos.current[0]?.focus();
  }, []);

  const grupo = (tipo: 'billete' | 'moneda') => (
    <section className="tarjeta conteo__grupo" aria-labelledby={`titulo-${tipo}`}>
      <h3 id={`titulo-${tipo}`} className="tarjeta__titulo">
        {tipo === 'billete' ? 'Billetes' : 'Monedas'}
      </h3>
      <ul>
        {DENOMINACIONES.map((d, i) =>
          d.tipo !== tipo ? null : (
            <FilaDenominacion
              key={d.valor}
              valor={d.valor}
              tipo={d.tipo}
              cantidad={conteo[String(d.valor)] ?? 0}
              alCambiar={(n) => alCambiar({ ...conteo, [String(d.valor)]: n })}
              alSiguiente={() => {
                const sig = campos.current[i + 1];
                if (sig) sig.focus();
                else alRevisar();
              }}
              entradaRef={(el) => {
                campos.current[i] = el;
              }}
            />
          ),
        )}
      </ul>
      <p className="conteo__subtotal">
        <span>{tipo === 'billete' ? 'Billetes' : 'Monedas'}</span>
        <span className="numeros">{dinero(tipo === 'billete' ? billetes : monedas)}</span>
      </p>
    </section>
  );

  return (
    <section className="cerrar__paso conteo" aria-labelledby="titulo-paso2">
      <h2 id="titulo-paso2" className="solo-lectores">
        Contar efectivo
      </h2>
      <p className="conteo__instruccion">Cuenta todo el efectivo que hay en la caja, incluido el fondo.</p>
      <div className="conteo__grupos">
        {grupo('billete')}
        {grupo('moneda')}
      </div>
      <div className="conteo__barra">
        <div className="conteo__barra-interior">
          <button type="button" className="boton boton--texto" onClick={alEmpezarDeNuevo}>
            Empezar de nuevo
          </button>
          <p className="conteo__total" aria-live="polite">
            <span className="conteo__total-etiqueta">Total contado</span>
            <span className="monto-3xl">{dinero(billetes + monedas)}</span>
          </p>
          <button type="button" className="boton boton--primario boton--grande" onClick={alRevisar}>
            Revisar y cerrar el día
          </button>
        </div>
      </div>
    </section>
  );
}
