// D3 — Reporte de propinas por rango de fechas (/propinas), solo dueño. docs/diseno.md, 20.5.
// Las fechas son días de calendario en hora de Honduras; la semana empieza en lunes.
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { api, ApiError, mensajeDeError } from '../api';
import { Cargando } from '../componentes/Cargando';
import { Encabezado } from '../componentes/Encabezado';
import { MenuImprimir } from '../componentes/MenuImprimir';
import { Spinner } from '../componentes/Spinner';
import { RANGO_MAX_DIAS } from '../config';
import {
  dinero,
  diasEnRango,
  fechaValida,
  hoyHonduras,
  inicioDeMes,
  lunesDe,
  plural,
  rangoCorto,
  rangoEnPalabras,
  sumarDias,
} from '../formato';
import type { ReportePropinas } from '../tipos';
import { PieImpresion } from './corte/PieImpresion';
import { Renglon } from './corte/Renglon';
import { TablaPropinasMesero } from './corte/TablaPropinasMesero';
import { PestanasDuenio } from './PestanasDuenio';

type Atajo = 'hoy' | 'semana' | 'semana-pasada' | 'mes';
const ATAJOS: { id: Atajo; texto: string }[] = [
  { id: 'hoy', texto: 'Hoy' },
  { id: 'semana', texto: 'Esta semana' },
  { id: 'semana-pasada', texto: 'Semana pasada' },
  { id: 'mes', texto: 'Este mes' },
];
const LLAVE_ATAJO = 'propinas-atajo';

interface Rango {
  desde: string;
  hasta: string;
}

function rangoDe(atajo: Atajo, hoy = hoyHonduras()): Rango {
  switch (atajo) {
    case 'hoy':
      return { desde: hoy, hasta: hoy };
    case 'semana':
      return { desde: lunesDe(hoy), hasta: hoy };
    case 'semana-pasada': {
      const lunes = sumarDias(lunesDe(hoy), -7);
      return { desde: lunes, hasta: sumarDias(lunes, 6) };
    }
    case 'mes':
      return { desde: inicioDeMes(hoy), hasta: hoy };
  }
}

function leerAtajo(): Atajo {
  const v = localStorage.getItem(LLAVE_ATAJO);
  return ATAJOS.some((a) => a.id === v) ? (v as Atajo) : 'hoy';
}

/** Mensaje si el rango no se puede consultar (o null si está bien). */
function validar(r: Rango): string | null {
  if (!fechaValida(r.desde) || !fechaValida(r.hasta)) return 'Escribe las dos fechas.';
  if (r.desde > r.hasta) return "La fecha 'Desde' debe ser antes de 'Hasta'.";
  if (diasEnRango(r.desde, r.hasta) > RANGO_MAX_DIAS) return `El rango máximo es de ${RANGO_MAX_DIAS} días.`;
  return null;
}

