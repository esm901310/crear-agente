import { useRef } from 'react';
import TarjetaMensaje from '../components/TarjetaMensaje';
import BotonPrincipal from '../components/BotonPrincipal';
import BotonSecundario from '../components/BotonSecundario';
import type { TipoError } from '../lib/errores';

interface Props {
  error: TipoError;
  alElegir: (archivo: File) => void;
  alIntentarIgual: () => void;
  alVerIgual: () => void;
  alReintentar: () => void;
}

export const MENSAJES: Record<TipoError, { titulo: string; texto: string }> = {
  noEsPdf: {
    titulo: 'Ese archivo no es un PDF',
    texto: 'Elige un archivo que termine en .pdf. Si es una foto, primero conviértela a PDF.',
  },
  muyGrande: {
    titulo: 'Este PDF es muy grande',
    texto: 'Puede ir lento o trabarse tu celular. Funciona mejor con menos de 25 MB y 20 páginas.',
  },
  sinTexto: {
    titulo: 'No encontramos texto',
    texto: 'Puede que la imagen esté borrosa, muy oscura o de lado. Prueba con un escaneo más nítido.',
  },
  noSeAbre: { titulo: 'No pudimos abrir este PDF', texto: 'Puede estar protegido con contraseña o dañado.' },
  falloDescarga: { titulo: 'No se pudo crear tu PDF', texto: 'Tus cambios siguen aquí. Inténtalo otra vez.' },
  memoria: {
    titulo: 'Tu celular se quedó sin espacio para seguir',
    texto: 'Cierra otras pestañas e inténtalo de nuevo.',
  },
};

export default function PantallaError({ error, alElegir, alIntentarIgual, alVerIgual, alReintentar }: Props) {
  const m = MENSAJES[error];
  const entrada = useRef<HTMLInputElement>(null);
  const alElegirOtro = () => entrada.current?.click();
  return (
    <main className="pantalla pantalla-centrada">
      <TarjetaMensaje variante="error" titulo={m.titulo} texto={m.texto}>
        {error === 'memoria' ? (
          <BotonPrincipal onClick={alReintentar}>Reintentar</BotonPrincipal>
        ) : (
          <BotonPrincipal onClick={alElegirOtro}>Elegir otro archivo</BotonPrincipal>
        )}
        {error === 'muyGrande' ? <BotonSecundario onClick={alIntentarIgual}>Intentar de todos modos</BotonSecundario> : null}
        {error === 'sinTexto' ? <BotonSecundario onClick={alVerIgual}>Ver el PDF igual</BotonSecundario> : null}
      </TarjetaMensaje>
      <input
        ref={entrada}
        type="file"
        accept="application/pdf,.pdf"
        className="oculto"
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          e.target.value = '';
          if (archivo) alElegir(archivo);
        }}
      />
    </main>
  );
}
