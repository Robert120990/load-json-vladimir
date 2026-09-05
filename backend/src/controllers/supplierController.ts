import type { Request, Response } from 'express';
import * as supplierService from '../services/supplierService';
import { asyncHandler } from '../utils/asyncHandler';

export const listSuppliers = asyncHandler(async (req: Request, res: Response) => {
  const search = req.query.search ? String(req.query.search) : undefined;
  const page = req.query.page ? Number(req.query.page) : 1;
  const limit = req.query.limit ? Number(req.query.limit) : 20;

  const result = await supplierService.listSuppliers({ search, page, limit });
  res.json(result);
});

export const getSupplierByCode = asyncHandler(async (req: Request, res: Response) => {
  const { codProveedor } = req.params;
  const result = await supplierService.getSupplierByCode(codProveedor);
  res.json(result);
});

export const createSupplier = asyncHandler(async (req: Request, res: Response) => {
  const codEmp = req.usuario?.cod_emp ?? null;
  const result = await supplierService.createSupplier(req.body, codEmp);
  res.status(201).json(result);
});

export const updateSupplier = asyncHandler(async (req: Request, res: Response) => {
  const { codProveedor } = req.params;
  const result = await supplierService.updateSupplier(codProveedor, req.body);
  res.json(result);
});

export const deleteSupplier = asyncHandler(async (req: Request, res: Response) => {
  const { codProveedor } = req.params;
  await supplierService.deleteSupplier(codProveedor);
  res.json({ message: 'Proveedor eliminado correctamente' });
});
