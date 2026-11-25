import { useCallback } from 'react';
import { useCarga } from './hooks/useCarga';
import { useHistorial } from './hooks/useHistorial';
import PantallaInicio from './screens/PantallaInicio';
import PantallaLeyendo from './screens/PantallaLeyendo';
import PantallaEditor from './screens/PantallaEditor';
import PantallaError from './screens/PantallaError';

export default function App() {
  const carga = useCarga();
  const historial = useHistorial();
  const { reiniciar } = historial;
  const { elegirArchivo, volverAInicio } = carga;

  const elegir = useCallback(
    (archivo: File) => {
      reiniciar();
      elegirArchivo(archivo);
    },
    [elegirArchivo, reiniciar],
  );

  const salir = useCallback(() => {
    reiniciar();
    volverAInicio();
  }, [reiniciar, volverAInicio]);

  switch (carga.fase.tipo) {
    case 'inicio':
      return <PantallaInicio alElegir={elegir} />;
    case 'leyendo':
      return <PantallaLeyendo nombre={carga.nombre} progreso={carga.progreso} paginas={carga.paginas} alCancelar={salir} />;
    case 'editor':
      return <PantallaEditor nombre={carga.nombre} bytes={carga.bytes} paginas={carga.paginas} historial={historial} alSalir={salir} />;
    case 'error':
      return (
        <PantallaError
          error={carga.fase.error}
          alElegir={elegir}
          alIntentarIgual={carga.intentarIgual}
          alVerIgual={carga.verIgual}
          alReintentar={carga.reintentar}
        />
      );
  }
}
