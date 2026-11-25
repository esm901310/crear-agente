/**
 * Utilidades de imagen compartidas entre la edición y la detección de letra:
 * desenfoque gaussiano, nitidez de bordes y grosor de trazo.
 */

/** Desenfoque gaussiano separable (radio ≈ 2.5σ) sobre un mapa de valores. */
export function desenfocar(v: Float32Array, ancho: number, alto: number, sigma: number): Float32Array {
  if (sigma < 0.15) return v;
  const r = Math.max(1, Math.ceil(sigma * 2.5));
  const k = new Float32Array(2 * r + 1);
  let suma = 0;
  for (let i = -r; i <= r; i++) {
    const w = Math.exp(-(i * i) / (2 * sigma * sigma));
    k[i + r] = w;
    suma += w;
  }
  for (let i = 0; i < k.length; i++) k[i] = (k[i] ?? 0) / suma;
  const tmp = new Float32Array(v.length);
  const out = new Float32Array(v.length);
  for (let y = 0; y < alto; y++) {
    const fila = y * ancho;
    for (let x = 0; x < ancho; x++) {
      let s = 0;
      for (let i = -r; i <= r; i++) {
        const xx = x + i;
        if (xx >= 0 && xx < ancho) s += (v[fila + xx] ?? 0) * (k[i + r] ?? 0);
      }
      tmp[fila + x] = s;
    }
  }
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      let s = 0;
      for (let i = -r; i <= r; i++) {
        const yy = y + i;
        if (yy >= 0 && yy < alto) s += (tmp[yy * ancho + x] ?? 0) * (k[i + r] ?? 0);
      }
      out[y * ancho + x] = s;
    }
  }
  return out;
}

function mediana(v: number[]): number {
  if (v.length === 0) return 0;
  const o = Float64Array.from(v).sort();
  return o[o.length >> 1] ?? 0;
}

/**
 * Ancho de la transición de los bordes (de 20 % a 80 % de tinta), en píxeles.
 * `v` va de 0 (fondo) a 1 (centro del trazo). Se mide en filas y columnas,
 * solo en bordes "limpios" que llegan de fondo a tinta plena.
 */
export function anchoBorde(v: Float32Array, ancho: number, alto: number): number {
  const anchos: number[] = [];
  const LIM = 8;
  const medir = (get: (i: number) => number, n: number) => {
    for (let i = 0; i + 1 < n; i++) {
      const a = get(i);
      const b = get(i + 1);
      const sube = a < 0.5 && b >= 0.5;
      const baja = a >= 0.5 && b < 0.5;
      if (!sube && !baja) continue;
      // Hacia atrás: el nivel "de afuera" (20 % si sube, 80 % si baja).
      const atras = sube ? 0.2 : 0.8;
      const adelante = sube ? 0.8 : 0.2;
      const pasa = (v: number, u: number, menor: boolean) => (menor ? v <= u : v >= u);
      let p = i;
      while (p >= 0 && i - p < LIM && !pasa(get(p), atras, sube)) p--;
      let q = i + 1;
      while (q < n && q - i < LIM && !pasa(get(q), adelante, !sube)) q++;
      if (p < 0 || q >= n || !pasa(get(p), atras, sube) || !pasa(get(q), adelante, !sube)) continue;
      const interp = (x0: number, umbral: number) => {
        const v0 = get(x0);
        const v1 = get(x0 + 1);
        return v1 === v0 ? x0 : x0 + (umbral - v0) / (v1 - v0);
      };
      const w = interp(q - 1, adelante) - interp(p, atras);
      if (Number.isFinite(w) && w > 0 && w < LIM) anchos.push(w);
    }
  };
  for (let y = 0; y < alto; y++) medir((i) => v[y * ancho + i] ?? 0, ancho);
  for (let x = 0; x < ancho; x++) medir((i) => v[i * ancho + x] ?? 0, alto);
  return anchos.length >= 6 ? mediana(anchos) : 0;
}

/** Mediana del largo de los trazos horizontales (píxeles con v ≥ 0.5). */
export function trazoMediano(v: ArrayLike<number>, ancho: number, alto: number): number {
  const largos: number[] = [];
  for (let y = 0; y < alto; y++) {
    let run = 0;
    for (let x = 0; x < ancho; x++) {
      if ((v[y * ancho + x] ?? 0) >= 0.5) run++;
      else if (run > 0) {
        largos.push(run);
        run = 0;
      }
    }
    if (run > 0) largos.push(run);
  }
  return mediana(largos);
}

/** Relación entre el ancho de borde (20–80 %) y σ de un desenfoque gaussiano. */
export const BORDE_POR_SIGMA = 1.68;

/**
 * Grosor medio del trazo, continuo (sin redondeo a píxeles enteros):
 * 2 × área de tinta / perímetro. Antes se recorta el nivel entre 15 % y 85 %
 * para que el grano del papel no cuente como borde.
 */
export function grosorContinuo(v: ArrayLike<number>, ancho: number, alto: number): number {
  const nivel = (i: number) => Math.min(1, Math.max(0, ((v[i] ?? 0) - 0.15) / 0.7));
  let area = 0;
  let perimetro = 0;
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const i = y * ancho + x;
      const a = nivel(i);
      area += a;
      const dx = x + 1 < ancho ? nivel(i + 1) - a : 0;
      const dy = y + 1 < alto ? nivel(i + ancho) - a : 0;
      perimetro += Math.sqrt(dx * dx + dy * dy);
    }
  }
  return perimetro > 0 ? (2 * area) / perimetro : 0;
}
