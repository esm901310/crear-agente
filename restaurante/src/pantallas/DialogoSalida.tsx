// Diálogo "Salida de efectivo": monto + motivo (docs/diseno.md, 17.4).
import { useState } from 'react';
import { api, ApiError, mensajeDeError } from '../api';
import { BotonAccion } from '../componentes/BotonAccion';
import { CampoDinero } from '../componentes/CampoDinero';
import { Dialogo } from '../componentes/Dialogo';
import { useToast } from '../componentes/Toast';
import { MOTIVO_MAX, MOTIVOS_SALIDA } from '../config';
import { dinero, textoACentavos } from '../formato';
import type { JornadaActual } from '../tipos';

interface Props {
  /** `jornada`: respuesta del servidor; null si el día ya no estaba abierto (hay que recargar). */
  alTerminar: (jornada: JornadaActual | null) => void;
  alCerrar: () => void;
}

export function DialogoSalida({ alTerminar, alCerrar }: Props) {
  const toast = useToast();
  const [montoTexto, setMontoTexto] = useState('');
  const [motivo, setMotivo] = useState('');
  const [registrando, setRegistrando] = useState(false);

  const monto = montoTexto.trim() === '' ? null : textoACentavos(montoTexto);
  const motivoLimpio = motivo.trim();
  const listo = monto !== null && monto > 0 && motivoLimpio.length > 0;

  const registrar = async () => {
    if (!listo || registrando) return;
    setRegistrando(true);
    try {
      const j = await api.registrarSalida(monto, motivoLimpio);
      toast({ texto: 'Salida registrada ✓', tipo: 'ok' });
      alTerminar(j);
    } catch (e) {
      setRegistrando(false);
      if (e instanceof ApiError && e.status === 409) {
        toast({ texto: e.message || 'El día ya se cerró. No se pueden registrar salidas.', tipo: 'error' });
        alTerminar(null);
        return;
      }
      toast({ texto: mensajeDeError(e), tipo: 'error' }); // el diálogo se queda con lo capturado
    }
  };

  return (
    <Dialogo titulo="Salida de efectivo" alCerrar={() => !registrando && alCerrar()}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void registrar();
        }}
      >
        <div>
          <h2 className="dialogo__titulo">Salida de efectivo</h2>
          <p className="texto-2 texto-s">Dinero que sale de la caja durante el día.</p>
        </div>
        <CampoDinero id="salida-monto" etiqueta="Monto" valor={montoTexto} alCambiar={setMontoTexto} vacioPermitido autoFocus />
        <fieldset className="grupo-sin-borde">
          <legend className="campo__etiqueta">Motivo</legend>
          <div className="chips chips--envolver" role="group" aria-label="Motivos frecuentes">
            {MOTIVOS_SALIDA.map((m) => (
              <button key={m} type="button" className="chip" aria-pressed={motivo === m} onClick={() => setMotivo(m)}>
                {m}
              </button>
            ))}
          </div>
          <label htmlFor="salida-motivo" className="solo-lectores">
            Motivo de la salida
          </label>
          <input
            id="salida-motivo"
            className="campo__entrada campo__entrada--caja"
            type="text"
            autoComplete="off"
            placeholder="ej. Refrescos para la tienda"
            maxLength={MOTIVO_MAX}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value.slice(0, MOTIVO_MAX))}
            onBlur={() => setMotivo((m) => m.trim())}
          />
          <p className={motivo.length >= MOTIVO_MAX ? 'contador contador--lleno' : 'contador'} aria-live="polite">
            {motivo.length}/{MOTIVO_MAX}
          </p>
        </fieldset>
        <div className="dialogo__botones">
          <button type="button" className="boton boton--secundario dialogo__izquierda" disabled={registrando} onClick={alCerrar}>
            Cancelar
          </button>
          <BotonAccion
            type="submit"
            className="boton boton--primario"
            ocupado={registrando}
            textoOcupado="Registrando…"
            disabled={!listo}
            aria-describedby={listo ? undefined : 'razon-salida'}
          >
            {monto !== null && monto > 0 ? `Registrar salida ${dinero(monto)}` : 'Registrar salida'}
          </BotonAccion>
        </div>
        {!listo && (
          <p id="razon-salida" className="ayuda ayuda--derecha">
            Escribe el monto y el motivo.
          </p>
        )}
      </form>
    </Dialogo>
  );
}
