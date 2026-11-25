import type { ReactNode } from 'react';
import Icono from './Icono';

interface Props {
  variante: 'error' | 'aviso' | 'exito';
  titulo: string;
  texto?: string;
  children?: ReactNode;
}

export default function TarjetaMensaje({ variante, titulo, texto, children }: Props) {
  const icono = variante === 'exito' ? 'exito' : variante === 'aviso' ? 'aviso' : 'error';
  return (
    <section className={`tarjeta-mensaje tarjeta-${variante}`} role={variante === 'error' ? 'alert' : 'status'}>
      <div className="tarjeta-mensaje-icono">
        <Icono nombre={icono} tamano={32} />
      </div>
      <h2 className="tarjeta-mensaje-titulo">{titulo}</h2>
      {texto ? <p className="tarjeta-mensaje-texto">{texto}</p> : null}
      {children ? <div className="tarjeta-mensaje-botones">{children}</div> : null}
    </section>
  );
}
