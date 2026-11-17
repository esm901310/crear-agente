import { Icono } from './Icono';

/** Banda visible cuando el servidor dice que los precios son de ejemplo (modoPrueba). */
export function AvisoPrueba({ datos }: { datos: { modoPrueba?: true; avisoPrueba?: string } | null | undefined }) {
  if (!datos?.modoPrueba) return null;
  return (
    <div className="banda banda-ambar aviso-prueba" role="note">
      <Icono nombre="alerta" tamano={20} />
      <div className="banda-contenido">
        <p>
          <strong>Precios de ejemplo (modo de prueba).</strong>
          {datos.avisoPrueba ? ` ${datos.avisoPrueba}` : ''}
        </p>
      </div>
    </div>
  );
}
