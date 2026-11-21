// Genera el SQL con datos de ejemplo (solo para pruebas locales).
// Uso:  node seed/generar.mjs > seed/seed.sql
// Cada ejecución crea sales nuevas para los PIN, por eso se genera y no se guarda fijo.
// El hash es SHA-256( sal + pin ) en hexadecimal, igual que lo valida el Worker.
//
// Entrega 3: El Lechón Playero (Omoa, Cortés, Honduras). Moneda: lempiras, en
// centavos. Hora: America/Tegucigalpa (UTC−6 fijo, sin horario de verano).
// El menú sale de seed/menu-lechon-playero.json (fuente de verdad).

import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';

const menu = JSON.parse(readFileSync(new URL('./menu-lechon-playero.json', import.meta.url), 'utf8'));

// Modo producción: `node seed/generar.mjs --produccion` (PIN del dueño en la
// variable SEED_PIN_DUENO). Solo crea menú, mesas y el usuario Dueño; no borra
// nada (si la base ya tiene datos, los INSERT fallan por nombres únicos) y no
// crea jornadas ni cuentas de ejemplo.
const PRODUCCION = process.argv.includes('--produccion');
const pinDueno = PRODUCCION ? process.env.SEED_PIN_DUENO : '0000';
if (PRODUCCION && !/^\d{4}$/.test(pinDueno ?? '')) throw new Error('Falta SEED_PIN_DUENO (4 dígitos)');

const usuariosEjemplo = [
  { nombre: 'Dueño', rol: 'dueno', pin: pinDueno },
  { nombre: 'Ana', rol: 'mesero', pin: '1111' },
  { nombre: 'Luis', rol: 'mesero', pin: '2222' },
  { nombre: 'Cocina', rol: 'cocina', pin: '3333' },
  { nombre: 'Caja', rol: 'caja', pin: '4444' },
];
const usuarios = PRODUCCION ? usuariosEjemplo.slice(0, 1) : usuariosEjemplo;

const mesas = Array.from({ length: 15 }, (_, i) => `Mesa ${i + 1}`);

