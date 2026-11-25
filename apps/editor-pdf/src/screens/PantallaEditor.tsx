import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import BarraSuperior from '../components/BarraSuperior';
import BarraPaginas from '../components/BarraPaginas';
import BotonIcono from '../components/BotonIcono';
import BotonPrincipal from '../components/BotonPrincipal';
import BotonSecundario from '../components/BotonSecundario';
import VisorPagina from '../components/VisorPagina';
import PanelInferior from '../components/PanelInferior';
import TiraMiniaturas from '../components/TiraMiniaturas';
import AvisoBreve from '../components/AvisoBreve';
import DialogoConfirmar from '../components/DialogoConfirmar';
import PanelEdicion from './PanelEdicion';
import PanelDescarga, { type EstadoDescarga } from './PanelDescarga';
import { analizar, calcularDisposicion, componerPagina, olvidarMedidas, palabrasVisibles, resolverEstilo, unirCajas } from '../lib/edit';
import { esErrorDeMemoria } from '../lib/errores';
import { detectarLetra, estadisticasBloques, precalentar, type Deteccion } from '../lib/fuentes';
import { cargarCatalogo, cargarLetra } from '../lib/catalogo';
import { AJUSTES_INICIALES, type Ajustes, type Analisis, type Caja, type Edicion, type Pagina, type Palabra } from '../lib/types';
import type { Historial } from '../hooks/useHistorial';

interface Props {
  nombre: string;
  bytes: ArrayBuffer | null;
  paginas: Pagina[];
  historial: Historial;
  alSalir: () => void;
  /** Aviso que llega de la lectura en segundo plano (p. ej. una página que no se pudo leer). */
  avisoLectura: { texto: string; clave: number } | null;
}

interface Borrador {
  pagina: number;
  palabras: string[];
  texto: string;
  ajustes: Ajustes;
  analisis: Analisis;
  existente: Edicion | null;
  /** Letras más parecidas a la original (para el selector). */
  deteccion: Deteccion | null;
  /** Estilo con el que se abrió (para saber si la persona cambió algo). */
  ajustesIniciales: Ajustes;
}

const CLAVE_AVISO = 'retoca-aviso-visto';
const MODO_PRUEBA =
  import.meta.env.DEV || (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('prueba'));
let contadorId = 0;

