// Métricas de la IA a partir de la tabla llamadas_ia.
//   npm run metricas            últimos 7 días
//   npm run metricas -- 30      últimos 30 días
// Para ver costos en USD, definí IA_PRECIO_ENTRADA_USD e IA_PRECIO_SALIDA_USD (por millón de tokens).

import { metricas } from '../src/trazas.js';
import { pool } from '../src/db.js';

const dias = Number(process.argv[2]) || 7;
const m = await metricas({ dias });

console.log(`Métricas de IA · últimos ${dias} días\n`);
console.log('Por día');
console.table(m.porDia);
console.log('Por función y versión de prompt (latencia en ms, sin contar las bloqueadas)');
console.table(m.porFuncion);
console.log('Usuarios que más consumen');
console.table(m.porUsuario);
if (m.errores.length) {
  console.log('Errores por tipo');
  console.table(m.errores);
}
if (!m.conPrecios) console.log('Costos en 0: definí IA_PRECIO_ENTRADA_USD e IA_PRECIO_SALIDA_USD en server/.env');
await pool.end();
