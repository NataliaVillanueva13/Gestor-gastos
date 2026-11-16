// Números que los modelos chicos devuelven como texto.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { numeroDesdeTexto } from '../src/ia.js';

test('acepta números escritos como texto en formatos claros', () => {
  assert.equal(numeroDesdeTexto('4500'), 4500);
  assert.equal(numeroDesdeTexto('4.500'), 4500);
  assert.equal(numeroDesdeTexto('4.500,50'), 4500.5);
  assert.equal(numeroDesdeTexto('4500,5'), 4500.5);
  assert.equal(numeroDesdeTexto('$ 12.350,50'), 12350.5);
  assert.equal(numeroDesdeTexto('4500.5'), 4500.5);
  assert.equal(numeroDesdeTexto(4500), 4500);
});

test('deja pasar sin convertir lo que no es un número claro (después lo rechaza zod)', () => {
  for (const v of ['cuatro mil', '4500; DROP TABLE', '1e9', '', '-4500']) {
    assert.equal(numeroDesdeTexto(v), v);
  }
});
