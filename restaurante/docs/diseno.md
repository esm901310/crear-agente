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

> Entrega 2 agrega Caja sin día abierto, Cerrar el día, Corte, Historial de cortes
> y Reporte de propinas: ver **sección 16** (mapa en 16.1).

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
3. Entrega 2: se agrega una cuarta tarjeta **"Cortes y propinas"** — ver 20.1.

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

---
---

# Entrega 2 — Corte de caja y propinas

> Basada en `docs/proyecto.md` → "Contrato de la API (Entrega 2…)". Reutiliza
> **todo** el sistema visual de las secciones 2–4 (colores, tipografía,
> componentes, toasts, diálogos, estados globales). No hay colores nuevos.
> Si algo aquí contradice el contrato, manda el contrato.

## 16. Reglas que mandan en esta entrega

1. **Corte a ciegas.** Mientras el día está abierto, la caja **nunca** ve ventas,
   total cobrado, efectivo esperado ni diferencia. Lo único con montos que ve es
   el **fondo** y sus **salidas** (las capturó ella). Esto aplica también
   cuando el dueño usa la vista Caja (misma pantalla); el dueño ve las cifras en
   "Cortes y propinas".
2. **Sin día abierto no se cobra.** Las cuentas se ven, pero "Cobrar" queda
   bloqueado con explicación. Meseros y Cocina no cambian en nada.
3. **Cerrar es definitivo**: es la única acción de esta entrega con confirmación
   fuerte. Abrir el día y registrar salidas no piden confirmación extra (anular
   sí, porque borra una salida de la cuenta).
4. El color nunca va solo: "Cuadra ✓", "Sobran $50.00", "Faltan $120.00",
   "Anulada", "En curso" siempre con texto.

### 16.1 Mapa de pantallas nuevas

| # | Pantalla | Ruta | Quién | Dispositivo |
|---|---|---|---|---|
| C1 | Caja (cambia: estado sin día, panel "Día") | `/caja`, `/caja/:ordenId` | caja, dueno | computadora |
| C2 | Cerrar el día (pasos) | `/caja/cerrar` | caja, dueno | computadora |
| C3 | Corte (resultado) | `/caja/corte` | caja, dueno | computadora |
| D1 | Historial de cortes | `/cortes` | dueno | computadora o tablet |
| D2 | Detalle del corte (misma vista que C3) | `/cortes/:jornadaId` | dueno | computadora o tablet |
| D3 | Reporte de propinas | `/propinas` | dueno | computadora o tablet |

Rutas: `/caja/cerrar` y `/caja/corte` no chocan con `/caja/:ordenId` (no son
números). En `App.tsx` agregar `cerrar`, `corte`, `cortes`, `cortes/:id`,
`propinas` a `elegirPantalla` y a `PERMISOS` (`cortes` y `propinas`: solo `dueno`).

```
              ┌──────────────────────────── C1 Caja ─────────────────────────────┐
              │  sin día abierto ──"Abrir el día"──► día abierto                │
              │                                        │  "Salida de efectivo"   │
              │                                        │  "Salidas de hoy"       │
              └────────────────────────────────────────┼─────────────────────────┘
                                         "Cerrar el día"│
                                                        ▼
         C2 Paso 1: Cuentas por cobrar ─(0 cuentas)─► C2 Paso 2: Contar efectivo
               │ "Ir a cobrar" ─► C1 /caja/:id               │ "Revisar y cerrar"
                                                             ▼
                                              Diálogo "¿Cerrar el día con $X…?"
                                                             │ "Cerrar el día"
                                                             ▼
                                              C3 Corte ──"Listo"──► C1 (sin día)

  P3 Elegir vista ──"Cortes y propinas"──► D1 Historial ──fila──► D2 Detalle
                                            ▲  pestañas │
                                            └───────────┴──► D3 Reporte de propinas
```

### 16.2 Constantes nuevas (`src/config.ts`)

```ts
export const FONDOS_RAPIDOS = [50000, 100000, 200000];        // $500, $1,000, $2,000
export const MOTIVOS_SALIDA = [
  'Hielo', 'Tortillas', 'Gas', 'Propinas a meseros', 'Retiro del dueño',
];
export const DENOMINACIONES = [                                 // centavos, en este orden
  { valor: 100000, tipo: 'billete' }, { valor: 50000, tipo: 'billete' },
  { valor: 20000, tipo: 'billete' },  { valor: 10000, tipo: 'billete' },
  { valor: 5000, tipo: 'billete' },   { valor: 2000, tipo: 'billete' },
  { valor: 1000, tipo: 'moneda' },    { valor: 500, tipo: 'moneda' },
  { valor: 200, tipo: 'moneda' },     { valor: 100, tipo: 'moneda' },
  { valor: 50, tipo: 'moneda' },
] as const;
```

Etiqueta de cada denominación: `$1,000` `$500` `$200` `$100` `$50` `$20`
`$10` `$5` `$2` `$1` `50¢` (sin centavos, salvo 50¢).

### 16.3 Formatos nuevos

- **Fecha larga** (títulos de corte): "Jueves 20 de noviembre de 2026"
  (`toLocaleDateString('es-MX', { weekday:'long', day:'numeric', month:'long', year:'numeric' })`
  con la primera letra en mayúscula). Se toma de `abierta_en` (aunque se cierre
  después de medianoche, el corte es "del día en que se abrió").
- **Fecha corta** (tablas): "Jue 20 nov" (+ año solo si no es el actual).
- **Diferencia de efectivo** (componente `Diferencia`, se usa en C3, D1, D2):

  | Valor | Texto | Color texto | Fondo (en tarjeta) / insignia |
  |---|---|---|---|
  | `0` | **Cuadra ✓** | `--c-ok` | `--c-ok-suave` / insignia ok |
  | `> 0` | **Sobran $50.00** | `--c-alerta` | `--c-alerta-suave` / insignia alerta |
  | `< 0` | **Faltan $120.00** | `--c-peligro` | `--c-peligro-suave` / insignia peligro |
  | `null` (día abierto) | **En curso** | `--c-texto-2` | `--c-superficie-2` / insignia neutra |

  (Insignia neutra: fondo `--c-superficie-2`, texto `--c-texto-2`.)
- **Contadores en plural**: "1 cuenta" / "2 cuentas", "1 salida" / "2 salidas".

---

## 17. C1 — Caja con jornada (cambios a la sección 11)

**Datos nuevos:** `GET /api/jornada/actual` cada 3 s (junto con
`GET /api/caja/ordenes`). La pantalla no muestra nada hasta tener **las dos**
respuestas la primera vez (spinner "Cargando…").

### 17.1 Estado A — Sin día abierto y sin cuentas abiertas

Pantalla completa centrada (reemplaza a "No hay cuentas abiertas."). Tarjeta
blanca de 520 px de ancho, radio 16, sombra de tarjeta, padding 32:

