// Panel del dueño — pestañas "Menú" · "Mesas" · "Usuarios" (docs/diseno.md, 30).
import { navegar } from '../../hooks/useRuta';

type Pestana = 'menu' | 'mesas' | 'usuarios';
const PESTANAS: { id: Pestana; texto: string; ruta: string }[] = [
  { id: 'menu', texto: 'Menú', ruta: '/admin/menu' },
  { id: 'mesas', texto: 'Mesas', ruta: '/admin/mesas' },
  { id: 'usuarios', texto: 'Usuarios', ruta: '/admin/usuarios' },
];

export function PestanasAdmin({ actual }: { actual: Pestana }) {
  return (
    <nav className="pestanas" aria-label="Administrar">
      {PESTANAS.map((p) => (
        <button
          key={p.id}
          type="button"
          className="chip"
          aria-pressed={actual === p.id}
          aria-current={actual === p.id ? 'page' : undefined}
          onClick={() => navegar(p.ruta)}
        >
          {p.texto}
        </button>
      ))}
    </nav>
  );
}
