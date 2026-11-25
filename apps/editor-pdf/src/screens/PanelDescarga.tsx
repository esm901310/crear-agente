import PanelInferior from '../components/PanelInferior';
import BarraProgreso from '../components/BarraProgreso';
import TarjetaMensaje from '../components/TarjetaMensaje';
import BotonPrincipal from '../components/BotonPrincipal';
import BotonSecundario from '../components/BotonSecundario';
import BotonTexto from '../components/BotonTexto';
import { MENSAJES } from './PantallaError';

export type EstadoDescarga =
  | { etapa: 'preparando'; pagina: number; total: number }
  | { etapa: 'lista'; archivo: File }
  | { etapa: 'error'; tipo: 'falloDescarga' | 'memoria' };

interface Props {
  estado: EstadoDescarga;
  puedeCompartir: boolean;
  alDescargar: () => void;
  alCompartir: () => void;
  alReintentar: () => void;
  alCerrar: () => void;
}

export default function PanelDescarga({ estado, puedeCompartir, alDescargar, alCompartir, alReintentar, alCerrar }: Props) {
  return (
    <PanelInferior etiqueta="Descargar PDF" alCerrar={estado.etapa === 'preparando' ? undefined : alCerrar} className="panel-descarga">
      {estado.etapa === 'preparando' ? (
        <div className="descarga-preparando">
          <h2 className="subtitulo">Preparando tu PDF…</h2>
          <BarraProgreso valor={estado.total ? estado.pagina / estado.total : 0} texto={`Página ${estado.pagina} de ${estado.total}`} />
        </div>
      ) : estado.etapa === 'lista' ? (
        <TarjetaMensaje variante="exito" titulo="¡Tu PDF está listo!" texto={estado.archivo.name}>
          <BotonPrincipal onClick={alDescargar}>Descargar de nuevo</BotonPrincipal>
          {puedeCompartir ? <BotonSecundario onClick={alCompartir}>Compartir</BotonSecundario> : null}
          <BotonTexto onClick={alCerrar}>Seguir editando</BotonTexto>
        </TarjetaMensaje>
      ) : (
        <TarjetaMensaje variante="error" titulo={MENSAJES[estado.tipo].titulo} texto={MENSAJES[estado.tipo].texto}>
          <BotonPrincipal onClick={alReintentar}>Reintentar</BotonPrincipal>
          <BotonTexto onClick={alCerrar}>Seguir editando</BotonTexto>
        </TarjetaMensaje>
      )}
    </PanelInferior>
  );
}
