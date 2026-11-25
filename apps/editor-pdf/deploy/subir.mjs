// Sube dist/ al KV "retoca-archivos" usando la API de Cloudflare (bulk write).
// Uso: CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... node deploy/subir.mjs
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
const cuenta = process.env.CLOUDFLARE_ACCOUNT_ID, token = process.env.CLOUDFLARE_API_TOKEN;
const ns = 'ed187ddfa6334376ae0ab79ff1495974';
const raiz = new URL('../dist/', import.meta.url).pathname;
const lista = [];
(function recorrer(d) { for (const n of readdirSync(d)) { const p = join(d, n); statSync(p).isDirectory() ? recorrer(p) : lista.push(p); } })(raiz);
let lote = [], tam = 0;
async function enviar() {
  if (!lote.length) return;
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cuenta}/storage/kv/namespaces/${ns}/bulk`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(lote),
  });
  const j = await r.json();
  if (!j.success) throw new Error(JSON.stringify(j.errors));
  console.log(`Subidos ${lote.length} archivos`);
  lote = []; tam = 0;
}
for (const p of lista) {
  const b64 = readFileSync(p).toString('base64');
  if (tam + b64.length > 40e6) await enviar();
  lote.push({ key: relative(raiz, p).split('\\').join('/'), value: b64, base64: true });
  tam += b64.length;
}
await enviar();
console.log(`Listo: ${lista.length} archivos`);
