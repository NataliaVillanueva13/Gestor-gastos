import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { manejarErrores } from './errors.js';
import { requiereSesion } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import categoriasRoutes from './routes/categorias.js';
import gastosRoutes from './routes/gastos.js';
import reportesRoutes from './routes/reportes.js';

export function crearApp() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('Definí JWT_SECRET (mínimo 32 caracteres) en server/.env');
  }

  const app = express();
  app.use(helmet());
  app.use(cookieParser());
  // Solo la ruta de IA acepta cuerpos grandes (foto del ticket en base64), y solo con sesión
  app.use('/api/gastos/interpretar', requiereSesion, express.json({ limit: '6mb' }));
  app.use(express.json({ limit: '50kb' }));

  app.get('/api/salud', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRoutes);
  app.use('/api/categorias', requiereSesion, categoriasRoutes);
  app.use('/api/gastos', requiereSesion, gastosRoutes);
  app.use('/api/reportes', requiereSesion, reportesRoutes);

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta inexistente' }));
  app.use(manejarErrores);
  return app;
}
