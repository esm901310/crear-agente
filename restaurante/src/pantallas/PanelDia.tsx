// Caja — panel "Día" al pie de la columna izquierda (docs/diseno.md, 17.3).
// Corte a ciegas: solo muestra el fondo y las salidas, nunca ventas ni efectivo esperado.
import { useAhora } from '../hooks/useAhora';
import { navegar } from '../hooks/useRuta';
import { dinero, fechaCorta, hora, mismoDia } from '../formato';
import { useSesion } from '../sesion';
import type { JornadaActual } from '../tipos';

interface Props {
  jornada: JornadaActual | null;
  alAbrirDia: () => void;
  alSalida: () => void;
  alVerSalidas: () => void;
}

/** "9:02 a.m.", "ayer 9:02 a.m." o "Lun 17 nov 9:02 a.m." */
function desdeCuando(iso: string, ahora: number): { texto: string; otroDia: boolean } {
  if (mismoDia(iso, ahora)) return { texto: hora(iso), otroDia: false };
  const ayer = ahora - 86400000;
  if (mismoDia(iso, ayer)) return { texto: `ayer ${hora(iso)}`, otroDia: true };
  return { texto: `el ${fechaCorta(iso, ahora)} ${hora(iso)}`, otroDia: true };
}

export function PanelDia({ jornada, alAbrirDia, alSalida, alVerSalidas }: Props) {
  const { usuario } = useSesion();
  const ahora = useAhora(60000);

  if (!jornada) {
    return (
      <section className="panel-dia" aria-label="Día">
        <p className="panel-dia__estado">
          <span className="punto punto--apagado" aria-hidden="true" /> El día no está abierto
        </p>
        <button type="button" className="boton boton--primario boton--chico boton--ancho" onClick={alAbrirDia}>
          Abrir el día
        </button>
      </section>
    );
  }

  const desde = desdeCuando(jornada.abierta_en, ahora);
  const otraPersona = jornada.abierta_por_nombre !== usuario.nombre;
  const vigentes = jornada.salidas.filter((s) => !s.anulada).length;

  return (
    <section className="panel-dia" aria-label="Día">
      <div className="panel-dia__estado-bloque">
        <p className={desde.otroDia ? 'panel-dia__estado panel-dia__estado--alerta' : 'panel-dia__estado'}>
          <span className="punto punto--ok" aria-hidden="true" /> Día abierto desde{' '}
          <span className="sin-partir">{desde.texto}</span>
          {otraPersona && ` por ${jornada.abierta_por_nombre}`}
        </p>
        <p className="panel-dia__fondo texto-2">Fondo {dinero(jornada.fondo)}</p>
      </div>
      <button type="button" className="boton boton--secundario boton--chico boton--ancho" onClick={alSalida}>
        − Salida de efectivo
      </button>
      {jornada.salidas.length > 0 ? (
        <button type="button" className="boton boton--texto panel-dia__enlace" onClick={alVerSalidas}>
          Salidas de hoy ({vigentes}) ›
        </button>
      ) : (
        <p className="panel-dia__sin-salidas texto-2">Sin salidas hoy</p>
      )}
      <button type="button" className="boton boton--secundario boton--chico boton--ancho" onClick={() => navegar('/caja/cerrar')}>
        Cerrar el día
      </button>
      {usuario.rol === 'dueno' && (
        <button type="button" className="boton boton--texto panel-dia__enlace" onClick={() => navegar(`/cortes/${jornada.id}`)}>
          Ver corte parcial ›
        </button>
      )}
    </section>
  );
}