export function Propinas() {
  const [atajo, setAtajo] = useState<Atajo | null>(leerAtajo);
  const [campos, setCampos] = useState<Rango>(() => rangoDe(leerAtajo()));
  const [rango, setRango] = useState<Rango>(campos);
  const [datos, setDatos] = useState<ReportePropinas | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorRango, setErrorRango] = useState<string | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const [diaAbiertoMx, setDiaAbiertoMx] = useState<boolean>(false);
  const [impresoEn, setImpresoEn] = useState(() => Date.now());
  const consulta = useRef(0);

  // ¿Hay día abierto? (para avisar que las cifras de hoy pueden cambiar)
  useEffect(() => {
    api
      .jornadaActual()
      .then((r) => setDiaAbiertoMx(r.jornada !== null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const n = ++consulta.current;
    setCargando(true);
    setErrorCarga(null);
    api
      .reportePropinas(rango.desde, rango.hasta)
      .then((r) => {
        if (n !== consulta.current) return;
        setDatos(r);
        setErrorRango(null);
      })
      .catch((e: unknown) => {
        if (n !== consulta.current) return;
        if (e instanceof ApiError && e.status === 400) setErrorRango(e.message);
        else setErrorCarga(mensajeDeError(e));
      })
      .finally(() => {
        if (n === consulta.current) setCargando(false);
      });
  }, [rango, intento]);

  const elegirAtajo = (a: Atajo) => {
    const r = rangoDe(a);
    setAtajo(a);
    localStorage.setItem(LLAVE_ATAJO, a);
    setCampos(r);
    setErrorRango(null);
    setRango(r);
  };

  /** Consulta el rango escrito (al salir del campo o con Enter). */
  const aplicarCampos = () => {
    const problema = validar(campos);
    setErrorRango(problema);
    if (problema) return;
    if (campos.desde !== rango.desde || campos.hasta !== rango.hasta) setRango(campos);
  };

  const cambiarCampo = (k: keyof Rango, v: string) => {
    setAtajo(null);
    setCampos((c) => ({ ...c, [k]: v }));
  };
  const alTeclear = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      aplicarCampos();
    }
  };

  const meseros = datos?.por_mesero ?? [];
  const mesas = datos?.por_mesa ?? [];
  const suma = (k: 'total' | 'efectivo' | 'tarjeta' | 'transferencia') => meseros.reduce((s, m) => s + m[k], 0);
  const total = suma('total');
  const hoy = hoyHonduras();
  const incluyeHoy = datos ? datos.desde <= hoy && hoy <= datos.hasta : false;
  const diasConCorte = datos ? (datos.dias ?? datos.jornadas) : 0;
  // Con servidor nuevo manda `abiertas`; si no viene, se adivina con el día abierto actual.
  const incluyeEnCurso = datos ? (datos.abiertas !== undefined ? datos.abiertas > 0 : incluyeHoy && diaAbiertoMx) : false;
  const tituloImpreso = datos ? `Reporte de propinas · ${rangoCorto(datos.desde, datos.hasta)}` : 'Reporte de propinas';

  let contenido;
  if (!datos) {
    contenido = errorCarga ? (
      <div className="vacio">
        <p className="texto-grande">No pudimos cargar el reporte.</p>
        <button type="button" className="boton boton--primario" onClick={() => setIntento((n) => n + 1)}>
          Reintentar
        </button>
      </div>
    ) : errorRango ? null : (
      <Cargando />
    );
  } else {
    contenido = (
      <div className="imprimible">
        <div className={cargando ? 'imprimible__pantalla reporte reporte--actualizando' : 'imprimible__pantalla reporte'}>
          <h2 className="corte__titulo solo-impresion">{tituloImpreso}</h2>
          <div className="reporte__resumen">
            <p className="reporte__rango" aria-live="polite">
              {rangoEnPalabras(datos.desde, datos.hasta)} · {plural(diasConCorte, 'día con corte', 'días con corte')}
              {cargando && <Spinner pequeno />}
            </p>
            <MenuImprimir antesDeImprimir={() => setImpresoEn(Date.now())} />
          </div>
          {incluyeEnCurso && <p className="ayuda">Incluye el día en curso; puede cambiar.</p>}
          {errorCarga && <p className="aviso aviso--alerta">{errorCarga}</p>}

          <dl className="cifras cifras--tarjetas">
            {[
              { etiqueta: 'Total propinas', valor: total },
              { etiqueta: 'Efectivo', valor: suma('efectivo') },
              { etiqueta: 'Tarjeta', valor: suma('tarjeta') },
              { etiqueta: 'Transferencia', valor: suma('transferencia') },
            ].map((c) => (
              <div key={c.etiqueta} className="tarjeta cifra">
                <dt className="cifra__etiqueta">{c.etiqueta}</dt>
                <dd className="cifra__valor">{dinero(c.valor)}</dd>
              </div>
            ))}
          </dl>

          {total === 0 && <p className="texto-2 reporte__vacio">No hay propinas en estas fechas.</p>}

          <div className="reporte__tablas">
            <section className="tarjeta" aria-labelledby="titulo-por-mesero">
              <h3 id="titulo-por-mesero" className="tarjeta__titulo">
                Por mesero
              </h3>
              {meseros.length > 0 ? (
                <>
                  <TablaPropinasMesero filas={meseros} />
                  <p className="ayuda">
                    Si una cuenta se pagó con varias formas, la propina se reparte entre ellas en proporción.
                  </p>
                </>
              ) : (
                <p className="texto-2">Sin cuentas cobradas.</p>
              )}
            </section>
            <section className="tarjeta" aria-labelledby="titulo-por-mesa">
              <h3 id="titulo-por-mesa" className="tarjeta__titulo">
                Por mesa
              </h3>
              {mesas.length > 0 ? (
                <div className="tabla-envoltura">
                  <table className="tabla tabla--cebra">
                    <thead>
                      <tr>
                        <th scope="col">Mesa</th>
                        <th scope="col" className="num">
                          Cuentas con propina
                        </th>
                        <th scope="col" className="num">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {mesas.map((m) => (
                        <tr key={m.mesa_id}>
                          <td>{m.nombre}</td>
                          <td className="num">{m.cuentas}</td>
                          <td className="num fuerte">{dinero(m.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="tabla__total">
                        <th scope="row">Total</th>
                        <td className="num">{mesas.reduce((s, m) => s + m.cuentas, 0)}</td>
                        <td className="num">{dinero(mesas.reduce((s, m) => s + m.total, 0))}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <p className="texto-2">Sin cuentas cobradas.</p>
              )}
            </section>
          </div>
          <PieImpresion impresoEn={impresoEn} firmas={false} />
        </div>

        {/* Solo al imprimir en formato ticket (80 mm). */}
        <div className="imprimible__ticket">
          <div className="ticket-impreso">
            <p className="ticket-impreso__titulo">{tituloImpreso}</p>
            <p>{plural(diasConCorte, 'día con corte', 'días con corte')}</p>
            <p className="ticket-impreso__seccion">TOTALES</p>
            <Renglon nombre="Total propinas" valor={dinero(total)} fuerte />
            <Renglon nombre="Efectivo" valor={dinero(suma('efectivo'))} />
            <Renglon nombre="Tarjeta" valor={dinero(suma('tarjeta'))} />
            <Renglon nombre="Transferencia" valor={dinero(suma('transferencia'))} />
            <p className="ticket-impreso__seccion">POR MESERO</p>
            {meseros.map((m) => (
              <div key={m.mesero_id} className="ticket-impreso__mesero">
                <Renglon nombre={m.nombre} valor={dinero(m.total)} fuerte />
                <p>
                  Ef {dinero(m.efectivo)} · Tj {dinero(m.tarjeta)} · Tr {dinero(m.transferencia)}
                </p>
              </div>
            ))}
            <p className="ticket-impreso__seccion">POR MESA</p>
            {mesas.map((m) => (
              <Renglon key={m.mesa_id} nombre={m.nombre} valor={dinero(m.total)} />
            ))}
          </div>
          <PieImpresion impresoEn={impresoEn} firmas={false} />
        </div>
      </div>
    );
  }

  return (
    <>
      <Encabezado vista="Propinas" />
      <main className="contenido contenido--duenio">
        <PestanasDuenio actual="propinas" />
        <div className="reporte__filtros no-imprimir">
          <div className="chips chips--envolver" role="group" aria-label="Atajos de fechas">
            {ATAJOS.map((a) => (
              <button key={a.id} type="button" className="chip" aria-pressed={atajo === a.id} onClick={() => elegirAtajo(a.id)}>
                {a.texto}
              </button>
            ))}
          </div>
          <div className="reporte__fechas">
            <label className="campo campo--fecha">
              <span className="campo__etiqueta">Desde</span>
              <input
                type="date"
                className={errorRango ? 'campo__entrada campo__entrada--caja campo__entrada--invalida' : 'campo__entrada campo__entrada--caja'}
                value={campos.desde}
                aria-invalid={errorRango ? true : undefined}
                aria-describedby={errorRango ? 'error-rango' : undefined}
                onChange={(e) => cambiarCampo('desde', e.target.value)}
                onBlur={aplicarCampos}
                onKeyDown={alTeclear}
              />
            </label>
            <label className="campo campo--fecha">
              <span className="campo__etiqueta">Hasta</span>
              <input
                type="date"
                className={errorRango ? 'campo__entrada campo__entrada--caja campo__entrada--invalida' : 'campo__entrada campo__entrada--caja'}
                value={campos.hasta}
                aria-invalid={errorRango ? true : undefined}
                aria-describedby={errorRango ? 'error-rango' : undefined}
                onChange={(e) => cambiarCampo('hasta', e.target.value)}
                onBlur={aplicarCampos}
                onKeyDown={alTeclear}
              />
            </label>
          </div>
          {errorRango && (
            <p id="error-rango" className="error-campo" role="alert">
              {errorRango}
            </p>
          )}
        </div>
        {contenido}
      </main>
    </>
  );
}
