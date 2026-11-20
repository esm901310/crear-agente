import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ProveedorToast } from './componentes/Toast';
import { APP_NOMBRE } from './config';
import './estilos.css';
import './imprimir.css';

document.title = APP_NOMBRE;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ProveedorToast>
      <App />
    </ProveedorToast>
  </StrictMode>,
);
