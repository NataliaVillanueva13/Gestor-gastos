import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { pool, query } from '../db.js';
import { ApiError, validar } from '../errors.js';
import { COOKIE, emitirSesion, opcionesCookie, requiereSesion } from '../middleware/auth.js';

const router = Router();

// Frena fuerza bruta: 20 intentos cada 15 minutos por IP.
const limitador = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === 'test' ? 1000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos, probá de nuevo en unos minutos' },
});

const registroSchema = z.object({
  nombre: z.string().trim().min(1, 'Ingresá tu nombre').max(80),
  email: z.string().trim().toLowerCase().email('Email inválido').max(255),
  password: z.string().min(8, 'Mínimo 8 caracteres').max(72, 'Máximo 72 caracteres'),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email inválido'),
  password: z.string().min(1, 'Ingresá tu contraseña'),
});

const CATEGORIAS_INICIALES = [
  ['Comida', '#d9822b'],
  ['Transporte', '#3b7ddd'],
  ['Hogar', '#0d6e6e'],
  ['Salud', '#c2415d'],
  ['Ocio', '#8a5cc7'],
  ['Otros', '#6b7785'],
];

const usuarioPublico = ({ id, nombre, email }) => ({ id, nombre, email });

router.post('/registro', limitador, async (req, res) => {
  const { nombre, email, password } = validar(registroSchema, req.body);
  const hash = await bcrypt.hash(password, 12);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO usuarios (nombre, email, password_hash)
       VALUES ($1, $2, $3) RETURNING id, nombre, email`,
      [nombre, email, hash],
    );
    const usuario = rows[0];
    for (const [nom, color] of CATEGORIAS_INICIALES) {
      await client.query(
        'INSERT INTO categorias (usuario_id, nombre, color) VALUES ($1, $2, $3)',
        [usuario.id, nom, color],
      );
    }
    await client.query('COMMIT');
    emitirSesion(res, usuario.id);
    res.status(201).json({ usuario: usuarioPublico(usuario) });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') throw new ApiError(409, 'Ya existe una cuenta con ese email');
    throw err;
  } finally {
    client.release();
  }
});

// Hash falso para que el tiempo de respuesta sea parecido exista o no el email.
const HASH_FALSO = bcrypt.hashSync('no-existe', 12);

router.post('/login', limitador, async (req, res) => {
  const { email, password } = validar(loginSchema, req.body);
  const { rows } = await query(
    'SELECT id, nombre, email, password_hash FROM usuarios WHERE email = $1',
    [email],
  );
  const usuario = rows[0];
  const ok = await bcrypt.compare(password, usuario?.password_hash ?? HASH_FALSO);
  if (!usuario || !ok) throw new ApiError(401, 'Email o contraseña incorrectos');
  emitirSesion(res, usuario.id);
  res.json({ usuario: usuarioPublico(usuario) });
});

router.post('/logout', (_req, res) => {
  const { maxAge, ...opciones } = opcionesCookie();
  res.clearCookie(COOKIE, opciones);
  res.status(204).end();
});

router.get('/yo', requiereSesion, async (req, res) => {
  const { rows } = await query('SELECT id, nombre, email FROM usuarios WHERE id = $1', [
    req.usuarioId,
  ]);
  if (!rows[0]) throw new ApiError(401, 'Usuario inexistente');
  res.json({ usuario: rows[0] });
});

export default router;
