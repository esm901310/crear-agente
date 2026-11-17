/** Emparejamiento de productos de varias tiendas en "grupos" (mismo producto). */
import { corteConfirmadoPorNombre, datosCorte, precioPorLibra, puntajePar, type DatosCorte } from '../../precios/src/cortes';
import { nombreParaMostrar, normalizarTexto } from '../../precios/src/normalizar';
import { compararFirmas, firmaDe, UMBRAL_PROBABLE, type Firma } from '../../precios/src/similitud';
import type { Producto } from '../../precios/src/tipos';
import { normalizarEan13 } from './ean';
import type { Coincidencia, Grupo, PrecioTienda, Tienda } from './tipos';

/** Preferencia para elegir el nombre/marca/imagen que se muestra del grupo. */
const PREFERENCIA_NOMBRE: Tienda[] = ['lacolonia', 'losandes', 'colonial'];

export function aPrecioTienda(p: Producto): PrecioTienda {
  const salida: PrecioTienda = { productoId: p.id, nombre: p.nombre, precio: p.precio, url: p.url };
  if (p.precioOferta !== undefined && p.precioOferta < p.precio) salida.precioOferta = p.precioOferta;
  if (p.imagen) salida.imagen = p.imagen;
  if (typeof p.disponible === 'boolean') salida.disponible = p.disponible;
  return salida;
}

/**
 * PrecioTienda de un grupo 'corte': precio y oferta en lempiras POR LIBRA. undefined si el
 * producto (p. ej. renombrado por la tienda) ya no se reconoce como vendido por peso.
 */
export function aPrecioTiendaPorLibra(p: Producto): PrecioTienda | undefined {
  const porLibra = precioPorLibra(p);
  if (!porLibra) return undefined;
  const salida = aPrecioTienda({ ...p, precio: porLibra.precio, precioOferta: porLibra.precioOferta });
  if (porLibra.precioOferta === undefined) delete salida.precioOferta;
  return salida;
}

export const PRESENTACION_POR_LIBRA = 'por libra';

/**
 * ¿Es un grupo de carne por libra (precios por libra, cantidad en libras, el sustituto manda)?
 * Sí si es 'corte' (2+ tiendas, clave "corte:…") o si es un fresco por peso sin pareja
 * (`presentacion: "por libra"`, una tienda). La app usa la misma regla. Solo se aplica a
 * grupos ya validados: `validarGrupo` quita "por libra" si el servidor no lo puede confirmar
 * (ver `porLibraConfirmado`).
 */
export const esGrupoCorte = (g: Pick<Grupo, 'clave' | 'coincidencia' | 'presentacion'>) =>
  g.coincidencia === 'corte' ||
  g.clave.startsWith('corte:') ||
  normalizarTexto(g.presentacion ?? '') === PRESENTACION_POR_LIBRA;

/**
 * Un grupo que NO es "corte:…" y dice `presentacion: "por libra"`: se acepta como por libra
 * solo si TODOS sus precios son, por su nombre, carne fresca por libra con corte reconocido
 * (`corteConfirmadoPorNombre`; el `corte` del grupo solo sirve de pista del animal si el
 * nombre no lo dice). Devuelve el nombre del corte o undefined.
 */
export function porLibraConfirmado(precios: Grupo['precios'], corte?: string): string | undefined {
  const lista = Object.values(precios);
  if (lista.length === 0) return undefined;
  const clases = lista.map((p) => corteConfirmadoPorNombre(p!.nombre, corte));
  return clases.every((c) => c) ? clases[0]!.nombre : undefined;
}

/** Clave de un grupo 'corte': "corte:<tienda>:<productoId>" del producto principal. */
export const claveCorte = (p: Producto) => `corte:${p.tienda}:${p.id}`;

/** "ean:0707517002083" si hay código de barras válido; si no, "<tienda>:<id>". */
export function claveDeProducto(p: Producto): string {
  const ean = normalizarEan13(p.codigoBarras);
  return ean ? `ean:${ean}` : `${p.tienda}:${p.id}`;
}

export interface Acumulado {
  clave: string;
  productos: Partial<Record<Tienda, Producto>>;
  /** Mejor posición del producto en los resultados de su tienda (relevancia). */
  rango: number;
  orden: number;
  /** true si se unió con otro grupo por parecido (no por código). */
  probable?: boolean;
  /** Nombre legible del corte si se unió en el modo carnes por libra. */
  corte?: string;
}

export interface ResultadoParaEmparejar {
  tienda: Tienda;
  productos: Producto[];
}

export interface OpcionesEmparejar {
  /** Unir también por parecido (marca + cantidad + palabras). Por defecto true. */
  difuso?: boolean;
  /** Puntuación mínima para unir por parecido. Por defecto UMBRAL_PROBABLE (0.8). */
  umbral?: number;
  /** Unir carnes frescas por libra con la misma clase de corte. Por defecto true. */
  cortes?: boolean;
}

