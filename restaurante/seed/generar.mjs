// Genera el SQL con datos de ejemplo (solo para pruebas locales).
// Uso:  node seed/generar.mjs > seed/seed.sql
// Cada ejecución crea sales nuevas para los PIN, por eso se genera y no se guarda fijo.
// El hash es SHA-256( sal + pin ) en hexadecimal, igual que lo valida el Worker.

import { createHash, randomBytes } from 'node:crypto';

const usuarios = [
  { nombre: 'Dueño', rol: 'dueno', pin: '0000' },
  { nombre: 'Ana', rol: 'mesero', pin: '1111' },
  { nombre: 'Luis', rol: 'mesero', pin: '2222' },
  { nombre: 'Cocina', rol: 'cocina', pin: '3333' },
  { nombre: 'Caja', rol: 'caja', pin: '4444' },
];

const mesas = [
  ...Array.from({ length: 10 }, (_, i) => `Mesa ${i + 1}`),
  'Barra 1',
  'Barra 2',
];

// Precios en pesos (se convierten a centavos abajo).
const productos = [
  ['Entradas', 'Guacamole con totopos', 95],
  ['Entradas', 'Queso fundido con chorizo', 110],
  ['Entradas', 'Sopa de tortilla', 85],
  ['Entradas', 'Frijoles charros', 60],
  ['Entradas', 'Elote en vaso', 45],
  ['Tacos', 'Tacos al pastor (orden de 4)', 85],
  ['Tacos', 'Tacos de bistec (orden de 4)', 95],
  ['Tacos', 'Tacos de suadero (orden de 4)', 90],
  ['Tacos', 'Tacos de carnitas (orden de 4)', 90],
  ['Tacos', 'Gringa de pastor', 75],
  ['Tacos', 'Quesadilla de flor de calabaza', 55],
  ['Platos fuertes', 'Enchiladas verdes de pollo', 135],
  ['Platos fuertes', 'Enchiladas suizas', 145],
  ['Platos fuertes', 'Chiles rellenos', 150],
  ['Platos fuertes', 'Mole poblano con pollo', 165],
  ['Platos fuertes', 'Arrachera con guarnición', 245],
  ['Platos fuertes', 'Chilaquiles rojos con huevo', 115],
  ['Bebidas', 'Agua de horchata', 35],
  ['Bebidas', 'Agua de jamaica', 35],
  ['Bebidas', 'Refresco', 32],
  ['Bebidas', 'Cerveza nacional', 45],
  ['Bebidas', 'Michelada', 75],
  ['Bebidas', 'Café de olla', 30],
  ['Postres', 'Flan napolitano', 55],
  ['Postres', 'Churros con chocolate', 65],
  ['Postres', 'Pastel de tres leches', 60],
  ['Postres', 'Arroz con leche', 45.5],
];

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const lineas = [];

lineas.push('-- Datos de ejemplo generados por seed/generar.mjs. NO usar en producción.');
lineas.push('DELETE FROM pagos;', 'DELETE FROM items;', 'DELETE FROM comandas;', 'DELETE FROM ordenes;');
lineas.push('DELETE FROM ordenes_canceladas;', 'DELETE FROM salidas;', 'DELETE FROM jornadas;', 'DELETE FROM freno_ip;');
lineas.push('DELETE FROM sesiones;', 'DELETE FROM productos;', 'DELETE FROM mesas;', 'DELETE FROM usuarios;');

for (const u of usuarios) {
  const sal = randomBytes(16).toString('hex');
  const hash = createHash('sha256').update(sal + u.pin, 'utf8').digest('hex');
  lineas.push(
    `INSERT INTO usuarios (nombre, rol, pin_hash, pin_sal) VALUES (${q(u.nombre)}, ${q(u.rol)}, ${q(hash)}, ${q(sal)});`,
  );
}

for (const m of mesas) {
  lineas.push(`INSERT INTO mesas (nombre) VALUES (${q(m)});`);
}

for (const [categoria, nombre, pesos] of productos) {
  const centavos = Math.round(pesos * 100);
  lineas.push(
    `INSERT INTO productos (nombre, categoria, precio) VALUES (${q(nombre)}, ${q(categoria)}, ${centavos});`,
  );
}

// ---------------------------------------------------------------------------
// Entrega 2: tres jornadas CERRADAS de días anteriores (para probar el historial
// del dueño y el reporte de propinas). Hoy queda SIN jornada abierta, para
// probar el flujo de "abrir el día".
// Se arman como en la vida real: se abre la jornada, se abren cuentas, se
// envían platillos, se cobran (ligadas a la jornada abierta), salidas, y al
// final se cierra con el conteo. Así se respetan todas las reglas (triggers).
// México: UTC−6 fijo (sin horario de verano desde 2022).

