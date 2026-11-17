// MODO SIMULADO (VITE_API_SIMULADA=1): implementa el contrato de la API en el
// navegador, con los DATOS DE EJEMPLO de datos-ejemplo.ts. No usa el servidor.
//
// Para probar estados de error, en la consola del navegador:
//   localStorage.setItem('comparasuper-simulada-falla', 'colonial')  // falla una tienda
//   localStorage.setItem('comparasuper-simulada-falla', 'todas')     // fallan todas
//   localStorage.setItem('comparasuper-simulada-falla', 'red')       // sin conexión
//   localStorage.setItem('comparasuper-simulada-falla', 'limite')    // comparar responde 429 (Retry-After: 30 s)
//   localStorage.setItem('comparasuper-simulada-falla', 'entrar-limite') // entrar responde 429 (Retry-After: 25 min)
//   localStorage.setItem('comparasuper-simulada-falla', 'servidor')  // comparar responde 500
//   localStorage.removeItem('comparasuper-simulada-falla')           // todo normal
// Además, buscar "café" simula que Colonial no respondió.
import {
  ErrorApi,
  notificarSesionPerdida,
  type ApiComparaSuper,
  type Grupo,
  type ItemLista,
  type RespuestaBusqueda,
  type Tienda,
  type Usuario,
} from './cliente';
import { CATALOGO_EJEMPLO } from './datos-ejemplo';
import { calcularComparacion, normalizar } from '../logica/comparar';

const TIENDAS_ACTIVAS: Tienda[] = ['lacolonia', 'colonial'];
const CLAVE = 'comparasuper-simulada';

interface Estado {
  usuarios: Record<string, { id: string; correo: string; contrasena: string }>;
  sesion: string | null; // id de usuario
  listas: Record<string, ListaSimulada>;
}

/** Como RespuestaLista. actualizadoEn = último cambio; preciosConsultadosEn = cuándo se consultaron los precios. */
interface ListaSimulada {
  items: ItemLista[];
  actualizadoEn: string | null;
  preciosConsultadosEn: string | null;
}

