// Caja — cobrar con propina y una o varias formas de pago (derecha).
// Todo se calcula en centavos enteros para evitar errores de redondeo.
import { useEffect, useRef, useState } from 'react';
import { api, ApiError, mensajeDeError } from '../api';
import { BotonAccion } from '../componentes/BotonAccion';
import { CampoDinero } from '../componentes/CampoDinero';
import { useToast } from '../componentes/Toast';
import { BILLETES_RAPIDOS, PROPINAS_PCT } from '../config';
import { centavosATexto, dinero, textoACentavos } from '../formato';
import { NOMBRE_METODO, type MetodoPago, type Orden } from '../tipos';

const METODOS: MetodoPago[] = ['efectivo', 'tarjeta', 'transferencia'];

type ModoPropina = { tipo: 'sin' } | { tipo: 'pct'; pct: number } | { tipo: 'otra' };

interface FilaPago {
  metodo: MetodoPago;
  texto: string; // pesos, como lo escribió la cajera
}

interface Props {
  orden: Orden;
  alCobrar: (pagada: Orden, cambio: number | null) => void;
  recargar: () => void;
}

/** Calcula la propina en centavos (null si "Otra" tiene un monto inválido). */
function calcularPropina(subtotal: number, modo: ModoPropina, otraTexto: string): number | null {
  if (modo.tipo === 'pct') return Math.round((subtotal * modo.pct) / 100);
  if (modo.tipo === 'otra') return textoACentavos(otraTexto);
  return 0;
}

