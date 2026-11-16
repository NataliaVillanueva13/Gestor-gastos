import { useEffect, useState } from 'react';
import { api } from './api.js';
import { dinero, fechaCorta, hoy, nombreMes } from './formato.js';

const EJEMPLOS = [
  '¿En qué gasté más este mes?',
  '¿Cuánto me queda del presupuesto?',
  '¿Cuánto gasté con tarjeta de crédito este mes?',
  '¿Cómo vengo los últimos 6 meses?',
];

// Preguntas en lenguaje natural. La IA interpreta la pregunta y redacta la respuesta,
// pero los números los calcula el servidor con la base de datos.
export default function Preguntar() {
  const [pregunta, setPregunta] = useState('');
  const [historial, setHistorial] = useState([]); // respuestas, la más nueva primero
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [segundos, setSegundos] = useState(0);

  // Contador mientras espera: con un modelo local una pregunta puede tardar bastante.
  useEffect(() => {
    if (!cargando) return undefined;
    setSegundos(0);
    const id = setInterval(() => setSegundos((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [cargando]);

  async function preguntar(texto) {
    const p = texto.trim();
    if (p.length < 3) return setError('Escribí tu pregunta');
    setCargando(true);
    setError('');
    try {
      const d = await api.post('/reportes/preguntar', { pregunta: p, hoy: hoy() });
      setHistorial((h) => [{ ...d, id: Date.now() }, ...h].slice(0, 5));
      setPregunta('');
    } catch (err) {
      setError(err.detalles?.pregunta ?? err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <section className="tarjeta preguntar" aria-labelledby="t-preg">
      <h2 id="t-preg">Preguntale a tus gastos</h2>
      <form className="preguntar-form" onSubmit={(e) => { e.preventDefault(); preguntar(pregunta); }}>
        <input
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          maxLength={300}
          placeholder="Ej: ¿cuánto gasté en comida el mes pasado?"
          aria-label="Tu pregunta"
        />
        <button className="btn" disabled={cargando}>{cargando ? `Pensando… ${segundos} s` : 'Preguntar'}</button>
      </form>
      <div className="ejemplos">
        {EJEMPLOS.map((e) => (
          <button key={e} type="button" className="btn secundario chico" disabled={cargando} onClick={() => preguntar(e)}>
            {e}
          </button>
        ))}
      </div>
      {cargando && segundos >= 8 && (
        <small className="suave" role="status">
          Sigue trabajando. Con un modelo local puede tardar hasta un minuto; no recargues la página.
        </small>
      )}
      {error && <p className="error" role="alert">{error}</p>}

      <div aria-live="polite">
        {historial.map((r) => (
          <article key={r.id} className="respuesta-ia">
            <p className="preg">{r.pregunta}</p>
            {r.respuesta ? (
              <p className="resp">{r.respuesta}</p>
            ) : (
              <p className="resp suave">No pude redactar la respuesta, pero acá están los datos.</p>
            )}
            {r.datos && <Datos tipo={r.consulta.tipo} datos={r.datos} />}
            {r.consulta && <small className="suave">Consulté: {r.consulta.descripcion}</small>}
          </article>
        ))}
      </div>
      {historial.length === 0 && (
        <small className="suave">La IA entiende tu pregunta; los números salen de tus gastos registrados.</small>
      )}
    </section>
  );
}

function Barras({ filas, valor, etiqueta }) {
  return (
    <ul className="lista-barras">
      {filas.map((f) => (
        <li key={f.nombre}>
          <div className="fila-barra">
            <span>{f.color && <i className="punto" style={{ background: f.color }} />}{f.nombre}</span>
            <span className={f.excedido ? 'excedido-texto' : 'suave'}>{etiqueta(f)}</span>
          </div>
          {valor(f) != null && (
            <div className="barra-prog" aria-hidden="true">
              <div className={f.excedido ? 'relleno excedido' : 'relleno'} style={{ width: `${Math.min(100, valor(f))}%` }} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function Datos({ tipo, datos }) {
  const vacio = datos.filas ? datos.filas.length === 0 : datos.cantidad === 0;
  if (vacio && tipo !== 'por_mes') return null;

  switch (tipo) {
    case 'total':
      return (
        <p className="dato-total">
          <strong>{dinero(datos.total)}</strong> <span className="suave">en {datos.cantidad} gasto{datos.cantidad === 1 ? '' : 's'}</span>
        </p>
      );
    case 'por_categoria':
    case 'por_medio_pago':
      return (
        <Barras
          filas={datos.filas}
          valor={(f) => f.porcentaje}
          etiqueta={(f) => `${dinero(f.total)} · ${f.porcentaje}%`}
        />
      );
    case 'presupuesto':
      return (
        <Barras
          filas={datos.filas.filter((f) => f.presupuesto !== null || f.gastado > 0)}
          valor={(f) => f.porcentaje}
          etiqueta={(f) => (f.presupuesto !== null ? `${dinero(f.gastado)} de ${dinero(f.presupuesto)}` : `${dinero(f.gastado)} · sin presupuesto`)}
        />
      );
    case 'por_mes':
      return (
        <div className="tabla-scroll">
          <table>
            <tbody>
              {datos.filas.map((f) => (
                <tr key={f.mes}><td>{nombreMes(f.mes)}</td><td className="num">{dinero(f.total)}</td></tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td>Promedio mensual</td><td className="num">{dinero(datos.promedio_mensual)}</td></tr>
            </tfoot>
          </table>
        </div>
      );
    case 'mayores_gastos':
      return (
        <div className="tabla-scroll">
          <table>
            <tbody>
              {datos.filas.map((f, i) => (
                <tr key={i}>
                  <td>{fechaCorta(f.fecha)}</td>
                  <td><i className="punto" style={{ background: f.color }} />{f.categoria}</td>
                  <td className="desc">{f.descripcion || <span className="suave">—</span>}</td>
                  <td className="num">{dinero(f.monto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    default:
      return null;
  }
}
