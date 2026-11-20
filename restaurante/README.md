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

Prueba rápida:

```bash
curl http://localhost:8787/api/usuarios-login
curl -X POST http://localhost:8787/api/login \
  -H 'Content-Type: application/json' -d '{"usuario_id":2,"pin":"1111"}'
```

PIN de prueba: Dueño 0000 · Ana 1111 · Luis 2222 · Cocina 3333 · Caja 4444.

Otros comandos:
- `npm run typecheck` — revisa el TypeScript del servidor.
- `npm run db:reset` — borra la base local y la vuelve a crear con datos de ejemplo.

No hace falta cuenta de Cloudflare para trabajar en local. Para publicar
(Entrega 4) habrá que crear la base con `npx wrangler d1 create comandas-db`
y poner su `database_id` en `wrangler.jsonc`.
