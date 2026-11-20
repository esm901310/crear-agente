// Constantes de la app en un solo lugar (ver docs/diseno.md, sección 14).

/** Nombre de la app: se usa en la entrada, el encabezado y el título de la pestaña. */
export const APP_NOMBRE = 'Comandas';

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
  'Sin cilantro',
  'Sin chile',
  'Poco picante',
  'Bien picante',
  'Para llevar',
  'Bien dorado',
  'Sin queso',
];

/** Atajos de billetes en el campo "Recibido" (centavos: $200, $500, $1,000). */
export const BILLETES_RAPIDOS = [20000, 50000, 100000];

/** Orden de las pestañas del menú. Las categorías que no estén aquí van al final. */
export const ORDEN_CATEGORIAS = ['Entradas', 'Tacos', 'Platos fuertes', 'Bebidas', 'Postres'];

/** Largo máximo de una nota (lo mismo que acepta el servidor). */
export const NOTA_MAX = 140;

/** Segundos que dura el aviso "Deshacer" en Cocina. */
export const DESHACER_COCINA_MS = 8000;

// ---------- Entrega 2 (docs/diseno.md, sección 16.2) ----------

/** Atajos del fondo de caja al abrir el día (centavos: $500, $1,000, $2,000). */
export const FONDOS_RAPIDOS = [50000, 100000, 200000];

/** Motivos frecuentes de una salida de efectivo. */
export const MOTIVOS_SALIDA = ['Hielo', 'Tortillas', 'Gas', 'Propinas a meseros', 'Retiro del dueño'];

/** Largo máximo del motivo de una salida (lo mismo que acepta el servidor). */
export const MOTIVO_MAX = 80;

/** Billetes y monedas para el conteo del efectivo (centavos), en este orden. */
export const DENOMINACIONES = [
  { valor: 100000, tipo: 'billete' },
  { valor: 50000, tipo: 'billete' },
  { valor: 20000, tipo: 'billete' },
  { valor: 10000, tipo: 'billete' },
  { valor: 5000, tipo: 'billete' },
  { valor: 2000, tipo: 'billete' },
  { valor: 1000, tipo: 'moneda' },
  { valor: 500, tipo: 'moneda' },
  { valor: 200, tipo: 'moneda' },
  { valor: 100, tipo: 'moneda' },
  { valor: 50, tipo: 'moneda' },
] as const;

/** Cantidad máxima por denominación (lo mismo que acepta el servidor). */
export const CANTIDAD_MAX = 10000;

/** Cada cuánto se actualizan el historial de cortes y el corte parcial (milisegundos). */
export const RECARGA_CORTES_MS = 30000;

/** Rango máximo del reporte de propinas (días, contando ambos extremos). */
export const RANGO_MAX_DIAS = 93;
