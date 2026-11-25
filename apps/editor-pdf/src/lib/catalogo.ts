/**
 * Catálogo de letras libres empaquetadas con la app (woff2, solo latin y
 * latin-ext). Los archivos se copian de @fontsource/* a public/fuentes en
 * `npm install` y se cargan con FontFace solo cuando hacen falta.
 */

export type Categoria = 'sans' | 'serif' | 'mono';

export interface LetraCatalogo {
  id: string;
  /** Nombre que ve la persona. */
  nombre: string;
  /** Ayuda corta: a qué letra conocida se parece. */
  parecida?: string;
  /** Prefijo de los archivos (paquete de @fontsource). */
  archivo: string;
  categoria: Categoria;
  tieneNegrita: boolean;
  tieneCursiva: boolean;
  tieneLatinExt: boolean;
}

export const CATALOGO: LetraCatalogo[] = [
  { id: 'arimo', nombre: 'Arimo', parecida: 'Arial', archivo: 'arimo', categoria: 'sans', tieneNegrita: true, tieneCursiva: true, tieneLatinExt: true },
  { id: 'tinos', nombre: 'Tinos', parecida: 'Times New Roman', archivo: 'tinos', categoria: 'serif', tieneNegrita: true, tieneCursiva: true, tieneLatinExt: true },
  { id: 'cousine', nombre: 'Cousine', parecida: 'Courier', archivo: 'cousine', categoria: 'mono', tieneNegrita: true, tieneCursiva: true, tieneLatinExt: true },
  { id: 'carlito', nombre: 'Carlito', parecida: 'Calibri', archivo: 'carlito', categoria: 'sans', tieneNegrita: true, tieneCursiva: true, tieneLatinExt: true },
  { id: 'caladea', nombre: 'Caladea', parecida: 'Cambria', archivo: 'caladea', categoria: 'serif', tieneNegrita: true, tieneCursiva: true, tieneLatinExt: true },
  { id: 'dejavu', nombre: 'DejaVu Sans', parecida: 'Verdana', archivo: 'dejavu-sans', categoria: 'sans', tieneNegrita: true, tieneCursiva: true, tieneLatinExt: false },
  { id: 'roboto', nombre: 'Roboto', archivo: 'roboto', categoria: 'sans', tieneNegrita: true, tieneCursiva: true, tieneLatinExt: true },
  { id: 'opensans', nombre: 'Open Sans', archivo: 'open-sans', categoria: 'sans', tieneNegrita: true, tieneCursiva: true, tieneLatinExt: true },
  { id: 'merriweather', nombre: 'Merriweather', parecida: 'Georgia', archivo: 'merriweather', categoria: 'serif', tieneNegrita: true, tieneCursiva: true, tieneLatinExt: true },
  { id: 'notoserif', nombre: 'Noto Serif', archivo: 'noto-serif', categoria: 'serif', tieneNegrita: true, tieneCursiva: true, tieneLatinExt: true },
  { id: 'charis', nombre: 'Charis SIL', parecida: 'Charter', archivo: 'charis-sil', categoria: 'serif', tieneNegrita: true, tieneCursiva: true, tieneLatinExt: true },
  { id: 'garamond', nombre: 'EB Garamond', parecida: 'Garamond', archivo: 'eb-garamond', categoria: 'serif', tieneNegrita: true, tieneCursiva: true, tieneLatinExt: true },
  { id: 'condensed', nombre: 'Roboto Condensed', parecida: 'Arial Narrow', archivo: 'roboto-condensed', categoria: 'sans', tieneNegrita: true, tieneCursiva: true, tieneLatinExt: true },
  { id: 'questrial', nombre: 'Questrial', parecida: 'Century Gothic', archivo: 'questrial', categoria: 'sans', tieneNegrita: false, tieneCursiva: false, tieneLatinExt: true },
];

export const LETRA_POR_DEFECTO = 'arimo';

const RESPALDO: Record<Categoria, string> = {
  sans: 'Arial, Helvetica, sans-serif',
  serif: '"Times New Roman", Times, serif',
  mono: '"Courier New", Courier, monospace',
};

const RANGO_LATIN =
  'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const RANGO_LATIN_EXT =
  'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';

export function letraPorId(id: string): LetraCatalogo {
  return CATALOGO.find((l) => l.id === id) ?? CATALOGO[0]!;
}

