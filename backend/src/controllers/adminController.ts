import type { Request, Response } from 'express';
import { ApiError } from '../middlewares/error';
import * as adminService from '../services/adminService';
import { asyncHandler } from '../utils/asyncHandler';

export const getUsers = asyncHandler(async (_req: Request, res: Response) => {
  const users = await adminService.getUsersList();
  res.json(users);
});

export const getUserCompanies = asyncHandler(async (req: Request, res: Response) => {
  const { nomUsu } = req.params;
  if (!nomUsu || !nomUsu.trim()) {
    throw new ApiError(400, 'nomUsu es requerido');
  }

  const companies = await adminService.getUserCompanies(nomUsu);
  res.json(companies);
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
