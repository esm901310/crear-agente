# Diseño de pantallas — Entrega 1

> Especificación para el programador de pantallas (Vite + React + TypeScript, CSS simple).
> Basada en `docs/proyecto.md` (roles, API y reglas). Si algo aquí contradice ese
> documento, manda `proyecto.md`.

---

## 0. Principios

1. **Rápido antes que bonito.** Cada acción frecuente se hace en 1 toque. Nada de
   confirmaciones salvo cuando se pierde información.
2. **Grande y legible.** Botones táctiles mínimo 48 px, normalmente 56 px. Texto
   base 18 px en tablet.
3. **El color nunca va solo.** Todo estado con color lleva también texto o ícono
   ("Libre", "Lleva 14 min", "Listo ✓").
4. **Siempre se sabe qué pasa.** Cargando, guardado, error y sin conexión se ven
   claramente.
5. **Textos cortos en español de México**, de tú, amables y sin tecnicismos.

### Nombre de la app
El nombre provisional es **"Comandas"**. Debe vivir en **un solo lugar**:

```ts
// src/config.ts
export const APP_NOMBRE = 'Comandas';
```

Se usa en la pantalla de entrada, en el encabezado y en `document.title`
(asignarlo al iniciar la app; en `index.html` dejar `<title>Comandas</title>` como
respaldo con un comentario que diga que el nombre real está en `src/config.ts`).

---

## 1. Mapa de pantallas y flujo

| # | Pantalla | Ruta sugerida | Quién la usa | Dispositivo |
|---|---|---|---|---|
| P1 | Entrada: elegir nombre | `/entrar` | todos | cualquiera |
| P2 | Entrada: PIN | `/entrar` (paso 2) | todos | cualquiera |
| P3 | Elegir vista | `/inicio` | dueno | cualquiera |
| M1 | Mesas | `/mesas` | mesero, dueno | tablet |
| M2 | Mesa (menú + pedido) | `/mesas/:mesaId` | mesero, dueno | tablet |
| K1 | Cocina | `/cocina` | cocina, dueno | tablet fija |
| C1 | Caja | `/caja` (y `/caja/:ordenId`) | caja, dueno | computadora |

```
                 ┌──────────────┐  toca su nombre  ┌──────────┐
  abrir app ───► │ P1 Nombres   │ ───────────────► │ P2 PIN   │
                 └──────────────┘ ◄─── "Cambiar" ─ └────┬─────┘
                        ▲                               │ 4 dígitos correctos
                        │ "Salir" (desde cualquier      │
                        │  pantalla) o sesión vencida   ▼
                        │               ┌──────── según rol ────────┐
                        │               │           │        │      │
                        │            mesero      cocina    caja   dueno
                        │               │           │        │      │
                        │               ▼           ▼        ▼      ▼
                        │          M1 Mesas    K1 Cocina  C1 Caja  P3 Elegir vista
                        │           │    ▲                          │  │  │
                        │  toca mesa│    │"← Mesas" o               │  │  └─► C1
                        │           ▼    │ tras enviar*             │  └────► K1
                        │          M2 Mesa                          └───────► M1
                        │
   * Tras "Enviar a cocina" el mesero se queda en M2 (ve la confirmación) y
     regresa con "← Mesas". No se le saca de la pantalla automáticamente.
```

- Si al abrir la app ya hay token en `localStorage`, se llama `GET /api/yo`:
  si responde, se va directo a la pantalla de su rol; si da 401, se borra el token
  y se muestra P1.
- Si un usuario abre una ruta que no le toca (ej. mesero en `/caja`), se le manda
  a su pantalla inicial sin mensaje.
- El dueño, en el encabezado, tiene además el botón **"Cambiar vista"** que lo
  regresa a P3.
- Cualquier respuesta 401 en cualquier momento → borrar token, ir a P1 y mostrar
  el aviso: **"Tu sesión terminó. Vuelve a entrar."**

---

## 2. Sistema visual

### 2.1 Colores

Paleta cálida (crema, café y terracota), con verde/ámbar/rojo para estados.
Todas las combinaciones de texto indicadas cumplen contraste AA (≥ 4.5:1).

| Token (variable CSS) | Hex | Uso |
|---|---|---|
| `--c-fondo` | `#FBF7F2` | Fondo general (crema) |
| `--c-superficie` | `#FFFFFF` | Tarjetas, paneles, campos |
| `--c-superficie-2` | `#F3ECE3` | Zonas secundarias, botones neutros, fila seleccionada suave |
| `--c-borde` | `#E2D6C8` | Bordes y divisores |
| `--c-texto` | `#2B2118` | Texto principal (café casi negro) |
| `--c-texto-2` | `#6B5B4E` | Texto secundario, etiquetas |
| `--c-primario` | `#B8441F` | Botón principal, pestaña activa, enlaces (terracota) |
| `--c-primario-hover` | `#9A3818` | Hover / presionado del primario |
| `--c-primario-suave` | `#FBE9E1` | Fondo de elemento seleccionado (pestaña, mesa elegida) |
| `--c-sobre-primario` | `#FFFFFF` | Texto sobre primario, verde o rojo |
| `--c-ok` | `#2E7D32` | Listo, libre, cobro correcto |
| `--c-ok-suave` | `#E7F4E8` | Fondo de "Libre" / "Listo" |
| `--c-alerta` | `#B45309` | Texto ámbar (espera media, "En preparación") |
| `--c-alerta-borde` | `#F59E0B` | Borde ámbar |
| `--c-alerta-suave` | `#FEF3C7` | Fondo ámbar |
| `--c-peligro` | `#B91C1C` | Texto/borde rojo (espera larga, errores) |
| `--c-peligro-suave` | `#FEE2E2` | Fondo rojo suave |
| `--c-oscuro` | `#2B2118` | Fondo de toasts y del aviso "Sin conexión" |
| `--c-foco` | `#1D4ED8` | Anillo de foco de teclado (3 px) |

Botones deshabilitados: fondo `#E2D6C8`, texto `#8A7B6E`, sin sombra, cursor
`not-allowed`.

### 2.2 Tipografía

Fuente del sistema:

```css
font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
font-variant-numeric: tabular-nums; /* en precios, totales y tiempos */
```

