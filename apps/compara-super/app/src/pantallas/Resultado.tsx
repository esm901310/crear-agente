import { Link, useNavigate } from 'react-router';
import type { Tienda, TotalTienda } from '../api/cliente';
import { AvisoPrecios } from '../componentes/AvisoPrecios';
import { AvisoPrueba } from '../componentes/AvisoPrueba';
import { BandaError } from '../componentes/BandaError';
import { BarraInferior } from '../componentes/BarraInferior';
import { Encabezado } from '../componentes/Encabezado';
import { ErrorPrecios } from '../componentes/ErrorPrecios';
import { Esqueleto } from '../componentes/Esqueleto';
import { Icono } from '../componentes/Icono';
import { Ilustracion } from '../componentes/Ilustracion';
import { Insignia } from '../componentes/Insignia';
import { Precio } from '../componentes/Precio';
import { TarjetaTienda } from '../componentes/TarjetaTienda';
import { useComparacionAlEntrar } from '../ganchos/useComparacionAlEntrar';
import { useSegundosRestantes } from '../ganchos/useSegundosRestantes';
import { lempirasHablado, productosTexto } from '../logica/formato';
import { mensajeErrorPrecios, textoEspera, tipoErrorPrecios } from '../logica/mensajes';
import { infoTienda, unirNombres } from '../logica/tiendas';

const TITULO = '¿Dónde te sale más barato?';

function faltanTexto(n: number) {
  return n === 1 ? 'Falta 1 producto' : `Faltan ${n} productos`;
}

function cuantosSuper(n: number) {
  if (n === 2) return 'los dos';
  if (n === 3) return 'los tres';
  return `los ${n}`;
}

function LineaCompleta() {
  return (
    <p className="linea-icono texto-ok">
      <Icono nombre="check" tamano={18} />
      Tiene todos tus productos
    </p>
  );
}

function LineaFaltan({ n }: { n: number }) {
  return (
    <p className="linea-icono texto-ambar">
      <Icono nombre="prohibido" tamano={18} />
      {faltanTexto(n)}
    </p>
  );
}

