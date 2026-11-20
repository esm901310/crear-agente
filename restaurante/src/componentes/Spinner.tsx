export function Spinner({ pequeno = false }: { pequeno?: boolean }) {
  return <span className={pequeno ? 'spinner spinner--pequeno' : 'spinner'} aria-hidden="true" />;
}
