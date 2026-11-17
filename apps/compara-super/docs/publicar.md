# Comparar Súper — Cómo publicar en internet

La app (lo que se ve) y el servidor (los datos) se publican **juntos, en una sola
dirección** de Cloudflare, por ejemplo `https://comparar-super-servidor.<tu-cuenta>.workers.dev`.
Las pantallas están en `/` y los datos en `/api/...`. No hace falta comprar nada: el
plan gratuito de Cloudflare alcanza para empezar.

No hay llaves ni contraseñas secretas que conseguir. Solo una cuenta de Cloudflare.

## Lo que necesitas una sola vez

1. **Una cuenta de Cloudflare** (gratis): entra a https://dash.cloudflare.com/sign-up y regístrate con tu correo.
2. **Node.js 20 o más nuevo** instalado en tu computadora.
3. Abrir una terminal en la carpeta del servidor e instalar lo necesario:

   ```bash
   cd apps/compara-super/servidor
   npm install
   npm --prefix ../app install
   ```

## Paso 1 — Conectar tu computadora con Cloudflare

```bash
npx wrangler login
```

Se abre el navegador; acepta el permiso. Con eso tu computadora puede publicar en tu cuenta.

## Paso 2 — Crear la base de datos (solo la primera vez)

```bash
npx wrangler d1 create comparar-super
```

Te va a mostrar algo como:

```
database_name = "comparar-super"
database_id = "1a2b3c4d-...."
```

Copia ese `database_id` y pégalo en `servidor/wrangler.toml`, reemplazando el marcador
`00000000-0000-0000-0000-000000000000`:

```toml
database_id = "1a2b3c4d-...."   # el tuyo
```

## Paso 3 — Preparar las tablas en la base de datos

```bash
npm run db:migrate:remote
```

(Es lo mismo que `npx wrangler d1 migrations apply comparar-super --remote`.) Responde
que sí cuando pregunte. Repite este paso solo cuando haya archivos nuevos en `servidor/migrations/`.

## Paso 4 — Publicar

```bash
npm run deploy
```

Esto hace dos cosas: primero construye la app (`app/dist`) y después sube la app y el
servidor a Cloudflare. Al final muestra la dirección pública (`https://....workers.dev`).
Ábrela en el celular: ya puedes crear tu cuenta y comparar.

Para publicar cambios más adelante, solo repite el **Paso 4** (y el 3 si hay migraciones nuevas).

## Ajustes opcionales

- **Límites de intentos** (registros por conexión, búsquedas, comparaciones, contraseñas
  incorrectas): se cambian en la sección `[vars]` de `servidor/wrangler.toml` y se aplican
  al volver a publicar. Están explicados ahí mismo y en `docs/datos-y-api.md`.
- **Dominio propio** (p. ej. `comparar.tudominio.hn`): en el panel de Cloudflare →
  Workers → `comparar-super-servidor` → Settings → Domains & Routes. Requiere tener el dominio en Cloudflare.
- **No** copies `.dev.vars` a Cloudflare: el modo de datos de prueba (`PRECIOS_MODO=fixtures`)
  es solo para tu computadora; publicado siempre consulta los precios reales de las tiendas.

## Si algo falla

| Mensaje | Qué hacer |
|---|---|
| `You are not authenticated` / pide login | Repite el Paso 1. |
| `database_id ... 00000000` o "database not found" | Falta el Paso 2 (pegar tu `database_id`). |
| `no such table: usuarios` al usar la app | Falta el Paso 3. |
| `The directory specified by the "assets.directory" field ... does not exist` | La app no se construyó: usa `npm run deploy` (no `npx wrangler deploy` directo). |
| Error al construir la app | Ejecuta `npm --prefix ../app install` y vuelve a intentar. |
