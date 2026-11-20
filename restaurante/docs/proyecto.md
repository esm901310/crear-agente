# App del restaurante — documento del proyecto

## Qué es
App web (se abre en el navegador) para el restaurante. Los meseros toman pedidos
por mesa en **tablet**, los pedidos llegan a la **cocina** (tablet) y a la
**caja** (computadora). La caja cobra (efectivo, tarjeta, transferencia), registra
propina y al final del día hace el corte de caja.

## Usuarios y roles
Cada persona entra eligiendo su nombre y escribiendo un **PIN de 4 dígitos**.

| Rol | Qué puede hacer |
|---|---|
| `mesero` | Ver mesas, abrir cuenta de una mesa, agregar platillos con notas y enviarlos a cocina |
| `cocina` | Ver comandas pendientes en orden de llegada y marcarlas como listas |
| `caja` | Ver cuentas abiertas, cobrar (una o varias formas de pago) con propina |
| `dueno` | Todo lo anterior (y en entregas futuras: corte, reportes, editar menú/mesas/usuarios) |

## Decisiones técnicas
- Todo vive en la carpeta `restaurante/`.
- Pantallas: Vite + React + TypeScript (`restaurante/src/`).
- Servidor: Cloudflare Worker (`restaurante/worker/`) + base de datos D1.
- Un solo proyecto de Cloudflare: el Worker sirve la API en `/api/*` y los
  archivos de las pantallas (carpeta `dist/`) como "static assets".
- Desarrollo local: `wrangler dev` (puerto 8787) con D1 local; Vite (puerto 5173)
  redirige `/api` a 8787.
- "Tiempo real": las pantallas preguntan al servidor cada 3 segundos (polling).
  Simple y suficiente para un restaurante.
- Dinero: siempre en **centavos enteros** (ej. L 85.50 = 8550). Moneda: lempiras (desde la Entrega 3; antes pesos MXN de ejemplo).
- Fechas: se guardan en UTC formato ISO; las pantallas las muestran en hora local.
- PIN: se guarda con hash SHA-256 + sal (nunca en texto plano).
- Sesión: token aleatorio guardado en la tabla `sesiones`; las pantallas lo mandan
  en el encabezado `Authorization: Bearer <token>` y lo guardan en `localStorage`.

## Entregas
1. **Pedidos funcionando** (esta): login con PIN, mesero → cocina → caja cobra.
   Menú, mesas y usuarios de ejemplo.
2. Corte de caja del día y reporte de propinas por mesero y por mesa.
3. Panel del dueño: editar menú, precios, mesas y usuarios.
4. Publicar en internet.

## Usuarios de ejemplo (solo para pruebas)
| Nombre | Rol | PIN |
|---|---|---|
| Dueño | dueno | 0000 |
| Ana | mesero | 1111 |
| Luis | mesero | 2222 |
| Cocina | cocina | 3333 |
| Caja | caja | 4444 |

---

## Contrato de la API (Entrega 1)

Todas las respuestas son JSON. Errores: código HTTP 4xx/5xx con
`{ "error": "mensaje en español para mostrar al usuario" }`.
Todo excepto `GET /api/usuarios-login` y `POST /api/login` requiere sesión
(401 si no hay o no es válida; 403 si el rol no tiene permiso).

### Tipos
```ts
type Rol = 'mesero' | 'cocina' | 'caja' | 'dueno';
type MetodoPago = 'efectivo' | 'tarjeta' | 'transferencia';

interface Usuario { id: number; nombre: string; rol: Rol }

interface Producto {
  id: number; nombre: string; categoria: string; precio: number /* centavos */;
}

interface MesaResumen {
  id: number; nombre: string;
  orden_id: number | null;        // cuenta abierta, si hay
  mesero_id: number | null;       // quien abrió la cuenta (para "Tú" / "Mis mesas")
  mesero_nombre: string | null;
  total: number;                  // centavos, 0 si no hay cuenta
  abierta_en: string | null;      // ISO
}

interface ItemComanda {
  id: number; producto_id: number; nombre: string;
  precio: number; cantidad: number; nota: string | null;
}

interface Comanda {
  id: number; orden_id: number; mesa_nombre: string; mesero_nombre: string;
  estado: 'pendiente' | 'listo';
  creada: string; listo_en: string | null;
  items: ItemComanda[];
}

interface Pago {
  id: number; metodo: MetodoPago; monto: number; creado: string;
}

interface Orden {
  id: number; mesa_id: number; mesa_nombre: string;
  mesero_id: number; mesero_nombre: string;
  estado: 'abierta' | 'pagada';
  creada: string; pagada_en: string | null;
  comandas: Comanda[];
  subtotal: number;   // suma de items
  propina: number;    // centavos (0 hasta que se cobra)
  total: number;      // subtotal + propina
  pagos: Pago[];
}
```

