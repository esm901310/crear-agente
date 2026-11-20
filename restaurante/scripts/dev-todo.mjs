// Levanta el servidor (wrangler, puerto 8787) y las pantallas (Vite, puerto 5173)
// juntos. Ctrl+C detiene ambos.
import { spawn } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const procesos = [
  spawn(npm, ['run', 'dev:api'], { stdio: 'inherit' }),
  spawn(npm, ['run', 'dev'], { stdio: 'inherit' }),
];

let terminando = false;
function terminar(codigo = 0) {
  if (terminando) return;
  terminando = true;
  for (const p of procesos) if (p.exitCode === null) p.kill('SIGTERM');
  setTimeout(() => process.exit(codigo), 500);
}

for (const p of procesos) p.on('exit', (c) => terminar(c ?? 0));
process.on('SIGINT', () => terminar(0));
process.on('SIGTERM', () => terminar(0));
