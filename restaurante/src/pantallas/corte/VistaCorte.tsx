// C3 / D2 — Corte del día (misma vista para la caja y el dueño). docs/diseno.md, sección 19.
import { useState } from 'react';
import { IndicadorPasos } from '../../componentes/IndicadorPasos';
import { Insignia } from '../../componentes/Insignia';
import { MenuImprimir } from '../../componentes/MenuImprimir';
import { diaSemanaYNumero, fechaLarga, hora, mismoDia } from '../../formato';
import type { Corte } from '../../tipos';
import { CuentasCorte } from './CuentasCorte';
import { PieImpresion } from './PieImpresion';
import { TablaPropinasMesero } from './TablaPropinasMesero';
import { TarjetaEfectivo } from './TarjetaEfectivo';
import { TarjetaOtrosPagos } from './TarjetaOtrosPagos';
import { TarjetaPropinasMesa } from './TarjetaPropinasMesa';
import { TarjetaSalidasCorte } from './TarjetaSalidasCorte';
import { TarjetaVentas } from './TarjetaVentas';
import { TicketCorte } from './TicketCorte';

interface Props {
  corte: Corte;
  /** Muestra el indicador de pasos (la caja recién cerró el día). */
  conPasos?: boolean;
  /** Botón "Listo" (solo la caja). */
  alListo?: () => void;
  /** Hora de la última actualización (corte parcial). */
  actualizadoEn?: number;
}

/** "Abierto 9:02 a.m. por Caja · Cerrado 11:48 p.m. por Caja" (o "· Sigue abierto"). */
function horario(j: Corte['jornada']): string {
  const abierto = `Abierto ${hora(j.abierta_en)} por ${j.abierta_por_nombre}`;
  if (!j.cerrada_en) return `${abierto} · Sigue abierto`;
  const quien = j.cerrada_por_nombre ? ` por ${j.cerrada_por_nombre}` : '';
  if (mismoDia(j.abierta_en, j.cerrada_en)) return `${abierto} · Cerrado ${hora(j.cerrada_en)}${quien}`;
  const dia = diaSemanaYNumero(j.cerrada_en);
  return `${abierto} · Cerrado el ${dia} a las ${hora(j.cerrada_en)}${quien}`;
}

export function VistaCorte({ corte, conPasos = false, alListo, actualizadoEn }: Props) {
  const [impresoEn, setImpresoEn] = useState(() => Date.now());
  const j = corte.jornada;
  const parcial = j.estado === 'abierta';
  const fecha = fechaLarga(j.abierta_en);
  const titulo = `${parcial ? 'Corte parcial' : 'Corte'} del ${fecha}`;
  const textoHorario = horario(j);
  const hayPropinas = corte.ventas.propinas > 0;

  return (
    <div className="corte imprimible">
      <div className="imprimible__pantalla">
        {conPasos && <IndicadorPasos actual={2} />}

        <div className="corte__cabeza">
          <div>
            <h2 className="corte__titulo">
              {titulo}
              {parcial && (
                <>
                  {' '}
                  <span className="no-imprimir">
                    <Insignia tipo="neutra">En curso</Insignia>
                  </span>
                  <span className="solo-impresion"> · PARCIAL</span>
                </>
              )}
            </h2>
            <p className="texto-2 texto-s">{textoHorario}</p>
          </div>
          <div className="corte__botones no-imprimir">
            <MenuImprimir antesDeImprimir={() => setImpresoEn(Date.now())} />
            {alListo && (
              <button type="button" className="boton boton--primario boton--chico" onClick={alListo}>
                Listo
              </button>
            )}
          </div>
        </div>

        {parcial && (
          <div className="aviso aviso--neutro no-imprimir">
            <p>
              El día sigue abierto: estas cifras pueden cambiar. El efectivo contado y la diferencia aparecerán cuando la
              caja cierre el día.
            </p>
            {actualizadoEn && <p className="texto-2 texto-s">Actualizado {hora(new Date(actualizadoEn).toISOString())}</p>}
          </div>
        )}

        <div className="corte__rejilla">
          <TarjetaEfectivo efectivo={corte.efectivo} />
          <TarjetaOtrosPagos porMetodo={corte.por_metodo} />
          <TarjetaVentas ventas={corte.ventas} />
          <section className="tarjeta corte__meseros" aria-labelledby="titulo-meseros">
            <h3 id="titulo-meseros" className="tarjeta__titulo">
              Propinas por mesero
            </h3>
            {hayPropinas ? (
              <>
                <TablaPropinasMesero filas={corte.propinas_por_mesero} />
                <p className="ayuda">Si una cuenta se pagó con varias formas, la propina se reparte entre ellas en proporción.</p>
              </>
            ) : (
              <p className="texto-2">No hubo propinas este día.</p>
            )}
          </section>
          <TarjetaPropinasMesa filas={corte.propinas_por_mesa} />
          <TarjetaSalidasCorte salidas={corte.salidas} total={corte.total_salidas} />
          <CuentasCorte cuentas={corte.cuentas} />
        </div>
        <PieImpresion impresoEn={impresoEn} />
      </div>

      {/* Solo al imprimir en formato ticket (80 mm). */}
      <div className="imprimible__ticket">
        <TicketCorte corte={corte} titulo={titulo.replace('Corte parcial', 'Corte PARCIAL')} horario={textoHorario} />
        <PieImpresion impresoEn={impresoEn} />
      </div>
    </div>
  );
}
