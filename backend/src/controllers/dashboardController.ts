import type { Request, Response } from 'express';
import * as dashboardService from '../services/dashboardService';
import { asyncHandler } from '../utils/asyncHandler';

export const getDashboardData = asyncHandler(async (req: Request, res: Response) => {
  const codEmp = req.usuario?.cod_emp;
  if (!codEmp) {
    res.status(400).json({ mensaje: 'No hay empresa seleccionada en la sesión' });
    return;
  }

  const year = req.query.year ? Number(req.query.year) : undefined;
  const month = req.query.month ? Number(req.query.month) : undefined;

  const data = await dashboardService.getDashboardData(codEmp, year, month);
  res.json(data);
});
