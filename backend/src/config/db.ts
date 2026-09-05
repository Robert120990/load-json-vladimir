import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();

export const pool = mysql.createPool({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  maxIdle: 5,
  idleTimeout: 60000,
  connectTimeout: 15000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  charset: 'latin1',
});

// Manejo de errores en sockets para evitar caídas no controladas en conexiones remotas
(pool as any).on('connection', (connection: any) => {
  connection.on('error', (err: any) => {
    console.warn('[DB Socket Warning]', err.code || err.message);
  });
});

const isTransientError = (err: any): boolean => {
  if (!err) return false;
  const code = err.code || '';
  const message = String(err.message || '');
  return (
    code === 'ECONNRESET' ||
    code === 'PROTOCOL_CONNECTION_LOST' ||
    code === 'ETIMEDOUT' ||
    code === 'EPIPE' ||
    code === 'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR' ||
    message.includes('ECONNRESET') ||
    message.includes('Connection lost')
  );
};

// Envolver pool.query con reintento automático ante caídas de conexión de red
const rawQuery = pool.query.bind(pool);
pool.query = (async (...args: any[]) => {
  try {
    return await (rawQuery as any)(...args);
  } catch (err: any) {
    if (isTransientError(err)) {
      console.warn(`[DB Pool] Reconectando y reintentando query tras caída de conexión (${err.code || err.message})...`);
      await new Promise((resolve) => setTimeout(resolve, 150));
      return await (rawQuery as any)(...args);
    }
    throw err;
  }
}) as any;

// Envolver pool.getConnection con reintento automático
const rawGetConnection = pool.getConnection.bind(pool);
pool.getConnection = (async () => {
  try {
    return await rawGetConnection();
  } catch (err: any) {
    if (isTransientError(err)) {
      console.warn(`[DB Pool] Reconectando y reintentando getConnection tras caída de conexión (${err.code || err.message})...`);
      await new Promise((resolve) => setTimeout(resolve, 150));
      return await rawGetConnection();
    }
    throw err;
  }
}) as any;