const q = (s) => (s === null || s === undefined ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`);
/** Misma clave que worker/texto.ts (claveNombre): sin mayúsculas, sin acentos, espacios simples. */
const clave = (s) =>
  s.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const lineas = [];
if (PRODUCCION) {
  lineas.push('-- Datos iniciales de producción generados por seed/generar.mjs --produccion.');
} else {
lineas.push('-- Datos de ejemplo generados por seed/generar.mjs. NO usar en producción.');
lineas.push('DELETE FROM pagos;', 'DELETE FROM items;', 'DELETE FROM comandas;', 'DELETE FROM ordenes;');
lineas.push('DELETE FROM ordenes_canceladas;', 'DELETE FROM salidas;', 'DELETE FROM jornadas;', 'DELETE FROM freno_ip;');
lineas.push('DELETE FROM sesiones;', 'DELETE FROM variantes;', 'DELETE FROM productos;', 'DELETE FROM categorias;');
lineas.push('DELETE FROM mesas;', 'DELETE FROM usuarios;');
}

for (const u of usuarios) {
  const sal = randomBytes(16).toString('hex');
  const hash = createHash('sha256').update(sal + u.pin, 'utf8').digest('hex');
  lineas.push(
    `INSERT INTO usuarios (nombre, nombre_clave, rol, pin_hash, pin_sal) VALUES (${q(u.nombre)}, ${q(clave(u.nombre))}, ${q(u.rol)}, ${q(hash)}, ${q(sal)});`,
  );
}

mesas.forEach((m, i) => {
  lineas.push(`INSERT INTO mesas (nombre, nombre_clave, activo, orden) VALUES (${q(m)}, ${q(clave(m))}, 1, ${i + 1});`);
});

// ---------------------------------------------------------------------------
// Menú real: 13 categorías en el orden del archivo, productos en su orden.

/** nombre de producto → { precio, precio_abierto, variantes: Map(nombre → precio), opciones, va_a_cocina, es_pasadia } */
const productos = new Map();
menu.categorias.forEach((c, ci) => {
  lineas.push(
    `INSERT INTO categorias (nombre, nombre_clave, orden, va_a_cocina, activa) VALUES (${q(c.nombre)}, ${q(clave(c.nombre))}, ${ci + 1}, ${c.va_a_cocina ? 1 : 0}, 1);`,
  );
  const catId = `(SELECT id FROM categorias WHERE nombre = ${q(c.nombre)})`;
  c.productos.forEach((p, pi) => {
    const variantes = p.variantes ?? [];
    const formas = (p.precio !== undefined ? 1 : 0) + (variantes.length > 0 ? 1 : 0) + (p.precio_abierto ? 1 : 0);
    if (formas !== 1) throw new Error(`producto con formas de precio inválidas: ${p.nombre}`);
    if (productos.has(p.nombre)) throw new Error(`producto repetido: ${p.nombre}`);
    lineas.push(
      `INSERT INTO productos (categoria_id, nombre, nombre_clave, descripcion, precio, precio_abierto, agotado, activo, orden, es_pasadia, opciones) VALUES (${catId}, ${q(p.nombre)}, ${q(clave(p.nombre))}, ${q(p.descripcion ?? null)}, ${p.precio ?? 'NULL'}, ${p.precio_abierto ? 1 : 0}, 0, 1, ${pi + 1}, ${p.es_pasadia ? 1 : 0}, ${q(JSON.stringify(p.opciones ?? []))});`,
    );
    variantes.forEach((v, vi) => {
      lineas.push(
        `INSERT INTO variantes (producto_id, nombre, nombre_clave, precio, orden, activa) VALUES ((SELECT MAX(id) FROM productos), ${q(v.nombre)}, ${q(clave(v.nombre))}, ${v.precio}, ${vi + 1}, 1);`,
      );
    });
    productos.set(p.nombre, {
      precio: p.precio ?? null,
      precio_abierto: !!p.precio_abierto,
      variantes: new Map(variantes.map((v) => [v.nombre, v.precio])),
      opciones: p.opciones ?? [],
      va_a_cocina: !!c.va_a_cocina,
      es_pasadia: !!p.es_pasadia,
    });
  });
});

if (PRODUCCION) {
  process.stdout.write(lineas.join('\n') + '\n');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Tres jornadas CERRADAS de días anteriores (historial del dueño y reporte de
// propinas). Hoy queda SIN jornada abierta, para probar "abrir el día".
// Se arman como en la vida real: se abre la jornada, se abren cuentas, se
// envían platillos, se cobran (ligadas a la jornada abierta), salidas, y al
// final se cierra con el conteo. Así se respetan todas las reglas (triggers).
// El restaurante abre de 9:00 a 18:00 (hora de Honduras).

const DESFASE = 6 * 3600_000; // Honduras: UTC−6 fijo
const hoyHn = new Date(Date.now() - DESFASE); // "ahora" en hora de Honduras (campos UTC)
const DENOMS = [50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10];

/** ISO UTC para el día (hoy − diasAtras) a la hora:min de Honduras. */
function isoHn(diasAtras, hora, min = 0) {
  const ms = Date.UTC(hoyHn.getUTCFullYear(), hoyHn.getUTCMonth(), hoyHn.getUTCDate() - diasAtras, hora, min) + DESFASE;
  return new Date(ms).toISOString();
}

/** Conteo (denominación → cantidad) que suma exactamente `monto` (múltiplo de 10 centavos). */
function conteoPara(monto) {
  if (monto % 10 !== 0 || monto < 0) throw new Error(`monto no contable: ${monto}`);
  const c = {};
  let resto = monto;
  for (const d of DENOMS) {
    c[String(d)] = Math.floor(resto / d);
    resto -= c[String(d)] * d;
  }
  return c;
}

const usuarioId = (nombre) => `(SELECT id FROM usuarios WHERE nombre = ${q(nombre)})`;
const mesaId = (nombre) => `(SELECT id FROM mesas WHERE nombre = ${q(nombre)})`;

/**
 * Item de ejemplo: [producto, cantidad, { variante?, opcion?, precio? }].
 * Se valida contra el menú y se compone el nombre como lo hace el Worker.
 */
function itemDe([nombre, cantidad, extra = {}]) {
  const p = productos.get(nombre);
  if (!p) throw new Error(`producto desconocido: ${nombre}`);
  let precio = p.precio;
  let variante = null;
  let opcion = null;
  if (p.variantes.size > 0) {
    if (!p.variantes.has(extra.variante)) throw new Error(`falta variante válida: ${nombre}`);
    variante = extra.variante;
    precio = p.variantes.get(variante);
  }
  if (p.precio_abierto) {
    if (!(extra.precio > 0)) throw new Error(`falta precio abierto: ${nombre}`);
    precio = extra.precio;
  }
  if (p.opciones.length > 0) {
    if (!p.opciones.includes(extra.opcion)) throw new Error(`falta opción válida: ${nombre}`);
    opcion = extra.opcion;
  }
  let compuesto = nombre;
  if (variante) compuesto += ` · ${variante}`;
  if (opcion) compuesto += ` (${opcion})`;
  return { producto: nombre, nombre: compuesto, variante, opcion, precio, cantidad, va_a_cocina: p.va_a_cocina, es_pasadia: p.es_pasadia };
}

// Cada cuenta: mesa, mesero, hora (Honduras), platillos, propina (centavos),
// pagos [[metodo, monto | 'resto']] ('resto' = total − los demás).
const jornadasEjemplo = [
  {
    dias: 3, fondo: 200000, abre: 'Caja', cierra: 'Caja', diferencia: 0, // cuadra
    cuentas: [
      { mesa: 'Mesa 1', mesero: 'Ana', h: [10, 15], propina: 13000, pagos: [['efectivo', 'resto']], items: [
        ['Pescado rojo', 2, { variante: 'Talla 3' }], ['Orden de tajadas', 2], ['Horchata', 2], ['Cerveza nacional', 2, { opcion: 'Salvavida' }]] },
      // Pasadía con consumo MENOR: 4 × L300 = L1,200; consumo L924.80 → se cobra L1,200.
      { mesa: 'Mesa 4', mesero: 'Luis', h: [11, 0], propina: 12000, pagos: [['tarjeta', 'resto']], items: [
        ['Pasadía', 4], ['Ceviche de camarón', 2], ['Cerveza nacional', 4, { opcion: 'Imperial' }], ['Limonada con agua', 2]] },
      { mesa: 'Mesa 7', mesero: 'Ana', h: [13, 30], propina: 20000, pagos: [['efectivo', 100000], ['tarjeta', 'resto']], items: [
        ['Mar y tierra', 1, { opcion: 'Camarón' }], ['Mariscada', 1, { variante: 'Para 2 personas' }], ['Piña colada', 2]] },
      // Solo bar: la comanda nunca aparece en Cocina.
      { mesa: 'Mesa 10', mesero: 'Luis', h: [15, 10], propina: 0, pagos: [['efectivo', 'resto']], items: [
        ['Cerveza nacional', 6, { opcion: 'Barrena' }]] },
    ],
    salidas: [
      { h: [9, 10], monto: 25000, motivo: 'Compra de hielo', por: 'Caja' },
      { h: [12, 0], monto: 8000, motivo: 'Error de captura', por: 'Caja', anula: 'Dueño' },
    ],
  },
  {
    dias: 2, fondo: 200000, abre: 'Caja', cierra: 'Caja', diferencia: -5000, // faltan L50
    cuentas: [
      { mesa: 'Mesa 2', mesero: 'Luis', h: [10, 30], propina: 15000, pagos: [['efectivo', 50000], ['tarjeta', 50000], ['transferencia', 'resto']], items: [
        ['Langosta', 1, { opcion: 'Al ajillo', precio: 120000 }], ['Orden de tostones', 1], ['Cerveza importada', 2, { opcion: 'Heineken' }]] },
      // Pasadía con consumo MAYOR: 2 × L300 = L600; consumo L1,120 → se cobra L1,120.
      { mesa: 'Mesa 5', mesero: 'Ana', h: [12, 0], propina: 17000, pagos: [['efectivo', 'resto']], items: [
        ['Pasadía', 2], ['Lechón en caja china', 2], ['Horchata', 2], ['Kayak', 2]] },
      { mesa: 'Mesa 3', mesero: 'Ana', h: [16, 0], propina: 1, pagos: [['efectivo', 20000], ['tarjeta', 'resto']], items: [
        ['Tacos de lechón', 1], ['Jamaica', 1]] },
    ],
    salidas: [{ h: [11, 20], monto: 150000, motivo: 'Pago a proveedor de mariscos', por: 'Caja' }],
  },
  {
    dias: 1, fondo: 250000, abre: 'Dueño', cierra: 'Caja', diferencia: 2000, // sobran L20
    cuentas: [
      { mesa: 'Mesa 6', mesero: 'Ana', h: [11, 45], propina: 15000, pagos: [['efectivo', 'resto']], items: [
        ['Sopa marinera de 5 mariscos', 2], ['Orden de tortillas', 2], ['Limonada de fresa con soda', 2]] },
      { mesa: 'Mesa 12', mesero: 'Luis', h: [13, 0], propina: 14000, pagos: [['efectivo', 60000], ['tarjeta', 'resto']], items: [
        ['Costilla parrillera', 2], ['Pescado al vapor', 1, { variante: 'Talla 1' }], ['Margarita', 2]] },
      { mesa: 'Mesa 15', mesero: 'Luis', h: [16, 30], propina: 7000, pagos: [['transferencia', 'resto']], items: [
        ['Deditos de pollo', 2], ['Mango', 2]] },
    ],
    salidas: [],
  },
];

for (const j of jornadasEjemplo) {
  lineas.push(`-- Jornada de hace ${j.dias} día(s)`);
  lineas.push(
    `INSERT INTO jornadas (estado, fondo, abierta_por, abierta_en) VALUES ('abierta', ${j.fondo}, ${usuarioId(j.abre)}, ${q(isoHn(j.dias, 8, 30))});`,
  );
  const jid = `(SELECT id FROM jornadas WHERE estado = 'abierta')`;
  let efectivo = 0;
  for (const c of j.cuentas) {
    const creada = isoHn(j.dias, c.h[0], c.h[1]);
    const pagadaEn = isoHn(j.dias, c.h[0] + 1, c.h[1]);
    const items = c.items.map(itemDe);
    // Misma regla que worker/montos.ts: subtotal = max(consumo, pasadía).
    const consumo = items.filter((i) => !i.es_pasadia).reduce((s, i) => s + i.precio * i.cantidad, 0);
    const pasadia = items.filter((i) => i.es_pasadia).reduce((s, i) => s + i.precio * i.cantidad, 0);
    const subtotal = Math.max(consumo, pasadia);
    const total = subtotal + c.propina;
    const fijos = c.pagos.filter(([, m]) => m !== 'resto').reduce((s, [, m]) => s + m, 0);
    const pagos = c.pagos.map(([metodo, m]) => [metodo, m === 'resto' ? total - fijos : m]);
    if (pagos.some(([, m]) => m <= 0)) throw new Error('pago no positivo en el ejemplo');
    lineas.push(
      `INSERT INTO ordenes (id, mesa_id, mesero_id, estado, creada) VALUES ((SELECT COALESCE(MAX(id), 0) + 1 FROM ordenes), ${mesaId(c.mesa)}, ${usuarioId(c.mesero)}, 'abierta', ${q(creada)});`,
    );
    const oid = `(SELECT MAX(id) FROM ordenes)`;
    lineas.push(`INSERT INTO comandas (orden_id, estado, creada, listo_en) VALUES (${oid}, 'listo', ${q(creada)}, ${q(creada)});`);
    for (const it of items) {
      lineas.push(
        `INSERT INTO items (comanda_id, producto_id, nombre, variante, opcion, precio, cantidad, va_a_cocina, es_pasadia) VALUES ((SELECT MAX(id) FROM comandas), (SELECT id FROM productos WHERE nombre = ${q(it.producto)}), ${q(it.nombre)}, ${q(it.variante)}, ${q(it.opcion)}, ${it.precio}, ${it.cantidad}, ${it.va_a_cocina ? 1 : 0}, ${it.es_pasadia ? 1 : 0});`,
      );
    }
    for (const [metodo, monto] of pagos) {
      lineas.push(`INSERT INTO pagos (orden_id, metodo, monto, creado) VALUES (${oid}, ${q(metodo)}, ${monto}, ${q(pagadaEn)});`);
      if (metodo === 'efectivo') efectivo += monto;
    }
    lineas.push(
      `UPDATE ordenes SET estado = 'pagada', propina = ${c.propina}, pagada_en = ${q(pagadaEn)}, cobrado_por = ${usuarioId('Caja')}, jornada_id = ${jid} WHERE id = ${oid};`,
    );
    process.stderr.write(
      `seed:   ${c.mesa}: consumo ${consumo}, pasadía ${pasadia}, subtotal ${subtotal}, propina ${c.propina}\n`,
    );
  }
  let salidas = 0;
  for (const s of j.salidas) {
    lineas.push(
      `INSERT INTO salidas (jornada_id, monto, motivo, usuario_id, creada) VALUES (${jid}, ${s.monto}, ${q(s.motivo)}, ${usuarioId(s.por)}, ${q(isoHn(j.dias, s.h[0], s.h[1]))});`,
    );
    if (s.anula) {
      lineas.push(
        `UPDATE salidas SET anulada_por = ${usuarioId(s.anula)}, anulada_en = ${q(isoHn(j.dias, s.h[0], s.h[1] + 5))} WHERE id = (SELECT MAX(id) FROM salidas);`,
      );
    } else {
      salidas += s.monto;
    }
  }
  const esperado = j.fondo + efectivo - salidas;
  const contado = esperado + j.diferencia;
  lineas.push(
    `UPDATE jornadas SET estado = 'cerrada', cerrada_por = ${usuarioId(j.cierra)}, cerrada_en = ${q(isoHn(j.dias, 18, 30))}, conteo = ${q(JSON.stringify(conteoPara(contado)))}, contado = ${contado} WHERE estado = 'abierta';`,
  );
  process.stderr.write(`seed: jornada hace ${j.dias} día(s): esperado ${esperado}, contado ${contado}\n`);
}

process.stdout.write(lineas.join('\n') + '\n');
