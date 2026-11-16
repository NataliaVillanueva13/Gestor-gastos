import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSesion } from '../sesion.jsx';

export default function Acceso({ modo }) {
  const { ingresar, registrar } = useSesion();
  const esRegistro = modo === 'registro';
  const [valores, setValores] = useState({ nombre: '', email: '', password: '' });
  const [errores, setErrores] = useState({});
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);

  const cambiar = (e) => setValores({ ...valores, [e.target.name]: e.target.value });

  async function enviar(e) {
    e.preventDefault();
    setErrores({});
    setMensaje('');
    setEnviando(true);
    try {
      if (esRegistro) await registrar(valores.nombre, valores.email, valores.password);
      else await ingresar(valores.email, valores.password);
    } catch (err) {
      setErrores(err.detalles ?? {});
      setMensaje(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="acceso">
      <form className="tarjeta formulario" onSubmit={enviar} noValidate>
        <h1>{esRegistro ? 'Crear cuenta' : 'Ingresar'}</h1>
        <p className="suave">Registrá tus gastos y controlá tu presupuesto mensual.</p>

        {esRegistro && (
          <Campo etiqueta="Nombre" error={errores.nombre}>
            <input name="nombre" value={valores.nombre} onChange={cambiar} autoComplete="name" required />
          </Campo>
        )}
        <Campo etiqueta="Email" error={errores.email}>
          <input type="email" name="email" value={valores.email} onChange={cambiar} autoComplete="email" required />
        </Campo>
        <Campo etiqueta="Contraseña" error={errores.password} ayuda={esRegistro ? 'Mínimo 8 caracteres' : null}>
          <input
            type="password"
            name="password"
            value={valores.password}
            onChange={cambiar}
            autoComplete={esRegistro ? 'new-password' : 'current-password'}
            required
          />
        </Campo>

        {mensaje && Object.keys(errores).length === 0 && <p className="error" role="alert">{mensaje}</p>}

        <button className="btn" disabled={enviando}>
          {enviando ? 'Enviando…' : esRegistro ? 'Crear cuenta' : 'Ingresar'}
        </button>
        <p className="suave centrado-texto">
          {esRegistro ? (
            <>¿Ya tenés cuenta? <Link to="/ingresar">Ingresá</Link></>
          ) : (
            <>¿No tenés cuenta? <Link to="/registro">Registrate</Link></>
          )}
        </p>
      </form>
    </div>
  );
}

export function Campo({ etiqueta, error, ayuda, children }) {
  return (
    <label className="campo">
      <span>{etiqueta}</span>
      {children}
      {ayuda && !error && <small className="suave">{ayuda}</small>}
      {error && <small className="error" role="alert">{error}</small>}
    </label>
  );
}
