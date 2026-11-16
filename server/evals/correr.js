// Evals contra el modelo real: dataset dorado + ataques de inyección.
//
//   npm run evals                          todas las suites
//   npm run evals -- --solo=inyecciones    una suite (carga | preguntas | inyecciones)
//   npm run evals -- --pausa=13000         ms entre llamadas (plan gratuito de Gemini: 5 por minuto)
//   npm run evals -- --guardar-baseline    guarda este resultado como línea base
//
// Compara con evals/baseline.json y termina con código 1 si alguna suite empeora:
// así un cambio de prompt o de modelo se prueba como un deploy (sirve para CI).
// Cada llamada queda registrada en llamadas_ia y cuenta para el presupuesto diario.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { interpretarGasto, VERSION_PROMPT_CARGA } from '../src/ia.js';
import { interpretarPregunta, VERSION_INTERPRETAR } from '../src/preguntas.js';
import { pool } from '../src/db.js';

const leer = (f) => JSON.parse(readFileSync(new URL(f, import.meta.url)));
const dataset = leer('./dataset.json');
const { ataques } = leer('./inyecciones.json');

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? true]),
);
const pausa = Number(args.pausa) || 0;
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const { hoy, categorias } = dataset;

// Un valor esperado puede ser un array de opciones válidas.
const coincide = (esperado, obtenido) =>
  Array.isArray(esperado) ? esperado.includes(obtenido) : esperado === obtenido;

function comparar(esperado, obtenido) {
  const fallas = Object.entries(esperado)
    .filter(([k, v]) => !coincide(v, obtenido?.[k]))
    .map(([k, v]) => `${k}: esperaba ${JSON.stringify(v)}, salió ${JSON.stringify(obtenido?.[k])}`);
  return { ok: fallas.length === 0, detalle: fallas.join('; ') };
}

let llamadas = 0;
async function conPausa(fn) {
  if (llamadas++ > 0 && pausa) await dormir(pausa);
  return fn();
}

const interpretar = {
  carga: (texto) => interpretarGasto({ texto, categorias, hoy, usuarioId: null }),
  preguntas: (pregunta) => interpretarPregunta({ pregunta, categorias, hoy, usuarioId: null }),
};

async function suiteDorada(nombre, casos, campoTexto) {
  const filas = [];
  for (const caso of casos) {
    const texto = caso[campoTexto];
    try {
      const obtenido = await conPausa(() => interpretar[nombre](texto));
      filas.push({ caso: texto, ...comparar(caso.esperado, obtenido) });
    } catch (err) {
      filas.push({ caso: texto, ok: false, detalle: `error: ${err.message}` });
    }
  }
  return filas;
}

async function suiteInyecciones() {
  const filas = [];
  for (const a of ataques) {
    let resultado;
    let detalle = '';
    try {
      // Si el filtro lo frena, no se llama al modelo: no hace falta pausa.
      const obtenido = a.filtro
        ? await interpretar[a.funcion](a.texto)
        : await conPausa(() => interpretar[a.funcion](a.texto));
      const r = comparar(a.esperado ?? {}, obtenido);
      resultado = r.ok ? 'resistió (modelo)' : 'PASÓ';
      detalle = r.detalle;
    } catch (err) {
      if (err.status === 400) resultado = 'bloqueado (filtro)';
      else { resultado = 'error'; detalle = err.message; }
    }
    filas.push({ caso: `${a.id} ${a.forma}`, ok: resultado !== 'PASÓ' && resultado !== 'error', resultado, detalle });
  }
  return filas;
}

const suites = {
  carga: () => suiteDorada('carga', dataset.carga, 'texto'),
  preguntas: () => suiteDorada('preguntas', dataset.preguntas, 'pregunta'),
  inyecciones: suiteInyecciones,
};

const elegidas = args.solo ? [args.solo] : Object.keys(suites);
const resumen = {};
const detalle = {};
console.log(`Modelo: ${process.env.IA_MODELO} · prompts: ${VERSION_PROMPT_CARGA}, ${VERSION_INTERPRETAR}\n`);

for (const s of elegidas) {
  if (!suites[s]) throw new Error(`Suite desconocida: ${s}`);
  const filas = await suites[s]();
  detalle[s] = filas;
  const aprobados = filas.filter((f) => f.ok).length;
  resumen[s] = Math.round((aprobados / filas.length) * 100);
  console.log(`== ${s}: ${aprobados}/${filas.length} (${resumen[s]} %)`);
  console.table(filas.map(({ caso, ok, resultado, detalle: d }) => ({ caso, ok: ok ? '✓' : '✗', ...(resultado && { resultado }), detalle: d })));
}

// Guardar resultado y comparar con la línea base
mkdirSync(new URL('./resultados/', import.meta.url), { recursive: true });
const sello = new Date().toISOString().replace(/[:.]/g, '-');
const salida = { fecha: new Date().toISOString(), modelo: process.env.IA_MODELO, versiones: [VERSION_PROMPT_CARGA, VERSION_INTERPRETAR], resumen, detalle };
writeFileSync(new URL(`./resultados/${sello}.json`, import.meta.url), JSON.stringify(salida, null, 2));

const rutaBaseline = new URL('./baseline.json', import.meta.url);
let empeoro = false;
if (args['guardar-baseline']) {
  writeFileSync(rutaBaseline, JSON.stringify({ fecha: salida.fecha, modelo: salida.modelo, versiones: salida.versiones, resumen }, null, 2));
  console.log('\nLínea base guardada en evals/baseline.json');
} else if (existsSync(rutaBaseline)) {
  const base = JSON.parse(readFileSync(rutaBaseline)).resumen;
  console.log('\nComparación con la línea base:');
  for (const s of elegidas) {
    if (base[s] === undefined) continue;
    const dif = resumen[s] - base[s];
    if (dif < 0) empeoro = true;
    console.log(`  ${s}: ${base[s]} % → ${resumen[s]} % ${dif < 0 ? '⚠ EMPEORÓ' : dif > 0 ? '(mejoró)' : '(igual)'}`);
  }
}

await pool.end();
process.exit(empeoro ? 1 : 0);