### Endpoints
| Método y ruta | Roles | Cuerpo | Respuesta |
|---|---|---|---|
| `GET /api/usuarios-login` | público | — | `Usuario[]` (activos, para la pantalla de entrada) |
| `POST /api/login` | público | `{ usuario_id, pin }` | `{ token, usuario: Usuario }` (401 "PIN incorrecto") |
| `POST /api/logout` | todos | — | `{ ok: true }` |
| `GET /api/yo` | todos | — | `Usuario` |
| `GET /api/menu` | todos | — | `Producto[]` activos, ordenados por categoría y nombre |
| `GET /api/mesas` | mesero, caja, dueno | — | `MesaResumen[]` |
| `POST /api/ordenes` | mesero, dueno | `{ mesa_id }` | `Orden` — abre cuenta; si la mesa ya tiene una abierta, regresa esa |
| `GET /api/ordenes/:id` | mesero, caja, dueno | — | `Orden`. Mesero y caja solo ven cuentas **abiertas** o **cobradas hace ≤ 10 min**; fuera de eso 404 "No se encontró esa cuenta." (corte a ciegas). El dueño ve todas |
| `POST /api/ordenes/:id/comandas` | mesero, dueno | `{ items: [{ producto_id, cantidad, nota? }], envio_id? }` | `Orden` actualizada (crea una comanda nueva que llega a cocina). `envio_id` (UUID, ≤ 64): si ya existe en esa orden no crea nada y responde 200; si existe en otra orden, 409. Si la cuenta se cobró hace más de 10 min (mesero/caja), el reintento responde 409 "Esta cuenta ya fue cobrada." en vez de la orden |
| `GET /api/cocina` | cocina, dueno | — | `Comanda[]`: todas las pendientes (más antigua primero) + las listas de los últimos 30 min (más reciente primero) |
| `POST /api/comandas/:id/listo` | cocina, dueno | — | `Comanda` |
| `POST /api/comandas/:id/pendiente` | cocina, dueno | — | `Comanda` (por si se marcó lista por error) |
| `GET /api/caja/ordenes` | caja, dueno | — | `Orden[]` abiertas, más antigua primero |
| `POST /api/ordenes/:id/pagar` | caja, dueno | `{ propina, pagos: [{ metodo, monto }] }` | `Orden` pagada. Regla: la suma de `pagos[].monto` debe ser igual a `subtotal + propina` (400 si no). No se puede pagar una cuenta sin platillos ni una ya pagada. |
| `POST /api/ordenes/:id/cancelar` | mesero, caja, dueno | — | `{ ok: true }` — borra una cuenta **abierta y sin platillos** (mesa abierta por error). 409 si ya tiene platillos o ya se cobró; 404 si no existe |

Notas:
- Al enviar una comanda se copian `nombre` y `precio` del producto al item
  (si después cambia el precio en el menú, las cuentas viejas no cambian).
- `cantidad` entero ≥ 1; `nota` máx. 140 caracteres.
- Para efectivo, el monto registrado es lo que se cobra (no lo que el cliente
  entregó); el cambio lo calcula la pantalla.

## Pendientes conocidos (del probador, Entrega 1)
- ~~Ajustar el freno por IP de `worker/auth.ts`~~ **Resuelto en la Entrega 2 (servidor):**
  ahora solo cuentan los PIN realmente evaluados e incorrectos (un intento rechazado
  por el propio freno, por bloqueo del usuario o con PIN correcto no suma); el límite
  subió a 30 fallos por IP en 10 minutos; y todo 429 del login trae `retry_after`
  (segundos) en el cuerpo (y el encabezado `Retry-After`). **Pendiente de pantallas:**
  desactivar el teclado de PIN durante `retry_after` segundos.
  **Ajuste Entrega 2.1:** un usuario inexistente o inactivo ya no suma al freno por IP;
  el límite es de 50 fallos por IP en 10 minutos y al alcanzarlo la IP se bloquea solo
  3 minutos (`retry_after` ≈ 180); al terminar el bloqueo el contador baja a la mitad.
