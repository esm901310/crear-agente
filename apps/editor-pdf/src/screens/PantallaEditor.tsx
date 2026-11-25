import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
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
import { analizar, componerPagina, resolverEstilo, unirCajas } from '../lib/edit';
import { esErrorDeMemoria } from '../lib/errores';
import { AJUSTES_INICIALES, type Ajustes, type Analisis, type Edicion, type Pagina, type Palabra } from '../lib/types';
import type { Historial } from '../hooks/useHistorial';

interface Props {
  nombre: string;
  bytes: ArrayBuffer | null;
  paginas: Pagina[];
  historial: Historial;
  alSalir: () => void;
}

interface Borrador {
  pagina: number;
  palabras: string[];
  texto: string;
  ajustes: Ajustes;
  analisis: Analisis;
  existente: Edicion | null;
}

const CLAVE_AVISO = 'retoca-aviso-visto';
let contadorId = 0;

export default function PantallaEditor({ nombre, bytes, paginas, historial, alSalir }: Props) {
  const { ediciones, registrar } = historial;
  const [actual, setActual] = useState(0);
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [panel, setPanel] = useState<'miniaturas' | 'descarga' | null>(null);
  const [descarga, setDescarga] = useState<EstadoDescarga | null>(null);
  const [ocultarMarcas, setOcultarMarcas] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; clave: number } | null>(null);
  const [confirmar, setConfirmar] = useState<'borrar' | 'salir' | null>(null);
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

  useLayoutEffect(() => {
    if (!pagina) return;
    componerPagina(pagina, visibles, lienzo);
    setVersionVista((v) => v + 1);
  }, [pagina, visibles, lienzo]);

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
  const abrirPanel = useCallback(
    (ids: string[]) => {
      if (!pagina) return;
      const sel = pagina.palabras.filter((p) => ids.includes(p.id)).sort((a, b) => a.posEnLinea - b.posEnLinea);
      if (sel.length === 0) return;
      const linea = pagina.lineas.find((l) => l.id === sel[0]?.lineaId);
      const ajustes = { ...AJUSTES_INICIALES };
      try {
        const analisis = analizar(pagina, sel, linea);
        setSeleccion(sel.map((p) => p.id));
        setBorrador({
          pagina: pagina.indice,
          palabras: sel.map((p) => p.id),
          texto: analisis.textoOriginal,
          ajustes,
          analisis,
          existente: null,
        });
      } catch (e) {
        console.error(e);
      }
    },
    [pagina],
  );

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
        });
        return;
      }
      abrirPanel([p.id]);
    },
    [abrirPanel, ediciones, pagina],
  );

  const alSeleccionar = useCallback(
    (ids: string[], terminada: boolean) => {
      setPanel(null);
      setBorrador(null);
      setSeleccion(ids);
      if (terminada) abrirPanel(ids);
    },
    [abrirPanel],
  );

  const cerrarEdicion = useCallback(() => {
    setBorrador(null);
    setSeleccion([]);
  }, []);

  const mostrarAviso = (texto: string) => setAviso({ texto, clave: Date.now() });
  const cerrarAviso = useCallback(() => setAviso(null), []);

  const guardar = (confirmado = false) => {
    if (!borrador || !edicionBorrador) return;
    const texto = borrador.texto.trim();
    if (!texto && !confirmado) {
      setConfirmar('borrar');
      return;
    }
    const sinCambio =
      !borrador.existente &&
      texto === borrador.analisis.textoOriginal &&
      JSON.stringify(borrador.ajustes) === JSON.stringify(AJUSTES_INICIALES);
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

  const estilo = borrador ? resolverEstilo(borrador.analisis, borrador.ajustes, borrador.texto.trim()) : null;
  const dudosa =
    !!borrador && !borrador.existente && pagina.palabras.some((p) => borrador.palabras.includes(p.id) && p.confianza < 60);
  const cajaEnfoque = edicionBorrador?.caja ?? null;

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
        pagina={pagina}
        lienzo={lienzo}
        ediciones={ediciones}
        seleccion={seleccion}
        ocultarMarcas={ocultarMarcas}
        alAlternarMarcas={() => setOcultarMarcas((v) => !v)}
        espacioInferior={altoPanel}
        enfocar={cajaEnfoque}
        alTocarPalabra={alTocarPalabra}
        alSeleccionar={alSeleccionar}
        alCambiarPagina={(d) => irA(actual + d)}
      >
        {pagina.estado !== 'lista' ? (
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
          alCambiarTexto={(t) => setBorrador({ ...borrador, texto: t })}
          ajustes={borrador.ajustes}
          alCambiarAjustes={(a) => setBorrador({ ...borrador, ajustes: a })}
          estilo={estilo}
          dudosa={dudosa}
          yaEditada={!!borrador.existente}
          lienzo={lienzo}
          caja={edicionBorrador.caja}
          limiteDerecho={borrador.analisis.limiteDerecho}
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
          accion={{ texto: 'Deshacer', alTocar: deshacer }}
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
            guardar(true);
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
