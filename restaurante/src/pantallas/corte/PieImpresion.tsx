// Pie que solo aparece al imprimir: fecha de impresión y líneas de firma.
import { APP_NOMBRE } from '../../config';
import { fechaNumerica, hora } from '../../formato';

export function PieImpresion({ impresoEn, firmas = true }: { impresoEn: number; firmas?: boolean }) {
  const iso = new Date(impresoEn).toISOString();
  return (
    <footer className="pie-impresion solo-impresion">
      <p>
        Impreso el {fechaNumerica(impresoEn)} {hora(iso)} · {APP_NOMBRE}
      </p>
      {firmas && (
        <div className="pie-impresion__firmas">
          <p>Entregó: ____________________</p>
          <p>Recibió: ____________________</p>
        </div>
      )}
    </footer>
  );
}
