import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import type { ItemLista, PrecioTienda, Tienda } from '../api/cliente';
import { AvisoPrecios } from '../componentes/AvisoPrecios';
import { AvisoPrueba } from '../componentes/AvisoPrueba';
import { BandaError } from '../componentes/BandaError';
import { Encabezado } from '../componentes/Encabezado';
import { ErrorPrecios } from '../componentes/ErrorPrecios';
import { EtiquetaTienda } from '../componentes/EtiquetaTienda';
import { Esqueleto } from '../componentes/Esqueleto';
import { HojaSustituto } from '../componentes/HojaSustituto';
import { Icono } from '../componentes/Icono';
import { Insignia } from '../componentes/Insignia';
import { Precio } from '../componentes/Precio';
import { useAvisos } from '../estado/avisos';
import { useComparacionAlEntrar } from '../ganchos/useComparacionAlEntrar';
import { useSegundosRestantes } from '../ganchos/useSegundosRestantes';
import { estaDisponible, precioDeItemEn, precioEfectivo, precioMinimo } from '../logica/comparar';
import { nombreLegible } from '../logica/nombres';
import { nombreCompleto } from '../logica/presentacion';
import { infoTienda } from '../logica/tiendas';

/** P8 — Detalle por supermercado (incluye P9 como hoja inferior). */
export function DetalleTienda() {
  const { tienda: param } = useParams();
  const tienda = (param ?? '') as Tienda;
  const lista = useComparacionAlEntrar();
  const { mostrar } = useAvisos();
  const [sustituyendo, setSustituyendo] = useState<ItemLista | null>(null);
  const { items, comparacion, estadoComparacion, carga, esperarHasta } = lista;
  const esperando = useSegundosRestantes(esperarHasta) > 0;
  const nombre = infoTienda(tienda).completo;

  // Falló la lista o la comparación y no hay precios anteriores que mostrar.
  const fallo = carga === 'error' || (estadoComparacion === 'error' && !comparacion);
  const cargando = !fallo && (!comparacion || estadoComparacion === 'cargando' || carga !== 'lista');
  const total = comparacion?.tiendas.find((t) => t.tienda === tienda);

  if (comparacion && !cargando && !total) return <Navigate to="/resultado" replace />;
  if (carga === 'lista' && items.length === 0) return <Navigate to="/lista" replace />;

  const tiendasSinError = comparacion?.tiendas.filter((t) => !t.error).map((t) => t.tienda) ?? [];

  async function elegir(item: ItemLista, precio: PrecioTienda | null, nombreVisible?: string) {
    const tenia = !!item.sustitutos?.[tienda];
    if (!precio && !tenia) {
      setSustituyendo(null);
      return;
    }
    await lista.elegirSustituto(item.id, tienda, precio);
    setSustituyendo(null);
    mostrar(
      precio
        ? `Listo, usamos ${nombreVisible ?? nombreLegible(precio.nombre)} en ${nombre}.`
        : `Listo, ${nombre} seguirá sin ${nombreCompleto(item.grupo)}.`,
    );
  }

  const selector = comparacion && comparacion.tiendas.length > 1 && (
    <nav className="pestanas" aria-label="Cambiar de súper">
      {comparacion.tiendas.map((t) => (
        <Link
          key={t.tienda}
          to={`/detalle/${t.tienda}`}
          replace
          className={t.tienda === tienda ? 'pestana pestana-activa' : 'pestana'}
          aria-current={t.tienda === tienda ? 'page' : undefined}
        >
          {infoTienda(t.tienda).corto}
        </Link>
      ))}
    </nav>
  );

  const titulo = <EtiquetaTienda tienda={tienda} completo />;

  if (fallo) {
    return (
      <main className="pantalla">
        <Encabezado titulo={titulo} volverA="/resultado" />
        <ErrorPrecios
          error={carga === 'error' ? lista.errorCarga : lista.errorComparacion}
          esperarHasta={carga === 'error' ? null : esperarHasta}
          alReintentar={() => void (carga === 'error' ? lista.cargar() : lista.comparar())}
          volverA="/lista"
          textoVolver="Volver a mi lista"
        />
      </main>
    );
  }

  if (cargando || !total || !comparacion) {
    return (
      <main className="pantalla" aria-busy="true">
        <Encabezado titulo={titulo} volverA="/resultado">
          <p className="solo-lector" role="status">
            Buscando los precios de hoy…
          </p>
          <Esqueleto ancho={160} alto={36} />
        </Encabezado>
        <div className="lista-filas" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="fila-detalle fila-esqueleto">
              <Esqueleto ancho="65%" alto={18} />
              <Esqueleto ancho="40%" alto={16} />
            </div>
          ))}
        </div>
      </main>
    );
  }

  const faltantes = items.filter((i) => !precioDeItemEn(i, tienda));
  const presentes = items.filter((i) => precioDeItemEn(i, tienda));
  const conteo = `${presentes.length} de ${items.length} productos`;

  return (
    <main className="pantalla">
      <Encabezado titulo={titulo} volverA="/resultado">
        {total.error ? null : (
          <div className="resumen-detalle">
            <div className="total-grande">
              <Precio valor={total.total} />
            </div>
            {faltantes.length > 0 ? (
              <p className="linea-icono texto-ambar">
                <Icono nombre="prohibido" tamano={18} />
                {conteo} · Faltan {faltantes.length}
              </p>
            ) : (
              <p className="texto-secundario">{conteo}</p>
            )}
          </div>
        )}
      </Encabezado>
      {selector}
      <AvisoPrueba datos={comparacion} />

      {total.error ? (
        <BandaError alReintentar={() => void lista.comparar()} accionDeshabilitada={esperando}>
          No pudimos consultar {nombre} en este momento.
        </BandaError>
      ) : (
        <>
          {faltantes.length > 0 && (
            <section className="seccion" aria-labelledby="faltan">
              <h2 id="faltan" className="titulo-seccion">
                Faltan en este súper
              </h2>
              <div className="lista-tarjetas">
                {faltantes.map((item) => {
                  const otra = precioMinimo(
                    item.grupo,
                    tiendasSinError.filter((t) => t !== tienda),
                  );
                  return (
                    <article key={item.id} className="tarjeta tarjeta-faltante">
                      <h3 className="tarjeta-nombre">
                        {nombreCompleto(item.grupo)}
                      </h3>
                      <Insignia tipo="no-disponible" />
                      {otra && (
                        <p className="texto-secundario">
                          O cómpralo en {infoTienda(otra.tienda).completo} a <Precio valor={otra.valor} />.
                        </p>
                      )}
                      <button
                        type="button"
                        className="boton boton-secundario"
                        onClick={() => setSustituyendo(item)}
                      >
                        Elegir sustituto
                      </button>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {presentes.length > 0 && (
            <section className="seccion" aria-labelledby="tus-productos">
              <h2 id="tus-productos" className="titulo-seccion">
                Tus productos
              </h2>
              <ul className="lista-filas">
                {presentes.map((item) => {
                  const { precio, esSustituto } = precioDeItemEn(item, tienda)!;
                  const unitario = precioEfectivo(precio);
                  const enTiendas = tiendasSinError.filter((t) => estaDisponible(item.grupo.precios[t]));
                  const min = precioMinimo(item.grupo, tiendasSinError);
                  const mejor = !esSustituto && enTiendas.length > 1 && min !== null && unitario <= min.valor;
                  return (
                    <li key={item.id} className="fila-detalle">
                      <p className="fila-detalle-nombre">
                        {esSustituto ? nombreLegible(precio.nombre) : nombreCompleto(item.grupo)}
                      </p>
                      {esSustituto && (
                        <div className="fila-detalle-sustituto">
                          <Insignia tipo="sustituto" />
                          <span className="texto-secundario">
                            En lugar de {nombreCompleto(item.grupo, ' ')}
                          </span>
                          <button type="button" className="boton-texto" onClick={() => setSustituyendo(item)}>
                            Cambiar
                          </button>
                        </div>
                      )}
                      <div className="fila-detalle-precios">
                        <span className="texto-secundario">
                          {item.cantidad} × <Precio valor={unitario} />
                        </span>
                        <Precio valor={unitario * item.cantidad} className="precio-fuerte" />
                      </div>
                      {precio.desactualizado && <p className="texto-nota">Precio de la última consulta</p>}
                      {mejor && <p className="texto-mejor">El mejor precio</p>}
                    </li>
                  );
                })}
              </ul>
              <p className="fila-total">
                <span>Total</span>
                <Precio valor={total.total} className="precio-fuerte" />
              </p>
            </section>
          )}
        </>
      )}

      <AvisoPrecios consultadoEn={comparacion.consultadoEn} />

      <HojaSustituto
        item={sustituyendo}
        tienda={tienda}
        alCerrar={() => setSustituyendo(null)}
        alElegir={elegir}
      />
    </main>
  );
}
