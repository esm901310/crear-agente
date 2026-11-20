// A2 — Formulario de producto: categoría, nombre, descripción, las 3 formas de precio
// (fijo, por tamaño, a consultar), opciones, pasadía y disponible. Docs/diseno.md, 30.2.
import { useRef, useState } from 'react';
import { api, ApiError, mensajeDeError, type ProductoDatos } from '../../api';
import { BotonAccion } from '../../componentes/BotonAccion';
import { CampoDinero } from '../../componentes/CampoDinero';
import { Confirmar } from '../../componentes/Confirmar';
import { Dialogo } from '../../componentes/Dialogo';
import { Interruptor } from '../../componentes/Interruptor';
import { useToast } from '../../componentes/Toast';
import { PRECIO_MAX } from '../../config';
import { centavosATexto, dinero, sinAcentos, textoACentavos } from '../../formato';
import { useMedia } from '../../hooks/useMedia';
import type { CategoriaAdmin, ProductoAdmin } from '../../tipos';
import { FlechasOrden, mover } from './FlechasOrden';

const NOMBRE_MAX = 60;
const DESCRIPCION_MAX = 140;
const MAX_LISTA = 12;

type Forma = 'fijo' | 'tamano' | 'consultar';

interface FilaVariante {
  clave: number;
  id?: number;
  nombre: string;
  precio: string;
}
interface FilaOpcion {
  clave: number;
  texto: string;
}

type Errores = Partial<Record<'nombre' | 'precio' | 'variantes' | 'opciones', string>>;

interface Props {
  /** null = nuevo. */
  producto: ProductoAdmin | null;
  categorias: CategoriaAdmin[];
  categoriaInicial: number;
  alGuardar: () => void;
  alQuitar?: (p: ProductoAdmin) => void;
  alCerrar: () => void;
}

let claves = 0;
const nuevaClave = () => ++claves;

function formaDe(p: ProductoAdmin | null): Forma {
  if (!p) return 'fijo';
  if (p.precio_abierto) return 'consultar';
  if (p.variantes.length > 0) return 'tamano';
  return 'fijo';
}

