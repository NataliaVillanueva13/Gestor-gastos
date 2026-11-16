import { useEffect, useState } from 'react';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../api.js';
import { dinero, mesActual, nombreMes, sumarMeses } from '../formato.js';
import Preguntar from '../Preguntar.jsx';

export default function Resumen() {
  const [mes, setMes] = useState(mesActual());
  const [resumen, setResumen] = useState(null);
  const [serie, setSerie] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let vigente = true;
    setError('');
    Promise.all([
      api.get(`/reportes/resumen?mes=${mes}`),
      api.get(`/reportes/mensual?hasta=${mes}&meses=6`),
    ])
      .then(([r, m]) => {
        if (!vigente) return;
        setResumen(r);
        setSerie(m.meses.map((x) => ({ ...x, etiqueta: nombreMes(x.mes, true) })));
      })
      .catch((e) => vigente && setError(e.message));
    return () => { vigente = false; };
  }, [mes]);

  const conGasto = resumen?.categorias.filter((c) => c.gastado > 0) ?? [];
  const conPresupuesto = resumen?.categorias.filter((c) => c.presupuesto !== null) ?? [];
  const restante = resumen ? resumen.presupuestoTotal - resumen.total : 0;

  return (
    <>
      <div className="encabezado">
        <h1>Resumen</h1>
        <div className="selector-mes">
          <button className="btn secundario" onClick={() => setMes(sumarMeses(mes, -1))} aria-label="Mes anterior">‹</button>
          <input type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} aria-label="Mes" />
          <button className="btn secundario" onClick={() => setMes(sumarMeses(mes, 1))} aria-label="Mes siguiente">›</button>
        </div>
      </div>

      <Preguntar />

      {error && <p className="error" role="alert">{error}</p>}
      {!resumen ? (
        <p className="suave">Cargando…</p>
      ) : (
        <>
          <section className="cifras" aria-label={`Totales de ${nombreMes(mes)}`}>
            <div className="tarjeta">
              <span className="suave">Gastado en {nombreMes(mes)}</span>
              <strong className="cifra">{dinero(resumen.total)}</strong>
            </div>
            <div className="tarjeta">
              <span className="suave">Presupuesto total</span>
              <strong className="cifra">{resumen.presupuestoTotal ? dinero(resumen.presupuestoTotal) : '—'}</strong>
            </div>
            <div className="tarjeta">
              <span className="suave">{restante >= 0 ? 'Te queda' : 'Te pasaste por'}</span>
              <strong className={`cifra ${resumen.presupuestoTotal && restante < 0 ? 'excedido-texto' : ''}`}>
                {resumen.presupuestoTotal ? dinero(Math.abs(restante)) : '—'}
              </strong>
            </div>
          </section>

          <div className="dos-columnas">
            <section className="tarjeta" aria-labelledby="t-pres">
              <h2 id="t-pres">Presupuesto por categoría</h2>
              {conPresupuesto.length === 0 ? (
                <p className="suave">Definí un presupuesto mensual en Categorías para ver tu avance acá.</p>
              ) : (
                <ul className="lista-barras">
                  {conPresupuesto.map((c) => (
                    <li key={c.id}>
                      <div className="fila-barra">
                        <span><i className="punto" style={{ background: c.color }} />{c.nombre}</span>
                        <span className={c.excedido ? 'excedido-texto' : 'suave'}>
                          {dinero(c.gastado)} de {dinero(c.presupuesto)}
                        </span>
                      </div>
                      <div
                        className="barra-prog"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.min(100, c.porcentaje)}
                        aria-label={`${c.nombre}: ${c.porcentaje}% del presupuesto`}
                      >
                        <div
                          className={c.excedido ? 'relleno excedido' : 'relleno'}
                          style={{ width: `${Math.min(100, c.porcentaje)}%` }}
                        />
                      </div>
                      {c.excedido && <small className="excedido-texto">Superaste el presupuesto ({c.porcentaje}%)</small>}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="tarjeta" aria-labelledby="t-cat">
              <h2 id="t-cat">Gasto por categoría</h2>
              {conGasto.length === 0 ? (
                <p className="suave">Todavía no hay gastos en este mes.</p>
              ) : (
                <>
                  <div className="grafico" style={{ height: 220 }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={conGasto} dataKey="gastado" nameKey="nombre" innerRadius={55} outerRadius={90} stroke="none" isAnimationActive={false}>
                          {conGasto.map((c) => <Cell key={c.id} fill={c.color} />)}
                        </Pie>
                        <Tooltip formatter={(v) => dinero(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="leyenda">
                    {conGasto.map((c) => (
                      <li key={c.id}>
                        <span><i className="punto" style={{ background: c.color }} />{c.nombre}</span>
                        <span>{dinero(c.gastado)} · {Math.round((c.gastado / resumen.total) * 100)}%</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          </div>

          <section className="tarjeta" aria-labelledby="t-mes">
            <h2 id="t-mes">Últimos 6 meses</h2>
            <div className="grafico barras" style={{ height: 240 }}>
              <ResponsiveContainer>
                <BarChart data={serie} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <XAxis dataKey="etiqueta" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} width={64} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
                  <Tooltip formatter={(v) => dinero(v)} labelFormatter={(l) => l} cursor={{ fillOpacity: 0.08 }} />
                  <Bar dataKey="total" name="Gastado" isAnimationActive={false} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </>
      )}
    </>
  );
}