const precioDe = new Map(productos.map(([, nombre, pesos]) => [nombre, Math.round(pesos * 100)]));
const DESFASE = 6 * 3600_000;
const hoyMx = new Date(Date.now() - DESFASE); // "ahora" en hora de México (campos UTC)
const DENOMS = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50];

/** ISO UTC para el día (hoy − diasAtras) a la hora:min de México. */
function isoMx(diasAtras, hora, min = 0) {
  const ms = Date.UTC(hoyMx.getUTCFullYear(), hoyMx.getUTCMonth(), hoyMx.getUTCDate() - diasAtras, hora, min) + DESFASE;
  return new Date(ms).toISOString();
}

/** Conteo (denominación → cantidad) que suma exactamente `monto` (múltiplo de 50¢). */
function conteoPara(monto) {
  if (monto % 50 !== 0 || monto < 0) throw new Error(`monto no contable: ${monto}`);
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

// Cada cuenta: mesa, mesero, hora (México), platillos [nombre, cantidad], propina (centavos),
// pagos [[metodo, monto | 'resto']] ('resto' = total − los demás).
const jornadasEjemplo = [
  {
    dias: 3, fondo: 150000, abre: 'Caja', cierra: 'Caja', diferencia: 0, // cuadra
    cuentas: [
      { mesa: 'Mesa 1', mesero: 'Ana', h: [13, 20], items: [['Tacos al pastor (orden de 4)', 2], ['Agua de horchata', 2]], propina: 3000, pagos: [['efectivo', 'resto']] },
      { mesa: 'Mesa 4', mesero: 'Luis', h: [14, 5], items: [['Arrachera con guarnición', 2], ['Cerveza nacional', 3], ['Guacamole con totopos', 1]], propina: 9000, pagos: [['tarjeta', 'resto']] },
      { mesa: 'Mesa 2', mesero: 'Ana', h: [15, 40], items: [['Enchiladas suizas', 1], ['Mole poblano con pollo', 1], ['Agua de jamaica', 2]], propina: 5000, pagos: [['efectivo', 20000], ['tarjeta', 'resto']] },
      { mesa: 'Barra 1', mesero: 'Luis', h: [17, 10], items: [['Michelada', 2], ['Gringa de pastor', 2]], propina: 0, pagos: [['efectivo', 'resto']] },
      { mesa: 'Mesa 7', mesero: 'Ana', h: [20, 30], items: [['Chiles rellenos', 2], ['Flan napolitano', 2], ['Café de olla', 2]], propina: 6000, pagos: [['transferencia', 'resto']] },
    ],
    salidas: [
      { h: [12, 45], monto: 25000, motivo: 'Compra de hielo y garrafones', por: 'Caja' },
      { h: [16, 0], monto: 8000, motivo: 'Error de captura', por: 'Caja', anula: 'Dueño' },
    ],
  },
  {
    dias: 2, fondo: 150000, abre: 'Caja', cierra: 'Caja', diferencia: -5000, // faltan $50
    cuentas: [
      { mesa: 'Mesa 3', mesero: 'Luis', h: [13, 0], items: [['Chilaquiles rojos con huevo', 3], ['Café de olla', 3]], propina: 4000, pagos: [['efectivo', 'resto']] },
      { mesa: 'Mesa 5', mesero: 'Ana', h: [14, 30], items: [['Tacos de bistec (orden de 4)', 3], ['Refresco', 3], ['Queso fundido con chorizo', 1]], propina: 7000, pagos: [['efectivo', 15000], ['tarjeta', 15000], ['transferencia', 'resto']] },
      { mesa: 'Mesa 8', mesero: 'Luis', h: [16, 15], items: [['Enchiladas verdes de pollo', 2], ['Agua de horchata', 2], ['Churros con chocolate', 1]], propina: 4500, pagos: [['tarjeta', 'resto']] },
      { mesa: 'Mesa 1', mesero: 'Ana', h: [19, 50], items: [['Sopa de tortilla', 2], ['Arroz con leche', 2]], propina: 1, pagos: [['efectivo', 10000], ['tarjeta', 'resto']] },
    ],
    salidas: [{ h: [15, 20], monto: 40000, motivo: 'Pago a proveedor de tortillas', por: 'Caja' }],
  },
  {
    dias: 1, fondo: 200000, abre: 'Dueño', cierra: 'Caja', diferencia: 2000, // sobran $20
    cuentas: [
      { mesa: 'Mesa 6', mesero: 'Ana', h: [13, 45], items: [['Tacos de suadero (orden de 4)', 2], ['Tacos de carnitas (orden de 4)', 1], ['Cerveza nacional', 2]], propina: 5000, pagos: [['efectivo', 'resto']] },
      { mesa: 'Mesa 9', mesero: 'Luis', h: [15, 0], items: [['Mole poblano con pollo', 2], ['Pastel de tres leches', 2], ['Agua de jamaica', 2]], propina: 8000, pagos: [['efectivo', 30000], ['tarjeta', 'resto']] },
      { mesa: 'Barra 2', mesero: 'Luis', h: [18, 30], items: [['Elote en vaso', 2], ['Michelada', 1]], propina: 2000, pagos: [['transferencia', 'resto']] },
    ],
    salidas: [],
  },
];

for (const j of jornadasEjemplo) {
  lineas.push(`-- Jornada de hace ${j.dias} día(s)`);
  lineas.push(
    `INSERT INTO jornadas (estado, fondo, abierta_por, abierta_en) VALUES ('abierta', ${j.fondo}, ${usuarioId(j.abre)}, ${q(isoMx(j.dias, 12, 30))});`,
  );
  const jid = `(SELECT id FROM jornadas WHERE estado = 'abierta')`;
  let efectivo = 0;
  for (const c of j.cuentas) {
    const creada = isoMx(j.dias, c.h[0], c.h[1]);
    const pagadaEn = isoMx(j.dias, c.h[0] + 1, c.h[1]);
    const subtotal = c.items.reduce((s, [nombre, cant]) => {
      if (!precioDe.has(nombre)) throw new Error(`producto desconocido: ${nombre}`);
      return s + precioDe.get(nombre) * cant;
    }, 0);
    const total = subtotal + c.propina;
    const fijos = c.pagos.filter(([, m]) => m !== 'resto').reduce((s, [, m]) => s + m, 0);
    const pagos = c.pagos.map(([metodo, m]) => [metodo, m === 'resto' ? total - fijos : m]);
    if (pagos.some(([, m]) => m <= 0)) throw new Error('pago no positivo en el ejemplo');
    lineas.push(
      `INSERT INTO ordenes (id, mesa_id, mesero_id, estado, creada) VALUES ((SELECT COALESCE(MAX(id), 0) + 1 FROM ordenes), ${mesaId(c.mesa)}, ${usuarioId(c.mesero)}, 'abierta', ${q(creada)});`,
    );
    const oid = `(SELECT MAX(id) FROM ordenes)`;
    lineas.push(`INSERT INTO comandas (orden_id, estado, creada, listo_en) VALUES (${oid}, 'listo', ${q(creada)}, ${q(creada)});`);
    for (const [nombre, cant] of c.items) {
      lineas.push(
        `INSERT INTO items (comanda_id, producto_id, nombre, precio, cantidad) SELECT (SELECT MAX(id) FROM comandas), id, nombre, precio, ${cant} FROM productos WHERE nombre = ${q(nombre)};`,
      );
    }
    for (const [metodo, monto] of pagos) {
      lineas.push(`INSERT INTO pagos (orden_id, metodo, monto, creado) VALUES (${oid}, ${q(metodo)}, ${monto}, ${q(pagadaEn)});`);
      if (metodo === 'efectivo') efectivo += monto;
    }
    lineas.push(
      `UPDATE ordenes SET estado = 'pagada', propina = ${c.propina}, pagada_en = ${q(pagadaEn)}, cobrado_por = ${usuarioId('Caja')}, jornada_id = ${jid} WHERE id = ${oid};`,
    );
  }
  let salidas = 0;
  for (const s of j.salidas) {
    lineas.push(
      `INSERT INTO salidas (jornada_id, monto, motivo, usuario_id, creada) VALUES (${jid}, ${s.monto}, ${q(s.motivo)}, ${usuarioId(s.por)}, ${q(isoMx(j.dias, s.h[0], s.h[1]))});`,
    );
    if (s.anula) {
      lineas.push(
        `UPDATE salidas SET anulada_por = ${usuarioId(s.anula)}, anulada_en = ${q(isoMx(j.dias, s.h[0], s.h[1] + 5))} WHERE id = (SELECT MAX(id) FROM salidas);`,
      );
    } else {
      salidas += s.monto;
    }
  }
  const esperado = j.fondo + efectivo - salidas;
  const contado = esperado + j.diferencia;
  lineas.push(
    `UPDATE jornadas SET estado = 'cerrada', cerrada_por = ${usuarioId(j.cierra)}, cerrada_en = ${q(isoMx(j.dias, 23, 0))}, conteo = ${q(JSON.stringify(conteoPara(contado)))}, contado = ${contado} WHERE estado = 'abierta';`,
  );
  process.stderr.write(`seed: jornada hace ${j.dias} día(s): esperado ${esperado}, contado ${contado}\n`);
}

process.stdout.write(lineas.join('\n') + '\n');
