import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api.js';

const Sesion = createContext(null);
export const useSesion = () => useContext(Sesion);

export function SesionProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    api
      .get('/auth/yo')
      .then((d) => setUsuario(d.usuario))
      .catch(() => setUsuario(null))
      .finally(() => setCargando(false));
  }, []);

  const ingresar = async (email, password) => {
    const d = await api.post('/auth/login', { email, password });
    setUsuario(d.usuario);
  };
  const registrar = async (nombre, email, password) => {
    const d = await api.post('/auth/registro', { nombre, email, password });
    setUsuario(d.usuario);
  };
  const salir = async () => {
    await api.post('/auth/logout');
    setUsuario(null);
  };

  return (
    <Sesion.Provider value={{ usuario, cargando, ingresar, registrar, salir }}>
      {children}
    </Sesion.Provider>
  );
}