| Token | Tamaño / alto de línea | Peso | Uso |
|---|---|---|---|
| `--t-xs` | 14 / 20 px | 500 | Notas pequeñas, ayudas (mínimo absoluto) |
| `--t-s` | 16 / 24 px | 400 | Texto base en Caja (computadora) |
| `--t-m` | 18 / 26 px | 400 | Texto base en tablet (Meseros) |
| `--t-l` | 20 / 28 px | 600 | Nombres de platillos, filas de pedido |
| `--t-xl` | 24 / 32 px | 700 | Títulos de pantalla, nombre de mesa, items en Cocina |
| `--t-2xl` | 32 / 40 px | 700 | Totales, encabezado de comanda en Cocina |
| `--t-3xl` | 44 / 52 px | 800 | Tiempo transcurrido en Cocina, total a cobrar, cambio |
| `--t-4xl` | 56 / 64 px | 800 | Puntos del PIN y dígitos del teclado |

### 2.3 Espaciado, radios y sombras

- Escala de espaciado (múltiplos de 4): `4, 8, 12, 16, 24, 32, 48` px
  (`--e-1` … `--e-7`). Separación entre botones táctiles: mínimo **12 px**.
- Márgenes de pantalla: 16 px en vertical, 24 px en horizontal / computadora.
- Radios: `--r-s: 8px` (campos, chips), `--r-m: 12px` (botones, tarjetas),
  `--r-l: 16px` (paneles, tarjetas de comanda), `--r-full: 999px` (insignias).
- Sombra de tarjeta: `0 1px 2px rgba(43,33,24,.08), 0 2px 8px rgba(43,33,24,.06)`.
- Tamaños táctiles: **mínimo 48 px**; botones normales de tablet **56 px**;
  botones principales ("Enviar a cocina", "Listo", "Cobrar") **64–72 px** de alto.

### 2.4 Componentes base

| Componente | Especificación |
|---|---|
| Botón primario | Fondo `--c-primario`, texto blanco, 56 px alto, `--t-l` 600, radio 12, padding horizontal 24. Presionado: `--c-primario-hover` y escala 0.98. |
| Botón secundario | Fondo `--c-superficie`, borde 2 px `--c-borde`, texto `--c-texto`. |
| Botón de éxito | Fondo `--c-ok`, texto blanco (solo "Listo" en Cocina). |
| Botón de texto | Sin fondo, texto `--c-primario`, subrayado al hover. Área táctil 48 px igual. |
| Chip | 48 px alto, radio 999, borde `--c-borde`; seleccionado: fondo `--c-primario-suave`, borde y texto `--c-primario`. |
| Insignia (badge) | Radio 999, `--t-xs` 700, padding 4×10. Variantes: ok (verde suave + texto verde), alerta (ámbar suave + `--c-alerta`), peligro (rojo suave + `--c-peligro`). |
| Campo de texto | 56 px alto (48 en Caja), borde 2 px `--c-borde`, radio 8, foco con borde `--c-primario` + anillo `--c-foco`. Etiqueta arriba, `--t-s` 600. |
| Toast | Abajo al centro, fondo `--c-oscuro`, texto blanco `--t-l`, radio 12, 16×24 padding, dura 3 s (5 s si trae botón "Deshacer"). Máximo 1 a la vez (el nuevo reemplaza al anterior). |
| Diálogo | Centrado, máx. 480 px, fondo blanco, radio 16, capa detrás `rgba(43,33,24,.5)`. Botones abajo: secundario a la izquierda, principal a la derecha. |
| Spinner | Círculo de 32 px, borde 4 px `--c-borde` con un tramo `--c-primario`, girando. |

Íconos: usar caracteres de texto simples (← ✓ ✕ + − ✎ ⏱) para no agregar
librerías.

### 2.5 Encabezado común

