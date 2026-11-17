# Comparar Súper — app (PWA)

Vite + React + TypeScript. Diseño en `../docs/diseno.md`, contrato con el servidor en `../docs/api-contrato.md`.

## Comandos

| Comando | Para qué |
|---|---|
| `npm run dev` | App en http://localhost:5173 usando el servidor real (`/api` → `http://localhost:8787`, levántalo con `npm run dev` en `../servidor`). |
| `npm run dev:simulada` | App con datos de ejemplo, sin servidor. |
| `npm run dev:red` | Igual que `dev`, pero visible para otros aparatos de tu red (para probar en un celular). |
| `npm run dev:simulada:red` | Igual que `dev:simulada`, visible en tu red. |
| `npm run typecheck` / `npm run lint` / `npm run build` | Revisiones y compilación. |
| `npm run capturas` | Capturas de pantalla (ver `scripts/capturas.mjs`). |

Configuración opcional: copia `.env.example` como `.env.local`. Los archivos `.env*` no se suben al repositorio.

## Probar en un celular real (misma red wifi)

1. En la computadora: `npm run dev:red` (o `npm run dev:simulada:red`).
2. Vite muestra una dirección tipo `Network: http://192.168.1.20:5173/`. Ábrela en el celular, conectado a la misma red wifi.
3. Si no abre, revisa que el firewall de la computadora permita el puerto 5173.

Limitaciones de esta forma de probar:

- **Iniciar sesión no se mantiene con el servidor real.** La cookie de sesión es `Secure`, y el navegador solo la guarda en `https://` o en `localhost`. En `http://192.168.x.x` el servidor responde bien, pero el celular no guarda la cookie y la app vuelve a pedir que entres. Para probar el flujo completo con sesión en el celular hace falta `https` (por ejemplo, un túnel https o publicar una versión de prueba).
- **El modo simulado sí funciona completo** (`dev:simulada:red`): no usa cookies, guarda todo en el navegador del celular.
- **La app no se instala como PWA ni funciona sin conexión** en `http://` desde otra dirección que no sea `localhost`: el navegador solo activa el service worker en `https://` o `localhost`.

## Cuándo se consultan los precios

Para no gastar consultas a los súper (y no chocar con el límite del servidor):

- Al abrir la app no se consulta si la lista trae precios de hace menos de 30 min (`actualizadoEn`).
- Al abrir "¿Dónde te sale más barato?" o el detalle de un súper se consulta solo si los precios tienen más de 30 min, la última consulta falló o agregaste productos desde el buscador que todavía no se compararon (la búsqueda puede venir sin algún súper que no respondió).
- Tras un cambio en la lista se espera 1.5 s y se consulta solo si los precios ya están viejos.
- "Actualizar precios" y "Reintentar" consultan siempre.
- Si dos pantallas piden comparar a la vez, se hace una sola consulta.
- Si el servidor responde 429, no se vuelve a consultar hasta que pase el tiempo de `Retry-After` (60 s si no lo indica).
