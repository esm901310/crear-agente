// Worker principal: atiende /api/* y deja el resto a los archivos de las pantallas.
// Router hecho a mano (sin frameworks): una lista de rutas con su método,
// patrón, roles permitidos y la función que responde.

import { exigirRol, login, logout, usuarioDeSesion, usuariosLogin } from './auth';
import { HttpError, errorJson, idDeRuta, json } from './http';
import {
  abrirJornada,
  anularSalida,
  cerrarJornada,
  jornadaActual,
  listarJornadas,
  registrarSalida,
  reportePropinas,
  ultimaCerrada,
  verCorte,
} from './jornadas';
import {
  abrirOrden,
  agregarComanda,
  cajaOrdenes,
  cancelarOrden,
  cambiarEstadoComanda,
  cocina,
  mesas,
  menu,
  pagar,
  verOrden,
} from './restaurante';
import type { Env, Rol, Usuario } from './tipos';

interface Contexto {
  request: Request;
  env: Env;
  params: string[];
  usuario: Usuario;
  tokenHash: string;
}

interface Ruta {
  metodo: 'GET' | 'POST';
  patron: RegExp;
  /** null = pública; [] = cualquier usuario con sesión; si no, roles permitidos (el dueño siempre puede). */
  roles: readonly Rol[] | null;
  manejar: (c: Contexto) => Promise<Response>;
}

const TODOS: readonly Rol[] = [];

const rutas: Ruta[] = [
  { metodo: 'GET', patron: /^\/api\/usuarios-login$/, roles: null, manejar: ({ env }) => usuariosLogin(env) },
  { metodo: 'POST', patron: /^\/api\/login$/, roles: null, manejar: ({ request, env }) => login(request, env) },
  { metodo: 'POST', patron: /^\/api\/logout$/, roles: TODOS, manejar: ({ env, tokenHash }) => logout(env, tokenHash) },
  {
    metodo: 'GET',
    patron: /^\/api\/yo$/,
    roles: TODOS,
    manejar: async ({ usuario }) => json(usuario),
  },
  { metodo: 'GET', patron: /^\/api\/menu$/, roles: TODOS, manejar: ({ env }) => menu(env) },
  { metodo: 'GET', patron: /^\/api\/mesas$/, roles: ['mesero', 'caja'], manejar: ({ env }) => mesas(env) },
  {
    metodo: 'POST',
    patron: /^\/api\/ordenes$/,
    roles: ['mesero'],
    manejar: ({ request, env, usuario }) => abrirOrden(request, env, usuario),
  },
  {
    metodo: 'GET',
    patron: /^\/api\/ordenes\/([^/]+)$/,
    roles: ['mesero', 'caja'],
    manejar: ({ env, params }) => verOrden(env, idDeRuta(params[0])),
  },
  {
    metodo: 'POST',
    patron: /^\/api\/ordenes\/([^/]+)\/comandas$/,
    roles: ['mesero'],
    manejar: ({ request, env, params }) => agregarComanda(request, env, idDeRuta(params[0])),
  },
  {
    metodo: 'POST',
    patron: /^\/api\/ordenes\/([^/]+)\/cancelar$/,
    roles: ['mesero', 'caja'],
    manejar: ({ env, params, usuario }) => cancelarOrden(env, idDeRuta(params[0]), usuario),
  },
  { metodo: 'GET', patron: /^\/api\/cocina$/, roles: ['cocina'], manejar: ({ env }) => cocina(env) },
  {
    metodo: 'POST',
    patron: /^\/api\/comandas\/([^/]+)\/listo$/,
    roles: ['cocina'],
    manejar: ({ env, params }) => cambiarEstadoComanda(env, idDeRuta(params[0]), 'listo'),
  },
  {
    metodo: 'POST',
    patron: /^\/api\/comandas\/([^/]+)\/pendiente$/,
    roles: ['cocina'],
    manejar: ({ env, params }) => cambiarEstadoComanda(env, idDeRuta(params[0]), 'pendiente'),
  },
  { metodo: 'GET', patron: /^\/api\/caja\/ordenes$/, roles: ['caja'], manejar: ({ env }) => cajaOrdenes(env) },
  {
    metodo: 'POST',
    patron: /^\/api\/ordenes\/([^/]+)\/pagar$/,
    roles: ['caja'],
    manejar: ({ request, env, params, usuario }) => pagar(request, env, idDeRuta(params[0]), usuario),
  },
  // --- Entrega 2: jornada, salidas, corte y propinas ---
  { metodo: 'GET', patron: /^\/api\/jornada\/actual$/, roles: ['caja'], manejar: ({ env }) => jornadaActual(env) },
  {
    metodo: 'POST',
    patron: /^\/api\/jornada\/abrir$/,
    roles: ['caja'],
    manejar: ({ request, env, usuario }) => abrirJornada(request, env, usuario),
  },
  {
    metodo: 'POST',
    patron: /^\/api\/jornada\/salidas$/,
    roles: ['caja'],
    manejar: ({ request, env, usuario }) => registrarSalida(request, env, usuario),
  },
  {
    metodo: 'POST',
    patron: /^\/api\/jornada\/salidas\/([^/]+)\/anular$/,
    roles: ['caja'],
    manejar: ({ env, params, usuario }) => anularSalida(env, idDeRuta(params[0]), usuario),
  },
  {
    metodo: 'POST',
    patron: /^\/api\/jornada\/cerrar$/,
    roles: ['caja'],
    manejar: ({ request, env, usuario }) => cerrarJornada(request, env, usuario),
  },
  // Solo el dueño (exigirRol siempre deja pasar al dueño).
  { metodo: 'GET', patron: /^\/api\/jornadas$/, roles: ['dueno'], manejar: ({ env }) => listarJornadas(env) },
  // Ruta fija: va antes que /api/jornadas/:id/corte y no choca con ella (esa termina en /corte).
  {
    metodo: 'GET',
    patron: /^\/api\/jornadas\/ultima-cerrada$/,
    roles: ['caja'],
    manejar: ({ env }) => ultimaCerrada(env),
  },
  {
    metodo: 'GET',
    patron: /^\/api\/jornadas\/([^/]+)\/corte$/,
    roles: ['caja'],
    manejar: ({ env, params, usuario }) => verCorte(env, idDeRuta(params[0]), usuario),
  },
  {
    metodo: 'GET',
    patron: /^\/api\/reportes\/propinas$/,
    roles: ['dueno'],
    manejar: ({ request, env }) => reportePropinas(request, env),
  },
];

async function atenderApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const ruta = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname;

  let rutaExiste = false;
  for (const r of rutas) {
    const m = r.patron.exec(ruta);
    if (!m) continue;
    rutaExiste = true;
    if (r.metodo !== request.method) continue;

    if (r.roles === null) {
      return r.manejar({ request, env, params: m.slice(1), usuario: null as unknown as Usuario, tokenHash: '' });
    }
    const { usuario, tokenHash } = await usuarioDeSesion(request, env);
    if (r.roles.length > 0) exigirRol(usuario, r.roles);
    return r.manejar({ request, env, params: m.slice(1), usuario, tokenHash });
  }
  if (rutaExiste) throw new HttpError(405, 'Método no permitido.');
  throw new HttpError(404, 'Ruta no encontrada.');
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      try {
        return await atenderApi(request, env);
      } catch (e) {
        if (e instanceof HttpError) return errorJson(e.status, e.message, e.extra, e.headers);
        console.error('Error inesperado', e);
        return errorJson(500, 'Ocurrió un error en el servidor. Intenta de nuevo.');
      }
    }
    // Cualquier otra ruta: archivos de las pantallas (SPA).
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