Aparece en todas las pantallas excepto P1/P2. Alto **64 px**, fondo
`--c-superficie`, borde inferior 1 px `--c-borde`, fijo arriba.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [← Mesas]  Comandas · Mesas            Ana · Mesera   [Cambiar vista] [Salir] │
└──────────────────────────────────────────────────────────────────────────┘
```

- Izquierda: botón de regreso si aplica (solo en M2: "← Mesas"), luego
  `APP_NOMBRE` en `--t-l` 700 y, tras un punto medio, el nombre de la vista
  ("Mesas", "Mesa 4", "Cocina", "Caja").
- Derecha: nombre del usuario y rol en `--t-s` `--c-texto-2`, ej. "Ana · Mesero"
  (roles mostrados como "Mesero", "Cocina", "Caja", "Dueño").
- "Cambiar vista": solo para el dueño, botón secundario.
- "Salir": botón secundario, 48 px. Llama `POST /api/logout`, borra el token y
  va a P1 (aunque el logout falle). Si el mesero tiene un pedido sin enviar, primero
  pregunta (ver M2).

---

## 3. Formatos

- **Dinero:** `$1,234.50` — siempre con 2 decimales. Convertir desde centavos:
  ```ts
  const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
  export const dinero = (centavos: number) => fmt.format(centavos / 100); // "$1,234.50"
  ```
- **Hora:** hora local corta, ej. `2:35 p.m.`
  (`toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })`).
- **Tiempo transcurrido:** `menos de 1 min`, `5 min`, `1 h 12 min`. Se recalcula
  cada 30 s en pantalla (no hace falta pedirlo al servidor).
- **Cantidades:** `2×` antes del nombre del platillo: `2× Tacos al pastor`.

---

## 4. Estados globales (todas las pantallas)

| Situación | Qué se ve |
|---|---|
| Carga inicial de una pantalla | Spinner centrado + texto "Cargando…" debajo (`--t-m`, `--c-texto-2`). Solo la primera vez; las actualizaciones cada 3 s son silenciosas. |
| Sin conexión (2 consultas seguidas fallan por red) | Barra fija debajo del encabezado, 48 px, fondo `--c-oscuro`, texto blanco: **"Sin conexión. Reintentando…"** con spinner pequeño. Se mantienen los últimos datos en pantalla. Al volver: la barra cambia a verde `--c-ok` con "Conexión recuperada ✓" por 2 s y desaparece. |
| Error del servidor en una acción (4xx/5xx con `error`) | Toast con el texto del campo `error` del servidor. Si no hay texto: "Algo salió mal. Intenta de nuevo." |
| Acción en curso (enviar, marcar listo, cobrar) | El botón muestra spinner y el texto en gerundio ("Enviando…", "Cobrando…"), queda deshabilitado para evitar doble toque. |
| Sesión vencida (401) | Ver sección 1. |
| Sin permiso (403) | Mandar a la pantalla inicial del rol. |

---

## 5. P1 — Entrada: elegir nombre

**Para qué:** que cada persona elija quién es sin escribir.
**Datos:** `GET /api/usuarios-login`.

Elementos de arriba hacia abajo (centrado, ancho máx. 720 px):
1. `APP_NOMBRE` en `--t-3xl`, color `--c-primario`.
2. Texto "¿Quién eres?" en `--t-xl`.
3. Cuadrícula de tarjetas de usuario: 3 columnas en horizontal, 2 en vertical;
   cada tarjeta 120 px de alto, mínimo 200 px de ancho. Contenido: círculo de
   56 px con la inicial (fondo `--c-primario-suave`, letra `--c-primario`),
   nombre en `--t-xl`, rol debajo en `--t-s` `--c-texto-2` ("Mesero", "Cocina",
   "Caja", "Dueño").
   Orden: como venga del servidor.
4. Si venía de sesión vencida: aviso arriba de la cuadrícula en caja ámbar
   (`--c-alerta-suave`, borde `--c-alerta-borde`): "Tu sesión terminó. Vuelve a entrar."

```
┌────────────────────────────────────────────────────┐
│                     Comandas                       │
│                   ¿Quién eres?                     │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐│
│  │   (D)        │ │   (A)        │ │   (L)        ││
│  │   Dueño      │ │   Ana        │ │   Luis       ││
│  │   Dueño      │ │   Mesero     │ │   Mesero     ││
│  └──────────────┘ └──────────────┘ └──────────────┘│
│  ┌──────────────┐ ┌──────────────┐                 │
│  │   (C)        │ │   (C)        │                 │
│  │   Cocina     │ │   Caja       │                 │
│  │   Cocina     │ │   Caja       │                 │
│  └──────────────┘ └──────────────┘                 │
└────────────────────────────────────────────────────┘
```

**Estados:**
- Cargando: spinner + "Cargando…".
- Error al cargar: "No pudimos cargar los nombres. Revisa la conexión." + botón
  primario "Reintentar".
- Lista vacía: "No hay usuarios registrados. Pide ayuda al dueño."

---

## 6. P2 — Entrada: PIN

**Para qué:** confirmar la identidad con 4 dígitos.
**Acción:** `POST /api/login { usuario_id, pin }`.

Elementos de arriba hacia abajo (centrado, ancho máx. 400 px):
1. Botón de texto "← Cambiar" (vuelve a P1).
2. Inicial en círculo de 72 px + "Hola, Ana" en `--t-xl`.
3. "Escribe tu PIN" en `--t-m` `--c-texto-2`.
4. **4 puntos** del PIN: círculos de 24 px separados 24 px; vacíos = borde 2 px
   `--c-texto-2`; llenos = relleno `--c-texto`. Nunca se muestran los números.
5. Mensaje de error (espacio reservado de 28 px para que nada brinque).
6. **Teclado numérico** 3×4: `1 2 3 / 4 5 6 / 7 8 9 / [vacío] 0 ⌫`.
   Cada tecla **88×88 px** (mínimo 72 si no cabe en vertical), separación 16 px,
   número en `--t-4xl` 600 (la tecla ⌫ en `--t-2xl`), fondo `--c-superficie`,
   borde 2 px `--c-borde`, radio 16. Al presionar: fondo `--c-superficie-2`.
   La tecla ⌫ tiene `aria-label="Borrar"`.

```
        ← Cambiar

           (A)
        Hola, Ana
      Escribe tu PIN

       ●   ●   ○   ○

   ┌─────┐ ┌─────┐ ┌─────┐
   │  1  │ │  2  │ │  3  │
   └─────┘ └─────┘ └─────┘
   ┌─────┐ ┌─────┐ ┌─────┐
   │  4  │ │  5  │ │  6  │
   └─────┘ └─────┘ └─────┘
   ┌─────┐ ┌─────┐ ┌─────┐
   │  7  │ │  8  │ │  9  │
   └─────┘ └─────┘ └─────┘
           ┌─────┐ ┌─────┐
           │  0  │ │  ⌫  │
           └─────┘ └─────┘