- Si la caja libera una cuenta vacía mientras el mesero la tiene abierta, el
  primer "Enviar a cocina" muestra "No se encontró esa cuenta" (el segundo
  intento funciona). Hay que mejorar ese mensaje.

---

## Contrato de la API (Entrega 2: corte de caja y propinas)

Decisiones de la persona:
- **Un solo corte al día.** El "día" es una **jornada**: la abre la caja
  capturando el **fondo de caja** y la cierra con el corte. Solo puede haber una
  jornada abierta a la vez.
- **No se puede cobrar sin jornada abierta** (`POST /api/ordenes/:id/pagar` →
  409 "Primero abre el día capturando el fondo de caja."). Cada cobro queda
  ligado a la jornada abierta en ese momento (`ordenes.jornada_id`). Mesero y
  cocina trabajan normal aunque no haya jornada abierta.
- **Salidas de efectivo** durante el día: monto + motivo + quién. Se pueden
  anular (por error de captura) mientras la jornada esté abierta; quedan
  registradas como anuladas.
- **Corte a ciegas:** la caja captura el conteo del efectivo **sin ver** cuánto
  debería haber. Ninguna respuesta a la caja revela totales de la jornada
  abierta. Después de cerrar, se muestra el corte completo.
- No se puede cerrar con cuentas abiertas (409 con la lista).
- **Propina por mesero**: se atribuye a `ordenes.mesero_id` (quien abrió la
  cuenta). Cuando una cuenta se pagó con varias formas, la propina se reparte
  entre las formas en proporción a cada monto (redondeo por el método del
  residuo mayor, para que la suma sea exacta al centavo).
- El dueño ve el historial de cortes. La caja solo puede ver el corte de la
  **última jornada cerrada** (para imprimirlo/revisarlo al terminar).

### Tipos nuevos
```ts
// Denominaciones en centavos, como texto (llaves de JSON):
// "100000","50000","20000","10000","5000","2000" (billetes)
// "1000","500","200","100","50" (monedas de $10, $5, $2, $1, 50¢)
type Conteo = Record<string, number>; // denominación → cantidad (entero ≥ 0)

interface Salida {
  id: number; monto: number; motivo: string;
  usuario_nombre: string; creada: string;
  anulada: boolean; anulada_por_nombre: string | null;
}

interface JornadaActual {            // lo que ve la caja: SIN totales
  id: number; abierta_en: string; abierta_por_nombre: string;
  fondo: number;
  salidas: Salida[];                 // incluye anuladas (marcadas)
  cuentas_abiertas: number;          // cuántas cuentas faltan por cobrar
}

interface PropinaMesero {
  mesero_id: number; nombre: string; cuentas: number; // cuentas con propina > 0
  total: number; efectivo: number; tarjeta: number; transferencia: number;
}
interface PropinaMesa {
  mesa_id: number; nombre: string; cuentas: number; total: number;
}

interface CuentaCorte {
  orden_id: number; mesa_nombre: string; mesero_nombre: string;
  pagada_en: string; cobrado_por_nombre: string;
  subtotal: number; propina: number; total: number;
  pagos: { metodo: MetodoPago; monto: number }[];
}

interface Corte {
  jornada: {
    id: number; estado: 'abierta' | 'cerrada';
    abierta_en: string; abierta_por_nombre: string;
    cerrada_en: string | null; cerrada_por_nombre: string | null;
    fondo: number;
  };
  ventas: {
    cuentas: number; subtotal: number; propinas: number; total: number;
    ticket_promedio: number;          // subtotal / cuentas, redondeado; 0 si no hay
  };
  por_metodo: { efectivo: number; tarjeta: number; transferencia: number }; // montos cobrados (incluyen propina)
  salidas: Salida[]; total_salidas: number;       // total sin anuladas
  efectivo: {
    fondo: number; cobrado: number; salidas: number;
    esperado: number;                 // fondo + cobrado − salidas
    contado: number | null;           // null si la jornada sigue abierta
    diferencia: number | null;        // contado − esperado (+ sobra, − falta)
    conteo: Conteo | null;
  };
  propinas_por_mesero: PropinaMesero[];   // mayor total primero
  propinas_por_mesa: PropinaMesa[];       // mayor total primero
  cuentas: CuentaCorte[];                 // más reciente primero
}

interface ReportePropinas {
  desde: string; hasta: string;           // 'AAAA-MM-DD', tal como se pidieron
  por_mesero: PropinaMesero[];
  por_mesa: PropinaMesa[];
  jornadas: number;                       // jornadas incluidas
  dias: number;                           // días distintos con corte (fecha de abierta_en, hora de Honduras)
  abiertas: number;                       // de esas jornadas, cuántas siguen abiertas
}

interface JornadaResumen {
  id: number; abierta_en: string; cerrada_en: string | null;
  cerrada_por_nombre: string | null;
  cuentas: number; total: number; propinas: number;
  diferencia: number | null;
}
```

