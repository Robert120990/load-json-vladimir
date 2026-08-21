import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { ApiError } from './error';

interface TokenPayload {
  cod_usu: number;
  nom_usu: string;
  cod_emp: number | null;
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';

  if (!token) {
    next(new ApiError(401, 'Sesión no válida'));
    return;
  }

  try {
    const secret = process.env.JWT_SECRET ?? '';
    const payload = jwt.verify(token, secret) as TokenPayload;
    req.usuario = {
      cod_usu: payload.cod_usu,
      nom_usu: payload.nom_usu,
      cod_emp: payload.cod_emp,
    };
    next();
  } catch {
    next(new ApiError(401, 'Sesión expirada o no válida'));
  }
}
