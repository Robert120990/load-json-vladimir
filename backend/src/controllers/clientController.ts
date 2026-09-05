import type { Request, Response } from 'express';
import * as clientService from '../services/clientService';
import { asyncHandler } from '../utils/asyncHandler';

export const listClients = asyncHandler(async (req: Request, res: Response) => {
  const search = req.query.search ? String(req.query.search) : undefined;
  const page = req.query.page ? Number(req.query.page) : 1;
  const limit = req.query.limit ? Number(req.query.limit) : 20;

  const result = await clientService.listClients({ search, page, limit });
  res.json(result);
});

export const getClientByCode = asyncHandler(async (req: Request, res: Response) => {
  const { codCliente } = req.params;
  const result = await clientService.getClientByCode(codCliente);
  res.json(result);
});

export const createClient = asyncHandler(async (req: Request, res: Response) => {
  const codEmp = req.usuario?.cod_emp ?? null;
  const result = await clientService.createClient(req.body, codEmp);
  res.status(201).json(result);
});

export const updateClient = asyncHandler(async (req: Request, res: Response) => {
  const { codCliente } = req.params;
  const result = await clientService.updateClient(codCliente, req.body);
  res.json(result);
});

export const deleteClient = asyncHandler(async (req: Request, res: Response) => {
  const { codCliente } = req.params;
  await clientService.deleteClient(codCliente);
  res.json({ message: 'Cliente eliminado correctamente' });
});