function leer(): Estado {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (crudo) return JSON.parse(crudo) as Estado;
  } catch {
    /* estado vacío */
  }
  return { usuarios: {}, sesion: null, listas: {} };
}
function guardar(e: Estado) {
  localStorage.setItem(CLAVE, JSON.stringify(e));
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
const id = () => Math.random().toString(36).slice(2, 10);
const copia = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

function falla(): string | null {
  return localStorage.getItem('comparasuper-simulada-falla');
}

async function red(ms = 350) {
  await esperar(ms);
  if (falla() === 'red') throw new ErrorApi(0, 'sin_conexion', 'No hay conexión.');
}

function usuarioActual(e: Estado): Usuario {
  const u = Object.values(e.usuarios).find((x) => x.id === e.sesion);
  if (!u) {
    notificarSesionPerdida();
    throw new ErrorApi(401, 'sin_sesion', 'Inicia sesión para continuar.');
  }
  return { id: u.id, correo: u.correo };
}

function lista(e: Estado, usuarioId: string) {
  e.listas[usuarioId] ??= { items: [], actualizadoEn: null, preciosConsultadosEn: null };
  // Listas guardadas antes de existir preciosConsultadosEn: sin fecha conocida.
  e.listas[usuarioId].preciosConsultadosEn ??= null;
  return e.listas[usuarioId];
}

function erroresSimulados(q = ''): Partial<Record<Tienda, string>> {
  const f = falla();
  if (f === 'todas') return { lacolonia: 'No respondió a tiempo', colonial: 'No respondió a tiempo' };
  if (f === 'colonial' || normalizar(q).includes('cafe')) return { colonial: 'No respondió a tiempo' };
  return {};
}

function sinTiendasConError(g: Grupo, errores: Partial<Record<Tienda, string>>): Grupo {
  const precios = { ...g.precios };
  for (const t of Object.keys(errores) as Tienda[]) delete precios[t];
  return { ...g, precios };
}

export const apiSimulada: ApiComparaSuper = {
  async registro(correo, contrasena) {
    await red();
    const e = leer();
    const c = correo.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) throw new ErrorApi(400, 'correo_invalido', 'Correo inválido.');
    if (contrasena.length < 8) throw new ErrorApi(400, 'contrasena_corta', 'Contraseña muy corta.');
    if (e.usuarios[c]) throw new ErrorApi(409, 'correo_registrado', 'Ese correo ya tiene cuenta.');
    const u = { id: id(), correo: c, contrasena };
    e.usuarios[c] = u;
    e.sesion = u.id;
    guardar(e);
    return { id: u.id, correo: u.correo };
  },
  async entrar(correo, contrasena) {
    await red();
    if (falla() === 'entrar-limite') {
      throw new ErrorApi(429, 'demasiados_intentos', 'Demasiados intentos.', Date.now() + 25 * 60_000);
    }
    const e = leer();
    const u = e.usuarios[correo.trim().toLowerCase()];
    if (!u || u.contrasena !== contrasena) {
      throw new ErrorApi(401, 'credenciales', 'El correo o la contraseña no coinciden.');
    }
    e.sesion = u.id;
    guardar(e);
    return { id: u.id, correo: u.correo };
  },
  async salir() {
    await red(150);
    const e = leer();
    e.sesion = null;
    guardar(e);
  },
  async yo() {
    await esperar(150);
    const e = leer();
    const u = Object.values(e.usuarios).find((x) => x.id === e.sesion);
    return u ? { id: u.id, correo: u.correo } : null;
  },
  async borrarCuenta() {
    await red();
    const e = leer();
    const u = usuarioActual(e);
    delete e.listas[u.id];
    delete e.usuarios[u.correo];
    e.sesion = null;
    guardar(e);
  },
  async buscar(q, senal) {
    await red(600);
    if (senal?.aborted) throw new DOMException('Cancelado', 'AbortError');
    usuarioActual(leer());
    const texto = q.trim();
    if (texto.length < 2 || texto.length > 60) {
      throw new ErrorApi(400, 'q_invalida', 'Escribe entre 2 y 60 letras.');
    }
    const palabras = normalizar(texto).split(' ').filter(Boolean);
    const errores = erroresSimulados(texto);
    const grupos = CATALOGO_EJEMPLO.filter((g) => {
      const heno = normalizar(`${g.nombre} ${g.marca ?? ''} ${g.presentacion ?? ''}`);
      return palabras.every((w) => heno.includes(w));
    })
      .map((g) => sinTiendasConError(g, errores))
      .filter((g) => Object.keys(g.precios).length > 0)
      .sort((a, b) => Object.keys(b.precios).length - Object.keys(a.precios).length)
      .slice(0, 20);
    const r: RespuestaBusqueda = { consultadoEn: new Date().toISOString(), grupos: copia(grupos), errores };
    return r;
  },
  async obtenerLista() {
    await red(250);
    const e = leer();
    const u = usuarioActual(e);
    return copia(lista(e, u.id));
  },
  async agregarItem(grupo, cantidad = 1, consultadoEn) {
    await red(300);
    const e = leer();
    const l = lista(e, usuarioActual(e).id);
    const existente = l.items.find((i) => i.grupo.clave === grupo.clave);
    let item: ItemLista;
    if (existente) {
      existente.cantidad = Math.min(99, existente.cantidad + cantidad);
      item = existente;
    } else {
      item = { id: id(), cantidad: Math.max(1, Math.min(99, cantidad)), grupo: copia(grupo), sustitutos: {} };
      l.items.push(item);
    }
    // Como el servidor: con la fecha de la búsqueda, preciosConsultadosEn pasa a ser la más antigua;
    // un producto sin fecha deja la lista "vieja".
    const eraVacia = l.items.length === 1 && !existente;
    l.actualizadoEn = new Date().toISOString();
    if (!consultadoEn || Number.isNaN(Date.parse(consultadoEn))) l.preciosConsultadosEn = null;
    else if (eraVacia) l.preciosConsultadosEn = consultadoEn;
    else if (l.preciosConsultadosEn && Date.parse(consultadoEn) < Date.parse(l.preciosConsultadosEn)) {
      l.preciosConsultadosEn = consultadoEn;
    }
    guardar(e);
    return copia(item);
  },
  async actualizarItem(itemId, cambios) {
    await red(200);
    const e = leer();
    const l = lista(e, usuarioActual(e).id);
    const item = l.items.find((i) => i.id === itemId);
    if (!item) throw new ErrorApi(404, 'no_existe', 'Ese producto ya no está en tu lista.');
    if (cambios.cantidad !== undefined) {
      if (!Number.isInteger(cambios.cantidad) || cambios.cantidad < 1 || cambios.cantidad > 99) {
        throw new ErrorApi(400, 'cantidad_invalida', 'La cantidad va de 1 a 99.');
      }
      item.cantidad = cambios.cantidad;
    }
    if (cambios.sustitutos) {
      for (const [t, v] of Object.entries(cambios.sustitutos) as [Tienda, ItemLista['sustitutos'][Tienda] | null][]) {
        if (v === null) delete item.sustitutos[t];
        else if (v) item.sustitutos[t] = v;
      }
    }
    // Editar cantidad o sustitutos no cambia la fecha de los precios.
    l.actualizadoEn = new Date().toISOString();
    guardar(e);
    return copia(item);
  },
  async quitarItem(itemId) {
    await red(200);
    const e = leer();
    const l = lista(e, usuarioActual(e).id);
    l.items = l.items.filter((i) => i.id !== itemId);
    l.actualizadoEn = l.items.length > 0 ? new Date().toISOString() : null;
    if (l.items.length === 0) l.preciosConsultadosEn = null;
    guardar(e);
  },
  async comparar() {
    await red(1200);
    if (falla() === 'limite') {
      throw new ErrorApi(429, 'demasiadas_consultas', 'Demasiadas consultas.', Date.now() + 30_000);
    }
    if (falla() === 'servidor') throw new ErrorApi(500, 'error_interno', 'Error interno.');
    const e = leer();
    const l = lista(e, usuarioActual(e).id);
    const errores = erroresSimulados();
    // "Vuelve a consultar" los precios con el catálogo de ejemplo.
    for (const item of l.items) {
      const actual = CATALOGO_EJEMPLO.find((g) => g.clave === item.grupo.clave);
      if (actual) item.grupo = sinTiendasConError(copia(actual), errores);
    }
    // preciosConsultadosEn = cuándo se consultaron (bien) los precios de toda la lista.
    const consultadoEn = new Date().toISOString();
    l.actualizadoEn = l.items.length > 0 ? consultadoEn : null;
    l.preciosConsultadosEn = l.items.length > 0 && Object.keys(errores).length === 0 ? consultadoEn : null;
    guardar(e);
    return {
      ...calcularComparacion(copia(l.items), TIENDAS_ACTIVAS, errores, consultadoEn),
      preciosConsultadosEn: l.preciosConsultadosEn,
    };
  },
};
