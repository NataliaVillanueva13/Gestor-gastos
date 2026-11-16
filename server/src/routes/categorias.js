import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { ApiError, validar } from '../errors.js';

const router = Router();

const categoriaSchema = z.object({
  nombre: z.string().trim().min(1, 'Ingresá un nombre').max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color inválido').default('#0d6e6e'),
  // null = sin presupuesto
  presupuesto_mensual: z.number().min(0, 'No puede ser negativo').max(999999999).nullable().default(null),
});

const idSchema = z.coerce.number().int().positive();

const COLUMNAS = 'id, nombre, color, presupuesto_mensual';

router.get('/', async (req, res) => {
  const { rows } = await query(
    `SELECT ${COLUMNAS} FROM categorias WHERE usuario_id = $1 ORDER BY nombre`,
    [req.usuarioId],
  );
  res.json({ categorias: rows });
});

router.post('/', async (req, res) => {
  const { nombre, color, presupuesto_mensual } = validar(categoriaSchema, req.body);
  try {
    const { rows } = await query(
      `INSERT INTO categorias (usuario_id, nombre, color, presupuesto_mensual)
       VALUES ($1, $2, $3, $4) RETURNING ${COLUMNAS}`,
      [req.usuarioId, nombre, color, presupuesto_mensual],
    );
    res.status(201).json({ categoria: rows[0] });
  } catch (err) {
    if (err.code === '23505') throw new ApiError(409, 'Ya tenés una categoría con ese nombre');
    throw err;
  }
});

router.put('/:id', async (req, res) => {
  const id = validar(idSchema, req.params.id);
  const { nombre, color, presupuesto_mensual } = validar(categoriaSchema, req.body);
  try {
    const { rows } = await query(
      `UPDATE categorias SET nombre = $3, color = $4, presupuesto_mensual = $5
       WHERE id = $1 AND usuario_id = $2 RETURNING ${COLUMNAS}`,
      [id, req.usuarioId, nombre, color, presupuesto_mensual],
    );
    if (!rows[0]) throw new ApiError(404, 'Categoría no encontrada');
    res.json({ categoria: rows[0] });
  } catch (err) {
    if (err.code === '23505') throw new ApiError(409, 'Ya tenés una categoría con ese nombre');
    throw err;
  }
});

router.delete('/:id', async (req, res) => {
  const id = validar(idSchema, req.params.id);
  try {
    const { rowCount } = await query('DELETE FROM categorias WHERE id = $1 AND usuario_id = $2', [
      id,
      req.usuarioId,
    ]);
    if (!rowCount) throw new ApiError(404, 'Categoría no encontrada');
    res.status(204).end();
  } catch (err) {
    if (err.code === '23503') {
      throw new ApiError(409, 'Esa categoría tiene gastos. Pasalos a otra categoría antes de borrarla');
    }
    throw err;
  }
});

export default router;
