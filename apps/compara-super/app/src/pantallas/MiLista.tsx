import { useState } from 'react';
import { Link } from 'react-router';
import { esSinConexion, type ItemLista } from '../api/cliente';
import { AvisoPrecios } from '../componentes/AvisoPrecios';
import { AvisoPrueba } from '../componentes/AvisoPrueba';
import { BandaError } from '../componentes/BandaError';
import { BarraInferior } from '../componentes/BarraInferior';
import { Encabezado } from '../componentes/Encabezado';
import { Esqueleto } from '../componentes/Esqueleto';
import { FilaProducto } from '../componentes/FilaProducto';
import { HojaInferior } from '../componentes/HojaInferior';
import { Icono } from '../componentes/Icono';
import { Ilustracion } from '../componentes/Ilustracion';
import { ResumenLista } from '../componentes/ResumenLista';
import { useAvisos } from '../estado/avisos';
import { useListaCargada } from '../ganchos/useListaCargada';
import { tituloGrupo } from '../logica/corte';
import { productosTexto } from '../logica/formato';
import { mensajeDeError } from '../logica/mensajes';

/** P5 — Mi lista (inicio) */
export function MiLista() {
  const lista = useListaCargada();
  const { mostrar } = useAvisos();
  const [porQuitar, setPorQuitar] = useState<ItemLista | null>(null);

  const { items, carga, estadoComparacion, comparacion } = lista;
  const buscando = estadoComparacion === 'cargando';
  const cargandoLista = carga === 'inicial' || carga === 'cargando';

  async function quitar(item: ItemLista) {
    setPorQuitar(null);
    try {
      const quitado = await lista.quitar(item.id);
      if (!quitado) return;
      mostrar(`Quitamos ${tituloGrupo(item.grupo)}.`, {
        texto: 'Deshacer',
        alTocar: () => {
          lista.restaurar(quitado).catch((e) => mostrar(mensajeDeError(e)));
        },
      });
    } catch (e) {
      mostrar(esSinConexion(e) ? mensajeDeError(e) : `No pudimos quitar ${tituloGrupo(item.grupo)}. Intenta de nuevo.`);
    }
  }

  function cambiarCantidad(item: ItemLista, cantidad: number) {
    lista.cambiarCantidad(item.id, cantidad).catch((e) => {
      mostrar(esSinConexion(e) ? mensajeDeError(e) : 'No pudimos guardar el cambio. Intenta de nuevo.');
    });
  }

  const botonCuenta = (
    <Link to="/cuenta" className="boton-icono" aria-label="Mi cuenta">
      <Icono nombre="persona" />
    </Link>
  );

  // Cargando la lista por primera vez.
  if (cargandoLista && items.length === 0) {
    return (
      <main className="pantalla" aria-busy="true">
        <Encabezado titulo="Mi lista" derecha={botonCuenta} />
        <p className="solo-lector">Cargando tu lista…</p>
        <ul className="lista-filas" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <li key={i} className="fila-producto fila-esqueleto">
              <Esqueleto ancho="60%" alto={20} />
              <Esqueleto ancho="35%" alto={16} />
              <Esqueleto ancho={152} alto={48} />
            </li>
          ))}
        </ul>
      </main>
    );
  }

  if (carga === 'error' && items.length === 0) {
    return (
      <main className="pantalla">
        <Encabezado titulo="Mi lista" derecha={botonCuenta} />
        <BandaError alReintentar={() => void lista.cargar()}>
          {esSinConexion(lista.errorCarga)
            ? 'No hay conexión. Revisa tu internet e intenta de nuevo.'
            : 'No pudimos abrir tu lista.'}
        </BandaError>
      </main>
    );
  }

  // Estado vacío.
  if (items.length === 0) {
    return (
      <main className="pantalla">
        <Encabezado titulo="Mi lista" derecha={botonCuenta} />
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

  return (
    <main className="pantalla">
      <Encabezado titulo="Mi lista" derecha={botonCuenta}>
        <p className="subtitulo">{productosTexto(items.length)}</p>
      </Encabezado>
      <AvisoPrueba datos={comparacion} />

      <Link to="/agregar" className="boton boton-secundario">
        <Icono nombre="mas" tamano={20} />
        Agregar producto
      </Link>

      <ul className="lista-filas" aria-label="Productos de tu lista">
        {items.map((item) => (
          <FilaProducto
            key={item.id}
            item={item}
            tiendas={lista.tiendas}
            buscandoPrecios={buscando}
            alCambiarCantidad={(n) => cambiarCantidad(item, n)}
            alPedirQuitar={() => setPorQuitar(item)}
            alQuitar={() => void quitar(item)}
          />
        ))}
      </ul>

      {!buscando && <AvisoPrecios consultadoEn={comparacion?.consultadoEn} />}

      <BarraInferior gris>
        <ResumenLista estado={estadoComparacion} comparacion={comparacion} error={lista.errorComparacion} />
        {buscando ? (
          <button type="button" className="boton boton-principal" disabled>
            Buscando precios…
          </button>
        ) : (
          <Link to="/resultado" className="boton boton-principal">
            Ver dónde sale más barato
          </Link>
        )}
      </BarraInferior>

      <HojaInferior
        abierta={!!porQuitar}
        alCerrar={() => setPorQuitar(null)}
        titulo={porQuitar ? `¿Quitar ${tituloGrupo(porQuitar.grupo)} de tu lista?` : ''}
        conCerrar={false}
        pie={
          <>
            <button
              type="button"
              className="boton boton-texto-peligro boton-texto"
              onClick={() => porQuitar && void quitar(porQuitar)}
            >
              Quitar
            </button>
            <button type="button" className="boton boton-principal" onClick={() => setPorQuitar(null)}>
              Dejarlo
            </button>
          </>
        }
      >
        {null}
      </HojaInferior>
    </main>
  );
}
