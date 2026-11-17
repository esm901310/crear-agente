import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../api';
import { ErrorApi, esSinConexion, type Grupo, type RespuestaBusqueda, type Tienda } from '../api/cliente';
import { AvisoPrueba } from '../componentes/AvisoPrueba';
import { BandaError } from '../componentes/BandaError';
import { Buscador } from '../componentes/Buscador';
import { Encabezado } from '../componentes/Encabezado';
import { Esqueleto } from '../componentes/Esqueleto';
import { TarjetaResultado } from '../componentes/TarjetaResultado';
import { useAvisos } from '../estado/avisos';
import { CLAVE_BUSQUEDAS } from '../estado/datosLocales';
import { useEnLinea } from '../ganchos/useEnLinea';
import { useListaCargada } from '../ganchos/useListaCargada';
import { grupoVisible, tituloGrupo } from '../logica/corte';
import { mensajeDeError } from '../logica/mensajes';
import { nombreCompleto } from '../logica/presentacion';
import { ordenarTiendas, unirNombres } from '../logica/tiendas';

const ESPERA_MS = 350;

type Estado =
  | { tipo: 'inicial' }
  | { tipo: 'buscando'; q: string }
  | { tipo: 'listo'; q: string; r: RespuestaBusqueda }
  | { tipo: 'error'; q: string; error: unknown };

function leerRecientes(): string[] {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_BUSQUEDAS) ?? '[]') as string[];
  } catch {
    return [];
  }
}

function guardarReciente(q: string) {
  const lista = [q, ...leerRecientes().filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 5);
  localStorage.setItem(CLAVE_BUSQUEDAS, JSON.stringify(lista));
}

