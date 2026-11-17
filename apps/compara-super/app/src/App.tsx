import { useEffect, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import { AvisoModoSimulado } from './componentes/AvisoModoSimulado';
import { RutaProtegida } from './componentes/RutaProtegida';
import { ProveedorAvisos } from './estado/avisos';
import { ProveedorLista } from './estado/lista';
import { ProveedorSesion, useSesion } from './estado/sesion';
import { AgregarProducto } from './pantallas/AgregarProducto';
import { Bienvenida } from './pantallas/Bienvenida';
import { Cargando } from './pantallas/Cargando';
import { CrearCuenta } from './pantallas/CrearCuenta';
import { DetalleTienda } from './pantallas/DetalleTienda';
import { IniciarSesion } from './pantallas/IniciarSesion';
import { MiCuenta } from './pantallas/MiCuenta';
import { MiLista } from './pantallas/MiLista';
import { Resultado } from './pantallas/Resultado';

function SubirAlCambiarDePantalla() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function Rutas() {
  const { usuario, verificando } = useSesion();
  if (verificando) return <Cargando />;
  const soloSinSesion = (pantalla: ReactNode) => (usuario ? <Navigate to="/lista" replace /> : pantalla);
  const conSesion = (pantalla: ReactNode) => <RutaProtegida>{pantalla}</RutaProtegida>;
  return (
    <Routes>
      <Route path="/" element={soloSinSesion(<Bienvenida />)} />
      <Route path="/crear-cuenta" element={soloSinSesion(<CrearCuenta />)} />
      <Route path="/entrar" element={soloSinSesion(<IniciarSesion />)} />
      <Route path="/lista" element={conSesion(<MiLista />)} />
      <Route path="/agregar" element={conSesion(<AgregarProducto />)} />
      <Route path="/resultado" element={conSesion(<Resultado />)} />
      <Route path="/detalle/:tienda" element={conSesion(<DetalleTienda />)} />
      <Route path="/cuenta" element={conSesion(<MiCuenta />)} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <SubirAlCambiarDePantalla />
      <ProveedorAvisos>
        <ProveedorSesion>
          <ProveedorLista>
            <div className="app">
              <AvisoModoSimulado />
              <Rutas />
            </div>
          </ProveedorLista>
        </ProveedorSesion>
      </ProveedorAvisos>
    </BrowserRouter>
  );
}