### Endpoints nuevos
| Método y ruta | Roles | Cuerpo | Respuesta |
|---|---|---|---|
| `GET /api/jornada/actual` | caja, dueno | — | `{ jornada: JornadaActual \| null }` |
| `POST /api/jornada/abrir` | caja, dueno | `{ fondo }` (centavos ≥ 0) | `JornadaActual`. 409 si ya hay una abierta |
| `POST /api/jornada/salidas` | caja, dueno | `{ monto, motivo }` (monto > 0; motivo 1–80 caracteres) | `JornadaActual`. 409 si no hay jornada abierta |
| `POST /api/jornada/salidas/:id/anular` | caja, dueno | — | `JornadaActual`. Solo con la jornada de esa salida abierta |
| `POST /api/jornada/cerrar` | caja, dueno | `{ conteo: Conteo }` | `Corte` (cerrado). El servidor calcula `contado` a partir del conteo. 409 si no hay jornada abierta; 409 `{ error, cuentas_abiertas: [{ orden_id, mesa_nombre, total }] }` si hay cuentas abiertas |
| `GET /api/jornadas` | dueno | — | `JornadaResumen[]`, más reciente primero (máx. 90) |
| `GET /api/jornadas/ultima-cerrada` | caja, dueno | — | `Corte` de la jornada cerrada más reciente (aunque se haya cerrado desde otra computadora). 404 "Todavía no hay cortes." si no hay ninguna |
| `GET /api/jornadas/:id/corte` | dueno (cualquiera, incluso la abierta: corte parcial); caja (solo la última cerrada, 403 en otro caso) | — | `Corte` |
| `GET /api/reportes/propinas?desde=AAAA-MM-DD&hasta=AAAA-MM-DD` | dueno | — | `ReportePropinas`. Incluye jornadas cuya `abierta_en` (hora de Honduras, `America/Tegucigalpa`) cae en el rango; rango máx. 93 días |

## Pendientes menores (revisión final de la Entrega 2)
- `src/pantallas/Mesa.tsx:105-114`: si la caja **cancela** una cuenta vacía que el
  mesero tiene abierta, el aviso dice "Esta cuenta ya se cobró". Debe decir
  que se liberó. El envío siguiente sí funciona.
- `src/pantallas/TecladoPin.tsx`: el freno por IP desactiva solo el teclado del
  usuario que lo recibió; debería desactivar el de todos en ese aparato.
- A 1024 px, "12:48 p.m." se parte en dos líneas en el panel Día de la caja y en
  la columna de hora de las salidas del corte (`white-space: nowrap`).

---

## Entrega 3: el restaurante real y el panel del dueño

### Decisiones de la persona
- El restaurante es **El Lechón Playero**, en Omoa, Cortés (**Honduras**).
  Abre de viernes a domingo, de 9:00 am a 6:00 pm.
  - `APP_NOMBRE = 'El Lechón Playero'`.
  - **Moneda: lempiras**, con formato `L 1,234.50`. Todo sigue en centavos enteros.
  - **Zona horaria `America/Tegucigalpa`** (UTC−6 fijo, sin horario de verano). Reemplaza a `America/Mexico_City` en todo: reportes, pantallas y documentación. El desfase es el mismo, pero hay que cambiar nombres y textos.
  - Textos en español de Honduras/neutro. Usar "tajadas", "rice and beans", etc. como vienen en el menú.
- **Corte de caja en lempiras.** Denominaciones nuevas, en centavos y como texto:
  - Billetes: `"50000","20000","10000","5000","2000","1000","500","200","100"` (L500, L200, L100, L50, L20, L10, L5, L2, L1).
  - Monedas: `"50","20","10"` (50, 20 y 10 centavos).
  - Ya no existe la denominación L1,000. Las jornadas viejas de ejemplo se regeneran con el seed.
  - La tolerancia para mostrar "Cuadra ✓" sube a **menos de L1.00**, porque las monedas de centavos casi no circulan.