```
┌ Comandas · Caja ──────────────────────────────────────────── Caja  [Salir] ┐
│                                                                            │
│              ┌──────────────────────────────────────────────┐              │
│              │  Abrir el día                                │              │
│              │  Cuenta el efectivo con el que empieza la    │              │
│              │  caja (el fondo para dar cambio).            │              │
│              │                                              │              │
│              │  Fondo de caja                               │              │
│              │  ┌────────────────────────────────────────┐  │              │
│              │  │ $                              1,000.00│  │              │
│              │  └────────────────────────────────────────┘  │              │
│              │  ( $500 )  ( $1,000 )  ( $2,000 )            │              │
│              │                                              │              │
│              │  El fondo no se puede cambiar después.       │              │
│              │  ┌────────────────────────────────────────┐  │              │
│              │  │     Abrir el día con $1,000.00         │  │              │
│              │  └────────────────────────────────────────┘  │              │
│              └──────────────────────────────────────────────┘              │
│                         Ver el último corte                                │
└────────────────────────────────────────────────────────────────────────────┘
```

Componente **`FormAbrirDia`** (se usa aquí y dentro del diálogo de 17.2):
1. Título "Abrir el día" `--t-2xl`.
2. Texto "Cuenta el efectivo con el que empieza la caja (el fondo para dar
   cambio)." `--t-s` `--c-texto-2`.
3. Campo de dinero "Fondo de caja" (regla común de 11.4, 56 px, `--t-xl`
   alineado a la derecha). Enfocado al aparecer. Vacío al inicio.
4. Chips (48 px) "$500", "$1,000", "$2,000": llenan el campo; el chip cuyo valor
   coincide con el campo se ve seleccionado.
5. Ayuda `--t-xs` `--c-texto-2`: "El fondo no se puede cambiar después."
6. Botón primario ancho completo 64 px: **"Abrir el día con $1,000.00"**
   (monto en vivo). Vacío o inválido → deshabilitado con texto "Abrir el día".
   $0.00 es válido ("Abrir el día sin fondo"). Enter = enviar.
   En curso: "Abriendo…". → `POST /api/jornada/abrir { fondo }`.
7. Éxito: toast verde **"Día abierto ✓"** y la pantalla pasa al Estado C.

Debajo de la tarjeta, botón de texto **"Ver el último corte"** (solo si hay
`ultimo-corte-id` en `localStorage`, ver 19.11) → `/caja/corte`.

### 17.2 Estado B — Sin día abierto pero con cuentas abiertas

Se ve la Caja normal de tres columnas (las cuentas se pueden revisar), con dos
cambios:

- **Columna Cobrar:** arriba, antes de "Propina", aviso ámbar (fondo
  `--c-alerta-suave`, borde 2 px `--c-alerta-borde`, radio 12, padding 16):
  - "**El día no está abierto.**" `--t-m` 700
  - "Para cobrar, primero captura el fondo de caja." `--t-s`
  - Botón primario 48 px **"Abrir el día"** → abre el diálogo con `FormAbrirDia`
    (diálogo 480 px, más botón secundario "Cancelar" abajo a la izquierda).
  - Propina y formas de pago se pueden capturar (no se pierden al abrir el día).
  - Botón "Cobrar $…" **deshabilitado** y debajo la razón: "Abre el día para poder cobrar."
- **Pie de la columna izquierda:** panel "Día" en su versión cerrada (17.3).
- "Liberar mesa" (cuentas sin platillos) sigue funcionando sin día abierto.

### 17.3 Estado C — Día abierto: panel "Día"

Las acciones del día viven en un **panel fijo al pie de la columna izquierda**
(320 px, debajo de "Cuentas abiertas"). Así no se roba altura a la columna de
cobro (que ya está justa a 1440×900) y queda siempre a la vista. La lista de
cuentas conserva su scroll propio arriba del panel.

```
┌ Comandas · Caja ─────────────────────────────────────────────────── Caja  [Salir] ┐
│ CUENTAS ABIERTAS (3)   │ MESA 3 · Luis                    │ COBRAR      $485.00    │
│┌─────────────────────┐ │ Abierta 2:05 p.m. · hace 48 min  │ Propina                │
││▌Mesa 3     $485.00  │ │──────────────────────────────────│ (Sin)(10%)(15%)(20%)…  │
││▌Luis · 48 min       │ │ 2:12 p.m.              [Listo ✓] │ ...                    │
│└─────────────────────┘ │  3× Taco al pastor        $75.00 │ TOTAL       $557.75    │
│┌─────────────────────┐ │  ...                             │ Formas de pago         │
││ Mesa 7     $230.00  │ │                                  │ ...                    │
│└─────────────────────┘ │                                  │                        │
│  (scroll)              │                                  │                        │
│────────────────────────│                                  │                        │
│ ● Día abierto          │                                  │                        │
│   desde 9:02 a.m.      │                                  │                        │
│   Fondo $1,000.00      │                                  │                        │
│ ┌────────────────────┐ │                                  │ Asignado $557.75 ✓     │
│ │ − Salida de efectivo│ │                                  │┌──────────────────────┐│
│ └────────────────────┘ │                                  ││  Cobrar $557.75      ││
│  Salidas de hoy (2)  › │                                  │└──────────────────────┘│
│ ┌────────────────────┐ │──────────────────────────────────│                        │
│ │   Cerrar el día    │ │ Subtotal                $485.00  │                        │
│ └────────────────────┘ │                                  │                        │
└───────────────────────────────────────────────────────────────────────────────────┘
```

Panel "Día" (fondo `--c-superficie-2`, borde superior 1 px `--c-borde`,
padding 16, separación 12 entre elementos), de arriba hacia abajo:

1. **Indicador** (discreto, `--t-s`): punto de 10 px `--c-ok` + "Día abierto
   desde 9:02 a.m." y en la línea siguiente `--c-texto-2` "Fondo $1,000.00".
   Si lo abrió otra persona: "Día abierto desde 9:02 a.m. por Dueño".
   Si el día se abrió en otra fecha (ej. ayer), agregar la fecha:
   "Día abierto desde ayer 9:02 a.m." en `--c-alerta` (pista de que olvidaron
   cerrar).
2. Botón secundario ancho completo 48 px **"− Salida de efectivo"** → 17.4.
3. Botón de texto **"Salidas de hoy (2) ›"** (solo cuenta las no anuladas;
   si no hay ninguna: "Sin salidas hoy", sin enlace) → 17.5.
4. Botón secundario ancho completo 48 px **"Cerrar el día"** → C2 (`/caja/cerrar`).
   No es primario a propósito: el primario de esta pantalla es "Cobrar".
5. Solo para el dueño: botón de texto "Ver corte parcial ›" → `/cortes/:id`.

Versión **cerrada** del panel (Estado B): punto `--c-texto-2` + "El día no está
abierto" y botón primario 48 px "Abrir el día" (abre el diálogo).

