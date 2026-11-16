import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { ApiError, validar } from '../errors.js';
import { MES_RE, rangoMes } from '../fechas.js';
import rateLimit from 'express-rate-limit';
import { gastosACsv } from '../csv.js';
import { interpretarGasto, MEDIOS_PAGO } from '../ia.js';

const router = Router();

// Acepta solo fechas reales en formato YYYY-MM-DD.
export const fechaSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')
  .refine((f) => {
    const d = new Date(`${f}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === f;
  }, 'Fecha inválida');

export const gastoSchema = z.object({
  monto: z
    .number({ error: 'Ingresá un monto' })
    .positive('El monto debe ser mayor a 0')
    .max(999999999, 'Monto demasiado grande')
    .transform((n) => Math.round(n * 100) / 100),
  fecha: fechaSchema,
  categoria_id: z.number().int().positive('Elegí una categoría'),
  descripcion: z.string().trim().max(200).default(''),
  medio_pago: z.enum(MEDIOS_PAGO).default('efectivo'),
});

const idSchema = z.coerce.number().int().positive();

const filtrosSchema = z.object({
  mes: z.string().regex(MES_RE, 'Mes inválido (usar YYYY-MM)').optional(),
  categoria_id: z.coerce.number().int().positive().optional(),
  q: z.string().trim().max(100).optional(),
});

// Arma el WHERE siempre limitado al usuario de la sesión.
function armarFiltro(usuarioId, filtros) {
  const condiciones = ['g.usuario_id = $1'];
  const params = [usuarioId];
  if (filtros.mes) {
    const [desde, hasta] = rangoMes(filtros.mes);
    params.push(desde, hasta);
    condiciones.push(`g.fecha >= $${params.length - 1} AND g.fecha < $${params.length}`);
  }
  if (filtros.categoria_id) {
    params.push(filtros.categoria_id);
    condiciones.push(`g.categoria_id = $${params.length}`);
  }
  if (filtros.q) {
    params.push(`%${filtros.q.replace(/[\\%_]/g, '\\$&')}%`);
    condiciones.push(`g.descripcion ILIKE $${params.length}`);
  }
  return { where: condiciones.join(' AND '), params };
}

const SELECT_GASTO = `
  SELECT g.id, g.monto, g.fecha, g.descripcion, g.medio_pago, g.categoria_id,
         c.nombre AS categoria, c.color AS categoria_color
  FROM gastos g JOIN categorias c ON c.id = g.categoria_id`;

async function verificarCategoria(usuarioId, categoriaId) {
  const { rowCount } = await query('SELECT 1 FROM categorias WHERE id = $1 AND usuario_id = $2', [
    categoriaId,
    usuarioId,
  ]);
  if (!rowCount) throw new ApiError(400, 'Datos inválidos', { categoria_id: 'Categoría inexistente' });
}

router.get('/', async (req, res) => {
  const filtros = validar(filtrosSchema, req.query);
  const { where, params } = armarFiltro(req.usuarioId, filtros);
  const { rows } = await query(
    `${SELECT_GASTO} WHERE ${where} ORDER BY g.fecha DESC, g.id DESC LIMIT 1000`,
    params,
  );
  const total = rows.reduce((suma, g) => suma + g.monto, 0);
  res.json({ gastos: rows, total: Math.round(total * 100) / 100 });
});

// Va antes de '/:id' para que 'exportar' no se interprete como un id.
router.get('/exportar', async (req, res) => {
  const filtros = validar(filtrosSchema, req.query);
  const { where, params } = armarFiltro(req.usuarioId, filtros);
  const { rows } = await query(
    `${SELECT_GASTO} WHERE ${where} ORDER BY g.fecha, g.id`,
    params,
  );
  const nombre = `gastos${filtros.mes ? `-${filtros.mes}` : ''}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
  res.send(gastosACsv(rows));
});

// --- IA: interpreta una frase o la foto de un ticket y devuelve una SUGERENCIA ---
// No guarda nada: la persona revisa el formulario y confirma con POST /api/gastos.

const interpretarSchema = z
  .object({
    texto: z.string().trim().max(500, 'Máximo 500 caracteres').optional(),
    // data URL de una imagen; el límite de tamaño lo pone express.json en app.js
    imagen: z
      .string()
      .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, 'Imagen inválida (usar PNG, JPG o WebP)')
      .optional(),
    hoy: fechaSchema.optional(), // fecha local del navegador, para resolver "ayer"
  })
  .refine((d) => d.texto || d.imagen, { message: 'Escribí el gasto o subí una foto', path: ['texto'] });

// Tope de gasto por usuario: cada llamada a la IA cuesta plata.
const limiteIA = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  keyGenerator: (req) => `u${req.usuarioId}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Llegaste al límite de cargas con IA por hora. Podés cargar el gasto a mano' },
});

router.post('/interpretar', limiteIA, async (req, res) => {
  const d = validar(interpretarSchema, req.body);
  const { rows: categorias } = await query(
    'SELECT id, nombre FROM categorias WHERE usuario_id = $1 ORDER BY nombre',
    [req.usuarioId],
  );
  const sugerencia = await interpretarGasto({
    texto: d.texto,
    imagen: d.imagen,
    categorias,
    hoy: d.hoy ?? new Date().toISOString().slice(0, 10),
    usuarioId: req.usuarioId,
  });
  res.json({ sugerencia });
});

router.post('/', async (req, res) => {
  const d = validar(gastoSchema, req.body);
  await verificarCategoria(req.usuarioId, d.categoria_id);
  const { rows } = await query(
    `INSERT INTO gastos (usuario_id, categoria_id, monto, fecha, descripcion, medio_pago)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [req.usuarioId, d.categoria_id, d.monto, d.fecha, d.descripcion, d.medio_pago],
  );
  const { rows: completo } = await query(`${SELECT_GASTO} WHERE g.id = $1`, [rows[0].id]);
  res.status(201).json({ gasto: completo[0] });
});

router.put('/:id', async (req, res) => {
  const id = validar(idSchema, req.params.id);
  const d = validar(gastoSchema, req.body);
  await verificarCategoria(req.usuarioId, d.categoria_id);
  const { rowCount } = await query(
    `UPDATE gastos SET categoria_id = $3, monto = $4, fecha = $5, descripcion = $6, medio_pago = $7
     WHERE id = $1 AND usuario_id = $2`,
    [id, req.usuarioId, d.categoria_id, d.monto, d.fecha, d.descripcion, d.medio_pago],
  );
  if (!rowCount) throw new ApiError(404, 'Gasto no encontrado');
  const { rows } = await query(`${SELECT_GASTO} WHERE g.id = $1`, [id]);
  res.json({ gasto: rows[0] });
});

router.delete('/:id', async (req, res) => {
  const id = validar(idSchema, req.params.id);
  const { rowCount } = await query('DELETE FROM gastos WHERE id = $1 AND usuario_id = $2', [
    id,
    req.usuarioId,
  ]);
  if (!rowCount) throw new ApiError(404, 'Gasto no encontrado');
  res.status(204).end();
});

export default router;