export function DialogoProducto({ producto, categorias, categoriaInicial, alGuardar, alQuitar, alCerrar }: Props) {
  const toast = useToast();
  const pantallaCompleta = useMedia('(max-width: 1023px)');
  const [categoriaId, setCategoriaId] = useState(producto?.categoria_id ?? categoriaInicial);
  const [nombre, setNombre] = useState(producto?.nombre ?? '');
  const [descripcion, setDescripcion] = useState(producto?.descripcion ?? '');
  const [forma, setForma] = useState<Forma>(formaDe(producto));
  const [precio, setPrecio] = useState(producto?.precio ? centavosATexto(producto.precio) : '');
  const [variantes, setVariantes] = useState<FilaVariante[]>(() =>
    producto && producto.variantes.length > 0
      ? producto.variantes.map((v) => ({ clave: nuevaClave(), id: v.id, nombre: v.nombre, precio: centavosATexto(v.precio) }))
      : [
          { clave: nuevaClave(), nombre: '', precio: '' },
          { clave: nuevaClave(), nombre: '', precio: '' },
        ],
  );
  const [opciones, setOpciones] = useState<FilaOpcion[]>(() =>
    (producto?.opciones ?? []).map((t) => ({ clave: nuevaClave(), texto: t })),
  );
  const [esPasadia, setEsPasadia] = useState(producto?.es_pasadia ?? false);
  const [disponible, setDisponible] = useState(!(producto?.agotado ?? false));
  const [errores, setErrores] = useState<Errores>({});
  const [guardando, setGuardando] = useState(false);
  const [descartar, setDescartar] = useState(false);
  const enfocarVariante = useRef<number | null>(null);

  // ¿Hay cambios? (para preguntar antes de cerrar)
  const inicial = useRef<string | null>(null);
  const huella = JSON.stringify([categoriaId, nombre, descripcion, forma, precio, variantes.map((v) => [v.nombre, v.precio]), opciones.map((o) => o.texto), esPasadia, disponible]);
  if (inicial.current === null) inicial.current = huella;
  const hayCambios = huella !== inicial.current;

  const cerrar = () => {
    if (guardando) return;
    if (hayCambios) setDescartar(true);
    else alCerrar();
  };

  const validar = (): { errores: Errores; datos: ProductoDatos } => {
    const e: Errores = {};
    const limpio = nombre.trim().replace(/\s+/g, ' ');
    if (!limpio) e.nombre = 'Escribe el nombre del producto.';
    const datos: ProductoDatos = {
      categoria_id: categoriaId,
      nombre: limpio,
      descripcion: descripcion.trim() === '' ? null : descripcion.trim(),
    };
    if (forma === 'fijo') {
      const c = textoACentavos(precio);
      if (c === null || c <= 0) e.precio = 'Escribe un precio mayor a L 0.00.';
      else if (c > PRECIO_MAX) e.precio = 'El precio máximo es L 1,000,000.00.';
      Object.assign(datos, { precio: c ?? 0, precio_abierto: false, variantes: [], es_pasadia: esPasadia });
    } else if (forma === 'tamano') {
      const filas = variantes.map((v) => ({ id: v.id, nombre: v.nombre.trim().replace(/\s+/g, ' '), precio: textoACentavos(v.precio) }));
      if (filas.length < 2) e.variantes = 'Agrega al menos 2 tamaños. Si solo hay uno, usa «Precio fijo».';
      else if (filas.some((f) => !f.nombre || f.precio === null || f.precio <= 0))
        e.variantes = 'Completa el nombre y el precio de cada tamaño.';
      else if (filas.some((f) => (f.precio ?? 0) > PRECIO_MAX)) e.variantes = 'El precio máximo es L 1,000,000.00.';
      else if (new Set(filas.map((f) => sinAcentos(f.nombre))).size !== filas.length) e.variantes = 'Hay dos tamaños con el mismo nombre.';
      Object.assign(datos, {
        precio: null,
        precio_abierto: false,
        variantes: filas.map((f) => ({ ...(f.id ? { id: f.id } : {}), nombre: f.nombre, precio: f.precio ?? 0 })),
        es_pasadia: false,
      });
    } else {
      Object.assign(datos, { precio: null, precio_abierto: true, variantes: [], es_pasadia: false });
    }
    const textos = opciones.map((o) => o.texto.trim().replace(/\s+/g, ' '));
    if (textos.length === 1) e.opciones = 'Agrega al menos 2 opciones o quítalas.';
    else if (textos.some((t) => !t) || new Set(textos.map(sinAcentos)).size !== textos.length)
      e.opciones = 'Las opciones no pueden ir vacías ni repetirse.';
    datos.opciones = textos;
    return { errores: e, datos };
  };

  const guardar = async () => {
    const { errores: e, datos } = validar();
    setErrores(e);
    const primero = (['nombre', 'precio', 'variantes', 'opciones'] as const).find((k) => e[k]);
    if (primero) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-campo="${primero}"]`)?.focus());
      return;
    }
    setGuardando(true);
    try {
      const guardado = producto ? await api.editarProducto(producto.id, datos) : await api.crearProducto(datos);
      // "Disponible" no se cambia con PUT: va por su propia dirección.
      if (producto && guardado.agotado === disponible) await api.agotado(guardado.id, !disponible);
      toast({ texto: 'Producto guardado ✓', tipo: 'ok' });
      alGuardar();
    } catch (err) {
      setGuardando(false);
      if (err instanceof ApiError && err.status === 409) setErrores({ nombre: err.message });
      toast({ texto: mensajeDeError(err), tipo: 'error' });
    }
  };

  const cambiarVariante = (clave: number, campo: 'nombre' | 'precio', valor: string) => {
    setVariantes((vs) => vs.map((v) => (v.clave === clave ? { ...v, [campo]: valor } : v)));
    setErrores((e) => (e.variantes ? { ...e, variantes: undefined } : e));
  };

  const titulo = producto ? `Editar · ${producto.nombre}` : 'Nuevo producto';
  const pasadiaPosible = forma === 'fijo';

  if (descartar) {
    return (
      <Confirmar
        titulo="¿Descartar los cambios?"
        textoConfirmar="Descartar"
        textoCancelar="Seguir editando"
        peligro
        alConfirmar={alCerrar}
        alCancelar={() => setDescartar(false)}
      />
    );
  }

  return (
    <Dialogo titulo={titulo} alCerrar={cerrar} className={`dialogo--grande ${pantallaCompleta ? 'dialogo--completo' : ''}`}>
      <form
        className="form-producto"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void guardar();
        }}
      >
        <div className="form-producto__cabeza">
          <h2 className="dialogo__titulo">{titulo}</h2>
          <button type="button" className="boton-cerrar" aria-label="Cerrar" onClick={cerrar}>
            ✕
          </button>
        </div>

        <div className="form-producto__scroll">
          <div className="campo">
            <label className="campo__etiqueta" htmlFor="prod-categoria">
              Categoría
            </label>
            <select id="prod-categoria" className="campo__entrada" value={categoriaId} onChange={(e) => setCategoriaId(Number(e.target.value))}>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                  {c.activa ? '' : ' (oculta)'}
                </option>
              ))}
            </select>
            {producto && categoriaId !== producto.categoria_id && (
              <p className="ayuda">Se moverá al final de la otra categoría.</p>
            )}
          </div>

          <div className="campo">
            <label className="campo__etiqueta" htmlFor="prod-nombre">
              Nombre
            </label>
            <input
              id="prod-nombre"
              data-campo="nombre"
              className="campo__entrada"
              value={nombre}
              maxLength={NOMBRE_MAX}
              autoFocus={!producto}
              aria-invalid={!!errores.nombre}
              aria-describedby="prod-nombre-pie"
              onChange={(e) => {
                setNombre(e.target.value);
                setErrores((x) => (x.nombre ? { ...x, nombre: undefined } : x));
              }}
            />
            <p id="prod-nombre-pie" className="campo__pie">
              <span className="campo__error">{errores.nombre}</span>
              <span className={nombre.length >= NOMBRE_MAX ? 'contador contador--lleno' : 'contador'}>
                {nombre.length}/{NOMBRE_MAX}
              </span>
            </p>
          </div>

          <div className="campo">
            <label className="campo__etiqueta" htmlFor="prod-descripcion">
              Descripción <span className="texto-2">(opcional)</span>
            </label>
            <input
              id="prod-descripcion"
              className="campo__entrada"
              value={descripcion}
              maxLength={DESCRIPCION_MAX}
              placeholder="ej. Con rice and beans y tortillas"
              aria-describedby="prod-descripcion-pie"
              onChange={(e) => setDescripcion(e.target.value)}
            />
            <p id="prod-descripcion-pie" className="campo__pie">
              <span className="ayuda">Se ve en la tarjeta del mesero.</span>
              <span className={descripcion.length >= DESCRIPCION_MAX ? 'contador contador--lleno' : 'contador'}>
                {descripcion.length}/{DESCRIPCION_MAX}
              </span>
            </p>
          </div>

          <fieldset className="campo">
            <legend className="campo__etiqueta">Precio</legend>
            <div className="segmentado segmentado--tres">
              <button type="button" className="segmentado__opcion" aria-pressed={forma === 'fijo'} onClick={() => setForma('fijo')}>
                Precio fijo
              </button>
              <button type="button" className="segmentado__opcion" aria-pressed={forma === 'tamano'} onClick={() => setForma('tamano')}>
                Por tamaño
              </button>
              <button type="button" className="segmentado__opcion" aria-pressed={forma === 'consultar'} onClick={() => setForma('consultar')}>
                A consultar
              </button>
            </div>

            {forma === 'fijo' && (
              <div className="form-producto__bloque">
                <CampoDinero id="prod-precio" etiqueta="Precio" valor={precio} alCambiar={setPrecio} entradaRef={(el) => el?.setAttribute('data-campo', 'precio')} />
                {errores.precio && <p className="campo__error">{errores.precio}</p>}
              </div>
            )}

            {forma === 'tamano' && (
              <div className="form-producto__bloque tamanos">
                <div className="tamanos__cabeza" aria-hidden="true">
                  <span>Tamaño</span>
                  <span>Precio</span>
                </div>
                <ul>
                  {variantes.map((v, i) => {
                    const etiqueta = v.nombre.trim() || `tamaño ${i + 1}`;
                    return (
                      <li key={v.clave} className="tamanos__fila">
                        <input
                          className="campo__entrada"
                          value={v.nombre}
                          maxLength={NOMBRE_MAX}
                          placeholder="ej. Talla 1, Personal, Para 2 personas"
                          aria-label={`Nombre del tamaño ${i + 1}`}
                          data-campo={i === 0 ? 'variantes' : undefined}
                          ref={(el) => {
                            if (el && enfocarVariante.current === v.clave) {
                              enfocarVariante.current = null;
                              el.focus();
                            }
                          }}
                          onChange={(e) => cambiarVariante(v.clave, 'nombre', e.target.value)}
                        />
                        <CampoDinero
                          id={`prod-var-${v.clave}`}
                          etiqueta={`Precio de ${etiqueta}`}
                          etiquetaOculta
                          valor={v.precio}
                          alCambiar={(t) => cambiarVariante(v.clave, 'precio', t)}
                        />
                        <span className="tamanos__acciones">
                          <FlechasOrden
                            grupo="var"
                            id={v.clave}
                            nombre={etiqueta}
                            primero={i === 0}
                            ultimo={i === variantes.length - 1}
                            alMover={(d) => setVariantes((vs) => mover(vs, i, d))}
                          />
                          <button
                            type="button"
                            className="boton-icono"
                            aria-label={`Quitar ${etiqueta}`}
                            onClick={() => setVariantes((vs) => vs.filter((x) => x.clave !== v.clave))}
                          >
                            ✕
                          </button>
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <div className="tamanos__pie">
                  <button
                    type="button"
                    className="boton boton--secundario boton--chico"
                    disabled={variantes.length >= MAX_LISTA}
                    onClick={() => {
                      const clave = nuevaClave();
                      enfocarVariante.current = clave;
                      setVariantes((vs) => [...vs, { clave, nombre: '', precio: '' }]);
                    }}
                  >
                    + Agregar tamaño
                  </button>
                  <span className="texto-2 texto-s">
                    {variantes.length >= MAX_LISTA ? 'Máximo 12.' : `${variantes.length} de ${MAX_LISTA}`}
                  </span>
                </div>
                {errores.variantes && <p className="campo__error">{errores.variantes}</p>}
              </div>
            )}

            {forma === 'consultar' && (
              <p className="form-producto__bloque texto-2 texto-s">
                El mesero escribe el precio al pedir (por ejemplo, la langosta según su tamaño).
              </p>
            )}
          </fieldset>

          <fieldset className="campo">
            <legend className="campo__etiqueta">
              Opciones <span className="texto-2">(opcional)</span>
            </legend>
            <p className="ayuda">El mesero debe elegir una. No cambian el precio.</p>
            {opciones.length === 0 ? (
              <button
                type="button"
                className="boton boton--secundario boton--chico boton--alinear-izq"
                onClick={() => setOpciones([{ clave: nuevaClave(), texto: '' }, { clave: nuevaClave(), texto: '' }])}
              >
                + Agregar opciones
              </button>
            ) : (
              <>
                <ul className="opciones-lista">
                  {opciones.map((o, i) => (
                    <li key={o.clave} className="opciones-lista__fila">
                      <input
                        className="campo__entrada"
                        value={o.texto}
                        maxLength={NOMBRE_MAX}
                        placeholder="ej. Camarón"
                        aria-label={`Opción ${i + 1}`}
                        data-campo={i === 0 ? 'opciones' : undefined}
                        onChange={(e) => setOpciones((os) => os.map((x) => (x.clave === o.clave ? { ...x, texto: e.target.value } : x)))}
                      />
                      <button
                        type="button"
                        className="boton-icono"
                        aria-label={`Quitar ${o.texto.trim() || `opción ${i + 1}`}`}
                        onClick={() => setOpciones((os) => os.filter((x) => x.clave !== o.clave))}
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="tamanos__pie">
                  <button
                    type="button"
                    className="boton boton--secundario boton--chico"
                    disabled={opciones.length >= MAX_LISTA}
                    onClick={() => setOpciones((os) => [...os, { clave: nuevaClave(), texto: '' }])}
                  >
                    + Agregar opción
                  </button>
                  {opciones.length >= MAX_LISTA && <span className="texto-2 texto-s">Máximo 12.</span>}
                </div>
              </>
            )}
            {errores.opciones && <p className="campo__error">{errores.opciones}</p>}
          </fieldset>

          <div className="campo">
            <div className="campo--fila">
              <span className="campo__etiqueta">Es pasadía (consumo mínimo)</span>
              <Interruptor
                encendido={pasadiaPosible && esPasadia}
                etiqueta="Es pasadía (consumo mínimo)"
                textoEncendido="Sí"
                textoApagado="No"
                disabled={!pasadiaPosible}
                alCambiar={setEsPasadia}
              />
            </div>
            <p className="ayuda">
              {pasadiaPosible
                ? 'Su precio funciona como consumo mínimo por persona: la cuenta cobra lo que sea mayor, el consumo o los pasadías.'
                : 'El pasadía necesita precio fijo.'}
            </p>
          </div>

          {producto && (
            <div className="campo campo--fila">
              <span className="campo__etiqueta">Disponible</span>
              <Interruptor encendido={disponible} etiqueta={`${producto.nombre} disponible`} alCambiar={setDisponible} />
            </div>
          )}

          <p className="ayuda">Los cambios aplican a los pedidos nuevos. Las cuentas y cortes anteriores no cambian.</p>
          {producto && forma === 'fijo' && producto.precio && textoACentavos(precio) !== producto.precio && (
            <p className="ayuda">Precio anterior: {dinero(producto.precio)}.</p>
          )}
        </div>

        <div className="form-producto__pie">
          {producto && alQuitar && producto.activo && (
            <button type="button" className="boton boton--texto boton--peligro-texto dialogo__izquierda" onClick={() => alQuitar(producto)}>
              Quitar del menú
            </button>
          )}
          <button type="button" className="boton boton--secundario" onClick={cerrar} disabled={guardando}>
            Cancelar
          </button>
          <BotonAccion type="submit" className="boton boton--primario" ocupado={guardando} textoOcupado="Guardando…">
            {producto ? 'Guardar' : 'Crear producto'}
          </BotonAccion>
        </div>
      </form>
    </Dialogo>
  );
}