/**
 * Agrupa los productos:
 * 1. Por código de barras (EAN-13): coincidencia 'codigo'.
 * 2. Los grupos que quedan sin pareja en otra tienda se unen por parecido
 *    (precios/src/similitud.ts), solo por encima del umbral y uno a uno, el mejor
 *    par primero: coincidencia 'probable'. Nunca se unen dos grupos con códigos de
 *    barras distintos (son productos distintos), ni si ninguno tiene código (la
 *    clave del grupo tiene que ser "ean:..." para tener 2 tiendas).
 * 3. Los que siguen solos y son carne/pescado fresco por peso se unen, uno a uno, con
 *    los de otra tienda de la MISMA clase de corte (precios/src/cortes.ts): coincidencia
 *    'corte', clave "corte:<tienda>:<id>", precios por libra.
 * Ordena primero los grupos que están en más tiendas y luego por relevancia.
 * Devuelve como máximo `maximo`.
 */
export function emparejar(resultados: ResultadoParaEmparejar[], maximo = 20, opciones: OpcionesEmparejar = {}): Grupo[] {
  const lista = agrupar(resultados, opciones);
  const tiendasDe = (a: Acumulado) => Object.keys(a.productos).length;
  lista.sort((a, b) => tiendasDe(b) - tiendasDe(a) || a.rango - b.rango || a.orden - b.orden);
  return lista.slice(0, maximo).map(armarGrupo);
}

/** Agrupa sin ordenar ni recortar (lo usa también la búsqueda para ver qué quedó sin pareja). */
export function agrupar(resultados: ResultadoParaEmparejar[], opciones: OpcionesEmparejar = {}): Acumulado[] {
  const mapa = new Map<string, Acumulado>();
  let orden = 0;
  for (const r of resultados) {
    r.productos.forEach((p, i) => {
      const clave = claveDeProducto(p);
      let acc = mapa.get(clave);
      if (!acc) {
        acc = { clave, productos: {}, rango: i, orden: orden++ };
        mapa.set(clave, acc);
      }
      // Si una misma tienda trae dos productos con el mismo código, se queda el primero (más relevante).
      if (!acc.productos[r.tienda]) acc.productos[r.tienda] = p;
      acc.rango = Math.min(acc.rango, i);
    });
  }
  let lista = [...mapa.values()];
  if (opciones.difuso !== false) lista = unirPorParecido(lista, opciones.umbral ?? UMBRAL_PROBABLE);
  if (opciones.cortes !== false) lista = unirPorCorte(lista);
  return lista;
}

/**
 * Modo carnes por libra. Solo toma grupos de UNA tienda (nunca rompe lo unido por código o
 * parecido) cuyo producto es fresco por peso y tiene clase de corte. Voraz: une primero el
 * par con mejor `puntajePar` (calidad parecida, luego misma marca, luego precio por libra
 * más cercano); cada producto se usa una sola vez. Con 3 tiendas, un grupo ya unido puede
 * recibir la tercera si su producto es de la misma clase que todos los del grupo.
 */
function unirPorCorte(lista: Acumulado[]): Acumulado[] {
  const datos = new Map<Producto, DatosCorte | undefined>();
  const dato = (p: Producto) => (datos.has(p) ? datos.get(p) : datos.set(p, datosCorte(p)).get(p));
  const candidato = (a: Acumulado) =>
    (a.corte !== undefined || tiendasDeGrupo(a).length === 1) && Object.values(a.productos).every((p) => dato(p!));
  const activos = new Set(lista);
  for (;;) {
    let mejor: { a: Acumulado; b: Acumulado; p: number } | undefined;
    const vivos = [...activos].filter(candidato);
    for (let i = 0; i < vivos.length; i++) {
      for (let j = i + 1; j < vivos.length; j++) {
        const a = vivos[i];
        const b = vivos[j];
        const ta = tiendasDeGrupo(a);
        if (tiendasDeGrupo(b).some((t) => ta.includes(t))) continue;
        let peor: number | undefined = -1;
        for (const pa of Object.values(a.productos)) {
          for (const pb of Object.values(b.productos)) {
            const p = puntajePar(dato(pa!)!, dato(pb!)!);
            peor = p === undefined || peor === undefined ? undefined : Math.max(peor, p);
          }
        }
        if (peor === undefined) continue;
        const desempate = (x: { a: Acumulado; b: Acumulado }) => x.a.rango + x.b.rango;
        if (!mejor || peor < mejor.p || (peor === mejor.p && desempate({ a, b }) < desempate(mejor))) mejor = { a, b, p: peor };
      }
    }
    if (!mejor) break;
    const { a, b } = mejor;
    const productos = { ...a.productos, ...b.productos };
    const principal = PREFERENCIA_NOMBRE.map((t) => productos[t]).find((p): p is Producto => !!p)!;
    const unido: Acumulado = {
      clave: claveCorte(principal),
      productos,
      rango: Math.min(a.rango, b.rango),
      orden: Math.min(a.orden, b.orden),
      corte: dato(principal)!.clase.nombre,
    };
    activos.delete(a);
    activos.delete(b);
    activos.add(unido);
  }
  return [...activos];
}

