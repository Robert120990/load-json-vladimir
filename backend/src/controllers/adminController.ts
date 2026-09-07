import type { Request, Response } from 'express';
import { ApiError } from '../middlewares/error';
import * as adminService from '../services/adminService';
import { asyncHandler } from '../utils/asyncHandler';

export const getUsers = asyncHandler(async (_req: Request, res: Response) => {
  const users = await adminService.getUsersList();
  res.json(users);
});

export const getCompanies = asyncHandler(async (_req: Request, res: Response) => {
  const companies = await adminService.getActiveCompanies();
  res.json(companies);
});

export const getUserCompanies = asyncHandler(async (req: Request, res: Response) => {
  const { nomUsu } = req.params;
  if (!nomUsu || !nomUsu.trim()) {
    throw new ApiError(400, 'nomUsu es requerido');
  }

  const companies = await adminService.getUserCompanies(nomUsu);
  res.json(companies);
});

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const { nom_usu, desc_usu, password, cod_rol, cod_punto_venta, codEmpresas } = req.body ?? {};
  const result = await adminService.createUser({
    nom_usu,
    desc_usu,
    password,
    cod_rol,
    cod_punto_venta,
    codEmpresas,
  });
  res.status(201).json(result);
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const { nomUsu } = req.params;
  if (!nomUsu || !nomUsu.trim()) {
    throw new ApiError(400, 'nomUsu es requerido');
  }

  const { desc_usu, password, cod_rol, cod_punto_venta, codEmpresas } = req.body ?? {};
  const result = await adminService.updateUser(nomUsu, {
    desc_usu,
    password,
    cod_rol,
    cod_punto_venta,
    codEmpresas,
  });
  res.json(result);
});

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  const { nomUsu } = req.params;
  if (!nomUsu || !nomUsu.trim()) {
    throw new ApiError(400, 'nomUsu es requerido');
  }

  const currentAuthUser = (req as any).usuario?.nom_usu;
  const result = await adminService.deleteUser(nomUsu, currentAuthUser);
  res.json(result);
});

export const updateUserCompanies = asyncHandler(async (req: Request, res: Response) => {
  const { nomUsu } = req.params;
  const { codEmpresas } = req.body ?? {};

  if (!nomUsu || !nomUsu.trim()) {
    throw new ApiError(400, 'nomUsu es requerido');
  }

  if (!Array.isArray(codEmpresas)) {
    throw new ApiError(400, 'codEmpresas debe ser un arreglo de identificadores de empresas');
  }

  const result = await adminService.updateUserCompanies(nomUsu, codEmpresas);
  res.json(result);
});
