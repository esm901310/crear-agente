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

process.stdout.write(lineas.join('\n') + '\n');
