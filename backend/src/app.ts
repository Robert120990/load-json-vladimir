import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { errorHandler } from './middlewares/error';
import authRoutes from './routes/auth.routes';
import dteRoutes from './routes/dte.routes';

dotenv.config();

export const app = express();

app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/dte', dteRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

app.use(errorHandler);