/** Nombre de familia CSS con el que registramos cada letra. */
export function familiaCss(id: string): string {
  const l = letraPorId(id);
  return `"Retoca ${l.nombre}", ${RESPALDO[l.categoria]}`;
}

/** Cadena `font` para canvas. Si la letra no tiene cursiva, se inclina al dibujar. */
export function fuenteCss(id: string, tamano: number, negrita: boolean, cursiva: boolean): string {
  const l = letraPorId(id);
  const it = cursiva && l.tieneCursiva ? 'italic ' : '';
  const b = negrita && l.tieneNegrita ? 'bold ' : '';
  return `${it}${b}${tamano.toFixed(2)}px ${familiaCss(id)}`;
}

/** true si la cursiva hay que simularla inclinando (la letra no la trae). */
export function cursivaSimulada(id: string, cursiva: boolean): boolean {
  return cursiva && !letraPorId(id).tieneCursiva;
}

let registradas = false;

/** Registra todas las caras (sin descargarlas todavía). */
function registrar(): void {
  if (registradas || typeof document === 'undefined' || !('fonts' in document)) return;
  registradas = true;
  const base = new URL(`${import.meta.env.BASE_URL}fuentes/`, window.location.href).href;
  for (const l of CATALOGO) {
    const pesos = l.tieneNegrita ? [400, 700] : [400];
    const estilos = l.tieneCursiva ? ['normal', 'italic'] : ['normal'];
    for (const peso of pesos) {
      for (const estilo of estilos) {
        const subconjuntos: [string, string][] = [['latin', RANGO_LATIN]];
        if (l.tieneLatinExt) subconjuntos.push(['latin-ext', RANGO_LATIN_EXT]);
        for (const [sub, rango] of subconjuntos) {
          const cara = new FontFace(`Retoca ${l.nombre}`, `url(${base}${l.archivo}-${sub}-${peso}-${estilo}.woff2) format("woff2")`, {
            weight: String(peso),
            style: estilo,
            unicodeRange: rango,
            display: 'block',
          });
          document.fonts.add(cara);
        }
      }
    }
  }
}

const cargas = new Map<string, Promise<boolean>>();
/** Letras que no se pudieron cargar: se sacan de las candidatas. */
const fallidas = new Set<string>();

/** Caras que ya terminaron de cargar bien (letra|negrita|cursiva). */
const listas = new Set<string>();

export function letraDisponible(id: string): boolean {
  return !fallidas.has(id);
}

export function caraLista(id: string, negrita: boolean, cursiva: boolean): boolean {
  return listas.has(`${id}|${negrita}|${cursiva}`);
}

/**
 * Asegura que la letra esté descargada y lista para dibujar `texto` en canvas
 * (solo baja los subconjuntos que ese texto necesita).
 */
export function cargarLetra(id: string, negrita: boolean, cursiva: boolean, texto = 'Aa'): Promise<boolean> {
  registrar();
  if (typeof document === 'undefined' || !('fonts' in document)) return Promise.resolve(false);
  const necesitaExt = /[Ā-˿Ḁ-ỿ]/.test(texto);
  const clave = `${id}|${negrita}|${cursiva}|${necesitaExt}`;
  let p = cargas.get(clave);
  if (!p) {
    const css = fuenteCss(id, 16, negrita, cursiva);
    p = document.fonts
      .load(css, necesitaExt ? `Aa${texto}` : 'Aaáñ')
      .then((caras) => caras.length > 0)
      .catch(() => false)
      .then((ok) => {
        if (!ok) {
          // Una carga fallida no se guarda en caché (se puede reintentar) y la letra sale de las candidatas.
          cargas.delete(clave);
          fallidas.add(id);
        } else {
          fallidas.delete(id);
          listas.add(`${id}|${negrita}|${cursiva}`);
        }
        return ok;
      });
    cargas.set(clave, p);
  }
  return p;
}

/** Carga todas las caras normales, negritas y cursivas (para comparar letras). */
export function cargarCatalogo(texto = 'Aa'): Promise<unknown> {
  const tareas: Promise<boolean>[] = [];
  for (const l of CATALOGO) {
    for (const negrita of l.tieneNegrita ? [false, true] : [false]) {
      for (const cursiva of l.tieneCursiva ? [false, true] : [false]) tareas.push(cargarLetra(l.id, negrita, cursiva, texto));
    }
  }
  return Promise.all(tareas);
}