/** Tiendas de un grupo. */
const tiendasDeGrupo = (a: Acumulado) => Object.keys(a.productos) as Tienda[];

/**
 * Une grupos de tiendas distintas que son "probablemente el mismo producto".
 * Voraz: en cada vuelta une el mejor par que pase el umbral; un grupo unido ya
 * tiene esas tiendas ocupadas, así que cada producto se usa una sola vez.
 */
function unirPorParecido(lista: Acumulado[], umbral: number): Acumulado[] {
  const firmas = new Map<Producto, Firma>();
  const firma = (p: Producto) => firmas.get(p) ?? firmas.set(p, firmaDe(p)).get(p)!;
  const puntuaciones = new Map<string, number>();
  const puntuar = (a: Acumulado, b: Acumulado): number => {
    const k = a.orden < b.orden ? `${a.orden}|${b.orden}` : `${b.orden}|${a.orden}`;
    const guardada = puntuaciones.get(k);
    if (guardada !== undefined) return guardada;
    let minimo = 1;
    // Todos los productos de un grupo deben parecerse a todos los del otro.
    for (const pa of Object.values(a.productos)) {
      for (const pb of Object.values(b.productos)) {
        minimo = Math.min(minimo, compararFirmas(firma(pa!), firma(pb!)).puntuacion);
        if (minimo < umbral) break;
      }
      if (minimo < umbral) break;
    }
    puntuaciones.set(k, minimo);
    return minimo;
  };
  const ean = (a: Acumulado) => (a.clave.startsWith('ean:') ? a.clave : undefined);

  const activos = new Set(lista);
  for (;;) {
    let mejor: { a: Acumulado; b: Acumulado; p: number } | undefined;
    const vivos = [...activos];
    for (let i = 0; i < vivos.length; i++) {
      for (let j = i + 1; j < vivos.length; j++) {
        const a = vivos[i];
        const b = vivos[j];
        const ta = tiendasDeGrupo(a);
        if (tiendasDeGrupo(b).some((t) => ta.includes(t))) continue;
        const ea = ean(a);
        const eb = ean(b);
        if (!ea && !eb) continue; // sin código no hay clave válida para un grupo de 2 tiendas
        if (ea && eb && ea !== eb) continue; // códigos distintos = productos distintos
        const p = puntuar(a, b);
        if (p < umbral) continue;
        const desempate = (x: { a: Acumulado; b: Acumulado }) => x.a.rango + x.b.rango;
        if (!mejor || p > mejor.p || (p === mejor.p && desempate({ a, b }) < desempate(mejor))) mejor = { a, b, p };
      }
    }
    if (!mejor) break;
    const { a, b } = mejor;
    const unido: Acumulado = {
      clave: ean(a) ?? ean(b)!,
      productos: { ...a.productos, ...b.productos },
      rango: Math.min(a.rango, b.rango),
      orden: Math.min(a.orden, b.orden),
      probable: true,
    };
    activos.delete(a);
    activos.delete(b);
    activos.add(unido);
    // El grupo unido hereda el "orden" menor: borrar puntuaciones guardadas con ese orden.
    for (const k of [...puntuaciones.keys()]) {
      if (k.split('|').includes(String(unido.orden))) puntuaciones.delete(k);
    }
  }
  return [...activos];
}

/** Quita "x Lb", "por libra", "Lbr"… del final del nombre (el grupo ya dice "por libra"). */
function sinLibra(nombre: string): string {
  const sin = nombre.replace(/[\s-]*(?:\b(?:x|por)\s*)?\b(?:lbs?|lbr|libr|libras?)\.?\s*$/i, '').trim();
  return sin.length >= 3 ? sin : nombre;
}

/**
 * Grupo de carne por libra: 'corte' (2+ tiendas) o un fresco por peso sin pareja (una
 * tienda, sin `coincidencia`, clave "<tienda>:<id>"). Los dos con `corte`,
 * `presentacion: "por libra"` y precios por libra.
 */
