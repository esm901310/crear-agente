// Constantes de la app en un solo lugar (ver docs/diseno.md, sección 14).

/** Nombre de la app: se usa en la entrada, el encabezado y el título de la pestaña. */
export const APP_NOMBRE = 'El Lechón Playero';

/** Lugar del restaurante (debajo del nombre en la entrada). */
export const APP_LUGAR = 'Omoa, Cortés · Honduras';

/** Zona horaria de todas las horas y fechas que se muestran (UTC−6 fijo, sin horario de verano). */
export const ZONA_HORARIA = 'America/Tegucigalpa';

/** Cada cuánto se pregunta al servidor por cambios (milisegundos). */
export const POLLING_MS = 3000;

/** Minutos de espera en Cocina para pintar la comanda en ámbar y en rojo. */
export const ESPERA_AMBAR_MIN = 10;
export const ESPERA_ROJO_MIN = 20;

/** Porcentajes de propina que aparecen como botones en Caja. */
export const PROPINAS_PCT = [10, 15, 20];

/** Notas rápidas que el mesero puede tocar al agregar una nota a un platillo. */
export const NOTAS_RAPIDAS = [
  'Sin cebolla',
  'Sin culantro',
  'Sin chile',
  'Bien cocido',
  'Poca sal',
  'Salsa aparte',
  'Para llevar',
  'Para niño',
];

/** Atajos de billetes en el campo "Recibido" (centavos: L100, L200, L500). */
export const BILLETES_RAPIDOS = [10000, 20000, 50000];

/** Cada cuánto se vuelve a pedir el menú para enterarse de los agotados (milisegundos). */
export const MENU_RECARGA_MS = 30000;

/** Precio máximo que se puede escribir (centavos: L 1,000,000.00, lo mismo que acepta el servidor). */
export const PRECIO_MAX = 100000000;

/** Largo máximo de una nota (lo mismo que acepta el servidor). */
export const NOTA_MAX = 140;

/** Segundos que dura el aviso "Deshacer" en Cocina. */
export const DESHACER_COCINA_MS = 8000;

// ---------- Entrega 2 (docs/diseno.md, sección 16.2) ----------

/** Atajos del fondo de caja al abrir el día (centavos: L1,000, L2,000, L3,000). */
export const FONDOS_RAPIDOS = [100000, 200000, 300000];

/** Motivos frecuentes de una salida de efectivo. */
export const MOTIVOS_SALIDA = ['Hielo', 'Gas', 'Mariscos', 'Tortillas', 'Propinas a meseros', 'Retiro del dueño'];

/** Largo máximo del motivo de una salida (lo mismo que acepta el servidor). */
export const MOTIVO_MAX = 80;

/** Billetes y monedas de lempira para el conteo del efectivo (centavos), en este orden (diseño 31). */
export const DENOMINACIONES = [
  { valor: 50000, tipo: 'billete' },
  { valor: 20000, tipo: 'billete' },
  { valor: 10000, tipo: 'billete' },
  { valor: 5000, tipo: 'billete' },
  { valor: 2000, tipo: 'billete' },
  { valor: 1000, tipo: 'billete' },
  { valor: 500, tipo: 'billete' },
  { valor: 200, tipo: 'billete' },
  { valor: 100, tipo: 'billete' },
  { valor: 50, tipo: 'moneda' },
  { valor: 20, tipo: 'moneda' },
  { valor: 10, tipo: 'moneda' },
] as const;

/** Cantidad máxima por denominación (lo mismo que acepta el servidor). */
export const CANTIDAD_MAX = 10000;

/** Cada cuánto se actualizan el historial de cortes y el corte parcial (milisegundos). */
export const RECARGA_CORTES_MS = 30000;

/**
 * Diferencias de efectivo menores a esto (centavos) se consideran "Cuadra ✓": menos de L1.00,
 * porque las monedas de centavos casi no circulan. Ver docs/diseno.md, sección 31.
 */
export const TOLERANCIA_CUADRE = 100;

/** Rango máximo del reporte de propinas (días, contando ambos extremos). */
export const RANGO_MAX_DIAS = 93;