```

**Comportamiento:**
- Al llenar el 4.º dígito se envía **solo** (no hay botón "Entrar"). Mientras
  espera: los puntos parpadean suavemente y el teclado se deshabilita.
- También funciona con el teclado físico (dígitos y Retroceso) para la Caja.
- **PIN correcto:** guardar token, ir a la pantalla del rol (mesero → M1,
  cocina → K1, caja → C1, dueno → P3).
- **PIN incorrecto (401):** los puntos hacen una pequeña sacudida horizontal
  (300 ms) y se vacían; aparece en `--c-peligro`: **"PIN incorrecto. Intenta de nuevo."**
  El mensaje se borra al teclear el siguiente dígito.
- **Error de red:** "No hay conexión. Intenta de nuevo." y se vacían los puntos.

---

## 7. P3 — Elegir vista (solo dueño)

Encabezado común (sin regreso). Debajo, centrado:
1. "¿A dónde quieres ir?" en `--t-xl`.
2. Tres tarjetas grandes en fila (en vertical: en columna), cada una 200 px de
   alto, botón entero tocable:
   - **Meseros** — "Mesas y pedidos"
   - **Cocina** — "Comandas por preparar"
   - **Caja** — "Cobrar cuentas"
   Título en `--t-2xl`, descripción en `--t-m` `--c-texto-2`, borde izquierdo de
   6 px `--c-primario`.

---

## 8. M1 — Mesas

**Para qué:** ver de un vistazo qué mesas están libres u ocupadas y entrar a una.
**Datos:** `GET /api/mesas`, cada 3 s.

Elementos de arriba hacia abajo:
1. Encabezado común ("Comandas · Mesas").
2. Fila de resumen y filtro (56 px):
   - Izquierda: "8 libres · 4 ocupadas" en `--t-m`.
   - Derecha: dos chips "Todas" (seleccionado por omisión) / "Mis mesas"
     (solo ocupadas por mí). Se recuerda la elección en `localStorage`.
3. Cuadrícula de mesas: `grid-template-columns: repeat(auto-fill, minmax(168px, 1fr))`,
   separación 16 px. Cada tarjeta mínimo **140 px de alto**, toda tocable.

**Tarjeta de mesa — libre:**
- Fondo `--c-ok-suave`, borde 2 px `--c-ok`.
- Nombre de la mesa en `--t-2xl` ("Mesa 4").
- Insignia "Libre" (verde).

**Tarjeta de mesa — ocupada:**
- Fondo `--c-superficie`, borde 2 px `--c-borde`; si es mía, borde 3 px
  `--c-primario` y una etiqueta "Tú" en la esquina.
- Nombre de la mesa en `--t-2xl`.
- Mesero: "Luis" en `--t-m` `--c-texto-2`.
- Total: `$485.00` en `--t-xl` 700.
- Tiempo desde que se abrió: "⏱ 35 min" en `--t-s` `--c-texto-2`.

```
┌ Comandas · Mesas ─────────────────────────── Ana · Mesero  [Salir] ┐
│ 8 libres · 4 ocupadas                       (Todas) ( Mis mesas )  │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐        │
│ │ Mesa 1     │ │ Mesa 2  Tú │ │ Mesa 3     │ │ Mesa 4     │        │
│ │            │ │ Ana        │ │ Luis       │ │            │        │
│ │ [Libre]    │ │ $485.00    │ │ $1,230.00  │ │ [Libre]    │        │
│ │            │ │ ⏱ 35 min   │ │ ⏱ 1 h 5 min│ │            │        │
│ └────────────┘ └────────────┘ └────────────┘ └────────────┘        │
│ ┌────────────┐ ┌────────────┐ ...                                  │
└────────────────────────────────────────────────────────────────────┘
```

**Acción:** tocar cualquier mesa → M2 de esa mesa. **No** se abre la cuenta al
tocar una mesa libre (para no dejar cuentas vacías si el mesero solo estaba
mirando); la cuenta se abre al enviar el primer pedido (ver M2).

Si una mesa tiene un pedido sin enviar guardado en esta tablet, mostrar en su
tarjeta una insignia ámbar "Sin enviar".

**Estados:**
- Cargando: spinner.
- Sin mesas: "Todavía no hay mesas registradas. Pide al dueño que las agregue."
- Filtro "Mis mesas" vacío: "No tienes mesas abiertas. Toca una mesa libre para empezar."
  + botón secundario "Ver todas".

---

## 9. M2 — Mesa (menú + pedido)

**Para qué:** armar el pedido nuevo, mandarlo a cocina y ver lo ya pedido.
**Datos:** `GET /api/menu` (una vez al entrar, se puede guardar en memoria);
si la mesa tiene `orden_id`: `GET /api/ordenes/:id` cada 3 s (para ver estados).

### 9.1 Distribución

**Horizontal (≥ 1024 px de ancho):** dos columnas.
- Izquierda (≈ 60 %): menú.
- Derecha (≈ 40 %, mín. 380 px): panel con "Pedido nuevo" arriba y "Ya enviado"
  abajo, con su propio scroll. El botón "Enviar a cocina" queda fijo al pie del
  panel derecho.

```
┌ [← Mesas] Comandas · Mesa 4 ─────────────────────── Ana · Mesero [Salir] ┐
│ (Entradas) (Tacos) (Platos fuertes) (Bebidas) (Postres)  │ PEDIDO NUEVO          │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │ ┌───────────────────┐ │
│ │Taco al pastor│ │Taco de       │ │Taco de       │        │ │Taco al pastor     │ │
│ │              │ │suadero       │ │bistec    (2) │        │ │[−] 3 [+]   $75.00 │ │
│ │ $25.00   (3) │ │ $25.00       │ │ $28.00       │        │ │✎ sin cebolla      │ │
│ └──────────────┘ └──────────────┘ └──────────────┘        │ ├───────────────────┤ │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │ │Taco de bistec     │ │
│ │Gringa        │ │Quesadilla    │ │Orden de      │        │ │[−] 2 [+]   $56.00 │ │
│ │ $55.00       │ │ $45.00       │ │cebollitas    │        │ │✎ Agregar nota     │ │
│ └──────────────┘ └──────────────┘ └──────────────┘        │ └───────────────────┘ │
│                                                           │ YA ENVIADO            │
│                                                           │ 2:35 p.m. [En prep.]  │
│                                                           │  2× Agua de horchata  │
│                                                           │ Subtotal     $210.00  │
│                                                           │┌─────────────────────┐│
│                                                           ││ Enviar a cocina (5) ││
│                                                           ││      $131.00        ││
│                                                           │└─────────────────────┘│
└──────────────────────────────────────────────────────────────────────────────────┘
```

**Vertical (< 1024 px):** una columna con el menú ocupando la pantalla y una
**barra fija abajo** (88 px, fondo `--c-superficie`, sombra hacia arriba):

```
┌──────────────────────────────────────────────┐
│ Pedido nuevo: 5 platillos · $131.00          │
│ [ Ver pedido ]        [ Enviar a cocina ]    │
└──────────────────────────────────────────────┘
```

- "Ver pedido" abre una hoja desde abajo (80 % del alto) con "Pedido nuevo" y
  "Ya enviado", y el botón "Enviar a cocina" fijo al pie. Se cierra con "✕ Cerrar"
  o tocando fuera.
- Si el pedido nuevo está vacío, la barra dice "Ya enviado: $210.00 · [Ver cuenta]"
  y el botón de enviar no aparece.

### 9.2 Menú

1. **Pestañas de categoría** en una fila con scroll horizontal (chips de 56 px,
   `--t-l`). La primera categoría seleccionada por omisión. Categorías en el
   orden que venga de la API.
2. **Cuadrícula de platillos** de la categoría activa:
   `repeat(auto-fill, minmax(176px, 1fr))`, separación 12 px. Cada tarjeta
   mínimo 104 px de alto: nombre en `--t-l` (hasta 2 líneas), precio en `--t-m`
   `--c-texto-2` abajo a la izquierda.
3. **Tocar un platillo = +1** en el pedido nuevo. Respuesta visual inmediata:
   la tarjeta parpadea en `--c-primario-suave` (150 ms) y muestra en la esquina
   un círculo `--c-primario` con la cantidad pedida en total de ese platillo
   (ej. "3"). No hay toast (sería ruido).

### 9.3 Pedido nuevo

Título "Pedido nuevo" en `--t-xl`. Cada línea (mín. 88 px de alto):
- Fila 1: nombre del platillo (`--t-l`) y a la derecha importe de la línea
  (`precio × cantidad`, `--t-l` 700).
- Fila 2: control de cantidad `[−] 3 [+]` — botones de **56×56 px**, número en
  `--t-xl` con ancho fijo de 48 px. Con cantidad 1, el botón "−" cambia a "✕"
  (`aria-label="Quitar"`, texto `--c-peligro`) y al tocarlo elimina la línea.
- Fila 3: botón de texto "✎ Agregar nota"; si ya tiene nota, se muestra la nota
  en itálica `--c-texto-2` precedida de "✎", tocable para editarla.

**Reglas de agrupación:**
- Tocar un platillo en el menú suma 1 a su línea **sin nota**; si no existe, crea
  una nueva al final.
- Una línea con nota es independiente. Así "3 tacos al pastor" + "1 sin cebolla"
  son dos líneas.

Vacío: texto en `--c-texto-2`: "Toca un platillo del menú para agregarlo."

**Persistencia:** el pedido nuevo se guarda en `localStorage` por mesa
(`pedido-mesa-<id>`) en cada cambio, para que no se pierda si el mesero va a
otra mesa, se recarga la página o se va la conexión. Se borra al enviarse con éxito.

### 9.4 Nota rápida (diálogo)

Se abre al tocar "✎ Agregar nota". Diálogo centrado (en vertical, hoja desde abajo):

```
┌──────────────────────────────────────────┐
│ Nota para: Taco al pastor                │
│                                          │
│ (Sin cebolla) (Sin cilantro) (Sin chile) │
│ (Poco picante) (Bien picante)            │
│ (Para llevar) (Bien dorado) (Sin queso)  │
│                                          │
│ Otra indicación                          │
│ ┌──────────────────────────────────────┐ │
│ │ ej. salsa aparte                     │ │
│ └──────────────────────────────────────┘ │
│                                    0/140 │
│ Aplicar a:  ( Los 3 )  ( Solo 1 )        │   ← solo si cantidad > 1
│                                          │
│ [ Quitar nota ]  [Cancelar]  [ Guardar ] │
└──────────────────────────────────────────┘
```

- **Chips de sugerencia** (48 px, se pueden elegir varios; al tocar se marcan y
  se agregan al texto): "Sin cebolla", "Sin cilantro", "Sin chile",
  "Poco picante", "Bien picante", "Para llevar", "Bien dorado", "Sin queso".
  Dejar la lista en una constante (`NOTAS_RAPIDAS` en `src/config.ts`) para
  cambiarla fácil.
- **Texto libre**: campo de una línea, placeholder "ej. salsa aparte".
- La nota final = chips elegidos + texto libre, unidos con ", "
  (ej. "Sin cebolla, Para llevar, salsa aparte"). Contador "n/140"; al pasar de
  140 no deja escribir más y el contador se pone en `--c-peligro`.
- **"Aplicar a"** (solo si la línea tiene cantidad > 1): "Los 3" (por omisión)
  o "Solo 1". "Solo 1" separa una unidad en una línea nueva con la nota y deja
  el resto sin nota.
- Botones: "Quitar nota" (botón de texto, solo si ya había nota), "Cancelar"
  (secundario), "Guardar" (primario).

### 9.5 Enviar a cocina

- Botón primario de **72 px** de alto, ancho completo del panel:
  "Enviar a cocina (5)" en `--t-xl` y debajo el monto del pedido nuevo
  `$131.00` en `--t-m`. El número entre paréntesis es la suma de cantidades.
- Deshabilitado si el pedido nuevo está vacío.
- Al tocar (sin confirmación):
  1. Si la mesa no tiene cuenta: `POST /api/ordenes { mesa_id }` → obtiene `orden_id`.
  2. `POST /api/ordenes/:id/comandas { items }`.
  3. Botón en estado "Enviando…".
- **Éxito:** toast **"Enviado a cocina ✓"** (fondo `--c-ok`), el pedido nuevo
  se vacía, la nueva comanda aparece arriba en "Ya enviado". El mesero se queda
  en la pantalla.
- **Error:** el pedido nuevo **se conserva intacto**, toast con el mensaje del
  servidor o "No se pudo enviar. Revisa la conexión e intenta de nuevo."

### 9.6 Ya enviado

Título "Ya enviado" en `--t-xl`. Comandas de la orden, la **más reciente primero**.
Cada comanda:
- Encabezado: hora de envío ("2:35 p.m.") y una insignia de estado:
  - `pendiente` → insignia ámbar **"En preparación"**.
  - `listo` → insignia verde **"Listo ✓"**.
- Items: `2× Agua de horchata` en `--t-m`, importe a la derecha en `--c-texto-2`;
  nota debajo en itálica `--t-s`.

Al final: **"Subtotal"** y el monto en `--t-2xl` 700, alineado a la derecha.
La propina no se muestra aquí (la define la Caja).

Si cambia una comanda de "En preparación" a "Listo" mientras el mesero está en
la pantalla, su tarjeta hace un destello verde (600 ms). (Sin sonido en esta entrega.)

Vacío (mesa sin cuenta): "Aún no se ha enviado nada a cocina."

Si la cuenta ya fue cobrada mientras el mesero estaba dentro (la orden vuelve
como `pagada` o la mesa queda libre): aviso "Esta cuenta ya se cobró." y botón
"← Volver a mesas".

### 9.7 Salir con pedido sin enviar

Si el mesero toca "← Mesas" con un pedido nuevo sin enviar, **no se pregunta**
(se guarda solo y la mesa muestra "Sin enviar"). Si toca **"Salir"** y hay
pedidos sin enviar en cualquier mesa, diálogo:
- Título: "Tienes pedidos sin enviar"
- Texto: "Mesa 4 tiene platillos que no se han mandado a cocina. Si sales, se borran."
- Botones: "Quedarme" (primario) / "Salir y borrar" (secundario con texto `--c-peligro`).

---

## 10. K1 — Cocina

**Para qué:** ver qué hay que preparar, en orden de llegada, y marcarlo listo.
**Datos:** `GET /api/cocina` cada 3 s. Pantalla pensada para leerse a 1–2 m.

### 10.1 Distribución

- Encabezado común (en esta pantalla el contador va al lado del título:
  "Comandas · Cocina — 5 pendientes").
- **Zona principal "Por preparar":** cuadrícula de tarjetas, la **más antigua
  primero** (arriba a la izquierda), flujo de izquierda a derecha y hacia abajo.
  `repeat(auto-fill, minmax(320px, 1fr))`, separación 16 px. En horizontal caben
  3 columnas a 1280 px; en vertical, 2.
- **Zona "Listas (últimos 30 min)":** debajo, separada por un título, plegada
  por omisión: un botón de 56 px "Ver listas (4) ▾". Al abrir, muestra tarjetas
  compactas, la más reciente primero.

```
┌ Comandas · Cocina — 3 pendientes ───────────────── Cocina · Cocina [Salir] ┐
│ ┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐ │
│ │▌MESA 3        23 min │ │▌MESA 7        12 min │ │ MESA 2         4 min │ │
│ │▌Luis · 2:12 p.m.     │ │▌Ana · 2:23 p.m.      │ │ Ana · 2:31 p.m.      │ │
│ │▌[Muy tardada]        │ │▌[Tardada]            │ │                      │ │
│ │▌3× Taco al pastor    │ │▌1× Gringa            │ │ 2× Agua de horchata  │ │
│ │▌   Sin cebolla       │ │▌2× Quesadilla        │ │ 1× Flan              │ │
│ │▌1× Gringa            │ │▌   Para llevar       │ │                      │ │
│ │▌┌──────────────────┐ │ │▌┌──────────────────┐ │ │┌──────────────────┐  │ │
│ │▌│    ✓  LISTO      │ │ │▌│    ✓  LISTO      │ │ ││    ✓  LISTO      │  │ │
│ │▌└──────────────────┘ │ │▌└──────────────────┘ │ │└──────────────────┘  │ │
│ └──────────────────────┘ └──────────────────────┘ └──────────────────────┘ │
│                                                                            │
│ [ Ver listas (4) ▾ ]                                                       │
└────────────────────────────────────────────────────────────────────────────┘
```

### 10.2 Tarjeta de comanda pendiente

De arriba hacia abajo:
1. **Fila superior:** nombre de la mesa en mayúsculas `--t-2xl` 800 a la izquierda;
   **tiempo transcurrido** a la derecha en `--t-3xl` 800 ("12 min").
2. Mesero y hora de llegada: "Luis · 2:12 p.m." en `--t-m` `--c-texto-2`.
3. Insignia de espera (solo si aplica, ver tabla).
4. **Items:** cada uno en `--t-xl` 600: "3× Taco al pastor". La cantidad en
   negritas 800. La **nota** debajo en `--t-l`, sangrada 32 px, con fondo
   `--c-alerta-suave` y texto `--c-texto` (para que no se pase por alto).
   Separador de 1 px entre items.
5. **Botón "✓ LISTO"**: ancho completo de la tarjeta, **80 px** de alto,
   fondo `--c-ok`, texto blanco `--t-2xl` 800, radio 12.

Tarjeta: fondo blanco, radio 16, padding 20, sombra de tarjeta.

**Colores por tiempo de espera** (desde `creada`):

| Espera | Borde y franja izquierda (8 px) | Fondo de la tarjeta | Tiempo en color | Insignia |
|---|---|---|---|---|
| menos de 10 min | `--c-borde` (sin franja) | `#FFFFFF` | `--c-texto` | — |
| 10 a 20 min | `--c-alerta-borde` | `--c-alerta-suave` | `--c-alerta` | "Tardada" (ámbar) |
| más de 20 min | `--c-peligro` | `--c-peligro-suave` | `--c-peligro` | "Muy tardada" (rojo) |

