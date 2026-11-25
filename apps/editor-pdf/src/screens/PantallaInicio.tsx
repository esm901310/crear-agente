import { useRef, useState } from 'react';
import BotonPrincipal from '../components/BotonPrincipal';

interface Props {
  alElegir: (archivo: File) => void;
}

function Ilustracion() {
  return (
    <svg className="inicio-ilustracion" viewBox="0 0 140 120" role="img" aria-label="Una hoja con un lápiz">
      <rect x="28" y="8" width="72" height="96" rx="6" fill="#FFFFFF" stroke="#E2DED6" strokeWidth="2" />
      <rect x="40" y="26" width="48" height="5" rx="2.5" fill="#E2DED6" />
      <rect x="40" y="40" width="40" height="5" rx="2.5" fill="#E2DED6" />
      <rect x="40" y="54" width="22" height="8" rx="2" fill="#FFC23D" fillOpacity="0.45" stroke="#E0A100" strokeWidth="1.5" />
      <rect x="66" y="56" width="22" height="5" rx="2.5" fill="#E2DED6" />
      <rect x="40" y="70" width="44" height="5" rx="2.5" fill="#E2DED6" />
      <g transform="rotate(40 104 70)">
        <rect x="98" y="30" width="13" height="60" rx="2" fill="#1E6FD9" />
        <rect x="98" y="30" width="13" height="9" rx="2" fill="#1758AE" />
        <path d="M98 90 L104.5 104 L111 90 Z" fill="#F5D7A1" />
        <path d="M102.3 99.5 L104.5 104 L106.7 99.5 Z" fill="#1F2328" />
      </g>
    </svg>
  );
}

export default function PantallaInicio({ alElegir }: Props) {
  const entrada = useRef<HTMLInputElement>(null);
  const [arrastrando, setArrastrando] = useState(false);

  return (
    <main
      className={`pantalla inicio ${arrastrando ? 'inicio-arrastrando' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setArrastrando(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setArrastrando(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setArrastrando(false);
        const archivo = e.dataTransfer.files[0];
        if (archivo) alElegir(archivo);
      }}
    >
      <div className="inicio-logo">
        <img src="./favicon.svg" alt="" width={32} height={32} />
        <span>Retoca</span>
      </div>
      <div className="inicio-tarjeta">
        {arrastrando ? (
          <p className="inicio-soltar">Suelta tu PDF aquí</p>
        ) : (
          <>
            <Ilustracion />
            <h2 className="titulo-pantalla">Corrige el texto de tus PDF</h2>
            <p className="inicio-texto">
              Abre un PDF escaneado o de fotos, toca la palabra que quieras cambiar y escribe la nueva. Todo pasa en tu
              celular: tu archivo no se sube a ningún lado.
            </p>
          </>
        )}
      </div>
      <div className="inicio-acciones">
        <BotonPrincipal onClick={() => entrada.current?.click()}>Elegir PDF</BotonPrincipal>
        <p className="texto-ayuda">Hasta 20 páginas y 25 MB.</p>
        <input
          ref={entrada}
          type="file"
          accept="application/pdf,.pdf"
          className="oculto"
          data-testid="entrada-archivo"
          onChange={(e) => {
            const archivo = e.target.files?.[0];
            e.target.value = '';
            if (archivo) alElegir(archivo);
          }}
        />
      </div>
    </main>
  );
}
