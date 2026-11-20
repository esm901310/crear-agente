// A1 — Diálogo de categoría, nueva o editar (docs/diseno.md, 30.1).
import { useState } from 'react';
import { api, ApiError, mensajeDeError } from '../../api';
import { BotonAccion } from '../../componentes/BotonAccion';
import { Confirmar } from '../../componentes/Confirmar';
import { Dialogo } from '../../componentes/Dialogo';
import { Interruptor } from '../../componentes/Interruptor';
import { useToast } from '../../componentes/Toast';
import type { CategoriaAdmin } from '../../tipos';

const NOMBRE_MAX = 60;

interface Props {
  /** null = nueva. */
  categoria: CategoriaAdmin | null;
  alGuardar: (c: CategoriaAdmin) => void;
  alCerrar: () => void;
}

export function DialogoCategoria({ categoria, alGuardar, alCerrar }: Props) {
  const toast = useToast();
  const [nombre, setNombre] = useState(categoria?.nombre ?? '');
  const [vaACocina, setVaACocina] = useState(categoria?.va_a_cocina ?? true);
  const [visible, setVisible] = useState(categoria?.activa ?? true);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [confirmarOcultar, setConfirmarOcultar] = useState(false);
  const activos = categoria?.productos.filter((p) => p.activo).length ?? 0;

  const guardar = async () => {
    const limpio = nombre.trim().replace(/\s+/g, ' ');
    if (!limpio) {
      setError('Escribe el nombre de la categoría.');
      document.getElementById('cat-nombre')?.focus();
      return;
    }
    setGuardando(true);
    try {
      const c = categoria
        ? await api.editarCategoria(categoria.id, { nombre: limpio, va_a_cocina: vaACocina, activa: visible })
        : await api.crearCategoria(limpio, vaACocina);
      toast({ texto: 'Categoría guardada ✓', tipo: 'ok' });
      alGuardar(c);
    } catch (e) {
      setGuardando(false);
      setConfirmarOcultar(false);
      if (e instanceof ApiError && e.status === 409) setError(e.message);
      else toast({ texto: mensajeDeError(e), tipo: 'error' });
    }
  };

  const alEnviar = () => {
    if (categoria && categoria.activa && !visible) setConfirmarOcultar(true);
    else void guardar();
  };

  if (confirmarOcultar && categoria) {
    return (
      <Confirmar
        titulo={`¿Ocultar «${categoria.nombre}»?`}
        textoConfirmar="Ocultar categoría"
        ocupado={guardando}
        alConfirmar={() => void guardar()}
        alCancelar={() => setConfirmarOcultar(false)}
      >
        <p>
          Sus {activos} {activos === 1 ? 'producto dejará' : 'productos dejarán'} de verse en el menú de los meseros. Las cuentas
          abiertas no cambian.
        </p>
      </Confirmar>
    );
  }

  return (
    <Dialogo titulo={categoria ? `Editar · ${categoria.nombre}` : 'Nueva categoría'} alCerrar={() => !guardando && alCerrar()}>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          alEnviar();
        }}
      >
        <h2 className="dialogo__titulo">{categoria ? `Editar · ${categoria.nombre}` : 'Nueva categoría'}</h2>
        <div className="campo">
          <label className="campo__etiqueta" htmlFor="cat-nombre">
            Nombre
          </label>
          <input
            id="cat-nombre"
            className="campo__entrada"
            value={nombre}
            maxLength={NOMBRE_MAX}
            autoFocus
            aria-invalid={error !== ''}
            aria-describedby="cat-nombre-ayuda"
            onChange={(e) => {
              setNombre(e.target.value);
              setError('');
            }}
          />
          <p id="cat-nombre-ayuda" className="campo__pie">
            <span className="campo__error" role={error ? 'alert' : undefined}>
              {error}
            </span>
            <span className={nombre.length >= NOMBRE_MAX ? 'contador contador--lleno' : 'contador'}>
              {nombre.length}/{NOMBRE_MAX}
            </span>
          </p>
        </div>

        <fieldset className="campo">
          <legend className="campo__etiqueta">¿Va a cocina?</legend>
          <div className="segmentado">
            <button type="button" className="segmentado__opcion" aria-pressed={vaACocina} onClick={() => setVaACocina(true)}>
              Sí, se prepara en cocina
            </button>
            <button type="button" className="segmentado__opcion" aria-pressed={!vaACocina} onClick={() => setVaACocina(false)}>
              No, la entrega el mesero
            </button>
          </div>
          <p className="ayuda">
            Si dices que no (bebidas, bar, actividades), sus productos se cobran pero no aparecen en la pantalla de Cocina.
          </p>
        </fieldset>

        {categoria && (
          <div className="campo campo--fila">
            <span className="campo__etiqueta" id="cat-visible">
              Visible para los meseros
            </span>
            <Interruptor
              encendido={visible}
              etiqueta="Visible para los meseros"
              textoEncendido="Visible"
              textoApagado="Oculta"
              alCambiar={setVisible}
            />
          </div>
        )}

        <div className="dialogo__botones">
          <button type="button" className="boton boton--secundario" onClick={alCerrar} disabled={guardando}>
            Cancelar
          </button>
          <BotonAccion type="submit" className="boton boton--primario" ocupado={guardando} textoOcupado="Guardando…">
            {categoria ? 'Guardar' : 'Crear categoría'}
          </BotonAccion>
        </div>
      </form>
    </Dialogo>
  );
}
