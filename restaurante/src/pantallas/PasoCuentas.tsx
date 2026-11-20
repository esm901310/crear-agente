// C2 Paso 1 — Cuentas por cobrar: bloquean el cierre del día (docs/diseno.md, 18.1).
import { useAhora } from '../hooks/useAhora';
import { navegar } from '../hooks/useRuta';
import { dinero, minutosDesde, plural, transcurrido } from '../formato';

export interface CuentaPorCobrar {
  orden_id: number;
  mesa_nombre: string;
  mesero_nombre: string | null;
  creada: string | null;
  total: number;
  sinPlatillos: boolean;
}

interface Props {
  cuentas: CuentaPorCobrar[];
  /** Cuántas cuentas faltan (puede ser más que la lista si el servidor ya sabe de otras). */
  pendientes: number;
  alSeguir: () => void;
}

export function PasoCuentas({ cuentas, pendientes, alSeguir }: Props) {
  const ahora = useAhora(30000);
  const n = Math.max(pendientes, cuentas.length);
  return (
    <section className="cerrar__paso" aria-labelledby="titulo-paso1">
      <h2 id="titulo-paso1" className="solo-lectores">
        Cuentas por cobrar
      </h2>
      {n > 0 ? (
        <div className="aviso aviso--alerta aviso--bloque" role="status">
          <p className="aviso__titulo">⚠ Faltan {plural(n, 'cuenta')} por cobrar</p>
          <p className="aviso__texto">Para cerrar el día, todas las cuentas deben estar cobradas.</p>
        </div>
      ) : (
        <div className="aviso aviso--ok aviso--bloque" role="status">
          <p className="aviso__titulo">Todas las cuentas están cobradas ✓</p>
        </div>
      )}

      {cuentas.length > 0 && (
        <ul className="tarjeta lista-pendientes">
          {cuentas.map((c) => (
            <li key={c.orden_id} className="pendiente">
              <div className="pendiente__info">
                <p className="pendiente__titulo">
                  {c.mesa_nombre}
                  {c.mesero_nombre && ` · ${c.mesero_nombre}`}
                  {c.creada && (
                    <span className="pendiente__tiempo"> · abierta hace {transcurrido(minutosDesde(c.creada, ahora))}</span>
                  )}
                </p>
                {c.sinPlatillos && <p className="texto-2 texto-s">Sin platillos</p>}
              </div>
              <span className="pendiente__total">{dinero(c.total)}</span>
              <button type="button" className="boton boton--secundario boton--chico" onClick={() => navegar(`/caja/${c.orden_id}`)}>
                Ir a cobrar
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="cerrar__acciones">
        <button
          type="button"
          className="boton boton--primario"
          disabled={n > 0}
          aria-describedby={n > 0 ? 'razon-paso1' : undefined}
          onClick={alSeguir}
        >
          Contar efectivo →
        </button>
        {n > 0 && (
          <p id="razon-paso1" className="ayuda">
            Cobra o libera las cuentas para seguir.
          </p>
        )}
      </div>
    </section>
  );
}
