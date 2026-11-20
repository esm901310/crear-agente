// Nota para un platillo: chips rápidos + texto libre (máx. 140) + "Aplicar a".
import { useState } from 'react';
import { Dialogo } from '../componentes/Dialogo';
import { NOTA_MAX, NOTAS_RAPIDAS } from '../config';
import type { LineaPedido } from '../pedidos';

interface Props {
  linea: LineaPedido;
  hoja: boolean;
  alGuardar: (nota: string | null, soloUna: boolean) => void;
  alCerrar: () => void;
}

function separarNota(nota: string | null): { chips: string[]; libre: string } {
  if (!nota) return { chips: [], libre: '' };
  const partes = nota.split(', ');
  const chips = partes.filter((p) => NOTAS_RAPIDAS.includes(p));
  const libre = partes.filter((p) => !NOTAS_RAPIDAS.includes(p)).join(', ');
  return { chips, libre };
}

function unir(chips: string[], libre: string): string {
  return [...chips, libre.trim()].filter(Boolean).join(', ');
}

export function DialogoNota({ linea, hoja, alGuardar, alCerrar }: Props) {
  const inicial = separarNota(linea.nota);
  const [chips, setChips] = useState<string[]>(inicial.chips);
  const [libre, setLibre] = useState(inicial.libre);
  const [soloUna, setSoloUna] = useState(false);
  const final = unir(chips, libre);
  const lleno = final.length >= NOTA_MAX;

  const alternarChip = (c: string) => {
    if (chips.includes(c)) {
      setChips(chips.filter((x) => x !== c));
      return;
    }
    const nuevos = [...chips, c];
    if (unir(nuevos, libre).length <= NOTA_MAX) setChips(nuevos);
  };

  const alEscribir = (texto: string) => {
    // No deja pasar de 140 caracteres en total (chips + texto).
    let t = texto;
    while (t.length > 0 && unir(chips, t).length > NOTA_MAX) t = t.slice(0, -1);
    setLibre(t);
  };

  return (
    <Dialogo titulo={`Nota para: ${linea.nombre}`} alCerrar={alCerrar} hoja={hoja}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          alGuardar(final === '' ? null : final, soloUna);
        }}
      >
        <h2 className="dialogo__titulo">Nota para: {linea.nombre}</h2>
        <div className="chips chips--envolver" role="group" aria-label="Notas rápidas">
          {NOTAS_RAPIDAS.map((c) => (
            <button key={c} type="button" className="chip" aria-pressed={chips.includes(c)} onClick={() => alternarChip(c)}>
              {c}
            </button>
          ))}
        </div>

        <label className="campo">
          <span className="campo__etiqueta">Otra indicación</span>
          <input
            className="campo__entrada"
            type="text"
            value={libre}
            placeholder="ej. salsa aparte"
            onChange={(e) => alEscribir(e.target.value)}
            aria-describedby="nota-contador"
          />
        </label>
        <p id="nota-contador" className={lleno ? 'contador contador--lleno' : 'contador'} aria-live="polite">
          {final.length}/{NOTA_MAX}
        </p>

        {linea.cantidad > 1 && (
          <div className="aplicar-a" role="group" aria-label="Aplicar a">
            <span className="campo__etiqueta">Aplicar a:</span>
            <button type="button" className="chip" aria-pressed={!soloUna} onClick={() => setSoloUna(false)}>
              Los {linea.cantidad}
            </button>
            <button type="button" className="chip" aria-pressed={soloUna} onClick={() => setSoloUna(true)}>
              Solo 1
            </button>
          </div>
        )}

        <div className="dialogo__botones">
          {linea.nota && (
            <button type="button" className="boton boton--texto dialogo__izquierda" onClick={() => alGuardar(null, false)}>
              Quitar nota
            </button>
          )}
          <button type="button" className="boton boton--secundario" onClick={alCerrar}>
            Cancelar
          </button>
          <button type="submit" className="boton boton--primario">
            Guardar
          </button>
        </div>
      </form>
    </Dialogo>
  );
}
