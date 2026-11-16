import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { dinero } from '../formato.js';
import { Campo } from './Acceso.jsx';

const NUEVA = { nombre: '', color: '#0d6e6e', presupuesto_mensual: '' };

export default function Categorias() {
  const [categorias, setCategorias] = useState([]);
  const [form, setForm] = useState(NUEVA);
  const [editandoId, setEditandoId] = useState(null);
  const [errores, setErrores] = useState({});
  const [mensaje, setMensaje] = useState('');
  const [aBorrar, setABorrar] = useState(null);
  const [cargando, setCargando] = useState(true);

  const cargar = () =>
    api
      .get('/categorias')
      .then((d) => setCategorias(d.categorias))
      .catch((e) => setMensaje(e.message))
      .finally(() => setCargando(false));
  useEffect(() => { cargar(); }, []);

  const cambiar = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  function empezarEdicion(c) {
    setEditandoId(c.id);
    setForm({
      nombre: c.nombre,
      color: c.color,
      presupuesto_mensual: c.presupuesto_mensual ?? '',
    });
    setErrores({});
    setMensaje('');
  }

  function cancelar() {
    setEditandoId(null);
    setForm(NUEVA);
    setErrores({});
    setMensaje('');
  }

  async function guardar(e) {
    e.preventDefault();
    setErrores({});
    setMensaje('');
    const texto = String(form.presupuesto_mensual).trim().replace(',', '.');
    const cuerpo = {
      nombre: form.nombre,
      color: form.color,
      presupuesto_mensual: texto === '' ? null : Number(texto),
    };
    try {
      if (editandoId) await api.put(`/categorias/${editandoId}`, cuerpo);
      else await api.post('/categorias', cuerpo);
      cancelar();
      cargar();
    } catch (err) {
      setErrores(err.detalles ?? {});
      setMensaje(err.message);
    }
  }

  async function borrar(id) {
    setMensaje('');
    try {
      await api.delete(`/categorias/${id}`);
      setABorrar(null);
      cargar();
    } catch (err) {
      setABorrar(null);
      setMensaje(err.message);
    }
  }

  return (
    <>
      <div className="encabezado"><h1>Categorías</h1></div>

      <div className="dos-columnas">
        <form className="tarjeta formulario" onSubmit={guardar} noValidate>
          <h2>{editandoId ? 'Editar categoría' : 'Nueva categoría'}</h2>
          <Campo etiqueta="Nombre" error={errores.nombre}>
            <input name="nombre" value={form.nombre} onChange={cambiar} maxLength={50} />
          </Campo>
          <div className="dos-campos">
            <Campo etiqueta="Color" error={errores.color}>
              <input type="color" name="color" value={form.color} onChange={cambiar} />
            </Campo>
            <Campo
              etiqueta="Presupuesto mensual"
              error={errores.presupuesto_mensual}
              ayuda="Dejalo vacío si no querés fijar un tope"
            >
              <input
                name="presupuesto_mensual"
                inputMode="decimal"
                value={form.presupuesto_mensual}
                onChange={cambiar}
                placeholder="0,00"
              />
            </Campo>
          </div>
          {mensaje && Object.keys(errores).length === 0 && <p className="error" role="alert">{mensaje}</p>}
          <div className="acciones">
            <button className="btn">{editandoId ? 'Guardar cambios' : 'Agregar'}</button>
            {editandoId && <button type="button" className="btn secundario" onClick={cancelar}>Cancelar</button>}
          </div>
        </form>

        <section className="tarjeta sin-relleno" aria-label="Lista de categorías">
          {cargando ? (
            <p className="suave relleno-interno">Cargando…</p>
          ) : (
            <ul className="lista-cat">
              {categorias.map((c) => (
                <li key={c.id}>
                  <div>
                    <i className="punto" style={{ background: c.color }} />
                    <strong>{c.nombre}</strong>
                    <div className="suave">
                      {c.presupuesto_mensual !== null ? `${dinero(c.presupuesto_mensual)} por mes` : 'Sin presupuesto'}
                    </div>
                  </div>
                  <div className="acciones-fila">
                    {aBorrar === c.id ? (
                      <>
                        <button className="btn peligro chico" onClick={() => borrar(c.id)}>Confirmar</button>
                        <button className="btn secundario chico" onClick={() => setABorrar(null)}>Cancelar</button>
                      </>
                    ) : (
                      <>
                        <button className="btn secundario chico" onClick={() => empezarEdicion(c)}>Editar</button>
                        <button className="btn secundario chico" onClick={() => setABorrar(c.id)}>Borrar</button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