(Los umbrales 10 y 20 en una constante en `src/config.ts`:
`ESPERA_AMBAR_MIN = 10`, `ESPERA_ROJO_MIN = 20`.)

### 10.3 Marcar listo y deshacer

- Un toque en "✓ LISTO" → `POST /api/comandas/:id/listo`. Sin confirmación.
- La tarjeta sale de "Por preparar" de inmediato (la pantalla no espera al
  servidor; si falla, la tarjeta regresa y sale un toast de error).
- Toast con botón, **8 s** (más largo de lo normal, porque en cocina tienen las
  manos ocupadas): **"Mesa 3 lista ✓"** + botón **"Deshacer"** (48 px, texto en
  mayúsculas, borde blanco). "Deshacer" → `POST /api/comandas/:id/pendiente` y la
  tarjeta vuelve a su lugar original.
- Además, en "Listas (últimos 30 min)" cada tarjeta compacta muestra: mesa,
  "Lista a las 2:40 p.m.", items en `--t-m`, y un botón secundario
  **"Regresar a pendientes"** (56 px). Fondo `--c-ok-suave`, borde `--c-ok`.

### 10.4 Estados

- Sin pendientes: centrado, grande (`--t-2xl`): **"Todo al día ✓"** y debajo
  `--t-m` `--c-texto-2`: "Las comandas nuevas aparecerán aquí."
