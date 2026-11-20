# Datos y API — Entrega 1

Complementa el contrato de `docs/proyecto.md` (que manda). Aquí está cómo
quedó implementado: estructura de la base de datos, cada dirección con
ejemplos, códigos de error y detalles que las pantallas deben conocer.

Código: `worker/` (Cloudflare Worker, TypeScript, sin frameworks).
Base de datos: D1, migración en `migrations/0001_inicial.sql`.

---

## 1. Estructura de datos

Dinero en **centavos enteros**. Fechas en texto ISO UTC (`2026-11-20T18:30:00.000Z`).

| Tabla | Campos principales | Notas |
|---|---|---|
| `usuarios` | id, nombre, rol, pin_hash, pin_sal, activo, intentos_fallidos, bloqueado_hasta | PIN = SHA-256(sal + pin). Freno: 5 PIN erróneos seguidos → bloqueado 1 min. |
| `sesiones` | id, token_hash, usuario_id, creada, expira | Se guarda el SHA-256 del token, no el token. Duran 16 h. |
| `mesas` | id, nombre (único), activo | |
| `productos` | id, nombre, categoria, precio, activo | |
| `ordenes` | id, mesa_id, mesero_id, estado (`abierta`/`pagada`), propina, creada, pagada_en, cobrado_por | **Una sola orden abierta por mesa** (índice único parcial). `mesero_id` = quien abrió la cuenta. `cobrado_por` = usuario de caja que cobró. |
| `comandas` | id, orden_id, estado (`pendiente`/`listo`), creada, listo_en | Cada envío a cocina. |
| `items` | id, comanda_id, producto_id, nombre, precio, cantidad, nota | nombre y precio **copiados** del menú al enviar. |
| `pagos` | id, orden_id, metodo, monto, creado | metodo: `efectivo`/`tarjeta`/`transferencia`; monto > 0. |

Reglas que además protege la propia base de datos (triggers), por si dos
personas actúan al mismo tiempo:
- No se insertan comandas ni pagos en una orden que no está abierta.
- Una orden solo pasa a `pagada` si tiene platillos y la suma de pagos = subtotal + propina.
- Una orden pagada no se puede reabrir.

Subtotal de una orden = suma de `precio × cantidad` de todos sus items
(incluye comandas pendientes y listas).

---

## 2. Reglas generales de la API

- Base: `/api`. En desarrollo: `http://localhost:8787/api` (Vite redirige `/api` ahí).
- Enviar `Content-Type: application/json` en los POST con cuerpo.
- Sesión: encabezado `Authorization: Bearer <token>` (token de 64 caracteres hex).
- Todas las respuestas son JSON. Errores: `{ "error": "mensaje para mostrar" }`.

| Código | Cuándo |
|---|---|
| 200 | OK |
| 201 | Se creó algo (orden nueva, comanda nueva). Cuerpo igual que en 200. |
| 400 | Datos inválidos (el mensaje dice qué corregir) |
| 401 | Sin sesión / sesión vencida / PIN incorrecto → mandar a la pantalla de entrada (excepto en login, donde se muestra "PIN incorrecto") |
| 403 | El rol no tiene permiso |
| 404 | No existe (mesa, cuenta, comanda, ruta) |
| 405 | Método equivocado para una ruta que sí existe |
| 409 | Conflicto: la cuenta ya fue cobrada, o cambió mientras se cobraba |
| 413 | Cuerpo de más de 32 KB |
| 429 | Demasiados PIN incorrectos: esperar 1 minuto |
| 500 | Error inesperado del servidor |

El rol `dueno` puede usar todas las direcciones.

---

## 3. Direcciones

### `GET /api/usuarios-login` — público
Usuarios activos para la pantalla de entrada (ordenados por id).
```json
[{"id":1,"nombre":"Dueño","rol":"dueno"},{"id":2,"nombre":"Ana","rol":"mesero"}, ...]
```

### `POST /api/login` — público
Cuerpo: `{ "usuario_id": 2, "pin": "1111" }` — `pin` es **texto** de 4 dígitos (conserva ceros: `"0000"`).
```json
{"token":"5d74…c8e2","usuario":{"id":2,"nombre":"Ana","rol":"mesero"}}
```
Errores: 400 "El PIN debe tener 4 dígitos." · 401 "PIN incorrecto" · 429 "Demasiados intentos…".

### `POST /api/logout` — todos
Borra la sesión. Respuesta `{ "ok": true }`.

### `GET /api/yo` — todos
`{"id":2,"nombre":"Ana","rol":"mesero"}` (útil al recargar la página para validar el token guardado).

### `GET /api/menu` — todos
Productos activos ordenados por categoría y nombre.
```json
[{"id":18,"nombre":"Agua de horchata","categoria":"Bebidas","precio":3500}, ...]
```
Categorías del ejemplo: Bebidas, Entradas, Platos fuertes, Postres, Tacos
(el orden alfabético es el del servidor; si las pantallas quieren otro orden de pestañas, lo deciden ellas).

### `GET /api/mesas` — mesero, caja, dueno
Mesas activas (ordenadas por id) con su cuenta abierta, si hay.
```json
[
  {"id":1,"nombre":"Mesa 1","orden_id":null,"mesero_nombre":null,"total":0,"abierta_en":null},
  {"id":3,"nombre":"Mesa 3","orden_id":1,"mesero_nombre":"Ana","total":32050,"abierta_en":"2026-11-20T01:37:12.519Z"}
]
```
`total` aquí es el subtotal de los platillos (aún sin propina).

