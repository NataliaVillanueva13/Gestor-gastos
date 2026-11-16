import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { validar } from '../errors.js';
import { MES_RE, mesActual, rangoMes, sumarMeses } from '../fechas.js';
import rateLimit from 'express-rate-limit';
import { responderPregunta } from '../preguntas.js';
import { fechaSchema } from './gastos.js';

const router = Router();

const resumenSchema = z.object({
  mes: z.string().regex(MES_RE, 'Mes inválido (usar YYYY-MM)').default(mesActual),
});

const mensualSchema = z.object({
  hasta: z.string().regex(MES_RE, 'Mes inválido (usar YYYY-MM)').default(mesActual),
  meses: z.coerce.number().int().min(1).max(24).default(6),
});

const redondear = (n) => Math.round(n * 100) / 100;

// Gasto de un mes por categoría, con el avance respecto del presupuesto.
router.get('/resumen', async (req, res) => {
  const { mes } = validar(resumenSchema, req.query);
  const [desde, hasta] = rangoMes(mes);
  const { rows } = await query(
    `SELECT c.id, c.nombre, c.color, c.presupuesto_mensual AS presupuesto,
            COALESCE(SUM(g.monto), 0) AS gastado
     FROM categorias c
     LEFT JOIN gastos g
       ON g.categoria_id = c.id AND g.fecha >= $2 AND g.fecha < $3
     WHERE c.usuario_id = $1
     GROUP BY c.id
     ORDER BY gastado DESC, c.nombre`,
    [req.usuarioId, desde, hasta],
  );

  const categorias = rows.map((c) => ({
    ...c,
    porcentaje: c.presupuesto ? redondear((c.gastado / c.presupuesto) * 100) : null,
    excedido: c.presupuesto !== null && c.gastado > c.presupuesto,
  }));
  const total = redondear(categorias.reduce((s, c) => s + c.gastado, 0));
  const presupuestoTotal = redondear(
    categorias.reduce((s, c) => s + (c.presupuesto ?? 0), 0),
  );

  res.json({ mes, total, presupuestoTotal, categorias });
});

// Total por mes de los últimos N meses (rellena con 0 los meses sin gastos).
router.get('/mensual', async (req, res) => {
  const { hasta, meses } = validar(mensualSchema, req.query);
  const primero = sumarMeses(hasta, -(meses - 1));
  const [desde] = rangoMes(primero);
  const [, limite] = rangoMes(hasta);

  const { rows } = await query(
    `SELECT to_char(fecha, 'YYYY-MM') AS mes, SUM(monto) AS total
     FROM gastos
     WHERE usuario_id = $1 AND fecha >= $2 AND fecha < $3
     GROUP BY 1`,
    [req.usuarioId, desde, limite],
  );
  const porMes = new Map(rows.map((r) => [r.mes, r.total]));
  const serie = Array.from({ length: meses }, (_, i) => {
    const mes = sumarMeses(primero, i);
    return { mes, total: redondear(porMes.get(mes) ?? 0) };
  });
  res.json({ meses: serie });
});

// --- IA: preguntas en lenguaje natural sobre los gastos ---
// El modelo traduce la pregunta a una consulta validada (nunca SQL); los números los calcula la base.

const preguntaSchema = z.object({
  pregunta: z.string().trim().min(3, 'Escribí tu pregunta').max(300, 'Máximo 300 caracteres'),
  hoy: fechaSchema.optional(), // fecha local del navegador, para resolver "este mes" o "ayer"
});

// Cada pregunta hace dos llamadas al modelo: tope propio por usuario.
const limitePreguntas = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  keyGenerator: (req) => `u${req.usuarioId}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Llegaste al límite de preguntas por hora. Probá más tarde' },
});

router.post('/preguntar', limitePreguntas, async (req, res) => {
  const { pregunta, hoy } = validar(preguntaSchema, req.body);
  const resultado = await responderPregunta({
    usuarioId: req.usuarioId,
    pregunta,
    hoy: hoy ?? new Date().toISOString().slice(0, 10),
  });
  res.json({ pregunta, ...resultado });
});

export default router;