- Nueva comanda llega: la tarjeta entra con un destello `--c-primario-suave`
  (1 s). (Sin sonido en esta entrega; se puede proponer para la siguiente.)
- Sin conexión: barra "Sin conexión. Reintentando…" (sección 4); las tarjetas
  siguen visibles y el tiempo sigue corriendo.
- Pantalla siempre encendida: si el navegador lo permite, pedir
  `navigator.wakeLock.request('screen')`; si no, ignorar sin mensaje.

---

## 11. C1 — Caja

**Para qué:** elegir una cuenta abierta, revisarla y cobrarla con propina y una o
varias formas de pago.
**Datos:** `GET /api/caja/ordenes` cada 3 s. **Acción:** `POST /api/ordenes/:id/pagar`.
Dispositivo: computadora (mín. 1280 px). Texto base `--t-s` (16 px); campos 48 px.

### 11.1 Distribución (tres columnas)

```
┌ Comandas · Caja ────────────────────────────────────────────── Caja · Caja  [Salir] ┐
│ CUENTAS ABIERTAS (4) │ MESA 3 · Luis                       │ COBRAR                 │
│┌───────────────────┐ │ Abierta 2:05 p.m. · hace 48 min     │ Subtotal     $485.00   │
││▌Mesa 3   $485.00  │ │─────────────────────────────────────│                        │
││▌Luis · 48 min     │ │ 2:12 p.m.                 [Listo ✓] │ Propina                │
│└───────────────────┘ │  3× Taco al pastor           $75.00 │ (Sin) (10%) (15%) (20%)│
│┌───────────────────┐ │     Sin cebolla                     │ (Otra: [$______])      │
││ Mesa 7   $230.00  │ │  1× Gringa                   $55.00 │ Propina       $72.75   │
││ Ana · 25 min      │ │ 2:30 p.m.           [En preparación]│ ────────────────────── │
│└───────────────────┘ │  2× Agua de horchata         $60.00 │ TOTAL       $557.75    │
│┌───────────────────┐ │  ...                                │                        │
││ Mesa 2   $90.00   │ │                                     │ Formas de pago         │
││ Ana · 6 min       │ │                                     │ Efectivo  [$300.00] ✕  │
│└───────────────────┘ │                                     │  Recibido [$500.00]    │
│                      │                                     │  Cambio     $200.00    │
│                      │                                     │ Tarjeta   [$257.75] ✕  │
│                      │                                     │ [+ Transferencia]      │
│                      │─────────────────────────────────────│ Asignado  $557.75 ✓    │
│                      │ Subtotal                   $485.00  │┌──────────────────────┐│
│                      │                                     ││  Cobrar $557.75      ││
│                      │                                     │└──────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────────┘
```