### `POST /api/ordenes` — mesero, dueno
Cuerpo: `{ "mesa_id": 3 }`. Abre la cuenta de la mesa; si ya tenía una abierta,
regresa esa (201 si se creó, 200 si ya existía). Respuesta: `Orden`.
Cualquier mesero puede abrir/agregar a cualquier mesa (cubrirse entre ellos);
`mesero_nombre` es quien la abrió.
Errores: 400 "Elige una mesa." · 404 "No se encontró esa mesa."

### `GET /api/ordenes/:id` — mesero, caja, dueno
Respuesta: `Orden` (ver ejemplo abajo). 404 si no existe.

### `POST /api/ordenes/:id/comandas` — mesero, dueno
```json
{ "items": [
  { "producto_id": 6, "cantidad": 2, "nota": "sin cebolla" },
  { "producto_id": 18, "cantidad": 3 }
] }
```
- 1 a 50 renglones; `cantidad` entero 1–99; `nota` opcional, texto ≤ 140 caracteres
  (se recortan espacios; vacía → `null`).
- Responde la `Orden` actualizada (201) con la nueva comanda al final de `comandas`.
- Errores: 400 (datos, o "Uno de los platillos ya no está disponible…") · 404 · 409 "Esta cuenta ya fue cobrada."

### `GET /api/cocina` — cocina, dueno
`Comanda[]`: primero todas las `pendiente` (más antigua primero), luego las
`listo` de los últimos 30 minutos (más reciente primero).
```json
[{"id":2,"orden_id":1,"mesa_nombre":"Mesa 3","mesero_nombre":"Ana","estado":"pendiente",
  "creada":"2026-11-20T01:37:12.602Z","listo_en":null,
  "items":[{"id":3,"producto_id":27,"nombre":"Arroz con leche","precio":4550,"cantidad":1,"nota":null}]}]
```

### `POST /api/comandas/:id/listo` — cocina, dueno
### `POST /api/comandas/:id/pendiente` — cocina, dueno
Sin cuerpo. Responden la `Comanda`. Repetirlas no hace daño (si ya estaba en ese
estado, regresa la comanda sin cambios). 404 si no existe.

### `GET /api/caja/ordenes` — caja, dueno
`Orden[]` abiertas, la más antigua primero (incluye cuentas sin platillos aún).

### `POST /api/ordenes/:id/pagar` — caja, dueno
```json
{ "propina": 5000,
  "pagos": [ { "metodo": "efectivo", "monto": 20000 }, { "metodo": "tarjeta", "monto": 17050 } ] }
```
- `propina` entero ≥ 0 (si se omite, 0). `pagos`: 1 a 10; `metodo` válido; `monto` entero > 0.
- La suma de montos debe ser **exactamente** `subtotal + propina`.
- Efectivo: se registra lo que se cobra, no lo que entregó el cliente.
- Se guarda todo junto o nada (transacción). La mesa queda libre al instante.
- Respuesta: `Orden` con `estado: "pagada"`, `pagada_en`, `propina`, `total` y `pagos`.
- Errores:
  - 400 "Los pagos suman $100.00 pero el total con propina es $370.50. Deben ser iguales."
  - 400 "No se puede cobrar una cuenta sin platillos."
  - 400 propina/método/monto inválidos
  - 409 "Esta cuenta ya fue cobrada."
  - 409 "La cuenta cambió mientras se cobraba…" (un mesero agregó platillos justo en ese momento: recargar la cuenta)

### Ejemplo de `Orden` (pagada)
```json
{"id":1,"mesa_id":3,"mesa_nombre":"Mesa 3","mesero_id":2,"mesero_nombre":"Ana",
 "estado":"pagada","creada":"2026-11-20T01:37:12.519Z","pagada_en":"2026-11-20T01:37:12.881Z",
 "comandas":[
   {"id":1,"orden_id":1,"mesa_nombre":"Mesa 3","mesero_nombre":"Ana","estado":"listo",
    "creada":"2026-11-20T01:37:12.585Z","listo_en":"2026-11-20T01:37:12.744Z",
    "items":[
      {"id":1,"producto_id":6,"nombre":"Tacos al pastor (orden de 4)","precio":8500,"cantidad":2,"nota":"sin cebolla"},
      {"id":2,"producto_id":18,"nombre":"Agua de horchata","precio":3500,"cantidad":3,"nota":null}]},
   {"id":2,"orden_id":1,"mesa_nombre":"Mesa 3","mesero_nombre":"Ana","estado":"pendiente",
    "creada":"2026-11-20T01:37:12.602Z","listo_en":null,
    "items":[{"id":3,"producto_id":27,"nombre":"Arroz con leche","precio":4550,"cantidad":1,"nota":null}]}],
 "subtotal":32050,"propina":5000,"total":37050,
 "pagos":[{"id":1,"metodo":"efectivo","monto":20000,"creado":"2026-11-20T01:37:12.881Z"},
          {"id":2,"metodo":"tarjeta","monto":17050,"creado":"2026-11-20T01:37:12.881Z"}]}
```

---

## 4. Datos de ejemplo (`npm run db:seed`)

- Usuarios: Dueño 0000 · Ana 1111 · Luis 2222 · Cocina 3333 · Caja 4444.
- Mesas: Mesa 1 … Mesa 10, Barra 1, Barra 2 (ids 1–12).
- 27 productos en Entradas, Tacos, Platos fuertes, Bebidas y Postres.
- `db:seed` **borra** todas las cuentas, sesiones y datos y vuelve a cargar el ejemplo.
