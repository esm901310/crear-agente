# Comandas del restaurante

App web para meseros, cocina y caja. Ver `docs/proyecto.md` (qué es y contrato)
y `docs/datos-y-api.md` (base de datos y API con ejemplos).

## Correr en tu computadora

Requisitos: Node.js 20 o más reciente.

```bash
npm install
npm run db:migrate   # crea las tablas en la base de datos local (.wrangler/)
npm run db:seed      # carga usuarios, mesas y menú de ejemplo (borra lo anterior)
npm run dev:api      # servidor en http://localhost:8787
```

En otra terminal, las pantallas:

```bash
npm run dev          # pantallas en http://localhost:5173 (redirige /api a 8787)
```

O ambos juntos con `npm run dev:todo`. Abre http://localhost:5173 en el navegador.

Prueba rápida del servidor:

```bash
curl http://localhost:8787/api/usuarios-login
curl -X POST http://localhost:8787/api/login \
  -H 'Content-Type: application/json' -d '{"usuario_id":2,"pin":"1111"}'
```

PIN de prueba: Dueño 0000 · Ana 1111 · Luis 2222 · Cocina 3333 · Caja 4444.

Otros comandos:
- `npm run typecheck` — revisa el TypeScript del servidor y de las pantallas.
- `npm run build` — genera las pantallas en `dist/` (las sirve el Worker).
- `npm run db:reset` — borra la base local y la vuelve a crear con datos de ejemplo.

No hace falta cuenta de Cloudflare para trabajar en local. Para publicar
(Entrega 4) habrá que crear la base con `npx wrangler d1 create comandas-db`
y poner su `database_id` en `wrangler.jsonc`.

## Publicación (Entrega 4)

- Dirección: https://lechon-playero.esm901310.workers.dev
- Cloudflare Worker `lechon-playero` + base D1 `comandas-db` (id en `wrangler.jsonc`).
- Las pantallas van empaquetadas dentro del Worker (`scripts/empaquetar-pantallas.mjs`
  genera `worker/pantallas.generated.ts` al correr `npm run build`).
- Publicar una nueva versión: `npm run deploy`.
- Cambios en la base (migraciones nuevas): `npm run db:migrate:remoto` **antes** de `npm run deploy`.
- La base de producción se cargó con `node seed/generar.mjs --produccion`
  (menú real, 15 mesas y solo el usuario Dueño). **Nunca** ejecutes `db:seed`
  ni `db:reset` con `--remote`: borran todo.
