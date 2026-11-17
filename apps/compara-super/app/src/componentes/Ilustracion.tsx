// Ilustraciones simples de línea (decorativas).
type Tipo = 'carrito' | 'lista-vacia' | 'sin-conexion';

export function Ilustracion({ tipo }: { tipo: Tipo }) {
  return (
    <svg className="ilustracion" width="120" height="120" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      <circle cx="60" cy="60" r="56" fill="#E7F5EE" />
      <g fill="none" stroke="#0F7A4F" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        {tipo === 'carrito' && (
          <>
            <path d="M24 36h10l9 40h38l8-28H38" />
            <path d="M52 60l7 7 13-14" />
            <circle cx="48" cy="88" r="4" />
            <circle cx="76" cy="88" r="4" />
          </>
        )}
        {tipo === 'lista-vacia' && (
          <>
            <rect x="38" y="28" width="44" height="64" rx="6" />
            <path d="M48 46h24M48 60h24M48 74h14" />
          </>
        )}
        {tipo === 'sin-conexion' && (
          <>
            <path d="M30 52a42 42 0 0 1 60 0M40 64a28 28 0 0 1 40 0M50 76a14 14 0 0 1 20 0" />
            <path d="M28 28l64 64" />
            <circle cx="60" cy="88" r="2" />
          </>
        )}
      </g>
    </svg>
  );
}
