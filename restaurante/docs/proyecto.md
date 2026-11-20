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
- Dinero: siempre en **centavos enteros** (ej. $85.50 = 8550). Moneda: pesos MXN.
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
| `GET /api/ordenes/:id` | mesero, caja, dueno | — | `Orden` |
| `POST /api/ordenes/:id/comandas` | mesero, dueno | `{ items: [{ producto_id, cantidad, nota? }], envio_id? }` | `Orden` actualizada (crea una comanda nueva que llega a cocina). `envio_id` (UUID, ≤ 64): si ya existe en esa orden no crea nada y responde 200; si existe en otra orden, 409 |
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
| `GET /api/reportes/propinas?desde=AAAA-MM-DD&hasta=AAAA-MM-DD` | dueno | — | `{ desde, hasta, por_mesero: PropinaMesero[], por_mesa: PropinaMesa[], jornadas: number }`. Incluye jornadas cuya `abierta_en` (hora de México, `America/Mexico_City`) cae en el rango; rango máx. 93 días |
