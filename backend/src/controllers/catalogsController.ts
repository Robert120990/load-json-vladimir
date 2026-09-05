import type { Request, Response } from 'express';
import * as catalogsService from '../services/catalogsService';
import { asyncHandler } from '../utils/asyncHandler';

export const getDepartamentos = asyncHandler(async (_req: Request, res: Response) => {
  const result = await catalogsService.getDepartamentos();
  res.json(result);
});

export const getMunicipios = asyncHandler(async (req: Request, res: Response) => {
  const codDept = req.query.codDept ? Number(req.query.codDept) : undefined;
  const result = await catalogsService.getMunicipios(codDept);
  res.json(result);
});

export const getTiposDocumentoCompras = asyncHandler(async (_req: Request, res: Response) => {
  const result = await catalogsService.getTiposDocumentoCompras();
  res.json(result);
});

export const getTiposDocumentoVentas = asyncHandler(async (_req: Request, res: Response) => {
  const result = await catalogsService.getTiposDocumentoVentas();
  res.json(result);
});

export const getFirmasConta = asyncHandler(async (req: Request, res: Response) => {
  const codEmp = req.usuario?.cod_emp;
  if (!codEmp) {
    res.json([]);
    return;
  }
  const result = await catalogsService.getFirmasConta(codEmp);
  res.json(result);
});

export const getPeriodoCompras = asyncHandler(async (req: Request, res: Response) => {
  const codEmp = req.usuario?.cod_emp;
  if (!codEmp) {
    res.json(null);
    return;
  }
  const result = await catalogsService.getPeriodoCompras(codEmp);
  res.json(result);
});

export const updatePeriodoCompras = asyncHandler(async (req: Request, res: Response) => {
  const codEmp = req.usuario?.cod_emp;
  if (!codEmp) {
    res.status(400).json({ error: 'No hay empresa asignada' });
    return;
  }
  const { mes, anio } = req.body ?? {};
  if (!mes || !anio) {
    res.status(400).json({ error: 'mes y anio son obligatorios' });
    return;
  }
  const result = await catalogsService.setPeriodoCompras(codEmp, Number(mes), Number(anio));
  res.json(result);
});
