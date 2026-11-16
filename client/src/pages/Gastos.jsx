import { useCallback, useEffect, useRef, useState } from 'react';
import { api, consulta } from '../api.js';
import { dinero, fechaCorta, hoy, mesActual, MEDIOS } from '../formato.js';
import { Campo } from './Acceso.jsx';

const VACIO = { monto: '', fecha: hoy(), categoria_id: '', descripcion: '', medio_pago: 'efectivo' };

export default function Gastos() {
  const [filtros, setFiltros] = useState({ mes: mesActual(), categoria_id: '', q: '' });
  const [gastos, setGastos] = useState([]);
  const [total, setTotal] = useState(0);
  const [categorias, setCategorias] = useState([]);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState(null); // null = cerrado, {} = nuevo, {id,...} = edición
  const [aBorrar, setABorrar] = useState(null);
  const [ia, setIa] = useState({ texto: '', imagen: null, nombre: '', cargando: false, error: '' });

  const cargar = useCallback(async () => {
    try {
      const d = await api.get(`/gastos${consulta(filtros)}`);
      setGastos(d.gastos);
      setTotal(d.total);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [filtros]);

  useEffect(() => {
    api.get('/categorias').then((d) => setCategorias(d.categorias)).catch((e) => setError(e.message));
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const cambiarFiltro = (e) => setFiltros({ ...filtros, [e.target.name]: e.target.value });

  async function borrar(id) {
    try {
      await api.delete(`/gastos/${id}`);
      setABorrar(null);
      cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  function elegirFoto(e) {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(archivo.type)) {
      return setIa((a) => ({ ...a, error: 'Usá una imagen PNG, JPG o WebP' }));
    }
    if (archivo.size > 4 * 1024 * 1024) {
      return setIa((a) => ({ ...a, error: 'La foto pesa más de 4 MB' }));
    }
    const lector = new FileReader();
    lector.onload = () => setIa((a) => ({ ...a, imagen: lector.result, nombre: archivo.name, error: '' }));
    lector.readAsDataURL(archivo);
  }

  // La IA solo propone: el resultado abre el formulario para revisar y confirmar.
  async function interpretar(e) {
    e.preventDefault();
    if (!ia.texto.trim() && !ia.imagen) {
      return setIa((a) => ({ ...a, error: 'Escribí el gasto o subí la foto del ticket' }));
    }
    setIa((a) => ({ ...a, cargando: true, error: '' }));
    try {
      const d = await api.post('/gastos/interpretar', {
        texto: ia.texto.trim() || undefined,
        imagen: ia.imagen ?? undefined,
        hoy: hoy(),
      });
      setIa({ texto: '', imagen: null, nombre: '', cargando: false, error: '' });
      setEditando({ sugerencia: d.sugerencia });
    } catch (err) {
      setIa((a) => ({ ...a, cargando: false, error: err.detalles?.texto ?? err.detalles?.imagen ?? err.message }));
    }
  }

  return (
    <>
      <div className="encabezado">
        <h1>Gastos</h1>
        <div className="acciones">
          <a className="btn secundario" href={`/api/gastos/exportar${consulta(filtros)}`}>Exportar CSV</a>
          <button className="btn" onClick={() => setEditando({})}>Nuevo gasto</button>
        </div>
      </div>

      <form className="tarjeta ia" onSubmit={interpretar}>
        <label className="campo">
          <span>Cargar con IA</span>
          <input
            name="texto"
            value={ia.texto}
            onChange={(e) => setIa({ ...ia, texto: e.target.value })}
            maxLength={500}
            placeholder="Ej: gasté 4500 en el súper ayer con débito"
          />
        </label>
        <div className="ia-acciones">
          <label className="btn secundario">
            {ia.imagen ? 'Cambiar foto' : 'Foto del ticket'}
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={elegirFoto} className="solo-lector" />
          </label>
          {ia.imagen && (
            <span className="adjunto">
              {ia.nombre}
              <button type="button" className="btn secundario chico" onClick={() => setIa({ ...ia, imagen: null, nombre: '' })}>
                Quitar
              </button>
            </span>
          )}
          <button className="btn" disabled={ia.cargando}>{ia.cargando ? 'Interpretando…' : 'Interpretar'}</button>
        </div>
        {ia.error ? (
          <small className="error" role="alert">{ia.error}</small>
        ) : (
          <small className="suave">La IA completa el formulario y vos lo revisás antes de guardar.</small>
        )}
      </form>

      <div className="filtros tarjeta">
        <label className="campo">
          <span>Mes</span>
          <input type="month" name="mes" value={filtros.mes} onChange={cambiarFiltro} />
        </label>
        <label className="campo">
          <span>Categoría</span>
          <select name="categoria_id" value={filtros.categoria_id} onChange={cambiarFiltro}>
            <option value="">Todas</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </label>
        <label className="campo crece">
          <span>Buscar en descripción</span>
          <input type="search" name="q" value={filtros.q} onChange={cambiarFiltro} placeholder="Ej: super" />
        </label>
        <button className="btn secundario" onClick={() => setFiltros({ mes: '', categoria_id: '', q: '' })}>
          Ver todo
        </button>
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      <section className="tarjeta sin-relleno">
        {cargando ? (
          <p className="suave relleno-interno">Cargando…</p>
        ) : gastos.length === 0 ? (
          <p className="suave relleno-interno">No hay gastos con estos filtros. Agregá uno con “Nuevo gasto”.</p>
        ) : (
          <div className="tabla-scroll">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th><th>Categoría</th><th>Descripción</th><th>Pago</th>
                  <th className="num">Monto</th><th><span className="solo-lector">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {gastos.map((g) => (
                  <tr key={g.id}>
                    <td>{fechaCorta(g.fecha)}</td>
                    <td><i className="punto" style={{ background: g.categoria_color }} />{g.categoria}</td>
                    <td className="desc">{g.descripcion || <span className="suave">—</span>}</td>
                    <td>{MEDIOS[g.medio_pago]}</td>
                    <td className="num">{dinero(g.monto)}</td>
                    <td className="acciones-fila">
                      {aBorrar === g.id ? (
                        <>
                          <button className="btn peligro chico" onClick={() => borrar(g.id)}>Confirmar</button>
                          <button className="btn secundario chico" onClick={() => setABorrar(null)}>Cancelar</button>
                        </>
                      ) : (
                        <>
                          <button className="btn secundario chico" onClick={() => setEditando(g)}>Editar</button>
                          <button className="btn secundario chico" onClick={() => setABorrar(g.id)}>Borrar</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan="4">Total ({gastos.length})</td><td className="num">{dinero(total)}</td><td /></tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {editando && (
        <FormularioGasto
          inicial={editando}
          categorias={categorias}
          alCerrar={() => setEditando(null)}
          alGuardar={() => { setEditando(null); cargar(); }}
        />
      )}
    </>
  );
}

function FormularioGasto({ inicial, categorias, alCerrar, alGuardar }) {
  const dialogo = useRef(null);
  const esEdicion = Boolean(inicial.id);
  const sug = inicial.sugerencia; // datos propuestos por la IA (pueden venir en null)
  const [v, setV] = useState(() => {
    if (esEdicion) return { ...inicial, monto: String(inicial.monto) };
    const base = { ...VACIO, fecha: hoy(), categoria_id: categorias[0]?.id ?? '' };
    if (!sug) return base;
    return {
      monto: sug.monto != null ? String(sug.monto).replace('.', ',') : '',
      fecha: sug.fecha ?? base.fecha,
      categoria_id: sug.categoria_id ?? base.categoria_id,
      descripcion: sug.descripcion ?? '',
      medio_pago: sug.medio_pago ?? base.medio_pago,
    };
  });
  const faltantes = sug
    ? [sug.monto == null && 'monto', sug.categoria_id == null && 'categoría', sug.medio_pago == null && 'medio de pago'].filter(Boolean)
    : [];
  const [errores, setErrores] = useState({});
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => { dialogo.current?.showModal(); }, []);

  const cambiar = (e) => setV({ ...v, [e.target.name]: e.target.value });

  async function enviar(e) {
    e.preventDefault();
    setErrores({});
    setMensaje('');
    setEnviando(true);
    const cuerpo = {
      monto: Number(String(v.monto).replace(',', '.')),
      fecha: v.fecha,
      categoria_id: Number(v.categoria_id),
      descripcion: v.descripcion,
      medio_pago: v.medio_pago,
    };
    try {
      if (esEdicion) await api.put(`/gastos/${inicial.id}`, cuerpo);
      else await api.post('/gastos', cuerpo);
      alGuardar();
    } catch (err) {
      setErrores(err.detalles ?? {});
      setMensaje(err.message);
      setEnviando(false);
    }
  }

  return (
    <dialog ref={dialogo} onClose={alCerrar} className="modal">
      <form className="formulario" onSubmit={enviar} noValidate>
        <h2>{esEdicion ? 'Editar gasto' : 'Nuevo gasto'}</h2>
        {sug && (
          <p className="aviso-ia">
            Datos sugeridos por IA. Revisalos antes de guardar.
            {faltantes.length > 0 && ` No pudo determinar: ${faltantes.join(', ')}.`}
          </p>
        )}
        <div className="dos-campos">
          <Campo etiqueta="Monto" error={errores.monto}>
            <input name="monto" inputMode="decimal" value={v.monto} onChange={cambiar} placeholder="0,00" autoFocus />
          </Campo>
          <Campo etiqueta="Fecha" error={errores.fecha}>
            <input type="date" name="fecha" value={v.fecha} onChange={cambiar} />
          </Campo>
        </div>
        <div className="dos-campos">
          <Campo etiqueta="Categoría" error={errores.categoria_id}>
            <select name="categoria_id" value={v.categoria_id} onChange={cambiar}>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </Campo>
          <Campo etiqueta="Medio de pago" error={errores.medio_pago}>
            <select name="medio_pago" value={v.medio_pago} onChange={cambiar}>
              {Object.entries(MEDIOS).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
            </select>
          </Campo>
        </div>
        <Campo etiqueta="Descripción (opcional)" error={errores.descripcion}>
          <input name="descripcion" value={v.descripcion} onChange={cambiar} maxLength={200} />
        </Campo>
        {mensaje && Object.keys(errores).length === 0 && <p className="error" role="alert">{mensaje}</p>}
        <div className="acciones fin">
          <button type="button" className="btn secundario" onClick={() => dialogo.current?.close()}>Cancelar</button>
          <button className="btn" disabled={enviando}>{enviando ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </form>
    </dialog>
  );
}
