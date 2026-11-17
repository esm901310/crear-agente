import { useCallback, useEffect, useId, useState } from 'react';
import { api } from '../api';
import { esDemasiadasConsultas, esSinConexion, type Grupo, type ItemLista, type PrecioTienda, type Tienda } from '../api/cliente';
import { estaDisponible, normalizar, parecido, precioEfectivo } from '../logica/comparar';
import { detalleGrupo } from '../logica/formato';
import { mensajeDeError, MUCHAS_CONSULTAS } from '../logica/mensajes';
import { nombreCompleto, tamanoDistinto } from '../logica/presentacion';
import { infoTienda } from '../logica/tiendas';
import { BandaError } from './BandaError';
import { Esqueleto } from './Esqueleto';
import { HojaInferior } from './HojaInferior';
import { Precio } from './Precio';

interface Opcion {
  clave: string;
  nombre: string;
  presentacion?: string;
  precio: PrecioTienda;
}

interface Props {
  item: ItemLista | null;
  tienda: Tienda;
  alCerrar: () => void;
  /** Guarda la elección (null = sin sustituto). Debe lanzar error si falla. */
  alElegir: (item: ItemLista, precio: PrecioTienda | null) => Promise<void>;
}

const MAXIMO = 5;
const NINGUNO = '__ninguno__';

/** Búsqueda más general: sin marca ni tamaños ("Frijoles rojos Kern's" -> "frijoles rojos"). */
function consultaGeneral(g: Grupo): string {
  const marca = new Set(normalizar(g.marca ?? '').split(' ').filter(Boolean));
  const palabras = normalizar(g.nombre)
    .split(' ')
    .filter((w) => w.length > 1 && !marca.has(w) && !/\d/.test(w));
  return palabras.slice(0, 2).join(' ');
}

function textoOriginal(g: Grupo): string {
  return nombreCompleto(g);
}

