import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { errorHandler } from './middlewares/error';
import authRoutes from './routes/auth.routes';
import controlIvaRoutes from './routes/controlIva.routes';
import dteRoutes from './routes/dte.routes';
import accountingRoutes from './routes/accounting.routes';

import { BACKEND_VERSION } from './version';

dotenv.config();

export const app = express();

app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get('/api/version', (_req, res) => {
  res.json({
    version: BACKEND_VERSION,
    timestamp: Date.now(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/dte', dteRoutes);
app.use('/api/control-iva', controlIvaRoutes);
app.use('/api/accounting', accountingRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

app.use(errorHandler);
