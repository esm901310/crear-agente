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
- Antes de publicar (Entrega 4): ajustar el freno por IP de `worker/auth.ts`.
  Hoy un PIN correcto que el freno rechaza también cuenta como fallo, y como
  todas las tablets del restaurante salen por la misma IP, se podría bloquear
  el acceso de todos por 10 minutos. También conviene desactivar el teclado de
  PIN mientras dura el bloqueo de un usuario.
- Si la caja libera una cuenta vacía mientras el mesero la tiene abierta, el
  primer "Enviar a cocina" muestra "No se encontró esa cuenta" (el segundo
  intento funciona). Hay que mejorar ese mensaje.
