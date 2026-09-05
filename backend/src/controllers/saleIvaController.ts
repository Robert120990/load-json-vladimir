import type { Request, Response } from 'express';
import { ApiError } from '../middlewares/error';
import * as saleIvaService from '../services/saleIvaService';
import { asyncHandler } from '../utils/asyncHandler';

export const listSales = asyncHandler(async (req: Request, res: Response) => {
  const codEmp = req.usuario?.cod_emp;
  if (!codEmp) throw new ApiError(400, 'El usuario no tiene cod_emp asignado');

  const search = req.query.search ? String(req.query.search) : undefined;
  const year = req.query.year ? Number(req.query.year) : undefined;
  const month = req.query.month ? Number(req.query.month) : undefined;
  const id_tipo_documento = req.query.id_tipo_documento ? String(req.query.id_tipo_documento) : undefined;
  const page = req.query.page ? Number(req.query.page) : 1;
  const limit = req.query.limit ? Number(req.query.limit) : 20;

  const result = await saleIvaService.listSales(codEmp, {
    search,
    year,
    month,
    id_tipo_documento,
    page,
    limit,
  });
  res.json(result);
});

export const getSaleByLlave = asyncHandler(async (req: Request, res: Response) => {
  const codEmp = req.usuario?.cod_emp;
  if (!codEmp) throw new ApiError(400, 'El usuario no tiene cod_emp asignado');

  const { llave } = req.params;
  const result = await saleIvaService.getSaleByLlave(llave, codEmp);
  res.json(result);
});

export const createSale = asyncHandler(async (req: Request, res: Response) => {
  const codEmp = req.usuario?.cod_emp;
  if (!codEmp) throw new ApiError(400, 'El usuario no tiene cod_emp asignado');

  const result = await saleIvaService.createSale(req.body, codEmp);
  res.status(201).json(result);
});

export const updateSale = asyncHandler(async (req: Request, res: Response) => {
  const codEmp = req.usuario?.cod_emp;
  if (!codEmp) throw new ApiError(400, 'El usuario no tiene cod_emp asignado');

  const { llave } = req.params;
  const result = await saleIvaService.updateSale(llave, req.body, codEmp);
  res.json(result);
});

export const deleteSale = asyncHandler(async (req: Request, res: Response) => {
  const codEmp = req.usuario?.cod_emp;
  if (!codEmp) throw new ApiError(400, 'El usuario no tiene cod_emp asignado');

  const { llave } = req.params;
  await saleIvaService.deleteSale(llave, codEmp);
  res.json({ message: 'Venta eliminada correctamente' });
});

export const createBatchConsumidorFinal = asyncHandler(async (req: Request, res: Response) => {
  const codEmp = req.usuario?.cod_emp;
  if (!codEmp) throw new ApiError(400, 'El usuario no tiene cod_emp asignado');

  const result = await saleIvaService.createBatchConsumidorFinal(codEmp, req.body);
  res.status(201).json(result);
});
