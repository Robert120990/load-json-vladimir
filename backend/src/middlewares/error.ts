import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_COUNT') {
      res.status(400).json({
        error: 'Se superó el límite de archivos permitidos por carga (máximo 1,500 archivos a la vez)',
      });
      return;
    }
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({
        error: 'Uno o más archivos exceden el tamaño máximo permitido (máx 25 MB por archivo)',
      });
      return;
    }
    res.status(400).json({ error: `Error en la carga de archivos: ${err.message}` });
    return;
  }

  if ((err as { type?: string }).type === 'entity.too.large') {
    res.status(413).json({
      error: 'El tamaño de los datos enviados excede el límite permitido por el servidor',
    });
    return;
  }

  // Handle common MySQL database errors gracefully
  const dbErr = err as { code?: string; errno?: number; sqlMessage?: string };
  if (typeof dbErr?.code === 'string' && dbErr.code.startsWith('ER_')) {
    if (dbErr.code === 'ER_DUP_ENTRY' || dbErr.errno === 1062) {
      res.status(400).json({
        error: 'Ya existe un registro con esos datos en la base de datos (código o identificación duplicada)',
      });
      return;
    }
    if (dbErr.code === 'ER_BAD_NULL_ERROR' || dbErr.errno === 1048) {
      res.status(400).json({
        error: 'Uno o más campos obligatorios no fueron proporcionados o son nulos',
      });
      return;
    }
    if (dbErr.code === 'ER_DATA_TOO_LONG' || dbErr.errno === 1406) {
      res.status(400).json({
        error: 'Uno de los campos supera la longitud máxima de caracteres permitida',
      });
      return;
    }
    if (dbErr.code === 'ER_NO_REFERENCED_ROW_2' || dbErr.errno === 1452) {
      res.status(400).json({
        error: 'Uno de los valores seleccionados (departamento o municipio) no es válido',
      });
      return;
    }
    res.status(400).json({
      error: dbErr.sqlMessage || 'Error al procesar los datos en la base de datos',
    });
    return;
  }

  const status = (err as { status?: number; statusCode?: number }).status
    ?? (err as { status?: number; statusCode?: number }).statusCode;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    res.status(status).json({ error: 'Solicitud inválida' });
    return;
  }

  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
}
