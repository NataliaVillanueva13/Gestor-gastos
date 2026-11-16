import jwt from 'jsonwebtoken';
import { ApiError } from '../errors.js';

export const COOKIE = 'token';
const SIETE_DIAS = 7 * 24 * 60 * 60 * 1000;

export function opcionesCookie() {
  return {
    httpOnly: true, // JavaScript del navegador no puede leerla (protege de XSS)
    sameSite: 'lax', // no se envía en POST desde otros sitios (protege de CSRF)
    secure: process.env.NODE_ENV === 'production',
    maxAge: SIETE_DIAS,
  };
}

export function emitirSesion(res, usuarioId) {
  const token = jwt.sign({ sub: usuarioId }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.cookie(COOKIE, token, opcionesCookie());
}

// Deja el id del usuario en req.usuarioId. Todas las consultas filtran por ese id.
export function requiereSesion(req, _res, next) {
  const token = req.cookies?.[COOKIE];
  if (!token) throw new ApiError(401, 'Necesitás iniciar sesión');
  try {
    const { sub } = jwt.verify(token, process.env.JWT_SECRET);
    req.usuarioId = Number(sub);
    next();
  } catch {
    throw new ApiError(401, 'Tu sesión expiró, iniciá sesión de nuevo');
  }
}