/** P9 — Elegir sustituto (hoja inferior). Solo muestra opciones del súper donde falta. */
export function HojaSustituto({ item, tienda, alCerrar, alElegir }: Props) {
  const nombreTienda = infoTienda(tienda).completo;
  const [estado, setEstado] = useState<'buscando' | 'listo' | 'error'>('buscando');
  const [error, setError] = useState<unknown>(null);
  const [opciones, setOpciones] = useState<Opcion[]>([]);
  const [eleccion, setEleccion] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);
  const nombreGrupo = useId();

  const buscar = useCallback(async () => {
    if (!item) return;
    setEstado('buscando');
    setError(null);
    const actual = item.sustitutos?.[tienda];
    try {
      const encontradas = new Map<string, Opcion>();
      const consultas = [item.grupo.nombre.slice(0, 60), consultaGeneral(item.grupo)].filter(
        (q, i, todas) => q.trim().length >= 2 && todas.indexOf(q) === i,
      );
      let tiendaFallo: string | undefined;
      for (const q of consultas) {
        const r = await api.buscar(q);
        tiendaFallo = r.errores?.[tienda];
        for (const g of r.grupos) {
          const p = g.precios[tienda];
          if (g.clave === item.grupo.clave || !estaDisponible(p)) continue;
          const clave = `${tienda}:${p.productoId}`;
          if (!encontradas.has(clave)) {
            encontradas.set(clave, { clave, nombre: g.nombre, presentacion: g.presentacion, precio: p });
          }
        }
        if (encontradas.size >= 3 || tiendaFallo) break;
      }
      if (tiendaFallo && encontradas.size === 0) {
        setEstado('error');
        setError(new Error(tiendaFallo));
        return;
      }
      const referencia = textoOriginal(item.grupo);
      let lista = [...encontradas.values()]
        .map((o) => ({ o, s: parecido(`${o.nombre} ${o.presentacion ?? ''}`, referencia) }))
        .sort((a, b) => b.s - a.s || precioEfectivo(a.o.precio) - precioEfectivo(b.o.precio))
        .map((x) => x.o)
        .slice(0, MAXIMO);
      // Si ya había un sustituto elegido, aparece primero y marcado.
      let marcada: string | null = null;
      if (actual) {
        const igual = lista.find((o) => o.precio.productoId === actual.productoId);
        if (igual) marcada = igual.clave;
        else {
          const propia: Opcion = { clave: `${tienda}:${actual.productoId}`, nombre: actual.nombre, precio: actual };
          lista = [propia, ...lista].slice(0, MAXIMO);
          marcada = propia.clave;
        }
      }
      setOpciones(lista);
      setEleccion(marcada);
      setEstado('listo');
    } catch (e) {
      setError(e);
      setEstado('error');
    }
  }, [item, tienda]);

  useEffect(() => {
    if (item) {
      setErrorGuardar(null);
      void buscar();
    }
  }, [item, buscar]);

  async function usar() {
    if (!item || !eleccion) return;
    const opcion = opciones.find((o) => o.clave === eleccion);
    setGuardando(true);
    setErrorGuardar(null);
    try {
      await alElegir(item, eleccion === NINGUNO ? null : opcion?.precio ?? null);
    } catch (e) {
      setErrorGuardar(esSinConexion(e) ? mensajeDeError(e) : 'No pudimos guardar el sustituto. Intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  const sinOpciones = estado === 'listo' && opciones.length === 0;

  return (
    <HojaInferior
      abierta={!!item}
      alCerrar={() => !guardando && alCerrar()}
      titulo={`Sustituto en ${nombreTienda}`}
      pie={
        sinOpciones || estado === 'error' ? (
          <button type="button" className="boton boton-secundario" onClick={alCerrar}>
            Cerrar
          </button>
        ) : (
          <button
            type="button"
            className="boton boton-principal"
            disabled={!eleccion || guardando || estado !== 'listo'}
            aria-busy={guardando}
            onClick={() => void usar()}
          >
            {guardando ? 'Guardando…' : 'Usar este'}
          </button>
        )
      }
    >
      {item && (
        <>
          {estado === 'buscando' && (
            <div aria-busy="true">
              <p role="status">Buscando productos parecidos en {nombreTienda}…</p>
              <div className="opciones" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="opcion opcion-esqueleto">
                    <Esqueleto ancho={24} alto={24} className="esqueleto-redondo" />
                    <Esqueleto ancho="55%" alto={18} />
                    <Esqueleto ancho={64} alto={18} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {estado === 'error' && (
            <BandaError alReintentar={() => void buscar()}>
              {esSinConexion(error)
                ? 'No hay conexión. Revisa tu internet para buscar precios.'
                : esDemasiadasConsultas(error)
                  ? MUCHAS_CONSULTAS
                  : `No pudimos consultar ${nombreTienda} en este momento.`}
            </BandaError>
          )}

          {sinOpciones && <p>No encontramos productos parecidos en {nombreTienda}.</p>}

          {estado === 'listo' && opciones.length > 0 && (
            <>
              <p>
                No encontramos <strong>{textoOriginal(item.grupo)}</strong>. Estos se parecen:
              </p>
              <fieldset className="opciones">
                <legend className="solo-lector">Elige un sustituto</legend>
                {[...opciones, null].map((o) => {
                  const clave = o ? o.clave : NINGUNO;
                  // Presentación (si el nombre no la dice ya) y aviso de tamaño, en una sola línea.
                  const detalle = o ? detalleGrupo({ nombre: o.nombre, presentacion: o.presentacion }) : '';
                  const distinto = !!o && tamanoDistinto(o, item.grupo);
                  const lineaDetalle = distinto ? (detalle ? `Tamaño distinto: ${detalle}` : 'Tamaño distinto') : detalle;
                  return (
                    <label key={clave} className={eleccion === clave ? 'opcion opcion-elegida' : 'opcion'}>
                      <input
                        type="radio"
                        name={nombreGrupo}
                        value={clave}
                        checked={eleccion === clave}
                        onChange={() => setEleccion(clave)}
                      />
                      <span className="opcion-textos">
                        <span className="opcion-nombre">{o ? o.nombre : 'No quiero sustituto'}</span>
                        {o ? (
                          <>
                            {lineaDetalle && <span className="texto-secundario">{lineaDetalle}</span>}
                          </>
                        ) : (
                          <span className="texto-secundario">Este súper seguirá con un producto faltante.</span>
                        )}
                      </span>
                      {o && <Precio valor={precioEfectivo(o.precio)} className="precio-fuerte opcion-precio" />}
                    </label>
                  );
                })}
              </fieldset>
            </>
          )}
          {errorGuardar && <BandaError>{errorGuardar}</BandaError>}
        </>
      )}
    </HojaInferior>
  );
}