Anchos: lista 320 px fija · detalle flexible · cobro 420 px fija. Cada columna
con su propio scroll; el botón "Cobrar" fijo al pie de la columna de cobro.

### 11.2 Lista de cuentas abiertas (izquierda)

- Título "Cuentas abiertas (4)" en `--t-l` 700.
- Orden: la más antigua primero (como llega de la API).
- Cada fila (72 px, toda clicable, también con flechas ↑/↓ del teclado):
  - Línea 1: mesa (`--t-l` 700) y total/subtotal a la derecha (`--t-l` 700).
  - Línea 2: mesero · tiempo abierta (`--t-s` `--c-texto-2`). Si alguna comanda
    sigue pendiente, insignia pequeña ámbar "En cocina".
  - Seleccionada: fondo `--c-primario-suave` y franja izquierda 4 px `--c-primario`.
- Al entrar se selecciona la primera automáticamente. La URL refleja la selección
  (`/caja/:ordenId`) para que sobreviva una recarga.
- Vacío: "No hay cuentas abiertas." + `--c-texto-2` "Cuando un mesero envíe un
  pedido, la cuenta aparecerá aquí." (las otras dos columnas se ocultan y el
  mensaje queda centrado en toda la pantalla).

### 11.3 Detalle de la cuenta (centro)

1. Título: "Mesa 3 · Luis" en `--t-xl`.
2. "Abierta 2:05 p.m. · hace 48 min" en `--t-s` `--c-texto-2`.
3. Comandas en orden de envío (más antigua primero, para leerla como ticket):
   encabezado con hora e insignia de estado ("En preparación" / "Listo ✓"),
   items como `3× Taco al pastor ........ $75.00` (cantidad × precio a la
   derecha), notas en itálica debajo.
4. Pie fijo: "Subtotal" y monto en `--t-xl` 700.

Si la cuenta tiene comandas "En preparación", aviso ámbar sobre el pie:
"Hay platillos que aún están en cocina." (informativo; no impide cobrar).

### 11.4 Cobrar (derecha)

Elementos de arriba hacia abajo:

**a) Subtotal** — renglón con el monto.

**b) Propina** — etiqueta "Propina" y chips (48 px): **"Sin propina"**, **"10%"**,
**"15%"**, **"20%"**, **"Otra"**.
- Por omisión: "Sin propina".
- El porcentaje se calcula **sobre el subtotal** y se redondea al centavo:
  `Math.round(subtotal * pct / 100)` (todo en centavos enteros).
- "Otra": muestra un campo de dinero "Monto de propina" (prefijo `$`, acepta
  decimales con punto). Se enfoca automáticamente.
- Renglón "Propina" con el monto calculado; si es porcentaje, muestra
  "Propina (15%)".

**c) TOTAL** — separador y "TOTAL" con el monto en `--t-3xl` 800.

**d) Formas de pago** — etiqueta "Formas de pago". Cada forma es una fila:
- Nombre del método (`--t-m` 600): **Efectivo**, **Tarjeta**, **Transferencia**.
- Campo de dinero con el monto asignado (prefijo `$`), 160 px de ancho.
- Botón "✕" (`aria-label="Quitar"`) — se oculta si es la única fila.
- Cada método aparece **máximo una vez** (suficiente para dividir; mantiene la
  pantalla simple). Debajo, botones secundarios para agregar los métodos que
  faltan: "+ Efectivo", "+ Tarjeta", "+ Transferencia".
- **Valores automáticos:**
  - Al seleccionar una cuenta, hay una fila **Efectivo** con monto = TOTAL.
  - Si cambia la propina y solo hay una fila, su monto se actualiza al nuevo TOTAL.
  - Al agregar una fila nueva, se llena con lo que **falta** por asignar (si falta
    algo; si no, queda en $0.00 y enfocada).
  - Cada fila con monto distinto al que falta muestra un botón de texto
    "Poner lo que falta" cuando hay diferencia.
- **Efectivo — Recibido y cambio:** bajo la fila de efectivo, sangrado:
  - Campo "Recibido" (opcional) con atajos de billetes como chips pequeños:
    "$200", "$500", "$1,000", "Exacto".
  - "Cambio" calculado = recibido − monto en efectivo, en `--t-2xl` 800 color
    `--c-ok`.
  - Si recibido < monto en efectivo: en `--c-peligro` "Faltan $45.00" y el botón
    Cobrar se deshabilita.

**e) Cuadre** — renglón "Asignado" con la suma de los pagos:
- Si cuadra: "Asignado $557.75 ✓" en `--c-ok`.
- Si falta: "Faltan $57.75 por asignar" en `--c-alerta`.
- Si sobra: "Sobran $20.00. Ajusta los montos." en `--c-peligro`.

**f) Botón "Cobrar $557.75"** — primario, ancho completo, **64 px**, `--t-xl` 700.
- **Habilitado solo si:** la suma de pagos = subtotal + propina **exactamente**
  (en centavos), ningún monto es negativo, la cuenta tiene al menos un platillo
  y, si hay "Recibido", alcanza para el efectivo. Filas con $0.00 se ignoran al
  enviar.
- Deshabilitado: debajo, en `--t-xs` `--c-texto-2`, la razón
  ("Asigna el total para poder cobrar").
- Atajo de teclado: **Enter** dentro de cualquier campo de cobro = Cobrar (si está
  habilitado). Orden de Tab: propina → montos → recibido → Cobrar.
- Al hacer clic: sin diálogo de confirmación (el total ya está a la vista y en el
  botón). Estado "Cobrando…".