- **Menú real** en `seed/menu-lechon-playero.json`. Es la fuente de verdad del seed: 13 categorías, en ese orden.
- **Mesas:** "Mesa 1" a "Mesa 15". Se quitan las de ejemplo ("Barra 1/2").
- **Usuarios de ejemplo:** los 5 de siempre, con los mismos PIN.
- **Categorías** con `orden` y `va_a_cocina` (sí/no).
  - Los platillos de categorías que no van a cocina (Bebidas, Bar, Actividades) se envían igual y se cobran, pero **no aparecen en Cocina**.
  - Una comanda sin ningún platillo de cocina no se muestra en Cocina.
  - Al mesero, esos platillos le aparecen como "No va a cocina" en lugar de "En preparación" o "Listo".
  - `va_a_cocina` se copia a cada item al enviar, igual que el nombre y el precio.
- **Productos.** Cada producto puede tener:
  - `descripcion` (texto corto, opcional).
  - `variantes`: tamaños o porciones, cada una con nombre y precio propio. Si tiene variantes, el mesero **debe** elegir una, y el precio sale de la variante.
  - `opciones`: lista de textos. Si tiene opciones, el mesero **debe** elegir una. No cambian el precio. El item queda como "Mar y tierra (Camarón)".
  - `precio_abierto`: el precio se escribe al pedir (por ejemplo, la langosta según tamaño). Es obligatorio y > 0.
  - `agotado`: se muestra al mesero tachado y no se puede pedir.
  - `activo`: "eliminar" desde el panel lo desactiva. Nunca se borra, para conservar el historial.
  - `es_pasadia`.
- **Pasadía (consumo mínimo).**
  - Los items `es_pasadia` (L300 por persona) suman `pasadia`. Todos los demás items suman `consumo`.
  - `subtotal = max(consumo, pasadia)`, y la propina se calcula sobre ese subtotal.
  - Si en la cuenta hay pasadía y el consumo es menor, la cuenta muestra: "Pasadía L1,200.00 · Consumo L900.00 → se cobra L1,200.00".
  - Si el consumo es mayor: "Consumo L1,500.00 (incluye pasadía de L1,200.00)".
  - En el corte, las ventas usan el `subtotal` de cada cuenta.
- **El panel del dueño** (solo `dueno`) administra el menú, las mesas y los usuarios.
  - **Agotado / disponible** también lo pueden cambiar `cocina` y `caja`, para no tener que llamar al dueño.
- **Cambiar precios o nombres no altera cuentas ni cortes existentes.** Los items ya guardan su nombre y precio.
- **Usuarios.**
  - El PIN es de 4 dígitos.
  - No se puede desactivar ni quitar el rol al último dueño activo, ni a uno mismo.
  - Cambiar el PIN, el rol o desactivar a alguien **cierra sus sesiones abiertas**.
  - Los nombres de usuario activos no se repiten (sin distinguir mayúsculas ni acentos).
- **Mesas:** no se puede desactivar una mesa con cuenta abierta. Los nombres activos no se repiten.

### Cambios a tipos existentes
```ts
interface Variante { id: number; nombre: string; precio: number }

interface Producto {
  id: number; categoria_id: number; categoria: string;   // nombre, por compatibilidad
  nombre: string; descripcion: string | null;
  precio: number | null;        // null si tiene variantes o precio_abierto
  precio_abierto: boolean;
  variantes: Variante[];        // [] si no tiene
  opciones: string[];           // [] si no tiene
  agotado: boolean;
  es_pasadia: boolean;
}

interface CategoriaMenu {
  id: number; nombre: string; orden: number; va_a_cocina: boolean;
  productos: Producto[];        // activos, en su orden
}

interface ItemComanda {           // se agregan campos
  id: number; producto_id: number;
  nombre: string;               // ya compuesto: "Pescado rojo · Talla 3", "Mar y tierra (Camarón)"
  variante: string | null; opcion: string | null;
  precio: number; cantidad: number; nota: string | null;
  va_a_cocina: boolean; es_pasadia: boolean;
}

interface Orden {                 // se agregan campos
  // ...lo de antes...
  consumo: number;              // suma de items que no son pasadía
  pasadia: number;              // suma de items de pasadía
  subtotal: number;             // max(consumo, pasadia)
}
// MesaResumen.total = subtotal de la cuenta abierta (ya con la regla del pasadía).
// Comanda (en GET /api/cocina) trae solo los items con va_a_cocina = true.
```

