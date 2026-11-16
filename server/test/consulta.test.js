// La consulta que devuelve el modelo es entrada no confiable: normalizarConsulta tiene que dejarla segura.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describirConsulta, normalizarConsulta } from '../src/preguntas.js';

const ctx = { hoy: '2026-11-16', categorias: [{ id: 1, nombre: 'Comida' }, { id: 2, nombre: 'Transporte' }] };

test('sin período usa el mes actual hasta hoy', () => {
  const c = normalizarConsulta({ tipo: 'total' }, ctx);
  assert.equal(c.desde, '2026-11-01');
  assert.equal(c.hasta, '2026-11-16');
});

test('basura del modelo cae a valores seguros', () => {
  const c = normalizarConsulta(
    { tipo: 'borrar_todo', desde: 'ayer', hasta: '2026-13-45', categoria_id: 99, medio_pago: 'bitcoin', texto: 123, sql: 'DROP TABLE gastos' },
    ctx,
  );
  assert.deepEqual(c, {
    tipo: 'fuera_de_alcance', desde: '2026-11-01', hasta: '2026-11-16',
    categoria_id: null, categoria: null, medio_pago: null, texto: null,
  });
});

test('una categoría ajena se descarta y una propia se acepta', () => {
  assert.equal(normalizarConsulta({ tipo: 'total', categoria_id: 3 }, ctx).categoria_id, null);
  const c = normalizarConsulta({ tipo: 'total', categoria_id: 2 }, ctx);
  assert.equal(c.categoria, 'Transporte');
});

test('fechas invertidas se ordenan y el rango se limita a 5 años', () => {
  const c = normalizarConsulta({ tipo: 'total', desde: '2026-11-10', hasta: '1990-01-01' }, ctx);
  assert.equal(c.desde, '2021-11-10');
  assert.equal(c.hasta, '2026-11-10');
});

test('el texto de búsqueda se limita a 50 caracteres', () => {
  const c = normalizarConsulta({ tipo: 'total', texto: 'x'.repeat(80) }, ctx);
  assert.equal(c.texto, null);
});

test('describirConsulta explica cómo se entendió la pregunta', () => {
  const c = normalizarConsulta({ tipo: 'total', categoria_id: 1, desde: '2026-10-01', hasta: '2026-10-31' }, ctx);
  assert.equal(describirConsulta(c), 'Total gastado del 01/10/2026 al 31/10/2026 · categoría Comida');
});

import { respuestaPlantilla } from '../src/preguntas.js';

test('respuestaPlantilla usa solo las cifras calculadas', () => {
  const c = normalizarConsulta({ tipo: 'por_categoria' }, ctx);
  const datos = { total: 122000, filas: [{ nombre: 'Comida', total: 67000, porcentaje: 54.9 }, { nombre: 'Transporte', total: 37000, porcentaje: 30.3 }] };
  assert.equal(
    respuestaPlantilla(c, datos).replace(/\s/g, ' '),
    'Donde más gastaste fue Comida: $ 67.000,00, el 54,9 % de $ 122.000,00. Le sigue Transporte con $ 37.000,00.',
  );
});

test('respuestaPlantilla avisa si no hay presupuesto o si se pasó', () => {
  const c = normalizarConsulta({ tipo: 'presupuesto' }, ctx);
  assert.match(respuestaPlantilla(c, { presupuesto_total: null, gastado_total: 5000, filas: [] }), /no tenés presupuesto definido/);
  const pasado = { presupuesto_total: 100, gastado_en_categorias_con_presupuesto: 150, restante: -50, porcentaje_usado: 150, filas: [{ nombre: 'Ocio', excedido: true }] };
  assert.match(respuestaPlantilla(c, pasado), /Te pasaste del presupuesto .* Superaste el presupuesto en Ocio\./);
});

test('respuestaPlantilla sin gastos', () => {
  assert.equal(respuestaPlantilla(normalizarConsulta({ tipo: 'total' }, ctx), { cantidad: 0 }), 'No encontré gastos para esa consulta.');
});