**Campos de dinero (regla común):** se escriben en pesos ("300" o "300.50"),
aceptan coma de miles al pegar, se convierten a centavos enteros para cálculos y
envío; al salir del campo se muestran formateados ("$300.00"). Valor inválido →
borde `--c-peligro` y texto "Monto no válido".

### 11.5 Después de cobrar

- **Éxito:** la columna de cobro muestra una tarjeta de confirmación (fondo
  `--c-ok-suave`, borde `--c-ok`):
  - "Cuenta cobrada ✓" en `--t-2xl`.
  - "Mesa 3 · Total $557.75" en `--t-l`.
  - Si hubo efectivo con recibido: **"Cambio: $200.00"** en `--t-4xl` 800 — lo
    más grande de la pantalla, para que la cajera no se equivoque.
  - Botón primario "Siguiente cuenta" (Enter también funciona).
  La cuenta desaparece de la lista; la tarjeta se queda hasta que se presiona
  "Siguiente cuenta" o se elige otra cuenta.
- **Error 400** (no cuadra, ya pagada, sin platillos): toast con el mensaje del
  servidor y se conserva todo lo capturado; se recarga la cuenta (igual que con 409).
- **Cuenta sin platillos** (p. ej. se abrió pero el envío a cocina falló): en vez
  del cobro, la columna muestra "Esta cuenta no tiene platillos" y un botón
  "Liberar mesa" que pide confirmación y llama a `POST /api/ordenes/:id/cancelar`.
  La tablet del mesero también cancela sola su cuenta vacía al salir de la mesa o
  de la sesión (409/404 se ignoran).
- La columna "Cobrar" tiene encabezado fijo (título y subtotal) y se desplaza por
  dentro; el pie con "Cobrar $…" nunca tapa controles (revisado a 1440×900 y 1280×800).

### 11.6 Cambios mientras se cobra

Si por el polling la cuenta seleccionada cambia (el mesero agregó platillos):
actualizar el detalle, mostrar arriba del cobro un aviso ámbar **"Se agregaron
platillos. Revisa el total."**, recalcular propina y, si hay una sola forma de
pago, su monto. Si la cuenta desaparece (la cobró otra caja): "Esta cuenta ya no
está abierta." y seleccionar la siguiente.

---

## 12. Catálogo de textos

| Clave | Texto |
|---|---|
| Entrada — título | ¿Quién eres? |
| Entrada — PIN | Hola, {nombre} / Escribe tu PIN |
| PIN incorrecto | PIN incorrecto. Intenta de nuevo. |
| Sesión vencida | Tu sesión terminó. Vuelve a entrar. |
| Dueño — elegir | ¿A dónde quieres ir? |
| Botones comunes | Salir · Cambiar vista · ← Mesas · ← Cambiar · Reintentar · Cancelar · Guardar |
| Mesa libre | Libre |
| Mesa propia | Tú |
| Pedido sin enviar | Sin enviar |
| Pedido vacío | Toca un platillo del menú para agregarlo. |
| Nota | ✎ Agregar nota · Nota para: {platillo} · Otra indicación · Aplicar a: · Quitar nota |
| Enviar | Enviar a cocina ({n}) · Enviando… |
| Enviado | Enviado a cocina ✓ |
| Error al enviar | No se pudo enviar. Revisa la conexión e intenta de nuevo. |
| Estados de comanda | En preparación · Listo ✓ |
| Sin envíos | Aún no se ha enviado nada a cocina. |
| Cocina vacía | Todo al día ✓ / Las comandas nuevas aparecerán aquí. |
| Espera | Tardada · Muy tardada |
| Listo en cocina | ✓ LISTO · Mesa {n} lista ✓ · Deshacer · Regresar a pendientes · Ver listas ({n}) |
| Caja vacía | No hay cuentas abiertas. |
| Propina | Sin propina · 10% · 15% · 20% · Otra |
| Pago | Efectivo · Tarjeta · Transferencia · Recibido · Cambio · Poner lo que falta |
| Cuadre | Asignado {monto} ✓ · Faltan {monto} por asignar · Sobran {monto}. Ajusta los montos. |
| Cobrar | Cobrar {monto} · Cobrando… · Cuenta cobrada ✓ · Siguiente cuenta |
| Cargando | Cargando… |
| Sin conexión | Sin conexión. Reintentando… / Conexión recuperada ✓ |
| Error genérico | Algo salió mal. Intenta de nuevo. |

---

## 13. Accesibilidad (lista de verificación)

- Contraste AA en todo texto; nada depende solo del color.
- Áreas táctiles ≥ 48 px y separadas ≥ 12 px.
- Todo usable con teclado en Caja; foco visible (anillo `--c-foco` de 3 px).
- Botones de solo ícono con `aria-label` (⌫ "Borrar", ✕ "Quitar", − "Menos", + "Más").
- Toasts en una región `aria-live="polite"`; errores en `aria-live="assertive"`.
- Respetar `prefers-reduced-motion`: sin sacudidas ni destellos, solo cambio de color.
- No bloquear el zoom del navegador.

---

## 14. Constantes configurables (`src/config.ts`)

```ts
export const APP_NOMBRE = 'Comandas';
export const POLLING_MS = 3000;
export const ESPERA_AMBAR_MIN = 10;
export const ESPERA_ROJO_MIN = 20;
export const PROPINAS_PCT = [10, 15, 20];
export const NOTAS_RAPIDAS = [
  'Sin cebolla', 'Sin cilantro', 'Sin chile', 'Poco picante',
  'Bien picante', 'Para llevar', 'Bien dorado', 'Sin queso',
];
export const BILLETES_RAPIDOS = [20000, 50000, 100000]; // centavos: $200, $500, $1,000
```

---

## 15. Decisiones a confirmar con la persona

1. **La cuenta se abre al enviar el primer pedido**, no al tocar la mesa (evita
   mesas "ocupadas" vacías).
2. **Cualquier mesero puede agregar a cualquier mesa** (se marca "Tú" en las
   propias y hay filtro "Mis mesas"). ¿O cada mesero solo debe tocar las suyas?
3. **Propina sobre el subtotal**, por omisión "Sin propina".
4. **Sin sonido** en Cocina en esta entrega (solo destello visual). Un "ding" al
   llegar comanda podría ser útil después.
5. **Umbrales de espera** 10 y 20 min y lista de notas rápidas: ¿son las que usa
   la cocina del restaurante?
