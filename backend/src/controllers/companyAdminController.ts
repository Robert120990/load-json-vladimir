import type { Request, Response } from 'express';
import { ApiError } from '../middlewares/error';
import * as companyAdminService from '../services/companyAdminService';
import { asyncHandler } from '../utils/asyncHandler';

export const getCompanies = asyncHandler(async (_req: Request, res: Response) => {
  const companies = await companyAdminService.getAllCompanies();
  res.json(companies);
});

export const getCompanyById = asyncHandler(async (req: Request, res: Response) => {
  const codEmp = Number(req.params.codEmp);
  if (!codEmp || Number.isNaN(codEmp)) {
    throw new ApiError(400, 'Código de empresa inválido');
  }

  const company = await companyAdminService.getCompanyById(codEmp);
  res.json(company);
});

export const createCompany = asyncHandler(async (req: Request, res: Response) => {
  const currentAuthUser = (req as any).usuario?.nom_usu;
  const result = await companyAdminService.createCompany(req.body, currentAuthUser);
  res.status(201).json(result);
});

export const updateCompany = asyncHandler(async (req: Request, res: Response) => {
  const codEmp = Number(req.params.codEmp);
  if (!codEmp || Number.isNaN(codEmp)) {
    throw new ApiError(400, 'Código de empresa inválido');
  }

  const result = await companyAdminService.updateCompany(codEmp, req.body);
  res.json(result);
});

export const deleteCompany = asyncHandler(async (req: Request, res: Response) => {
  const codEmp = Number(req.params.codEmp);
  if (!codEmp || Number.isNaN(codEmp)) {
    throw new ApiError(400, 'Código de empresa inválido');
  }

  const result = await companyAdminService.deleteCompany(codEmp);
  res.json(result);
});