/** P7 — Resultado: ¿Dónde te sale más barato? */
export function Resultado() {
  const lista = useComparacionAlEntrar();
  const navegar = useNavigate();
  const { items, carga, estadoComparacion, comparacion, comparar, esperarHasta } = lista;
  const segundosEspera = useSegundosRestantes(esperarHasta);
  const esperando = segundosEspera > 0;
  const reintentar = () => void comparar();
  const verDetalle = (t: string) => navegar(`/detalle/${t}`);

  const barra = (
    <BarraInferior>
      <Link to="/lista" className="boton boton-secundario">
        Volver a mi lista
      </Link>
    </BarraInferior>
  );

  const subtitulo = <p className="subtitulo">Tu lista de {productosTexto(items.length)}</p>;

  // Lista vacía.
  if (carga === 'lista' && items.length === 0) {
    return (
      <main className="pantalla">
        <Encabezado titulo={TITULO} volverA="/lista" />
        <div className="estado-vacio">
          <Ilustracion tipo="lista-vacia" />
          <h2 className="titulo-estado">Tu lista está vacía</h2>
          <p>Agrega lo que vas a comprar y te decimos en qué súper te sale más barato.</p>
        </div>
        <BarraInferior>
          <Link to="/agregar" className="boton boton-principal">
            Agregar mi primer producto
          </Link>
        </BarraInferior>
      </main>
    );
  }

  const todasFallaron = !!comparacion && comparacion.tiendas.every((t) => t.error);

  // Error de todas / sin internet / límite de consultas.
  if (carga === 'error' || (estadoComparacion === 'error' && !comparacion) || (estadoComparacion !== 'cargando' && todasFallaron)) {
    const error = carga === 'error' ? lista.errorCarga : estadoComparacion === 'error' ? lista.errorComparacion : null;
    return (
      <main className="pantalla">
        <Encabezado titulo={TITULO} volverA="/lista" />
        <ErrorPrecios
          error={error}
          esperarHasta={carga === 'error' ? null : esperarHasta}
          alReintentar={() => (carga === 'error' ? void lista.cargar() : reintentar())}
          volverA="/lista"
          textoVolver="Volver a mi lista"
        />
      </main>
    );
  }

  // Cargando.
  if (!comparacion || estadoComparacion === 'cargando' || carga !== 'lista') {
    const tiendas: string[] = lista.tiendas.length > 0 ? lista.tiendas : ['', ''];
    const n = lista.tiendas.length;
    return (
      <main className="pantalla" aria-busy="true">
        <Encabezado titulo={TITULO} volverA="/lista">
          <p className="subtitulo" role="status">
            Buscando los precios de hoy {n > 1 ? `en los ${n} súper` : 'en los súper'}…
          </p>
        </Encabezado>
        <div className="lista-tarjetas">
          {tiendas.map((t, i) =>
            t ? (
              <TarjetaTienda key={t} tienda={t} total={<Esqueleto ancho={160} alto={32} />}>
                <Esqueleto ancho="60%" alto={18} />
              </TarjetaTienda>
            ) : (
              <div key={i} className="tarjeta tarjeta-esqueleto" aria-hidden="true">
                <Esqueleto ancho="50%" alto={28} />
                <Esqueleto ancho={160} alto={32} />
                <Esqueleto ancho="60%" alto={18} />
              </div>
            ),
          )}
        </div>
        {barra}
      </main>
    );
  }

  // --- Con resultados ---
  const c = comparacion;
  const conError = c.tiendas.filter((t) => t.error);
  const sinError = c.tiendas.filter((t) => !t.error);
  const completas = sinError.filter((t) => t.completa).sort((a, b) => a.total - b.total);
  const incompletas = sinError.filter((t) => !t.completa).sort((a, b) => a.total - b.total);
  const ganadorTotal = c.ganador ? c.tiendas.find((t) => t.tienda === c.ganador) : undefined;

  const parcial =
    !ganadorTotal && c.comparacionParcial && c.comparacionParcial.itemsComparados > 0 && sinError.length > 1
      ? c.comparacionParcial
      : null;
  const totalParcial = (t: Tienda) => parcial?.tiendas[t] ?? null;

  // Quién va resaltado.
  let ganadoras: TotalTienda[] = [];
  if (ganadorTotal) {
    ganadoras = c.empate
      ? completas.filter((t) => Math.abs(t.total - ganadorTotal.total) < 0.005)
      : [ganadorTotal];
  } else if (parcial) {
    const conParcial = sinError.filter((t) => totalParcial(t.tienda) !== null);
    const min = Math.min(...conParcial.map((t) => totalParcial(t.tienda)!));
    ganadoras = conParcial.filter((t) => Math.abs(totalParcial(t.tienda)! - min) < 0.005);
  }
  const empate = ganadoras.length > 1;
  const idsGanadoras = new Set(ganadoras.map((t) => t.tienda));
  const masCaraCompleta = completas.length > 1 ? completas[completas.length - 1] : null;
  const sinContar = conError.length > 0 ? `Sin contar ${unirNombres(conError.map((t) => t.tienda), 'y', true)}` : null;

  // Anuncio para lectores de pantalla.
  let anuncio = 'Precios actualizados.';
  if (ganadoras.length === 1) {
    const g = ganadoras[0];
    const valor = parcial ? totalParcial(g.tienda)! : g.total;
    anuncio += ` Más barato: ${infoTienda(g.tienda).completo}, ${lempirasHablado(valor)}.`;
  } else if (empate) {
    anuncio += ` Te sale igual en ${unirNombres(ganadoras.map((t) => t.tienda))}.`;
  }

  const otras = [...completas, ...incompletas].filter((t) => !idsGanadoras.has(t.tienda));
  const referencia = ganadoras[0];
  const valorReferencia = referencia ? (parcial ? totalParcial(referencia.tienda) : referencia.total) : null;

  const incompletaConMasFaltantes = [...incompletas].sort((a, b) => b.faltantes.length - a.faltantes.length)[0];

  return (
    <main className="pantalla">
      <Encabezado titulo={TITULO} volverA="/lista">
        {subtitulo}
      </Encabezado>
      <p className="solo-lector" role="status">
        {anuncio}
      </p>
      <AvisoPrueba datos={c} />
      {estadoComparacion === 'error' && (
        <BandaError alReintentar={reintentar} accionDeshabilitada={esperando}>
          {tipoErrorPrecios(lista.errorComparacion) === 'servidor'
            ? 'No pudimos actualizar los precios.'
            : mensajeErrorPrecios(lista.errorComparacion)}{' '}
          Te mostramos los de la última consulta.{esperando ? ` ${textoEspera(segundosEspera)}` : ''}
        </BandaError>
      )}

      {!ganadorTotal && sinError.length > 1 && (
        <BandaError
          tono="ambar"
          textoAccion="Ver cuáles faltan"
          alReintentar={incompletaConMasFaltantes ? () => verDetalle(incompletaConMasFaltantes.tienda) : undefined}
        >
          {parcial
            ? `Ningún súper tiene todos tus productos. Comparamos ${parcial.itemsComparados === 1 ? 'el único producto que sí tienen' : `los ${parcial.itemsComparados} que sí tienen`} ${cuantosSuper(sinError.length)}.`
            : `Ningún súper tiene todos tus productos y no hay productos que estén en ${cuantosSuper(sinError.length)}.`}
        </BandaError>
      )}

      {empate && <p className="texto-fuerte">Te sale igual en {unirNombres(ganadoras.map((t) => t.tienda))}.</p>}

      <div className="lista-tarjetas">
        {ganadoras.map((g) => (
          <TarjetaTienda
            key={g.tienda}
            tienda={g.tienda}
            destacada
            insignia={<Insignia tipo={empate ? 'mismo-precio' : 'mas-barato'} />}
            total={<Precio valor={parcial ? totalParcial(g.tienda)! : g.total} />}
          >
            {parcial ? (
              <p className="texto-ahorro">
                Más barato en {productosTexto(parcial.itemsComparados).replace(/^1 producto$/, 'el producto')} que hay en{' '}
                {cuantosSuper(sinError.length)} súper
              </p>
            ) : masCaraCompleta && c.ahorro && c.ahorro > 0 && masCaraCompleta.tienda !== g.tienda ? (
              <p className="texto-ahorro">
                Ahorras <Precio valor={c.ahorro} /> frente a {infoTienda(masCaraCompleta.tienda).completo}
              </p>
            ) : completas.length === 1 && conError.length === 0 ? (
              <p className="texto-ahorro">Es el único con todos tus productos</p>
            ) : null}
            {g.completa ? (completas.length > 1 || conError.length > 0) && <LineaCompleta /> : <LineaFaltan n={g.faltantes.length} />}
            {sinContar && <p className="texto-secundario">{sinContar}</p>}
            <button type="button" className="boton boton-secundario" onClick={() => verDetalle(g.tienda)}>
              Ver detalle
            </button>
          </TarjetaTienda>
        ))}

        {otras.map((t) => {
          const valor = parcial ? totalParcial(t.tienda) ?? t.total : t.total;
          const comparable = (parcial || t.completa) && valorReferencia !== null;
          const diferencia = comparable ? valor - valorReferencia! : 0;
          return (
            <TarjetaTienda
              key={t.tienda}
              tienda={t.tienda}
              total={t.faltantes.length >= items.length && !parcial ? undefined : <Precio valor={valor} />}
              alLado={comparable && diferencia > 0.004 ? <Precio valor={diferencia} prefijo="+" /> : undefined}
            >
              {t.completa ? (
                <>
                  <LineaCompleta />
                  <button type="button" className="boton-texto" onClick={() => verDetalle(t.tienda)}>
                    Ver detalle
                  </button>
                </>
              ) : (
                <>
                  <LineaFaltan n={t.faltantes.length} />
                  {!parcial && <p className="texto-secundario">No se compara con los demás hasta completar la lista.</p>}
                  <button type="button" className="boton-texto" onClick={() => verDetalle(t.tienda)}>
                    Elegir sustitutos
                  </button>
                </>
              )}
            </TarjetaTienda>
          );
        })}

        {conError.map((t) => (
          <TarjetaTienda key={t.tienda} tienda={t.tienda}>
            <BandaError alReintentar={reintentar} accionDeshabilitada={esperando}>
              No pudimos consultar {infoTienda(t.tienda).completo} en este momento.
            </BandaError>
          </TarjetaTienda>
        ))}
      </div>

      <AvisoPrecios consultadoEn={c.consultadoEn} />
      <button type="button" className="boton-texto" onClick={reintentar} disabled={esperando}>
        Actualizar precios
      </button>
      {barra}
    </main>
  );
}