/** P6 — Agregar producto */
export function AgregarProducto() {
  const lista = useListaCargada();
  const { mostrar } = useAvisos();
  const navegar = useNavigate();
  const enLinea = useEnLinea();
  const [texto, setTexto] = useState('');
  const [estado, setEstado] = useState<Estado>({ tipo: 'inicial' });
  const [agregando, setAgregando] = useState<string | null>(null);
  const [recientes] = useState(leerRecientes);
  const controlador = useRef<AbortController | null>(null);

  const buscar = useCallback(async (consulta: string) => {
    const q = consulta.trim();
    controlador.current?.abort();
    if (q.length < 2) {
      setEstado({ tipo: 'inicial' });
      return;
    }
    const c = new AbortController();
    controlador.current = c;
    setEstado({ tipo: 'buscando', q });
    try {
      const r = await api.buscar(q, c.signal);
      if (c.signal.aborted) return;
      setEstado({ tipo: 'listo', q, r });
      if (r.grupos.length > 0) guardarReciente(q);
    } catch (error) {
      if (c.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) return;
      setEstado({ tipo: 'error', q, error });
    }
  }, []);

  // Busca solo cuando la persona deja de escribir un momento.
  const espera = useRef<number | undefined>(undefined);
  useEffect(() => {
    const t = window.setTimeout(() => {
      espera.current = undefined;
      void buscar(texto);
    }, ESPERA_MS);
    espera.current = t;
    return () => window.clearTimeout(t);
  }, [texto, buscar]);

  /** Enter: busca ya y cancela la búsqueda en espera (si no, salían dos búsquedas). */
  function buscarAhora() {
    window.clearTimeout(espera.current);
    espera.current = undefined;
    const q = texto.trim();
    // Si ya se está buscando (o ya se mostró) exactamente eso, no se repite.
    if ((estado.tipo === 'buscando' || estado.tipo === 'listo') && estado.q === q) return;
    void buscar(texto);
  }

  useEffect(() => () => controlador.current?.abort(), []);

  const clavesEnLista = useMemo(() => new Set(lista.items.map((i) => i.grupo.clave)), [lista.items]);

  /** Tiendas a mostrar: las que vienen en la respuesta y las que el servidor usó al comparar. */
  const tiendas: Tienda[] = useMemo(() => {
    const t = new Set<Tienda>(lista.tiendas);
    if (estado.tipo === 'listo') {
      for (const g of estado.r.grupos) for (const k of Object.keys(g.precios)) t.add(k as Tienda);
      for (const k of Object.keys(estado.r.errores ?? {})) t.add(k as Tienda);
    }
    return ordenarTiendas(t);
  }, [lista.tiendas, estado]);

  async function agregar(grupo: Grupo, r: RespuestaBusqueda) {
    setAgregando(grupo.clave);
    try {
      await lista.agregar(grupo, { consultadoEn: r.consultadoEn, tiendas });
      const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
      if (idx > 0) navegar(-1);
      else navegar('/lista', { replace: true });
      const nombre = nombreCompleto(grupoVisible(grupo), ' ');
      mostrar(`Listo, agregamos ${nombre}.`);
    } catch (e) {
      setAgregando(null);
      mostrar(
        esSinConexion(e) || (e instanceof ErrorApi && (e.codigo === 'lista_llena' || e.estado === 429))
          ? mensajeDeError(e)
          : `No pudimos agregar ${tituloGrupo(grupo)}. Intenta de nuevo.`,
      );
    }
  }

  const reintentar = () => void buscar(texto);
  const n = tiendas.length;
  const enLosSuper = n > 1 ? `en los ${n} súper` : 'en los súper';

  let contenido: ReactNode;
  if (estado.tipo === 'inicial') {
    contenido = (
      <div className="estado-busqueda">
        <p className="texto-secundario texto-centro">Escribe qué quieres comprar.</p>
        {recientes.length > 0 && (
          <div className="recientes">
            <h2 className="titulo-pequeno">Buscaste antes:</h2>
            <ul className="recientes-lista">
              {recientes.map((r) => (
                <li key={r}>
                  <button type="button" className="ficha" onClick={() => setTexto(r)}>
                    {r}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  } else if (estado.tipo === 'buscando') {
    contenido = (
      <div aria-busy="true">
        <p className="texto-secundario" role="status">
          Buscando {enLosSuper}…
        </p>
        <div className="lista-tarjetas" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="tarjeta tarjeta-esqueleto">
              <Esqueleto ancho="55%" alto={20} />
              <Esqueleto ancho="30%" alto={16} />
              {(n > 0 ? tiendas : [0, 1]).map((t) => (
                <div key={String(t)} className="precio-tienda-fila">
                  <Esqueleto ancho={120} alto={28} />
                  <Esqueleto ancho={72} alto={18} />
                </div>
              ))}
              <Esqueleto ancho="100%" alto={48} />
            </div>
          ))}
        </div>
      </div>
    );
  } else if (estado.tipo === 'error') {
    contenido =
      esSinConexion(estado.error) || !enLinea ? (
        <BandaError alReintentar={reintentar}>No hay conexión. Revisa tu internet para buscar precios.</BandaError>
      ) : (
        <BandaError alReintentar={reintentar}>{mensajeDeError(estado.error)}</BandaError>
      );
  } else {
    const { r, q } = estado;
    const fallidas = ordenarTiendas(Object.keys(r.errores ?? {}) as Tienda[]);
    const conRespuesta = tiendas.filter((t) => !fallidas.includes(t));
    if (r.grupos.length === 0 && fallidas.length > 0 && conRespuesta.length === 0) {
      contenido = (
        <BandaError alReintentar={reintentar}>
          No pudimos consultar los precios en este momento. Intenta de nuevo en un momento.
        </BandaError>
      );
    } else {
      contenido = (
        <>
          <AvisoPrueba datos={r} />
          {fallidas.length > 0 && (
            <BandaError alReintentar={reintentar}>
              No pudimos consultar {unirNombres(fallidas, 'ni', true)} en este momento.
              {conRespuesta.length > 0 && ` Te mostramos ${unirNombres(conRespuesta, 'y', true)}.`}
            </BandaError>
          )}
          {r.grupos.length === 0 ? (
            <div className="estado-busqueda" role="status">
              <h2 className="titulo-estado">No encontramos “{q}”</h2>
              <p>Revisa cómo está escrito o prueba con algo más general, como “arroz”.</p>
            </div>
          ) : (
            <>
              <p className="texto-secundario" role="status">
                Escoge la marca y el tamaño exacto.
              </p>
              <div className="lista-tarjetas">
                {r.grupos.map((g) => (
                  <TarjetaResultado
                    key={g.clave}
                    grupo={g}
                    tiendas={tiendas}
                    errores={r.errores ?? {}}
                    enLista={clavesEnLista.has(g.clave)}
                    agregando={agregando === g.clave}
                    alAgregar={() => void agregar(g, r)}
                  />
                ))}
              </div>
            </>
          )}
        </>
      );
    }
  }

  return (
    <main className="pantalla">
      <Encabezado titulo="Agregar producto" volverA="/lista" />
      <Buscador
        etiqueta="Buscar producto"
        placeholder="Busca, por ejemplo: arroz, leche, café"
        valor={texto}
        alCambiar={setTexto}
        alEnviar={buscarAhora}
        autoFocus
      />
      {!enLinea && estado.tipo !== 'error' && (
        <BandaError alReintentar={reintentar}>No hay conexión. Revisa tu internet para buscar precios.</BandaError>
      )}
      <div className="resultados-busqueda">{contenido}</div>
    </main>
  );
}
