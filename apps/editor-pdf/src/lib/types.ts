/** Rectángulo en píxeles de la imagen de la página. */
export interface Caja {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export type RGB = [number, number, number];

export interface Palabra {
  id: string;
  texto: string;
  caja: Caja;
  /** 0 a 100 */
  confianza: number;
  lineaId: string;
  posEnLinea: number;
}

export interface Linea {
  id: string;
  palabras: string[];
  caja: Caja;
  /** Línea base que entrega la lectura (si existe). */
  base: { x0: number; y0: number; x1: number; y1: number } | null;
}

export type EstadoLectura = 'pendiente' | 'leyendo' | 'lista' | 'error';

export interface Pagina {
  indice: number;
  /** Tamaño de la imagen en píxeles. */
  ancho: number;
  alto: number;
  /** Tamaño original de la página en puntos PDF. */
  anchoPt: number;
  altoPt: number;
  original: HTMLCanvasElement;
  miniatura: string;
  estado: EstadoLectura;
  palabras: Palabra[];
  lineas: Linea[];
}

/** Id de una letra del catálogo (ver catalogo.ts). */
export type Fuente = string;

/** Lo que medimos del texto original (siempre sobre la imagen original). */
export interface Analisis {
  fondo: RGB;
  fondoIzq: RGB;
  fondoDer: RGB;
  fondoArr: RGB;
  fondoAbj: RGB;
  /** Variación del fondo (textura del papel), 0-12. */
  ruido: number;
  tinta: RGB;
  /** Borde izquierdo de la tinta original. */
  xTinta: number;
  /** Línea base (donde se apoyan las letras). */
  base: number;
  /** Altura de la tinta sobre la línea base, en píxeles. */
  alturaTinta: number;
  /** Ancho real de la tinta original. */
  anchoTinta: number;
  /** Grosor medio del trazo original en píxeles. */
  trazo: number;
  /** σ del desenfoque que hay que agregar para igualar la nitidez de los bordes (px). */
  desenfoque: number;
  /** Caja que se borra. */
  cajaBorrado: Caja;
  textoOriginal: string;
}

export interface Ajustes {
  /** Multiplicador del tamaño elegido por la persona (1 = automático). */
  escala: number;
  /** null = automático */
  negrita: boolean | null;
  /** null = color detectado */
  color: string | null;
  /** Letra del catálogo (al abrir el panel: la más parecida detectada). */
  fuente: Fuente;
  /** Cursiva / inclinada. */
  cursiva: boolean;
  /** Ajuste fino del ancho de las letras (1 = el medido). */
  ancho: number;
  /** Ajuste fino del grosor del trazo (1 = igual al original). */
  grosor: number;
}

export interface Edicion {
  id: string;
  pagina: number;
  palabras: string[];
  caja: Caja;
  textoOriginal: string;
  textoNuevo: string;
  analisis: Analisis;
  ajustes: Ajustes;
}

export const AJUSTES_INICIALES: Ajustes = { escala: 1, negrita: null, color: null, fuente: 'arimo', cursiva: false, ancho: 1, grosor: 1 };
