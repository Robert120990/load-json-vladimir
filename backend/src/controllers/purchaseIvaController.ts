import type { Request, Response } from 'express';
import { ApiError } from '../middlewares/error';
import * as purchaseIvaService from '../services/purchaseIvaService';
import { asyncHandler } from '../utils/asyncHandler';

export const listPurchases = asyncHandler(async (req: Request, res: Response) => {
  const codEmp = req.usuario?.cod_emp;
  if (!codEmp) throw new ApiError(400, 'El usuario no tiene cod_emp asignado');

  const search = req.query.search ? String(req.query.search) : undefined;
  const year = req.query.year ? Number(req.query.year) : undefined;
  const month = req.query.month ? Number(req.query.month) : undefined;
  const page = req.query.page ? Number(req.query.page) : 1;
  const limit = req.query.limit ? Number(req.query.limit) : 20;

  const result = await purchaseIvaService.listPurchases(codEmp, { search, year, month, page, limit });
  res.json(result);
});

export const getPurchaseByLlave = asyncHandler(async (req: Request, res: Response) => {
  const codEmp = req.usuario?.cod_emp;
  if (!codEmp) throw new ApiError(400, 'El usuario no tiene cod_emp asignado');

  const { llave } = req.params;
  const result = await purchaseIvaService.getPurchaseByLlave(llave, codEmp);
  res.json(result);
});

export const createPurchase = asyncHandler(async (req: Request, res: Response) => {
  const codEmp = req.usuario?.cod_emp;
  if (!codEmp) throw new ApiError(400, 'El usuario no tiene cod_emp asignado');

  const result = await purchaseIvaService.createPurchase(req.body, codEmp);
  res.status(201).json(result);
});

export const updatePurchase = asyncHandler(async (req: Request, res: Response) => {
  const codEmp = req.usuario?.cod_emp;
  if (!codEmp) throw new ApiError(400, 'El usuario no tiene cod_emp asignado');

  const { llave } = req.params;
  const result = await purchaseIvaService.updatePurchase(llave, req.body, codEmp);
  res.json(result);
});

export const deletePurchase = asyncHandler(async (req: Request, res: Response) => {
  const codEmp = req.usuario?.cod_emp;
  if (!codEmp) throw new ApiError(400, 'El usuario no tiene cod_emp asignado');

  const { llave } = req.params;
  await purchaseIvaService.deletePurchase(llave, codEmp);
  res.json({ message: 'Compra eliminada correctamente' });
});