function armarGrupoCorte(acc: Acumulado, ordenados: Producto[], corte: string): Grupo {
  const principal = ordenados[0];
  const nombre = sinLibra(nombreParaMostrar(principal.nombre, { marca: principal.marca })).slice(0, 200);
  const grupo: Grupo = {
    clave: acc.clave,
    nombre: nombre || principal.nombre,
    ...(ordenados.length >= 2 ? { coincidencia: 'corte' as const } : {}),
    corte,
    presentacion: PRESENTACION_POR_LIBRA,
    precios: {},
  };
  // Marca solo si todas las tiendas dicen la misma.
  const marcas = new Set(ordenados.map((p) => (p.marca ? normalizarTexto(p.marca) : '')));
  if (marcas.size === 1 && principal.marca) grupo.marca = principal.marca;
  const imagen = ordenados.find((p) => p.imagen)?.imagen;
  if (imagen) grupo.imagen = imagen;
  for (const [tienda, p] of Object.entries(acc.productos) as Array<[Tienda, Producto]>) {
    grupo.precios[tienda] = aPrecioTiendaPorLibra(p)!;
  }
  return grupo;
}

function armarGrupo(acc: Acumulado): Grupo {
  const ordenados = PREFERENCIA_NOMBRE.map((t) => acc.productos[t]).filter((p): p is Producto => !!p);
  if (acc.corte !== undefined && ordenados.length >= 2) return armarGrupoCorte(acc, ordenados, acc.corte);
  if (ordenados.length === 1) {
    // Fresco por peso sin pareja: queda solo en su tienda, pero marcado "por libra" SOLO si el
    // nombre lo confirma (así pasa la validación cuando la app lo agrega a la lista).
    const solo = datosCorte(ordenados[0]);
    if (solo && corteConfirmadoPorNombre(ordenados[0].nombre, solo.clase.nombre)) return armarGrupoCorte(acc, ordenados, solo.clase.nombre);
  }
  const principal = ordenados[0];
  const marca = ordenados.find((p) => p.marca)?.marca;
  const presentacion = ordenados.find((p) => p.presentacion)?.presentacion;
  // Nombre limpio para mostrar; el original de cada tienda queda en precios[tienda].nombre.
  const nombre = nombreParaMostrar(principal.nombre, { marca: principal.marca ?? marca, presentacion }).slice(0, 200);
  const grupo: Grupo = { clave: acc.clave, nombre: nombre || principal.nombre, precios: {} };
  if (ordenados.length >= 2) grupo.coincidencia = (acc.probable ? 'probable' : 'codigo') satisfies Coincidencia;
  const imagen = ordenados.find((p) => p.imagen)?.imagen;
  if (marca) grupo.marca = marca;
  if (presentacion) grupo.presentacion = presentacion;
  if (imagen) grupo.imagen = imagen;
  for (const [tienda, p] of Object.entries(acc.productos) as Array<[Tienda, Producto]>) {
    grupo.precios[tienda] = aPrecioTienda(p);
  }
  return grupo;
}

/**
 * Junta un grupo que ya estaba en la lista con uno nuevo de la MISMA clave (la
 * persona agrega otra vez "el mismo" producto). No se pierde ninguna tienda: las
 * que trae el nuevo se actualizan y las que solo tenía el guardado se conservan.
 * Ej.: en la lista está el par probable `ean:X` {La Colonia, Colonial} y luego se
 * agrega `ean:X` solo de La Colonia (Colonial falló en esa búsqueda): se actualiza
 * La Colonia y se conserva el precio de Colonial.
 * Si el nuevo ya trae 2 o más tiendas, manda el nuevo en esas tiendas.
 */
export function fusionarGrupos(guardado: Grupo, nuevo: Grupo): { grupo: Grupo; conservoTiendas: boolean } {
  const precios = { ...guardado.precios, ...nuevo.precios };
  const grupo: Grupo = { ...guardado, ...nuevo, precios };
  const n = (g: Grupo) => Object.keys(g.precios).length;
  delete grupo.coincidencia;
  if (n(grupo) >= 2) {
    // Dos grupos de una tienda con la misma clave "ean:" comparten código de barras.
    grupo.coincidencia = (n(nuevo) >= 2 ? nuevo.coincidencia : n(guardado) >= 2 ? guardado.coincidencia : undefined) ?? 'codigo';
  }
  const conservoTiendas = Object.keys(guardado.precios).some((t) => !(t in nuevo.precios));
  return { grupo, conservoTiendas };
}

/**
 * Busca en los resultados de una tienda el mismo producto de un grupo:
 * primero por id del producto en esa tienda, luego por código de barras.
 */
export function reidentificar(
  productos: Producto[],
  productoId: string | undefined,
  ean13: string | undefined,
): Producto | undefined {
  if (productoId) {
    const porId = productos.find((p) => p.id === productoId);
    if (porId) return porId;
  }
  if (ean13) return productos.find((p) => normalizarEan13(p.codigoBarras) === ean13);
  return undefined;
}

/** EAN-13 de la clave del grupo ("ean:...") o undefined. */
export function eanDeClave(clave: string): string | undefined {
  return clave.startsWith('ean:') ? normalizarEan13(clave.slice(4)) : undefined;
}
