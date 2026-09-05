import type { Request, Response } from 'express';
import { ApiError } from '../middlewares/error';
import * as authService from '../services/authService';
import * as companyService from '../services/companyService';
import { asyncHandler } from '../utils/asyncHandler';

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { nomUsu, password } = req.body ?? {};

  if (typeof nomUsu !== 'string' || typeof password !== 'string' || !nomUsu.trim()) {
    throw new ApiError(400, 'Usuario y contraseña son obligatorios');
  }

  const resultado = await authService.login(nomUsu, password);
  res.json(resultado);
});

export const seleccionarEmpresa = asyncHandler(async (req: Request, res: Response) => {
  const { tokenTemporal, codEmp } = req.body ?? {};

  if (typeof tokenTemporal !== 'string' || typeof codEmp !== 'number') {
    throw new ApiError(400, 'tokenTemporal y codEmp son obligatorios');
  }

  const resultado = await authService.seleccionarEmpresa(tokenTemporal, codEmp);
  res.json(resultado);
});

export const obtenerEmpresa = asyncHandler(async (req: Request, res: Response) => {
  const usuario = req.usuario;
  if (!usuario) throw new ApiError(401, 'Sesión no válida');
  if (usuario.cod_emp === null) throw new ApiError(400, 'El usuario no tiene cod_emp asignado');

  const empresa = await companyService.getEmpresaPorCodEmp(usuario.cod_emp);
  res.json(empresa);
});

export const obtenerMisEmpresas = asyncHandler(async (req: Request, res: Response) => {
  const usuario = req.usuario;
  if (!usuario) throw new ApiError(401, 'Sesión no válida');

  const empresas = await authService.getMyCompanies(usuario.nom_usu);
  res.json(empresas);
});

export const cambiarEmpresa = asyncHandler(async (req: Request, res: Response) => {
  const usuario = req.usuario;
  if (!usuario) throw new ApiError(401, 'Sesión no válida');

  const { codEmp } = req.body ?? {};
  if (typeof codEmp !== 'number') {
    throw new ApiError(400, 'codEmp es requerido y debe ser un número');
  }

  const resultado = await authService.switchCompany(usuario.nom_usu, usuario.cod_usu, codEmp);
  res.json(resultado);
});