**Sin cuentas abiertas con día abierto:** se mantiene la columna izquierda
(con el mensaje "No hay cuentas abiertas." dentro de la lista y el panel "Día"
abajo); el resto del área muestra centrado el mensaje de siempre ("Cuando un
mesero envíe un pedido, la cuenta aparecerá aquí."). Nunca se esconde el panel
"Día" mientras hay día abierto.

**No se muestra en ningún lugar de C1:** ventas del día, número de cuentas
cobradas, total en efectivo, esperado.

### 17.4 Diálogo "Salida de efectivo"

```
┌──────────────────────────────────────────────┐
│ Salida de efectivo                           │
│ Dinero que sale de la caja durante el día.   │
│                                              │
│ Monto                                        │
│ ┌──────────────────────────────────────────┐ │
│ │ $                                 150.00 │ │
│ └──────────────────────────────────────────┘ │
│ Motivo                                       │
│ (Hielo) (Tortillas) (Gas)                    │
│ (Propinas a meseros) (Retiro del dueño)      │
│ ┌──────────────────────────────────────────┐ │
│ │ ej. Refrescos para la tienda             │ │
│ └──────────────────────────────────────────┘ │
│                                        12/80 │
│                                              │
│  [ Cancelar ]   [ Registrar salida $150.00 ] │
└──────────────────────────────────────────────┘
```

1. Título "Salida de efectivo" `--t-xl`; texto "Dinero que sale de la caja
   durante el día." `--t-s` `--c-texto-2`.
2. Campo de dinero **"Monto"** (enfocado al abrir). Debe ser > $0.00.
3. **"Motivo"**: chips de `MOTIVOS_SALIDA` (48 px, **uno a la vez**). Tocar un
   chip **escribe** su texto en el campo de motivo (reemplaza lo que hubiera);
   el chip queda seleccionado mientras el campo diga exactamente eso. El
   campo de texto (placeholder "ej. Refrescos para la tienda") permite escribir
   cualquier motivo o completar uno ("Gas — tanque de 30 kg").
   Contador "n/80"; no deja pasar de 80 (contador en `--c-peligro` al llegar).
   Se recortan espacios al inicio y al final.
4. Botones: "Cancelar" (secundario) / **"Registrar salida $150.00"** (primario;
   sin monto: "Registrar salida"). Deshabilitado si falta monto o motivo; la
   razón debajo en `--t-xs`: "Escribe el monto y el motivo."
   En curso: "Registrando…". → `POST /api/jornada/salidas { monto, motivo }`.
5. Éxito: se cierra, toast verde **"Salida registrada ✓"**, el contador
   "Salidas de hoy (n)" se actualiza con la respuesta.
6. Error: el diálogo se queda abierto con lo capturado y toast con el mensaje.

### 17.5 Diálogo "Salidas de hoy"

Diálogo ancho (640 px, alto máx. 80 %, lista con scroll). Más reciente primero.

```
┌──────────────────────────────────────────────────────────────┐
│ Salidas de hoy                                       ✕       │
│──────────────────────────────────────────────────────────────│
│ 6:40 p.m.  Propinas a meseros            $600.00  [Anular]   │
│            Caja                                              │
│ 1:15 p.m.  Hielo                          $150.00  [Anular]  │
│            Caja                                              │
│ 11:02 a.m. ~~Tortillas~~                ~~$80.00~~ [Anulada] │
│            Caja · anulada por Caja                           │
│──────────────────────────────────────────────────────────────│
│ Total de salidas                                   $750.00   │
│ [ − Nueva salida ]                              [ Cerrar ]   │
└──────────────────────────────────────────────────────────────┘
```

- Fila (mín. 64 px): hora `--t-s` `--c-texto-2` · motivo `--t-m` 600 · monto
  `--t-m` 700 a la derecha · quién la registró debajo en `--t-xs` `--c-texto-2`.
- Botón secundario pequeño (40 px de alto, área táctil 48) **"Anular"** con
  texto `--c-peligro`.
- **Anuladas:** fila con texto `--c-texto-2` y tachado en motivo y monto,
  insignia neutra **"Anulada"** en lugar del botón, y "· anulada por Caja".
  No suman al total.
- Pie: "Total de salidas" (solo no anuladas) `--t-l` 700. Botones: "− Nueva
  salida" (abre 17.4) y "Cerrar".
- Vacío: "No hay salidas hoy."

**Confirmar anulación** (diálogo encima, 480 px):
- Título: "¿Anular esta salida?"
- Texto: "Hielo · $150.00 · 1:15 p.m. Quedará registrada como anulada y ya no
  se descontará de la caja."
- Botones: "No, dejarla" (secundario) / **"Anular salida"** (primario con fondo
  `--c-peligro`). En curso: "Anulando…".
  → `POST /api/jornada/salidas/:id/anular`. Éxito: toast "Salida anulada ✓".

### 17.6 Cobrar (cambios a 11.4/11.5)

- Botón Cobrar deshabilitado sin día abierto (17.2).
- Si `POST /api/ordenes/:id/pagar` responde **409** "Primero abre el día
  capturando el fondo de caja." (otro equipo cerró el día): toast con el mensaje,
  se **conserva** lo capturado, se recarga `jornada/actual` y se abre el diálogo
  "Abrir el día".

---

## 18. C2 — Cerrar el día (`/caja/cerrar`)

Pantalla completa (no diálogo), contenido centrado de **880 px** de ancho.
Encabezado común con botón de regreso **"← Caja"** (vuelve sin cerrar nada;
el conteo se conserva, ver 18.3). Debajo, indicador de pasos:

```
  ① Cuentas por cobrar ─── ② Contar efectivo ─── ③ Corte
```

Paso actual en `--c-primario` 700 con círculo relleno; pasos hechos con "✓"
en `--c-ok`; pendientes en `--c-texto-2`. No son clicables.

Al entrar: si no hay día abierto (`jornada/actual` = null) → volver a `/caja`
con toast "El día no está abierto." Si `cuentas_abiertas > 0` → Paso 1; si
es 0 → directo al Paso 2 (el paso 1 aparece ya con ✓).

### 18.1 Paso 1 — Cuentas por cobrar (solo si hay)

**Datos:** `GET /api/caja/ordenes` cada 3 s (tiene mesa, mesero y total).

```
  ① Cuentas por cobrar ─── ② Contar efectivo ─── ③ Corte

  ┌──────────────────────────────────────────────────────────────┐
  │ ⚠ Faltan 2 cuentas por cobrar                                │
  │ Para cerrar el día, todas las cuentas deben estar cobradas.  │
  └──────────────────────────────────────────────────────────────┘
  ┌──────────────────────────────────────────────────────────────┐
  │ Mesa 3 · Luis · abierta hace 2 h 10 min  $485.00 [Ir a cobrar]│
  ├──────────────────────────────────────────────────────────────┤
  │ Mesa 7 · Ana · abierta hace 25 min         $0.00 [Ir a cobrar]│
  │ Sin platillos                                                │
  └──────────────────────────────────────────────────────────────┘

                                       [ Contar efectivo → ] (deshabilitado)
```

- Aviso ámbar (estilo de 17.2): "**Faltan 2 cuentas por cobrar**" /
  "Para cerrar el día, todas las cuentas deben estar cobradas."
- Lista: mesa y mesero `--t-l`, tiempo abierta `--t-s` `--c-texto-2`, total
  `--t-l` 700, botón secundario 48 px **"Ir a cobrar"** → `/caja/:ordenId`.
  Cuenta sin platillos: texto extra "Sin platillos" (en Caja se libera con
  "Liberar mesa").
- Botón primario 56 px **"Contar efectivo →"** deshabilitado mientras haya
  cuentas, con razón debajo: "Cobra o libera las cuentas para seguir."
- Cuando la lista llega a 0 (por el polling): el aviso cambia a verde
  "Todas las cuentas están cobradas ✓" y el botón se habilita (no avanza solo).

### 18.2 Paso 2 — Contar efectivo

```
  ✓ Cuentas por cobrar ─── ② Contar efectivo ─── ③ Corte

  Cuenta todo el efectivo que hay en la caja, incluido el fondo.

  BILLETES                                 MONEDAS
  ┌────────────────────────────────────┐   ┌────────────────────────────────────┐
  │ $1,000  [−] [  2 ] [+]   $2,000.00 │   │ $10     [−] [ 14 ] [+]     $140.00 │
  │ $500    [−] [  3 ] [+]   $1,500.00 │   │ $5      [−] [  9 ] [+]      $45.00 │
  │ $200    [−] [  4 ] [+]     $800.00 │   │ $2      [−] [  6 ] [+]      $12.00 │
  │ $100    [−] [  0 ] [+]       $0.00 │   │ $1      [−] [  7 ] [+]       $7.00 │
  │ $50     [−] [  5 ] [+]     $250.00 │   │ 50¢     [−] [  3 ] [+]       $1.50 │
  │ $20     [−] [ 11 ] [+]     $220.00 │   │                                    │
  │ Billetes                 $4,770.00 │   │ Monedas                    $205.50 │
  └────────────────────────────────────┘   └────────────────────────────────────┘
  ──────────────────────────────────────────────────────────────────────────────
  Total contado                                                    $4,975.50
  [ Empezar de nuevo ]                              [ Revisar y cerrar el día ]
```

Distribución: dos tarjetas lado a lado ("Billetes" y "Monedas", títulos en
mayúsculas `--t-s` 700 `--c-texto-2`). En pantallas < 1024 px, una debajo de la otra.

**Fila por denominación** (56 px de alto, separador 1 px):
- Denominación `--t-l` 700, ancho fijo 88 px.
- Botón **[−]** 48×48 (`aria-label="Menos billetes de $500"`), deshabilitado en 0.
- Campo numérico 80 px de ancho, 48 px de alto, `--t-l` centrado,
  `inputmode="numeric"`, solo enteros ≥ 0 (otra cosa: no se acepta la tecla).
  Etiqueta accesible "Billetes de $500" / "Monedas de $10" / "Monedas de 50¢".
  Al enfocar se selecciona todo el texto (escribir reemplaza). Vacío = 0.
- Botón **[+]** 48×48.
- Subtotal de la fila alineado a la derecha `--t-m`, `tabular-nums`; en
  `--c-texto-2` si es $0.00.
- Teclado: Tab y **Enter** pasan al siguiente campo (de $1,000 a 50¢);
  ↑/↓ suman o restan 1.

Bajo cada tarjeta: subtotal "Billetes $4,770.00" / "Monedas $205.50" `--t-m` 600.

**Barra inferior fija** (88 px, fondo `--c-superficie`, sombra hacia arriba):
- "Total contado" `--t-l` y el monto en **`--t-3xl` 800** a la derecha.
- Botón de texto **"Empezar de nuevo"** (pide confirmación simple: "¿Borrar el
  conteo? Se pondrán todas las cantidades en 0." · "Cancelar" / "Borrar conteo").
- Botón primario 64 px **"Revisar y cerrar el día"** → diálogo 18.3. Siempre
  habilitado (contar $0.00 es posible, ver el diálogo).

**Corte a ciegas:** en este paso **no** aparece ni el esperado ni pistas
("te faltan…"). Solo lo que la persona cuenta.

**Guardado:** el conteo se guarda en `localStorage` (`conteo-jornada-<id>`) en
cada cambio, para que sobreviva a una recarga, a ir a cobrar una cuenta o a
"← Caja". Se borra al cerrar con éxito.

### 18.3 Paso 2½ — Confirmación

Diálogo 480 px:
- Título: **"¿Cerrar el día con $4,975.50 contado?"**
- Texto: "Ya no se puede modificar. Después verás el corte completo."
- Si el total es $0.00, aviso ámbar extra: "No capturaste efectivo. ¿Seguro
  que la caja está vacía?"
- Resumen pequeño `--t-s` `--c-texto-2`: "Billetes $4,770.00 · Monedas $205.50".
- Botones: **"Seguir contando"** (secundario, con foco inicial para evitar
  cerrar por accidente con Enter) / **"Cerrar el día"** (primario).
  En curso: "Cerrando el día…"; el diálogo no se puede cerrar mientras espera.
- → `POST /api/jornada/cerrar { conteo }` con **las 11 denominaciones** como
  llaves de texto (`"100000"` … `"50"`), incluidas las de 0.
- Éxito: guardar `jornada.id` en `localStorage` como `ultimo-corte-id`, guardar
  el `Corte` recibido en memoria y navegar a `/caja/corte` (Paso 3).

Errores 409 (ver 21):
- Con `cuentas_abiertas`: cerrar el diálogo, volver al **Paso 1** mostrando esa
  lista (el conteo se conserva) y toast con el mensaje del servidor.
- Sin día abierto: toast "Este día ya se cerró." y navegar a `/caja`.

---

## 19. C3 / D2 — Corte

Misma vista (componente **`VistaCorte`**) para la caja al cerrar (`/caja/corte`)
y para el dueño (`/cortes/:id`). Contenido centrado, máx. **1120 px**, fondo
`--c-fondo`, tarjetas blancas (radio 16, padding 24, sombra de tarjeta),
separación 24 px. Scroll normal de página.

**Datos:** C3 usa el `Corte` que regresó el cierre; si no lo tiene (recarga),
`GET /api/jornadas/<ultimo-corte-id>/corte`. D2: `GET /api/jornadas/:id/corte`
(si la jornada está abierta, recargar cada 30 s).

### 19.1 Boceto (1440×900, caja recién cerrada)

```
┌ Comandas · Corte ──────────────────────────────────────────────── Caja  [Salir] ┐
│  ✓ Cuentas por cobrar ─── ✓ Contar efectivo ─── ③ Corte                         │
│                                                                                 │
│  Corte del jueves 20 de noviembre de 2026            [ Imprimir ▾ ]  [ Listo ]  │
│  Abierto 9:02 a.m. por Caja · Cerrado 11:48 p.m. por Caja                       │
│                                                                                 │
│ ┌ EFECTIVO EN CAJA ─────────────────────────────┐ ┌ TARJETA Y TRANSFERENCIA ──┐ │
│ │ ┌───────────────────────────────────────────┐ │ │ Tarjeta        $6,230.40  │ │
│ │ │            Faltan $74.50                  │ │ │ Compara con los vouchers  │ │
│ │ └───────────────────────────────────────────┘ │ │ de la terminal.           │ │
│ │ Debía haber                       $5,050.00   │ │                           │ │
│ │ Contaste                          $4,975.50   │ │ Transferencia  $1,120.00  │ │
│ │ Diferencia                          −$74.50   │ │ Compara con los depósitos │ │
│ │ ───────────────────────────────────────────   │ │ del banco.                │ │
│ │ Cómo se calcula lo que debía haber            │ │ ───────────────────────── │ │
│ │ Fondo inicial                   + $1,000.00   │ │ Total cobrado $11,400.40  │ │
│ │ Cobrado en efectivo             + $4,800.00   │ │ (todas las formas)        │ │
│ │ Salidas                         −   $750.00   │ └───────────────────────────┘ │
│ │ Debía haber                     = $5,050.00   │                               │
│ │ Ver conteo por denominación ▾                 │                               │
│ └───────────────────────────────────────────────┘                               │
│ ┌ VENTAS ───────────────────────────────────────────────────────────────────┐   │
│ │ Cuentas   Ventas (sin propina)   Propinas    Total cobrado  Ticket promedio│   │
│ │   42        $10,200.00           $1,200.40   $11,400.40        $242.86     │   │
│ └───────────────────────────────────────────────────────────────────────────┘   │
│ ┌ PROPINAS POR MESERO ──────────────────────────────────────────────────────┐   │
│ │ Mesero   Cuentas   Efectivo    Tarjeta   Transferencia     Total           │   │
│ │ Luis        18     $310.00    $402.50         $40.00     $752.50           │   │
│ │ Ana         15     $180.00    $230.40         $37.50     $447.90           │   │
│ │ Total       33     $490.00    $632.90         $77.50   $1,200.40           │   │
│ └───────────────────────────────────────────────────────────────────────────┘   │
│ ┌ PROPINAS POR MESA ────────────┐ ┌ SALIDAS ─────────────────────────────────┐  │
│ │ Mesa 3     6 cuentas  $310.00 │ │ 6:40 p.m. Propinas a meseros  $600.00   │  │
│ │ Mesa 1     5 cuentas  $250.40 │ │ 1:15 p.m. Hielo               $150.00   │  │
│ │ ...                           │ │ 11:02 a.m. Tortillas (Anulada)  $80.00  │  │
│ └───────────────────────────────┘ │ Total de salidas              $750.00   │  │
│                                   └─────────────────────────────────────────┘  │
│ [ Ver las 42 cuentas ▾ ]                                                        │
└─────────────────────────────────────────────────────────────────────────────────┘
```

Grid: fila 1 → Efectivo (≈ 60 %) + Tarjeta y transferencia (≈ 40 %); Ventas a
todo lo ancho; Propinas por mesero a todo lo ancho; fila → Propinas por mesa +
Salidas (50/50); Cuentas a todo lo ancho. En < 1024 px, todo en una columna en
ese mismo orden. Títulos de tarjeta en mayúsculas `--t-s` 700 `--c-texto-2`.

### 19.2 Encabezado del corte

1. Indicador de pasos (solo C3).
2. Título **"Corte del jueves 20 de noviembre de 2026"** `--t-2xl`. En D2 con
   jornada abierta: "Corte parcial del jueves 20 de noviembre de 2026" + insignia
   neutra **"En curso"**.
3. Subtítulo `--t-s` `--c-texto-2`: "Abierto 9:02 a.m. por Caja · Cerrado
   11:48 p.m. por Caja". Si cerró otro día: "Cerrado el viernes 21 a las 12:35 a.m.
   por Caja". Abierta: "Abierto 9:02 a.m. por Caja · Sigue abierto".
4. Botones a la derecha:
   - **"Imprimir ▾"** (secundario) → menú de 2 opciones: "Hoja carta" y
     "Ticket (80 mm)" (ver 19.10). Se recuerda la última opción.
   - **"Listo"** (primario, solo C3) → `/caja` (queda en Estado A).
   - D2: en lugar de "Listo", botón de regreso **"← Cortes"** en el encabezado común.
5. D2 abierta: aviso neutro debajo (fondo `--c-superficie-2`, radio 12):
   "El día sigue abierto: estas cifras pueden cambiar. El efectivo contado y la
   diferencia aparecerán cuando la caja cierre el día." + "Actualizado 4:12 p.m."

### 19.3 Tarjeta "Efectivo en caja" (la más importante)

1. **Caja de resultado** (alto 96 px, radio 12, ancho completo, colores según
   tabla 16.3): texto centrado en `--t-3xl` 800: "Cuadra ✓" / "Sobran $25.00"
   / "Faltan $74.50". Abierta: "Sin contar todavía" en `--t-xl` `--c-texto-2`.
2. Tres renglones `--t-l` (montos a la derecha, `tabular-nums`):
   - "Debía haber" → `efectivo.esperado`
   - "Contaste" → `efectivo.contado` (abierta: "—")
   - "Diferencia" → con signo (+$25.00 / −$74.50 / $0.00) en el color de la tabla
     (abierta: "—").
3. Separador. Subtítulo "Cómo se calcula lo que debía haber" `--t-s` 600 y
   desglose `--t-m`:
   - "Fondo inicial" `+ $1,000.00`
   - "Cobrado en efectivo" `+ $4,800.00` y debajo en `--t-xs` `--c-texto-2`:
     "Incluye propinas pagadas en efectivo."
   - "Salidas" `− $750.00`
   - Línea y "Debía haber" `= $5,050.00` 700.
4. Botón de texto **"Ver conteo por denominación ▾"** (plegado). Abierto: tabla
   compacta de 3 columnas "Denominación · Cantidad · Importe" solo con las
   filas > 0, y total. No aparece si `conteo` es null.

### 19.4 Tarjeta "Tarjeta y transferencia"

- "Tarjeta" `--t-l` y monto `--t-xl` 700; debajo `--t-xs` `--c-texto-2`:
  "Compara con los vouchers de la terminal."
- "Transferencia" igual; ayuda: "Compara con los depósitos del banco."
- Separador; "Total cobrado" (efectivo + tarjeta + transferencia) `--t-l` 700 y
  "(todas las formas, con propinas)" `--t-xs`.

### 19.5 Tarjeta "Ventas"

Cinco cifras en fila (en < 1024 px, cuadrícula de 2 columnas). Cada una: etiqueta
`--t-s` `--c-texto-2` arriba y valor `--t-2xl` 700:
"Cuentas" (42) · "Ventas (sin propina)" (`subtotal`) · "Propinas" ·
"Total cobrado" (`total`) · "Ticket promedio" (`ticket_promedio`, ayuda
`--t-xs`: "Por cuenta, sin propina").
Sin cuentas: las cifras en $0.00 y el texto "No se cobró ninguna cuenta este día."

### 19.6 Tarjeta "Propinas por mesero"

Tabla (filas de 48 px, cifras alineadas a la derecha, cebra con `--c-superficie-2`):

| Mesero | Cuentas con propina | Efectivo | Tarjeta | Transferencia | **Total** |
|---|---|---|---|---|---|

- Orden: el que viene de la API (mayor total primero). Columna Total en 700.
- Última fila **"Total"** en 700 con borde superior 2 px `--c-texto`.
- Ayuda bajo la tabla `--t-xs` `--c-texto-2`: "Si una cuenta se pagó con varias
  formas, la propina se reparte entre ellas en proporción."
- Vacío: "No hubo propinas este día."

### 19.7 Tarjeta "Propinas por mesa"

Lista simple: "Mesa 3" · "6 cuentas" `--c-texto-2` · monto 700 a la derecha.
Mayor total primero. Si hay más de 8, mostrar 8 y botón de texto
"Ver todas (14) ▾". Vacío: "No hubo propinas este día."

### 19.8 Tarjeta "Salidas"

Mismas filas que 17.5 pero **sin** botón "Anular" (solo lectura); anuladas
tachadas con insignia "Anulada". Pie "Total de salidas" (sin anuladas).
Vacío: "No hubo salidas de efectivo."

### 19.9 Lista de cuentas (plegable)

Botón secundario ancho completo 56 px **"Ver las 42 cuentas ▾"** /
"Ocultar cuentas ▴". Plegado por omisión. Abierto, tabla (más reciente primero):

| Hora | Mesa | Mesero | Cobró | Subtotal | Propina | Total | Pago |
|---|---|---|---|---|---|---|---|
| 11:20 p.m. | Mesa 3 | Luis | Caja | $485.00 | $72.75 | $557.75 | Efectivo $300.00 · Tarjeta $257.75 |

En < 1024 px cada cuenta es una tarjeta de 3 líneas (mesa · mesero · hora /
subtotal + propina = total / pago).

### 19.10 Imprimir

`window.print()` con hoja de estilos `@media print` (archivo `src/imprimir.css`).
Antes de imprimir, poner en `<body>` la clase `imprimir-carta` o
`imprimir-ticket` según la opción elegida, y quitarla en `afterprint`.

Reglas comunes de impresión:
- Ocultar: encabezado común, indicador de pasos, botones, barra "Sin conexión",
  toasts, avisos de "corte parcial" (se reemplaza por la palabra "PARCIAL" en el
  título).
- Blanco y negro: texto `#000`, fondos blancos, sin sombras; tarjetas con borde
  1 px `#000`. El resultado de efectivo se imprime con **texto** ("FALTAN
  $74.50", "SOBRAN $25.00", "CUADRA") en negritas dentro de un recuadro de 2 px.
- Desplegar el conteo por denominación. Evitar cortes dentro de una tarjeta
  (`break-inside: avoid`).
- Al pie: "Impreso el 20/11/2026 11:52 p.m. · Comandas" y dos líneas de firma:
  "Entregó: ____________" "Recibió: ____________".

**Hoja carta** (`@page { size: letter; margin: 12mm }`): letra 11 pt, mismo
orden de tarjetas a una columna salvo Efectivo + Tarjeta en dos columnas.
La lista de cuentas se imprime solo si estaba desplegada en pantalla.

**Ticket 80 mm** (`@page { size: 80mm auto; margin: 3mm }`): una columna de
74 mm, letra 12 pt, tablas convertidas en renglones "Nombre ..... $monto".
Incluye: título y horario, efectivo (resultado, debía haber, contaste,
desglose, conteo), tarjeta, transferencia, ventas, salidas, propinas por mesero
(solo Nombre y Total, y una línea "Ef $310.00 · Tj $402.50 · Tr $40.00").
**No** incluye propinas por mesa ni lista de cuentas.

### 19.11 Último corte para la caja

La caja solo puede ver la **última jornada cerrada**. La pantalla guarda
`ultimo-corte-id` al cerrar y lo usa en `/caja/corte` y en el enlace "Ver el
último corte" (17.1). Si no existe o responde 403/404: mensaje en lugar del
corte "Ese corte ya no está disponible. Pídele al dueño que lo revise." +
botón "← Caja" (en esta pantalla el 403 **no** redirige a la pantalla inicial).

---

## 20. Vistas del dueño

### 20.1 P3 — Elegir vista (cambio)

Cuarta tarjeta, mismo estilo: **"Cortes y propinas"** — "Cortes del día y
reparto de propinas" → `/cortes`. Con 4 tarjetas: cuadrícula de 2×2 (alto
180 px cada una) en pantallas < 1280 px y fila de 4 en ≥ 1280 px.

### 20.2 Navegación interna

Encabezado común con vista "Cortes" o "Propinas" (+ "Cambiar vista" y "Salir").
Debajo, **pestañas** (chips 48 px, alineadas a la izquierda, margen 24 px):
**"Historial de cortes"** (`/cortes`) · **"Reporte de propinas"** (`/propinas`).
En D2 no hay pestañas; hay "← Cortes" en el encabezado.

Contenido máx. 1120 px centrado. Pensado para computadora y tablet (≥ 768 px);
en tablet, tamaños táctiles de tablet (filas 56 px, texto base `--t-m`).

### 20.3 D1 — Historial de cortes (`/cortes`)

**Datos:** `GET /api/jornadas` al entrar y cada 30 s (no hace falta 3 s).

```
┌ Comandas · Cortes ─────────────────────── Dueño · Dueño [Cambiar vista] [Salir] ┐
│ (Historial de cortes) ( Reporte de propinas )                                   │
│                                                                                 │
│ Fecha          Horario                  Cerró   Cuentas   Total     Propinas  Efectivo   │
│ Vie 21 nov     9:05 a.m. – …            —          18   $4,310.00  $420.00 [En curso]  › │
│ Jue 20 nov     9:02 a.m. – 11:48 p.m.   Caja       42  $11,400.40 $1,200.40 [Faltan $74.50] ›│
│ Mié 19 nov     9:10 a.m. – 11:30 p.m.   Caja       37   $9,880.00  $990.00 [Cuadra ✓]  › │
│ Mar 18 nov     9:00 a.m. – 11:15 p.m.   Dueño      35   $9,120.50  $905.00 [Sobran $20.00]›│
│ ...                                                                             │
│ Se muestran los últimos 90 días.                                                │
└─────────────────────────────────────────────────────────────────────────────────┘
```

- Tabla con encabezados `--t-s` 700 `--c-texto-2`. Filas de 56 px, toda la fila
  clicable (y Enter con teclado) → `/cortes/:id`, con "›" al final.
- Columnas: **Fecha** (fecha corta de `abierta_en`), **Horario** ("9:02 a.m. –
  11:48 p.m."; abierta: "9:05 a.m. – …"), **Cerró** (`cerrada_por_nombre` o "—"),
  **Cuentas**, **Total** (`total`, con propinas), **Propinas**, **Efectivo**
  (insignia `Diferencia` de 16.3).
- La jornada abierta va arriba con fondo `--c-primario-suave` e insignia
  **"En curso"**.
- En < 1024 px: tarjetas de 2 líneas: "Jue 20 nov · 9:02 a.m. – 11:48 p.m." +
  insignia a la derecha / "42 cuentas · Total $11,400.40 · Propinas $1,200.40".
- Pie `--t-xs` `--c-texto-2`: "Se muestran los últimos 90 días."
- Vacío: "Todavía no hay cortes." / "El primero aparecerá cuando la caja abra
  el día."

### 20.4 D2 — Detalle del corte (`/cortes/:id`)

Es `VistaCorte` (sección 19) sin indicador de pasos y sin "Listo". Si la
jornada está abierta: corte parcial (19.2–19.3), recarga cada 30 s, botón
"Imprimir" disponible (imprime con la palabra "PARCIAL").
404: "No encontramos ese corte." + "← Cortes".

### 20.5 D3 — Reporte de propinas (`/propinas`)

**Datos:** `GET /api/reportes/propinas?desde=…&hasta=…` al cambiar el rango.

```
┌ Comandas · Propinas ───────────────────── Dueño · Dueño [Cambiar vista] [Salir] ┐
│ ( Historial de cortes ) (Reporte de propinas)                                   │
│                                                                                 │
│ (Hoy) (Esta semana) (Semana pasada) (Este mes)                                  │
│ Desde [17/11/2026]  Hasta [20/11/2026]                                          │
│                                                                                 │
│ Del lunes 17 al jueves 20 de noviembre · 4 días con corte                       │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐             │
│ │ Total propinas│ │ Efectivo     │ │ Tarjeta      │ │ Transferencia│             │
│ │ $4,120.30    │ │ $1,630.00    │ │ $2,200.30    │ │ $290.00      │             │
│ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘             │
│ ┌ POR MESERO ─────────────────────────────────────────────────────────────┐     │
│ │ Mesero  Cuentas con propina  Efectivo   Tarjeta  Transferencia   Total  │     │
│ │ Luis            61           $980.00  $1,300.10     $150.00  $2,430.10  │     │
│ │ Ana             49           $650.00    $900.20     $140.00  $1,690.20  │     │
│ │ Total          110         $1,630.00  $2,200.30     $290.00  $4,120.30  │     │
│ └─────────────────────────────────────────────────────────────────────────┘     │
│ ┌ POR MESA ──────────────────────────────┐                     [ Imprimir ▾ ]   │
│ │ Mesa       Cuentas con propina   Total  │                                     │
│ │ Mesa 3            22          $910.00   │                                     │
│ │ ...                                     │                                     │
│ │ Total            110        $4,120.30   │                                     │
│ └─────────────────────────────────────────┘                                     │
└─────────────────────────────────────────────────────────────────────────────────┘
```

1. **Atajos** (chips 48 px, uno seleccionado): **"Hoy"** (por omisión), **"Esta
   semana"** (lunes a hoy), **"Semana pasada"** (lunes a domingo anteriores),
   **"Este mes"** (día 1 a hoy). Fechas calculadas en hora de México
   (`America/Mexico_City`). Se recuerda el último en `localStorage`.
2. **Rango personalizado**: dos campos `type="date"` "Desde" y "Hasta" (48 px).
   Al cambiarlos se deselecciona el chip. Se consulta al salir del campo o con
   Enter, no en cada tecla.
   - Desde > Hasta → borde `--c-peligro` y "La fecha 'Desde' debe ser antes de
     'Hasta'." (no se consulta).
   - Más de 93 días → "El rango máximo es de 93 días." (no se consulta).
3. **Resumen** `--t-m`: "Del lunes 17 al jueves 20 de noviembre · 4 días con
   corte" (`jornadas`; 1 → "1 día con corte"). Si el rango incluye hoy y hay
   día abierto, agregar `--t-xs` `--c-texto-2`: "Incluye el día en curso; puede
   cambiar."
4. **Cuatro cifras** (tarjetas pequeñas, `--t-2xl` 700): Total propinas,
   Efectivo, Tarjeta, Transferencia (sumas de `por_mesero`).
5. **Por mesero**: tabla igual a 19.6 con fila Total.
6. **Por mesa**: tabla Mesa · Cuentas con propina · Total, con fila Total.
   (En ≥ 1280 px puede ir junto a "Por mesero" si cabe; si no, debajo.)
7. **"Imprimir ▾"** (mismas opciones y reglas de 19.10; título impreso
   "Reporte de propinas · del 17 al 20 de noviembre de 2026").

Estados: al cambiar de rango, las tablas se quedan con opacidad 50 % y un
spinner pequeño junto al resumen (no se vacía la pantalla). Sin datos:
"No hay propinas en estas fechas." y las cifras en $0.00.

---

## 21. Estados, errores y mensajes

| Situación | Dónde | Qué se ve |
|---|---|---|
| Carga inicial (Caja, C2, Corte, D1, D3) | pantalla | Spinner + "Cargando…" (sección 4) |
| Error al cargar `jornada/actual` | C1 | Pantalla: "No pudimos revisar si el día está abierto." + "Reintentar". (No se muestra la Caja hasta saberlo.) |
| Error al cargar corte / historial / reporte | C3, D1, D2, D3 | "No pudimos cargar el corte." / "…el historial." / "…el reporte." + "Reintentar" |
| Sin conexión | todas | Barra "Sin conexión. Reintentando…" (sección 4). En C2 el conteo sigue editable y guardado localmente; "Cerrar el día" muestra error si falla y no pierde el conteo |
| **409** cobrar sin día (`pagar`) | C1 | Toast "Primero abre el día capturando el fondo de caja." · conserva captura · abre diálogo "Abrir el día" |
| **409** abrir con día ya abierto | C1 | Toast con el mensaje del servidor (respaldo: "El día ya está abierto.") · cierra el diálogo · recarga y pasa a Estado C |
| **409** salida sin día abierto | 17.4 | Toast con el mensaje (respaldo: "El día ya se cerró. No se pueden registrar salidas.") · cierra el diálogo · recarga |
| **409** anular (día ya cerrado) | 17.5 | Toast con el mensaje (respaldo: "Este día ya se cerró; la salida no se puede anular.") · cierra diálogos · recarga |
| **409** cerrar con cuentas abiertas | C2 | Vuelve al Paso 1 con la lista `cuentas_abiertas`; toast con el mensaje (respaldo: "Hay cuentas sin cobrar. Cóbralas antes de cerrar el día.") · conserva el conteo |
| **409** cerrar sin día abierto | C2 | Toast "Este día ya se cerró." · navega a `/caja` |
| 403 corte para caja | C3 | "Ese corte ya no está disponible. Pídele al dueño que lo revise." (sin redirigir) |
| 400 en abrir / salida (monto o motivo inválido) | diálogos | Toast con el mensaje del servidor; el diálogo se queda abierto |
| 400 reporte (rango) | D3 | Mensaje bajo las fechas con el texto del servidor |
| El día se cerró desde otro equipo mientras la caja trabaja | C1 | Por el polling: el panel pasa a "El día no está abierto"; toast "El día se cerró desde otro equipo." (una vez) |
| El día se abrió desde otro equipo | C1 | El panel pasa a "Día abierto…" sin toast; se cierra el diálogo "Abrir el día" si estaba abierto |

Botones en curso (gerundio, deshabilitados): "Abriendo…", "Registrando…",
"Anulando…", "Cerrando el día…".

---

## 22. Catálogo de textos (Entrega 2)

| Clave | Texto |
|---|---|
| Abrir | Abrir el día · Cuenta el efectivo con el que empieza la caja (el fondo para dar cambio). · Fondo de caja · El fondo no se puede cambiar después. · Abrir el día con {monto} · Abriendo… · Día abierto ✓ |
| Sin día | El día no está abierto. · Para cobrar, primero captura el fondo de caja. · Abre el día para poder cobrar. |
| Panel Día | Día abierto desde {hora} · Fondo {monto} · − Salida de efectivo · Salidas de hoy ({n}) · Sin salidas hoy · Cerrar el día · Ver corte parcial |
| Salida | Salida de efectivo · Dinero que sale de la caja durante el día. · Monto · Motivo · ej. Refrescos para la tienda · Registrar salida {monto} · Escribe el monto y el motivo. · Salida registrada ✓ |
| Motivos | Hielo · Tortillas · Gas · Propinas a meseros · Retiro del dueño |
| Salidas | Salidas de hoy · Total de salidas · Anular · Anulada · anulada por {nombre} · No hay salidas hoy. · ¿Anular esta salida? · No, dejarla · Anular salida · Salida anulada ✓ |
| Pasos | Cuentas por cobrar · Contar efectivo · Corte · ← Caja |
| Paso 1 | Faltan {n} cuentas por cobrar · Para cerrar el día, todas las cuentas deben estar cobradas. · Ir a cobrar · Sin platillos · Cobra o libera las cuentas para seguir. · Todas las cuentas están cobradas ✓ · Contar efectivo → |
| Paso 2 | Cuenta todo el efectivo que hay en la caja, incluido el fondo. · Billetes · Monedas · Total contado · Empezar de nuevo · ¿Borrar el conteo? · Borrar conteo · Revisar y cerrar el día |
| Confirmar | ¿Cerrar el día con {monto} contado? · Ya no se puede modificar. Después verás el corte completo. · No capturaste efectivo. ¿Seguro que la caja está vacía? · Seguir contando · Cerrar el día · Cerrando el día… |
| Corte | Corte del {fecha} · Corte parcial del {fecha} · En curso · Abierto {hora} por {nombre} · Cerrado {hora} por {nombre} · Sigue abierto · Imprimir · Hoja carta · Ticket (80 mm) · Listo |
| Efectivo | Efectivo en caja · Cuadra ✓ · Sobran {monto} · Faltan {monto} · Sin contar todavía · Debía haber · Contaste · Diferencia · Cómo se calcula lo que debía haber · Fondo inicial · Cobrado en efectivo · Incluye propinas pagadas en efectivo. · Salidas · Ver conteo por denominación |
| Otros pagos | Tarjeta y transferencia · Compara con los vouchers de la terminal. · Compara con los depósitos del banco. · Total cobrado |
| Ventas | Ventas · Cuentas · Ventas (sin propina) · Propinas · Total cobrado · Ticket promedio · Por cuenta, sin propina · No se cobró ninguna cuenta este día. |
| Propinas | Propinas por mesero · Propinas por mesa · Cuentas con propina · Si una cuenta se pagó con varias formas, la propina se reparte entre ellas en proporción. · No hubo propinas este día. |
| Cuentas | Ver las {n} cuentas · Ocultar cuentas · Hora · Mesa · Mesero · Cobró · Subtotal · Propina · Total · Pago |
| Dueño | Cortes y propinas · Cortes del día y reparto de propinas · Historial de cortes · Reporte de propinas · Se muestran los últimos 90 días. · Todavía no hay cortes. · ← Cortes |
| Reporte | Hoy · Esta semana · Semana pasada · Este mes · Desde · Hasta · {n} días con corte · Incluye el día en curso; puede cambiar. · El rango máximo es de 93 días. · No hay propinas en estas fechas. |
| Impresión | Impreso el {fecha} {hora} · Entregó: · Recibió: · PARCIAL |

---

## 23. Accesibilidad (añadidos)

- Contador de denominaciones: cada campo con etiqueta accesible completa
  ("Billetes de $500"); el total contado en región `aria-live="polite"`.
- Resultado del corte ("Faltan $74.50") se anuncia al cargar C3
  (`aria-live="polite"`).
- Tablas con `<th scope="col">`; filas clicables de D1 son `<a>` o botones con
  foco visible.
- En C2, el foco inicial es el campo de $1,000.

---

## 24. Decisiones a confirmar con la persona (Entrega 2)

1. **El fondo no se puede corregir** una vez abierto el día (el contrato no lo
   permite). Si se equivocan, la diferencia saldrá en el corte. ¿Está bien, o
   quieren poder corregirlo?
2. **"Cuadra" solo si la diferencia es exactamente $0.00.** ¿Quieren un margen
   (ej. ±$5) para no marcar faltantes por monedas?
3. **Sobrante en ámbar, faltante en rojo.** ¿Les parece?
4. **Propinas en efectivo**: entran a la caja y, si se reparten a los meseros
   el mismo día, se registran como salida "Propinas a meseros". ¿Así lo hacen?
5. **La semana empieza en lunes** en el reporte de propinas.
6. **El dueño, en la vista Caja, también trabaja "a ciegas"** (ve las cifras en
   "Cortes y propinas").
7. **Para el programador/servidor:** la caja no tiene cómo saber cuál es "la
   última jornada cerrada" si cerró desde otra computadora o se borró el
   navegador (`GET /api/jornadas` es solo del dueño). Se usa `localStorage`;
   conviene agregar `GET /api/jornadas/ultima-cerrada` (caja, dueno) en el
   contrato.
