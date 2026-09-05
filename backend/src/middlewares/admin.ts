import type { NextFunction, Request, Response } from 'express';
import { ApiError } from './error';

export function adminMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const usuario = req.usuario;

  if (!usuario) {
    next(new ApiError(401, 'Sesión no válida'));
    return;
  }

  const isAdmin = usuario.isAdmin ?? (usuario.nom_usu?.trim().toUpperCase() === 'ADMIN');
  if (!isAdmin) {
    next(new ApiError(403, 'Acceso restringido únicamente para administradores'));
    return;
  }

  next();
}
