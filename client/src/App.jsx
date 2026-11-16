import { Navigate, NavLink, Outlet, Route, Routes } from 'react-router-dom';
import { useSesion } from './sesion.jsx';
import Acceso from './pages/Acceso.jsx';
import Resumen from './pages/Resumen.jsx';
import Gastos from './pages/Gastos.jsx';
import Categorias from './pages/Categorias.jsx';

function Privado() {
  const { usuario, cargando, salir } = useSesion();
  if (cargando) return <p className="centrado">Cargando…</p>;
  if (!usuario) return <Navigate to="/ingresar" replace />;

  return (
    <div className="app">
      <header className="barra">
        <strong className="marca">Gestor de gastos</strong>
        <nav aria-label="Principal">
          <NavLink to="/" end>Resumen</NavLink>
          <NavLink to="/gastos">Gastos</NavLink>
          <NavLink to="/categorias">Categorías</NavLink>
        </nav>
        <div className="usuario">
          <span>{usuario.nombre}</span>
          <button className="btn secundario" onClick={salir}>Salir</button>
        </div>
      </header>
      <main className="contenido">
        <Outlet />
      </main>
    </div>
  );
}

export default function App() {
  const { usuario, cargando } = useSesion();
  return (
    <Routes>
      <Route
        path="/ingresar"
        element={!cargando && usuario ? <Navigate to="/" replace /> : <Acceso modo="ingresar" />}
      />
      <Route
        path="/registro"
        element={!cargando && usuario ? <Navigate to="/" replace /> : <Acceso modo="registro" />}
      />
      <Route element={<Privado />}>
        <Route index element={<Resumen />} />
        <Route path="gastos" element={<Gastos />} />
        <Route path="categorias" element={<Categorias />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
