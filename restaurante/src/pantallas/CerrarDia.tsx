// C2 — Cerrar el día (/caja/cerrar): cuentas por cobrar → contar efectivo → confirmar.
// Ver docs/diseno.md, sección 18.
import { useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError, mensajeDeError } from '../api';
import { Cargando } from '../componentes/Cargando';
import { Dialogo } from '../componentes/Dialogo';
import { Encabezado } from '../componentes/Encabezado';
import { IndicadorPasos } from '../componentes/IndicadorPasos';
import { useToast } from '../componentes/Toast';
import { borrarConteos, conteoVacio, guardarConteo, LLAVES_CONTEO, leerConteo, recordarCorte, totalConteo } from '../dia';
import { usePolling } from '../hooks/usePolling';
import { navegar } from '../hooks/useRuta';
import { plural } from '../formato';
import type { Conteo, CuentaPendiente } from '../tipos';
import { ConteoEfectivo } from './ConteoEfectivo';
import { DialogoCerrarDia } from './DialogoCerrarDia';
import { PasoCuentas, type CuentaPorCobrar } from './PasoCuentas';

export function CerrarDia() {
  const toast = useToast();
  const dia = usePolling(api.jornadaActual);
  const ords = usePolling(api.cajaOrdenes);
  const [paso, setPaso] = useState<0 | 1 | null>(null);
  const [conteo, setConteo] = useState<Conteo>(conteoVacio);
  const [dialogo, setDialogo] = useState<'confirmar' | 'borrar' | null>(null);
  const [cerrando, setCerrando] = useState(false);
  const [cuentas409, setCuentas409] = useState<CuentaPendiente[] | null>(null);
  const jornadaId = useRef<number | null>(null);
  const terminado = useRef(false); // ya se cerró (aquí) o ya se avisó que no hay día

  const jornada = dia.datos?.jornada;

  // Al entrar (y si el día se cierra desde otro equipo mientras tanto).
  useEffect(() => {
    if (!dia.datos || !ords.datos || terminado.current) return;
    const j = dia.datos.jornada;
    if (jornadaId.current === null) {
      if (!j) {
        terminado.current = true;
        toast({ texto: 'El día no está abierto.' });
        navegar('/caja', true);
        return;
      }
      jornadaId.current = j.id;
      setConteo(leerConteo(j.id));
      setPaso(j.cuentas_abiertas > 0 || ords.datos.length > 0 ? 0 : 1);
    } else if (!j || j.id !== jornadaId.current) {
      terminado.current = true;
      toast({ texto: 'Este día ya se cerró.' });
      navegar('/caja', true);
    }
  }, [dia.datos, ords.datos, toast]);

  // Cuando llega una lista nueva de cuentas, deja de hacer falta la del 409.
  useEffect(() => setCuentas409(null), [ords.datos]);

  const cuentas = useMemo<CuentaPorCobrar[]>(() => {
    const lista: CuentaPorCobrar[] = (ords.datos ?? []).map((o) => ({
      orden_id: o.id,
      mesa_nombre: o.mesa_nombre,
      mesero_nombre: o.mesero_nombre,
      creada: o.creada,
      total: o.subtotal,
      sinPlatillos: o.comandas.length === 0,
    }));
    for (const c of cuentas409 ?? []) {
      if (!lista.some((l) => l.orden_id === c.orden_id)) {
        lista.push({ ...c, mesero_nombre: null, creada: null, sinPlatillos: c.total === 0 });
      }
    }
    return lista;
  }, [ords.datos, cuentas409]);
  // También cuenta lo que dice el servidor del día (por si la lista aún no se actualiza).
  const pendientes = Math.max(cuentas.length, jornada?.cuentas_abiertas ?? 0);

  const cambiarConteo = (c: Conteo) => {
    setConteo(c);
    if (jornadaId.current !== null) guardarConteo(jornadaId.current, c);
  };

  const cerrar = async () => {
    setCerrando(true);
    const cuerpo: Conteo = Object.fromEntries(LLAVES_CONTEO.map((k) => [k, conteo[k] ?? 0]));
    try {
      const corte = await api.cerrarJornada(cuerpo);
      terminado.current = true;
      borrarConteos();
      recordarCorte(corte);
      navegar('/caja/corte', true);
    } catch (e) {
      setCerrando(false);
      if (e instanceof ApiError && e.status === 409) {
        const lista = e.cuentasAbiertas;
        setDialogo(null);
        if (lista) {
          toast({ texto: e.message || 'Hay cuentas sin cobrar. Cóbralas antes de cerrar el día.', tipo: 'error' });
          setCuentas409(lista);
          setPaso(0);
          ords.recargar();
          dia.recargar();
        } else {
          terminado.current = true;
          toast({ texto: 'Este día ya se cerró.', tipo: 'error' });
          navegar('/caja', true);
        }
        return;
      }
      toast({ texto: mensajeDeError(e, 'No hay conexión. Tu conteo sigue guardado; intenta de nuevo.'), tipo: 'error' });
    }
  };

  let cuerpo;
  if (paso === null) {
    cuerpo =
      dia.error && !dia.datos ? (
        <div className="vacio">
          <p className="texto-grande">No pudimos revisar si el día está abierto.</p>
          <button type="button" className="boton boton--primario" onClick={dia.recargar}>
            Reintentar
          </button>
        </div>
      ) : (
        <Cargando />
      );
  } else if (paso === 0) {
    cuerpo = <PasoCuentas cuentas={cuentas} pendientes={pendientes} alSeguir={() => setPaso(1)} />;
  } else {
    cuerpo = (
      <>
        {pendientes > 0 && (
          <div className="aviso aviso--alerta aviso--accion" role="status">
            <span>
              Hay {plural(pendientes, 'cuenta abierta', 'cuentas abiertas')}. Cóbrala{pendientes === 1 ? '' : 's'} antes
              de cerrar el día.
            </span>
            <button type="button" className="boton boton--secundario boton--chico" onClick={() => setPaso(0)}>
              Ver cuentas
            </button>
          </div>
        )}
        <ConteoEfectivo
          conteo={conteo}
          alCambiar={cambiarConteo}
          alEmpezarDeNuevo={() => setDialogo('borrar')}
          alRevisar={() => setDialogo('confirmar')}
        />
      </>
    );
  }

  return (
    <>
      <Encabezado vista="Cerrar el día" regreso={{ texto: '← Caja', alTocar: () => navegar('/caja') }} />
      <main className="contenido cerrar">
        <IndicadorPasos actual={paso ?? 0} />
        {cuerpo}
      </main>

      {dialogo === 'confirmar' && (
        <DialogoCerrarDia
          billetes={totalConteo(conteo, 'billete')}
          monedas={totalConteo(conteo, 'moneda')}
          cerrando={cerrando}
          alCancelar={() => setDialogo(null)}
          alConfirmar={() => void cerrar()}
        />
      )}
      {dialogo === 'borrar' && (
        <Dialogo titulo="¿Borrar el conteo?" alCerrar={() => setDialogo(null)}>
          <h2 className="dialogo__titulo">¿Borrar el conteo?</h2>
          <p>Se pondrán todas las cantidades en 0.</p>
          <div className="dialogo__botones">
            <button type="button" className="boton boton--secundario dialogo__izquierda" autoFocus onClick={() => setDialogo(null)}>
              Cancelar
            </button>
            <button
              type="button"
              className="boton boton--primario"
              onClick={() => {
                cambiarConteo(conteoVacio());
                setDialogo(null);
              }}
            >
              Borrar conteo
            </button>
          </div>
        </Dialogo>
      )}
    </>
  );
}
