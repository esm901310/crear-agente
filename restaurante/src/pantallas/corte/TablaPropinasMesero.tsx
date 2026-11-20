// Tabla de propinas por mesero con fila de total (corte y reporte de propinas).
import { dinero } from '../../formato';
import type { PropinaMesero } from '../../tipos';

export function TablaPropinasMesero({ filas }: { filas: PropinaMesero[] }) {
  const suma = (k: 'cuentas' | 'efectivo' | 'tarjeta' | 'transferencia' | 'total') =>
    filas.reduce((s, f) => s + f[k], 0);
  return (
    <div className="tabla-envoltura">
      <table className="tabla tabla--cebra">
        <thead>
          <tr>
            <th scope="col">Mesero</th>
            <th scope="col" className="num">
              Cuentas con propina
            </th>
            <th scope="col" className="num">
              Efectivo
            </th>
            <th scope="col" className="num">
              Tarjeta
            </th>
            <th scope="col" className="num">
              Transferencia
            </th>
            <th scope="col" className="num">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.mesero_id}>
              <td>{f.nombre}</td>
              <td className="num">{f.cuentas}</td>
              <td className="num">{dinero(f.efectivo)}</td>
              <td className="num">{dinero(f.tarjeta)}</td>
              <td className="num">{dinero(f.transferencia)}</td>
              <td className="num fuerte">{dinero(f.total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="tabla__total">
            <th scope="row">Total</th>
            <td className="num">{suma('cuentas')}</td>
            <td className="num">{dinero(suma('efectivo'))}</td>
            <td className="num">{dinero(suma('tarjeta'))}</td>
            <td className="num">{dinero(suma('transferencia'))}</td>
            <td className="num">{dinero(suma('total'))}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