### Endpoints que cambian
| Método y ruta | Cambio |
|---|---|
| `GET /api/menu` | Ahora responde `{ categorias: CategoriaMenu[] }`, con categorías activas en su `orden`. Incluye productos agotados (marcados), no los inactivos. |
| `POST /api/ordenes/:id/comandas` | Cada item: `{ producto_id, variante_id?, opcion?, precio?, cantidad, nota? }`. Responde 400 con un mensaje claro si falta la variante u opción, si sobra o no corresponde, si falta el precio abierto o si el producto está agotado o inactivo ("Se agotó: King crab. Quítalo del pedido."). |
| `POST /api/ordenes/:id/pagar` | La suma de pagos debe ser `subtotal + propina`, con el nuevo `subtotal`. |
| `POST /api/jornada/cerrar` | Usa las denominaciones nuevas. |

### Endpoints nuevos
| Método y ruta | Roles | Cuerpo | Respuesta |
|---|---|---|---|
| `GET /api/admin/menu` | dueno | — | `{ categorias: (CategoriaMenu & { activa: boolean; productos: (Producto & { activo: boolean; orden: number })[] })[] }`. Incluye inactivos. |
| `POST /api/admin/categorias` | dueno | `{ nombre, va_a_cocina }` | categoría creada, al final del orden |
| `PUT /api/admin/categorias/:id` | dueno | `{ nombre?, va_a_cocina?, activa? }` | categoría |
| `POST /api/admin/categorias/orden` | dueno | `{ ids: number[] }` (todas, en el nuevo orden) | `{ ok: true }` |
| `POST /api/admin/productos` | dueno | `{ categoria_id, nombre, descripcion?, precio?, precio_abierto?, variantes?: {nombre, precio}[], opciones?: string[], es_pasadia? }` | producto |
| `PUT /api/admin/productos/:id` | dueno | los mismos campos, opcionales, más `activo?`. `variantes` reemplaza la lista completa; las variantes se identifican por `id` si lo traen. | producto |
| `POST /api/admin/productos/orden` | dueno | `{ categoria_id, ids: number[] }` | `{ ok: true }` |
| `POST /api/productos/:id/agotado` | dueno, cocina, caja | `{ agotado: boolean }` | producto |
| `GET /api/admin/mesas` | dueno | — | `{ id, nombre, activa, orden, tiene_cuenta_abierta }[]` |
| `POST /api/admin/mesas` | dueno | `{ nombre }` | mesa |
| `PUT /api/admin/mesas/:id` | dueno | `{ nombre?, activa? }` | mesa (409 si se desactiva con cuenta abierta) |
| `GET /api/admin/usuarios` | dueno | — | `{ id, nombre, rol, activo, sesiones_abiertas: number }[]` |
| `POST /api/admin/usuarios` | dueno | `{ nombre, rol, pin }` | usuario |
| `PUT /api/admin/usuarios/:id` | dueno | `{ nombre?, rol?, activo? }` | usuario |
| `POST /api/admin/usuarios/:id/pin` | dueno | `{ pin }` | `{ ok: true }` (cierra las sesiones de ese usuario) |

Validaciones:
- Nombres de 1 a 60 caracteres.
- Descripción de hasta 140 caracteres.
- Precios enteros entre 1 y 100,000,000.
- De 0 a 12 variantes y de 0 a 12 opciones.
- Un producto no puede tener precio fijo junto con variantes o precio abierto. Debe tener exactamente una de las tres formas de precio.

### Pendientes de la Entrega 2 que se arreglan aquí
Ver "Pendientes menores (revisión final de la Entrega 2)" más arriba.

## Pendientes menores (revisión final de la Entrega 3)
- `src/pedidos.ts:261,303`: si el dueño cambia la forma de precio de un producto
  (fijo → tamaños o → a consultar) con un pedido sin enviar, la línea no se
  marca. El servidor responde 400 y hay que quitar la línea y volver a agregarla.
- `src/pantallas/Mesa.tsx:275` y `src/menu.ts:25-36`: la recarga del menú antes
  de enviar puede reutilizar una carga que ya iba en camino. En una ventana muy
  corta, un precio recién cambiado se cobra sin aviso.
- "Propinas por mesa" muestra mesas con "0 cuentas L 0.00" (cuentas cobradas sin
  propina). Conviene ocultarlas o poner "sin propina".
- Con pasadía, el botón "Enviar" muestra la suma de las líneas y no lo que se
  cobrará. Es correcto según el diseño, pero puede confundir al mesero.