export default function PantallaEditor({ nombre, bytes, paginas, historial, alSalir, avisoLectura }: Props) {
  const { ediciones, registrar } = historial;
  const [actual, setActual] = useState(0);
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [panel, setPanel] = useState<'miniaturas' | 'descarga' | null>(null);
  const [descarga, setDescarga] = useState<EstadoDescarga | null>(null);
  const [ocultarMarcas, setOcultarMarcas] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; clave: number; deshacer: boolean } | null>(null);
  const [confirmar, setConfirmar] = useState<'borrar' | 'salir' | 'largo' | null>(null);
  const [verAyuda, setVerAyuda] = useState(() => {
    try {
      return localStorage.getItem(CLAVE_AVISO) !== '1';
    } catch {
      return true;
    }
  });
  const [altoPanel, setAltoPanel] = useState(0);
  const [descargadas, setDescargadas] = useState<Edicion[] | null>(null);
  const [versionVista, setVersionVista] = useState(0);
  const [versionLetras, setVersionLetras] = useState(0);
  const lienzo = useMemo(() => document.createElement('canvas'), []);

  const pagina = paginas[actual] ?? paginas[0];
  const total = paginas.length;
  const sinDescargar = ediciones.length > 0 && ediciones !== descargadas;
  const conCambios = useMemo(() => new Set(ediciones.map((e) => e.pagina)), [ediciones]);

  // Ediciones a mostrar: las guardadas + la vista previa del borrador.
  const edicionBorrador: Edicion | null = useMemo(() => {
    if (!borrador || !pagina || borrador.pagina !== pagina.indice) return null;
    const sel = pagina.palabras.filter((p) => borrador.palabras.includes(p.id));
    if (sel.length === 0) return null;
    return {
      id: 'borrador',
      pagina: pagina.indice,
      palabras: borrador.palabras,
      caja: unirCajas(sel.map((p) => p.caja)),
      textoOriginal: borrador.analisis.textoOriginal,
      textoNuevo: borrador.texto,
      analisis: borrador.analisis,
      ajustes: borrador.ajustes,
    };
  }, [borrador, pagina]);

  const visibles = useMemo(() => {
    if (!edicionBorrador) return ediciones;
    const ids = new Set(edicionBorrador.palabras);
    return [...ediciones.filter((e) => e.pagina !== edicionBorrador.pagina || !e.palabras.some((id) => ids.has(id))), edicionBorrador];
  }, [ediciones, edicionBorrador]);

  // Dónde queda cada palabra tras los cambios (las siguientes se corren).
  const disposicion = useMemo(() => {
    if (!pagina) return null;
    try {
      void versionLetras; // los anchos cambian cuando termina de cargar una letra
      return calcularDisposicion(pagina, visibles);
    } catch (e) {
      console.error(e);
      return null;
    }
  }, [pagina, visibles, versionLetras]);

  // Página y ediciones con las cajas donde se ven ahora (para marcas y toques).
  const paginaVista = useMemo(
    () => (pagina && disposicion ? { ...pagina, palabras: palabrasVisibles(pagina, disposicion) } : pagina),
    [pagina, disposicion],
  );
  const edicionesVista = useMemo(
    () => ediciones.map((e) => ({ ...e, caja: disposicion?.ediciones.get(e.id)?.caja ?? e.caja })),
    [ediciones, disposicion],
  );
  const posBorrador = edicionBorrador ? disposicion?.ediciones.get(edicionBorrador.id) : undefined;

  useLayoutEffect(() => {
    if (!pagina) return;
    try {
      componerPagina(pagina, visibles, lienzo, disposicion ?? undefined);
    } catch (e) {
      console.error(e);
      componerPagina(pagina, [], lienzo);
      setAviso({ texto: 'No pudimos aplicar el cambio en esta página. Inténtalo otra vez.', clave: Date.now(), deshacer: false });
    }
    setVersionVista((v) => v + 1);
  }, [pagina, visibles, lienzo, disposicion, versionLetras]);

  // Cuando termina de cargar una letra, se redibujan las ediciones que la usan.
  useEffect(() => {
    if (typeof document === 'undefined' || !('fonts' in document)) return;
    // Se agrupan: muchas letras pueden terminar de cargar casi juntas.
    let pendiente = 0;
    const alCargar = () => {
      if (pendiente) return;
      pendiente = window.requestAnimationFrame(() => {
        pendiente = 0;
        olvidarMedidas();
        setVersionLetras((v) => v + 1);
      });
    };
    document.fonts.addEventListener('loadingdone', alCargar);
    return () => {
      document.fonts.removeEventListener('loadingdone', alCargar);
      if (pendiente) window.cancelAnimationFrame(pendiente);
    };
  }, []);

  useEffect(() => {
    if (avisoLectura) setAviso({ ...avisoLectura, deshacer: false });
  }, [avisoLectura]);

  // Aviso del navegador al cerrar con cambios sin descargar.
  useEffect(() => {
    if (!sinDescargar) return;
    const avisar = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [sinDescargar]);

  // ----- Selección y panel de edición -----
  const solicitud = useRef(0);
  const abrirPanel = useCallback(
    async (ids: string[]) => {
      if (!pagina) return;
      const sel = pagina.palabras.filter((p) => ids.includes(p.id)).sort((a, b) => a.posEnLinea - b.posEnLinea);
      const primera = sel[0];
      if (!primera) return;
      const n = ++solicitud.current;
      const linea = pagina.lineas.find((l) => l.id === primera.lineaId);
      setSeleccion(sel.map((p) => p.id));
      try {
        // Letra más parecida a la original (en caché si ya se calculó en segundo plano).
        let deteccion: Deteccion | null = null;
        try {
          deteccion = await detectarLetra(pagina, primera);
        } catch (e) {
          console.error(e);
        }
        if (n !== solicitud.current) return;
        const ajustes: Ajustes = {
          ...AJUSTES_INICIALES,
          fuente: deteccion?.mejor.letra ?? AJUSTES_INICIALES.fuente,
          cursiva: deteccion?.mejor.cursiva ?? false,
        };
        const analisis = analizar(pagina, sel, linea, { alinearMargen: true });
        await cargarLetra(ajustes.fuente, true, ajustes.cursiva, analisis.textoOriginal);
        await cargarLetra(ajustes.fuente, false, ajustes.cursiva, analisis.textoOriginal);
        if (n !== solicitud.current) return;
        // Solo para pruebas: en desarrollo o con ?prueba=1 en la dirección.
        if (MODO_PRUEBA) {
          const w = window as unknown as { __retocaDeteccion?: Deteccion | null; __retocaAnalisis?: Analisis };
          w.__retocaDeteccion = deteccion;
          w.__retocaAnalisis = analisis;
          (window as unknown as { __retocaBloques?: typeof estadisticasBloques }).__retocaBloques = estadisticasBloques;
        }
        setBorrador({
          pagina: pagina.indice,
          palabras: sel.map((p) => p.id),
          texto: analisis.textoOriginal,
          ajustes,
          analisis,
          existente: null,
          deteccion,
          ajustesIniciales: ajustes,
        });
      } catch (e) {
        console.error(e);
        setSeleccion([]);
        setAviso({ texto: 'No pudimos preparar esta palabra. Prueba con otra.', clave: Date.now(), deshacer: false });
      }
    },
    [pagina],
  );

  // Letras: se cargan en segundo plano y se detecta la de cada línea ya leída.
  useEffect(() => {
    void cargarCatalogo();
  }, []);
  useEffect(() => {
    if (!pagina || pagina.estado !== 'lista') return;
    let cancelado = false;
    precalentar(pagina, () => cancelado);
    return () => {
      cancelado = true;
    };
  }, [pagina]);

  const alTocarPalabra = useCallback(
    (p: Palabra) => {
      if (!pagina) return;
      setPanel(null);
      const existente = ediciones.find((e) => e.pagina === pagina.indice && e.palabras.includes(p.id));
      if (existente) {
        setSeleccion(existente.palabras);
        setBorrador({
          pagina: pagina.indice,
          palabras: existente.palabras,
          texto: existente.textoNuevo,
          ajustes: existente.ajustes,
          analisis: existente.analisis,
          existente,
          deteccion: null,
          ajustesIniciales: existente.ajustes,
        });
        void detectarLetra(pagina, p).then((d) => setBorrador((b) => (b && b.existente === existente ? { ...b, deteccion: d } : b)));
        return;
      }
      void abrirPanel([p.id]);
    },
    [abrirPanel, ediciones, pagina],
  );

  const alSeleccionar = useCallback(
    (ids: string[], terminada: boolean) => {
      setPanel(null);
      setBorrador(null);
      setSeleccion(ids);
      if (terminada) void abrirPanel(ids);
    },
    [abrirPanel],
  );

  const cerrarEdicion = useCallback(() => {
    solicitud.current++;
    setBorrador(null);
    setSeleccion([]);
  }, []);

  const mostrarAviso = (texto: string) => setAviso({ texto, clave: Date.now(), deshacer: true });
  const cerrarAviso = useCallback(() => setAviso(null), []);

  const guardar = (confirmado: { borrar?: boolean; largo?: boolean } = {}) => {
    if (!borrador || !edicionBorrador) return;
    const texto = borrador.texto.trim();
    if (!texto && !confirmado.borrar) {
      setConfirmar('borrar');
      return;
    }
    if (texto && posBorrador?.imposible) return; // no cabe ni achicando: no se puede guardar
    if (texto && posBorrador?.noCabe && !confirmado.largo) {
      setConfirmar('largo');
      return;
    }
    const sinCambio =
      !borrador.existente &&
      texto === borrador.analisis.textoOriginal &&
      JSON.stringify(borrador.ajustes) === JSON.stringify(borrador.ajustesIniciales);
    if (!sinCambio) {
      const ids = new Set(borrador.palabras);
      const nueva: Edicion = { ...edicionBorrador, id: `e${++contadorId}`, textoNuevo: texto };
      registrar([...ediciones.filter((e) => e.pagina !== nueva.pagina || !e.palabras.some((id) => ids.has(id))), nueva]);
      mostrarAviso(texto ? 'Listo, palabra cambiada' : 'Listo, texto borrado');
    }
    cerrarEdicion();
  };

  const volverOriginal = () => {
    if (!borrador?.existente) return;
    const quitar = borrador.existente;
    registrar(ediciones.filter((e) => e !== quitar));
    cerrarEdicion();
    mostrarAviso('Listo, volvió al original');
  };

  // ----- Páginas -----
  const irA = useCallback(
    (i: number) => {
      if (i < 0 || i >= total) return;
      cerrarEdicion();
      setActual(i);
    },
    [cerrarEdicion, total],
  );

  // ----- Deshacer / rehacer -----
  const deshacer = () => {
    cerrarEdicion();
    historial.deshacer();
    setAviso(null);
  };
  const rehacer = () => {
    cerrarEdicion();
    historial.rehacer();
  };

  // ----- Descarga -----
  const [archivoListo, setArchivoListo] = useState<File | null>(null);
  const bajar = (archivo: File) => {
    const url = URL.createObjectURL(archivo);
    const a = document.createElement('a');
    a.href = url;
    a.download = archivo.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const descargar = async () => {
    if (!bytes) return;
    cerrarEdicion();
    setPanel('descarga');
    setDescarga({ etapa: 'preparando', pagina: 0, total });
    const instantanea = ediciones;
    try {
      // pdf-lib se carga solo cuando hace falta (la app abre más rápido).
      const { exportarPdf, nombreDeSalida } = await import('../lib/exportPdf');
      const datos = await exportarPdf(bytes, paginas, instantanea, (pag, tot) =>
        setDescarga({ etapa: 'preparando', pagina: pag, total: tot }),
      );
      const archivo = new File([datos as BlobPart], nombreDeSalida(nombre), { type: 'application/pdf' });
      setArchivoListo(archivo);
      setDescargadas(instantanea);
      setDescarga({ etapa: 'lista', archivo });
      bajar(archivo);
    } catch (e) {
      console.error(e);
      setDescarga({ etapa: 'error', tipo: esErrorDeMemoria(e) ? 'memoria' : 'falloDescarga' });
    }
  };

  const puedeCompartir = useMemo(() => {
    if (!archivoListo || typeof navigator.share !== 'function') return false;
    try {
      return navigator.canShare?.({ files: [archivoListo] }) ?? false;
    } catch {
      return false;
    }
  }, [archivoListo]);

  const compartir = async () => {
    if (!archivoListo) return;
    try {
      await navigator.share({ files: [archivoListo], title: archivoListo.name });
    } catch {
      // La persona canceló o el celular no lo permite: no hacemos nada.
    }
  };

  const salir = () => {
    if (sinDescargar) setConfirmar('salir');
    else alSalir();
  };

  if (!pagina) return null;

  const estilo = borrador ? resolverEstilo(borrador.analisis, borrador.ajustes, posBorrador?.escala ?? 1) : null;
  const achicado = (posBorrador?.escala ?? 1) < 0.999;
  const dudosa =
    !!borrador && !borrador.existente && pagina.palabras.some((p) => borrador.palabras.includes(p.id) && p.confianza < 60);
  const cajaEnfoque = posBorrador?.caja ?? edicionBorrador?.caja ?? null;

  // Vista previa: la línea completa, tal como queda (con las palabras corridas).
  let cajaLinea: Caja | null = null;
  if (edicionBorrador && paginaVista) {
    const primera = pagina.palabras.find((p) => p.id === edicionBorrador.palabras[0]);
    const linea = pagina.lineas.find((l) => l.id === primera?.lineaId);
    if (linea) {
      const enLinea = paginaVista.palabras.filter((p) => p.lineaId === linea.id).map((p) => p.caja);
      const u = unirCajas([linea.caja, ...enLinea, ...(posBorrador ? [posBorrador.caja] : [])]);
      cajaLinea = u;
    }
  }

  return (
    <div className="pantalla editor">
      <BarraSuperior
        titulo={nombre}
        alVolver={salir}
        acciones={
          <>
            <BotonIcono icono="deshacer" etiqueta="Deshacer" onClick={deshacer} disabled={!historial.puedeDeshacer} />
            <BotonIcono icono="rehacer" etiqueta="Rehacer" onClick={rehacer} disabled={!historial.puedeRehacer} />
          </>
        }
      />

      {verAyuda && pagina.palabras.length > 0 ? (
        <div className="ayuda-inicial" role="note">
          <p>Toca una palabra para cambiarla. Para elegir varias de la misma línea, mantén presionado y desliza.</p>
          <button
            type="button"
            className="boton-texto"
            onClick={() => {
              setVerAyuda(false);
              try {
                localStorage.setItem(CLAVE_AVISO, '1');
              } catch {
                /* sin almacenamiento: no pasa nada */
              }
            }}
          >
            Entendido
          </button>
        </div>
      ) : null}

      <VisorPagina
        pagina={paginaVista ?? pagina}
        lienzo={lienzo}
        ediciones={edicionesVista}
        cajaSeleccion={posBorrador?.caja ?? null}
        seleccion={seleccion}
        ocultarMarcas={ocultarMarcas}
        alAlternarMarcas={() => setOcultarMarcas((v) => !v)}
        espacioInferior={altoPanel}
        enfocar={cajaEnfoque}
        alTocarPalabra={alTocarPalabra}
        alSeleccionar={alSeleccionar}
        alCambiarPagina={(d) => irA(actual + d)}
      >
        {pagina.estado === 'error' ? (
          <div className="visor-mensaje" role="status">
            No pudimos leer el texto de esta página.
          </div>
        ) : pagina.estado !== 'lista' ? (
          <div className="visor-mensaje" role="status">
            Leyendo el texto de esta página…
          </div>
        ) : pagina.palabras.length === 0 ? (
          <div className="visor-mensaje" role="status">
            No encontramos texto en esta página.
          </div>
        ) : null}
      </VisorPagina>

      <footer className="barra-inferior">
        {ediciones.length > 0 ? (
          <BotonPrincipal onClick={() => void descargar()}>Descargar PDF</BotonPrincipal>
        ) : (
          <BotonSecundario onClick={() => void descargar()}>Descargar PDF</BotonSecundario>
        )}
        <BarraPaginas
          actual={actual + 1}
          total={total}
          alAnterior={() => irA(actual - 1)}
          alSiguiente={() => irA(actual + 1)}
          alAbrirMiniaturas={() => {
            cerrarEdicion();
            setPanel(panel === 'miniaturas' ? null : 'miniaturas');
          }}
        />
      </footer>

      {borrador && estilo && edicionBorrador ? (
        <PanelEdicion
          key={borrador.palabras.join()}
          textoOriginal={borrador.analisis.textoOriginal}
          texto={borrador.texto}
          alCambiarTexto={(t) => {
            setBorrador({ ...borrador, texto: t });
            if (/[\u0100-\u02ff\u1e00-\u1eff]/.test(t)) {
              const a = borrador.ajustes;
              void cargarLetra(a.fuente, false, a.cursiva, t).then(() => setBorrador((b) => (b ? { ...b } : b)));
            }
          }}
          ajustes={borrador.ajustes}
          alCambiarAjustes={(a) => {
            setBorrador({ ...borrador, ajustes: a });
            // Si la letra elegida aún no estaba lista, se redibuja cuando termine de cargar.
            void Promise.all([
              cargarLetra(a.fuente, false, a.cursiva, borrador.texto),
              cargarLetra(a.fuente, true, a.cursiva, borrador.texto),
            ]).then(() => setBorrador((b) => (b && b.ajustes === a ? { ...b } : b)));
          }}
          estilo={estilo}
          achicado={achicado}
          noCabe={!!posBorrador?.noCabe}
          imposible={!!posBorrador?.imposible && !!borrador.texto.trim()}
          sugeridas={borrador.deteccion?.porLetra.map((p) => p.letra) ?? []}
          letraDudosa={!borrador.existente && borrador.deteccion?.confianza === 'baja'}
          dudosa={dudosa}
          yaEditada={!!borrador.existente}
          lienzo={lienzo}
          caja={cajaLinea ?? edicionBorrador.caja}
          versionVista={versionVista}
          alGuardar={() => guardar()}
          alCancelar={cerrarEdicion}
          alVolverOriginal={volverOriginal}
          alElegirOtras={() => setBorrador(null)}
          alCambiarAltura={setAltoPanel}
        />
      ) : null}

      {panel === 'miniaturas' ? (
        <PanelInferior etiqueta="Páginas" alCerrar={() => setPanel(null)}>
          <div className="panel-encabezado">
            <h2 className="subtitulo">Páginas</h2>
            <BotonIcono icono="cerrar" etiqueta="Cerrar" onClick={() => setPanel(null)} />
          </div>
          <TiraMiniaturas
            paginas={paginas}
            actual={actual}
            conCambios={conCambios}
            alElegir={(i) => {
              irA(i);
              setPanel(null);
            }}
          />
        </PanelInferior>
      ) : null}

      {panel === 'descarga' && descarga ? (
        <PanelDescarga
          estado={descarga}
          puedeCompartir={puedeCompartir}
          alDescargar={() => archivoListo && bajar(archivoListo)}
          alCompartir={() => void compartir()}
          alReintentar={() => void descargar()}
          alCerrar={() => setPanel(null)}
        />
      ) : null}

      {aviso && !borrador ? (
        <AvisoBreve
          texto={aviso.texto}
          clave={aviso.clave}
          alCerrar={cerrarAviso}
          accion={aviso.deshacer ? { texto: 'Deshacer', alTocar: deshacer } : undefined}
        />
      ) : null}

      {confirmar === 'borrar' ? (
        <DialogoConfirmar
          pregunta="¿Borrar este texto de la página?"
          textoSi="Sí, borrar"
          textoNo="No"
          peligro
          alSi={() => {
            setConfirmar(null);
            guardar({ borrar: true });
          }}
          alNo={() => setConfirmar(null)}
        />
      ) : null}
      {confirmar === 'largo' ? (
        <DialogoConfirmar
          pregunta={`El texto es muy largo para esta línea; se verá un ${Math.round((1 - (posBorrador?.escala ?? 1)) * 100)} % más pequeño. ¿Guardar igual?`}
          textoSi="Guardar igual"
          textoNo="No"
          alSi={() => {
            setConfirmar(null);
            guardar({ largo: true });
          }}
          alNo={() => setConfirmar(null)}
        />
      ) : null}
      {confirmar === 'salir' ? (
        <DialogoConfirmar
          pregunta="Tienes cambios sin descargar. Si sales, se perderán."
          textoSi="Salir igual"
          textoNo="Quedarme"
          peligro
          alSi={() => {
            setConfirmar(null);
            alSalir();
          }}
          alNo={() => setConfirmar(null)}
        />
      ) : null}
    </div>
  );
}
