import { Link } from 'react-router';
import { BarraInferior } from '../componentes/BarraInferior';
import { Icono } from '../componentes/Icono';
import { Ilustracion } from '../componentes/Ilustracion';
import { TIENDAS_ANUNCIADAS, unirNombres } from '../logica/tiendas';

/** P1 — Bienvenida */
export function Bienvenida() {
  const n = TIENDAS_ANUNCIADAS.length;
  return (
    <main className="pantalla pantalla-bienvenida">
      <div className="bienvenida-ilustracion">
        <Ilustracion tipo="carrito" />
      </div>
      <h1 className="titulo-app">Comparar Súper</h1>
      <p className="bienvenida-texto">
        Arma tu lista y te decimos en qué súper te sale más barata: {unirNombres(TIENDAS_ANUNCIADAS, 'o', true)}.
      </p>
      <ul className="lista-checks">
        <li>
          <Icono nombre="check" />
          <span>Precios de {n === 1 ? 'tu súper' : `los ${n} súper`} en un solo lugar</span>
        </li>
        <li>
          <Icono nombre="check" />
          <span>Sabes cuánto ahorras antes de salir</span>
        </li>
        <li>
          <Icono nombre="check" />
          <span>Gratis</span>
        </li>
      </ul>
      <BarraInferior>
        <Link className="boton boton-principal" to="/crear-cuenta">
          Crear cuenta
        </Link>
        <Link className="boton-texto boton-texto-centro" to="/entrar">
          Ya tengo cuenta
        </Link>
      </BarraInferior>
    </main>
  );
}