export function PanelCobro({ orden, alCobrar, recargar }: Props) {
  const toast = useToast();
  const subtotal = orden.subtotal;

  const [modo, setModo] = useState<ModoPropina>({ tipo: 'sin' });
  const [otraTexto, setOtraTexto] = useState('');
  const [pagos, setPagos] = useState<FilaPago[]>([{ metodo: 'efectivo', texto: centavosATexto(subtotal) }]);
  const [recibidoTexto, setRecibidoTexto] = useState('');
  const [cobrando, setCobrando] = useState(false);
  const [avisoCambio, setAvisoCambio] = useState(false);
  const [enfocar, setEnfocar] = useState<MetodoPago | null>(null);
  const entradas = useRef(new Map<MetodoPago, HTMLInputElement>());

  // --- Cálculos ---
  const propina = calcularPropina(subtotal, modo, otraTexto);
  const total = subtotal + (propina ?? 0);
  const montos = pagos.map((p) => textoACentavos(p.texto));
  const montosValidos = montos.every((m) => m !== null);
  const suma = montos.reduce<number>((s, m) => s + (m ?? 0), 0);
  const falta = total - suma;
  const iEfectivo = pagos.findIndex((p) => p.metodo === 'efectivo');
  const efectivo = iEfectivo >= 0 ? (montos[iEfectivo] ?? 0) : 0;
  const recibido = iEfectivo >= 0 && recibidoTexto.trim() !== '' ? textoACentavos(recibidoTexto) : undefined;
  const cambio = recibido != null && efectivo > 0 ? recibido - efectivo : null;

  let razon = '';
  if (subtotal <= 0) razon = 'La cuenta no tiene platillos.';
  else if (propina === null) razon = 'Revisa el monto de la propina.';
  else if (!montosValidos) razon = 'Revisa los montos de pago.';
  else if (falta > 0) razon = 'Asigna el total para poder cobrar.';
  else if (falta < 0) razon = 'Los pagos suman más que el total. Ajusta los montos.';
  else if (recibido === null) razon = 'Revisa el monto recibido.';
  else if (cambio !== null && cambio < 0) razon = 'El efectivo recibido no alcanza.';
  const habilitado = razon === '' && !cobrando;

  // Si solo hay una forma de pago, su monto sigue al total (cambia la propina o se agregan platillos).
  const totalAnterior = useRef(total);
  useEffect(() => {
    if (totalAnterior.current === total) return;
    totalAnterior.current = total;
    setPagos((p) => (p.length === 1 ? [{ ...p[0], texto: centavosATexto(total) }] : p));
  }, [total]);

  // Aviso si el mesero agregó platillos mientras se cobraba.
  const subtotalAnterior = useRef(subtotal);
  useEffect(() => {
    if (subtotalAnterior.current !== subtotal) setAvisoCambio(true);
    subtotalAnterior.current = subtotal;
  }, [subtotal]);

  // Enfocar el campo de una forma de pago recién agregada.
  useEffect(() => {
    if (!enfocar) return;
    entradas.current.get(enfocar)?.focus();
    setEnfocar(null);
  }, [enfocar]);

  const cambiarTexto = (i: number, texto: string) =>
    setPagos((p) => p.map((f, j) => (j === i ? { ...f, texto } : f)));

  const agregarMetodo = (metodo: MetodoPago) => {
    setPagos((p) => [...p, { metodo, texto: centavosATexto(Math.max(0, falta)) }]);
    setEnfocar(metodo);
  };

  const quitarMetodo = (i: number) => {
    if (pagos[i].metodo === 'efectivo') setRecibidoTexto('');
    setPagos((p) => p.filter((_, j) => j !== i));
  };

  const cobrar = async () => {
    if (!habilitado || propina === null) return;
    setCobrando(true);
    try {
      const lista = pagos
        .map((p, i) => ({ metodo: p.metodo, monto: montos[i] ?? 0 }))
        .filter((p) => p.monto > 0);
      const pagada = await api.pagar(orden.id, propina, lista);
      alCobrar(pagada, cambio !== null && recibido != null ? cambio : null);
    } catch (e) {
      toast({ texto: mensajeDeError(e), tipo: 'error' });
      // 409 (la cuenta cambió) o 400 (no cuadra con lo que tiene el servidor): traer la cuenta al día.
      if (e instanceof ApiError && (e.status === 409 || e.status === 400)) recargar();
      setCobrando(false);
    }
  };

  const faltantes = METODOS.filter((m) => !pagos.some((p) => p.metodo === m));

  return (
    <section className="caja__cobro" aria-labelledby="titulo-cobrar">
      <form
        className="cobro"
        onSubmit={(e) => {
          e.preventDefault();
          void cobrar();
        }}
      >
        {/* Encabezado fijo: no se va con el desplazamiento de la columna. */}
        <div className="cobro__cabeza">
          <h2 id="titulo-cobrar" className="caja__titulo-columna">
            Cobrar
          </h2>
          <p className="cobro__cabeza-subtotal">
            <span>Subtotal</span> <span className="numeros">{dinero(subtotal)}</span>
          </p>
        </div>

        <div className="cobro__scroll">
          {avisoCambio && (
            <p className="aviso aviso--alerta" role="alert">
              Se agregaron platillos. Revisa el total.
            </p>
          )}

          {/* Propina */}
          <fieldset className="cobro__grupo">
            <legend className="campo__etiqueta">Propina</legend>
            <div className="chips chips--envolver chips--propina">
              <button type="button" className="chip" aria-pressed={modo.tipo === 'sin'} onClick={() => setModo({ tipo: 'sin' })}>
                Sin propina
              </button>
              {PROPINAS_PCT.map((pct) => (
                <button
                  key={pct}
                  type="button"
                  className="chip"
                  aria-pressed={modo.tipo === 'pct' && modo.pct === pct}
                  onClick={() => setModo({ tipo: 'pct', pct })}
                >
                  {pct}%
                </button>
              ))}
              <button
                type="button"
                className="chip"
                aria-pressed={modo.tipo === 'otra'}
                onClick={() => setModo({ tipo: 'otra' })}
              >
                Otra
              </button>
            </div>
            {modo.tipo === 'otra' && (
              <CampoDinero
                id="propina-otra"
                etiqueta="Monto de propina"
                valor={otraTexto}
                alCambiar={setOtraTexto}
                autoFocus
              />
            )}
          </fieldset>

          <div className="cobro__renglon">
            <span>Propina{modo.tipo === 'pct' ? ` (${modo.pct}%)` : ''}</span>
            <span className="numeros">{propina === null ? '—' : dinero(propina)}</span>
          </div>

          <div className="cobro__total">
            <span>TOTAL</span>
            <span className="monto-3xl">{dinero(total)}</span>
          </div>

          {/* Formas de pago */}
          <fieldset className="cobro__grupo">
            <legend className="campo__etiqueta">Formas de pago</legend>
            <ul className="pagos">
              {pagos.map((p, i) => {
                const m = montos[i];
                const ponerFalta = falta !== 0 && m !== null && m + falta >= 0;
                return (
                  <li key={p.metodo} className="pago">
                    <div className="pago__fila">
                      <div className="pago__metodo">
                        <span id={`metodo-${p.metodo}`}>{NOMBRE_METODO[p.metodo]}</span>
                        {ponerFalta && (
                          <button
                            type="button"
                            className="boton boton--texto boton--texto-chico pago__poner"
                            onClick={() => cambiarTexto(i, centavosATexto((m ?? 0) + falta))}
                          >
                            Poner lo que falta
                          </button>
                        )}
                      </div>
                      <CampoDinero
                        id={`monto-${p.metodo}`}
                        etiqueta={`Monto en ${NOMBRE_METODO[p.metodo].toLowerCase()}`}
                        etiquetaOculta
                        valor={p.texto}
                        alCambiar={(t) => cambiarTexto(i, t)}
                        className="pago__monto"
                        entradaRef={(el) => {
                          if (el) entradas.current.set(p.metodo, el);
                          else entradas.current.delete(p.metodo);
                        }}
                      />
                      {pagos.length > 1 && (
                        <button
                          type="button"
                          className="boton-icono"
                          aria-label={`Quitar ${NOMBRE_METODO[p.metodo].toLowerCase()}`}
                          title="Quitar"
                          onClick={() => quitarMetodo(i)}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    {p.metodo === 'efectivo' && (
                      <div className="efectivo">
                        <CampoDinero
                          id="recibido"
                          etiqueta="Recibido"
                          valor={recibidoTexto}
                          alCambiar={setRecibidoTexto}
                          vacioPermitido
                          className="campo-dinero--fila"
                        />
                        <div className="chips chips--chicos chips--una-fila" role="group" aria-label="Atajos de billetes">
                          {BILLETES_RAPIDOS.map((b) => (
                            <button key={b} type="button" className="chip chip--chico" onClick={() => setRecibidoTexto(centavosATexto(b))}>
                              {dinero(b).replace('.00', '')}
                            </button>
                          ))}
                          <button
                            type="button"
                            className="chip chip--chico"
                            onClick={() => setRecibidoTexto(centavosATexto(efectivo))}
                          >
                            Exacto
                          </button>
                        </div>
                        {cambio !== null && cambio >= 0 && (
                          <p className="efectivo__cambio" aria-live="polite">
                            <span>Cambio</span> <span className="efectivo__cambio-monto">{dinero(cambio)}</span>
                          </p>
                        )}
                        {cambio !== null && cambio < 0 && (
                          <p className="efectivo__faltan" aria-live="polite">
                            Faltan {dinero(-cambio)}
                          </p>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {faltantes.length > 0 && (
              <div className="pagos__agregar">
                {faltantes.map((m) => (
                  <button key={m} type="button" className="boton boton--secundario boton--chico" onClick={() => agregarMetodo(m)}>
                    + {NOMBRE_METODO[m]}
                  </button>
                ))}
              </div>
            )}
          </fieldset>
        </div>

        <div className="cobro__pie">
          <p
            className={`cobro__cuadre ${falta === 0 ? 'cobro__cuadre--ok' : falta > 0 ? 'cobro__cuadre--falta' : 'cobro__cuadre--sobra'}`}
            aria-live="polite"
          >
            {!montosValidos
              ? 'Revisa los montos de pago.'
              : falta === 0
                ? `Asignado ${dinero(suma)} ✓`
                : falta > 0
                  ? `Faltan ${dinero(falta)} por asignar`
                  : `Sobran ${dinero(-falta)}. Ajusta los montos.`}
          </p>
          <BotonAccion
            type="submit"
            className="boton boton--primario boton--cobrar"
            ocupado={cobrando}
            textoOcupado="Cobrando…"
            disabled={!habilitado}
            aria-describedby={razon ? 'razon-cobrar' : undefined}
          >
            Cobrar {dinero(total)}
          </BotonAccion>
          {razon && (
            <p id="razon-cobrar" className="cobro__razon">
              {razon}
            </p>
          )}
        </div>
      </form>
    </section>
  );
}
