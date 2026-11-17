import { Link } from 'react-router';
import { useSegundosRestantes } from '../ganchos/useSegundosRestantes';
import { MUCHAS_CONSULTAS, textoEspera, tipoErrorPrecios } from '../logica/mensajes';
import { BarraInferior } from './BarraInferior';
import { Ilustracion } from './Ilustracion';

interface Props {
  /** Error de la consulta. Sin error = respondimos, pero ningún súper contestó. */
  error: unknown;
  /** Tras un 429: hasta cuándo (ms) no se puede reintentar. */
  esperarHasta: number | null;
  alReintentar: () => void;
  volverA: string;
  textoVolver: string;
}

/**
 * Pantalla completa de "no pudimos traer los precios" (P7 y P8). Distingue:
 * sin conexión, demasiadas consultas (429, con espera) y fallo del servidor o de los súper.
 */
export function ErrorPrecios({ error, esperarHasta, alReintentar, volverA, textoVolver }: Props) {
  const segundos = useSegundosRestantes(esperarHasta);
  const tipo = error ? tipoErrorPrecios(error) : 'tiendas';

  let titulo = 'No pudimos consultar los precios';
  let texto: string;
  if (tipo === 'sin-conexion') texto = 'Revisa tu conexión e intenta de nuevo. Tu lista está guardada.';
  else if (tipo === 'limite') {
    titulo = 'Espera un momento';
    texto = `${MUCHAS_CONSULTAS} Tu lista está guardada.`;
  } else if (tipo === 'tiendas') texto = 'Los súper no respondieron en este momento. Intenta de nuevo en un rato. Tu lista está guardada.';
  else texto = 'Algo falló de nuestro lado. Intenta de nuevo en un momento. Tu lista está guardada.';

  const esperando = segundos > 0;
  return (
    <>
      <div className="estado-vacio" role="alert">
        <Ilustracion tipo={tipo === 'sin-conexion' ? 'sin-conexion' : tipo === 'limite' ? 'reloj' : 'alerta'} />
        <h2 className="titulo-estado">{titulo}</h2>
        <p>{texto}</p>
      </div>
      <BarraInferior>
        <button type="button" className="boton boton-principal" onClick={alReintentar} disabled={esperando}>
          Reintentar
        </button>
        {esperando && <p className="texto-espera">{textoEspera(segundos)}</p>}
        <Link to={volverA} className="boton-texto boton-texto-centro">
          {textoVolver}
        </Link>
      </BarraInferior>
    </>
  );
}
