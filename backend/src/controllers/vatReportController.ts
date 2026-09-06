import type { Request, Response } from 'express';
import { ApiError } from '../middlewares/error';
import * as vatReportService from '../services/vatReportService';
import { asyncHandler } from '../utils/asyncHandler';

export const getLibroCompras = asyncHandler(async (req: Request, res: Response) => {
  const codEmp = req.usuario?.cod_emp;
  if (!codEmp) throw new ApiError(400, 'El usuario no tiene cod_emp asignado');

  const now = new Date();
  const year = req.query.year ? Number(req.query.year) : now.getFullYear();
  const month = req.query.month ? Number(req.query.month) : (now.getMonth() + 1);

  const result = await vatReportService.getLibroCompras(codEmp, year, month);
  res.json(result);
});

export const getLibroConsumidorFinal = asyncHandler(async (req: Request, res: Response) => {
  const codEmp = req.usuario?.cod_emp;
  if (!codEmp) throw new ApiError(400, 'El usuario no tiene cod_emp asignado');

  const now = new Date();
  const year = req.query.year ? Number(req.query.year) : now.getFullYear();
  const month = req.query.month ? Number(req.query.month) : (now.getMonth() + 1);

  const result = await vatReportService.getLibroConsumidorFinal(codEmp, year, month);
  res.json(result);
});

export const getLibroContribuyentes = asyncHandler(async (req: Request, res: Response) => {
  const codEmp = req.usuario?.cod_emp;
  if (!codEmp) throw new ApiError(400, 'El usuario no tiene cod_emp asignado');

  const now = new Date();
  const year = req.query.year ? Number(req.query.year) : now.getFullYear();
  const month = req.query.month ? Number(req.query.month) : (now.getMonth() + 1);

  const result = await vatReportService.getLibroContribuyentes(codEmp, year, month);
  res.json(result);
});

export const getAnexoHacienda = asyncHandler(async (req: Request, res: Response) => {
  const codEmp = req.usuario?.cod_emp;
  if (!codEmp) throw new ApiError(400, 'El usuario no tiene cod_emp asignado');

  const tipo = (req.query.tipo as 'compras' | 'contribuyentes' | 'consumidor_final') || 'compras';
  const now = new Date();
  const year = req.query.year ? Number(req.query.year) : now.getFullYear();
  const month = req.query.month ? Number(req.query.month) : (now.getMonth() + 1);

  const result = await vatReportService.getAnexoHacienda(codEmp, tipo, year, month);
  res.json(result);
});

export const getPlantillaOficialAnexo = asyncHandler(async (req: Request, res: Response) => {
  const tipo = (req.query.tipo as string) || 'compras';

  if (tipo === 'compras') {
    res.json({
      tipo: 'compras',
      titulo: 'Plantilla Oficial Anexo de Compras - F-07 Ministerio de Hacienda El Salvador',
      columnas: [
        'FECHA DE EMISION',
        'CLASE DE DOCUMENTO',
        'TIPO DE DOCUMENTO',
        'NUMERO DE DOCUMENTO',
        'NUMERO DE CONTROL',
        'SELLO DE RECEPCION',
        'NIT',
        'NOMBRE DEL PROVEEDOR',
        'COMPRAS INTERNAS EXENTAS',
        'INTERNACIONES EXENTAS',
        'IMPORTACIONES EXENTAS',
        'COMPRAS INTERNAS GRAVADAS',
        'INTERNACIONES GRAVADAS',
        'IMPORTACIONES GRAVADAS',
        'CREDITO FISCAL',
        'TOTAL DE COMPRAS',
      ],
      ejemplo: [
        '04/05/2026', '4 - DTE', 'CREDITO FISCAL', '73E8C98E-D4A7-144A-877E-094C3E1A47D5', 'DTE-03-M001P001-000000000001', '2026DTE03M001P001RECEPCION001', '77122-8', 'ENMANUEL, S.A. DE C.V.',
        0, 0, 0, 25.50, 0, 0, 3.32, 28.82,
      ],
    });
    return;
  }

  if (tipo === 'contribuyentes') {
    res.json({
      tipo: 'contribuyentes',
      titulo: 'Plantilla Oficial Anexo de Ventas a Contribuyentes - F-07 Ministerio de Hacienda El Salvador',
      columnas: [
        'FECHA DE EMISION',
        'CLASE DE DOCUMENTO',
        'TIPO DE DOCUMENTO',
        'SERIE / SELLO DE RECEPCION',
        'NUMERO DE DOCUMENTO',
        'NUMERO DE CONTROL',
        'NIT',
        'NOMBRE DEL CLIENTE',
        'VENTAS EXENTAS',
        'VENTAS NO SUJETAS',
        'VENTAS GRAVADAS LOCALES',
        'DEBITO FISCAL',
        'VENTAS A CUENTA DE TERCEROS',
        'DEBITO FISCAL A TERCEROS',
        'TOTAL VENTAS',
      ],
      ejemplo: [
        '05/05/2026', '4 - DTE', 'CREDITO FISCAL', '2026DTE03M001P001RECEPCION001', '525C3F8F-F6DA-4D20-BBF2-04C46C7ED149',
        'DTE-03-M001P001-000000000010', '166944-9', 'ACOOPACCSAL. DE R.L.', 0, 0, 25.00, 3.25, 0, 0, 28.25,
      ],
    });
    return;
  }

  // consumidor_final
  res.json({
    tipo: 'consumidor_final',
    titulo: 'Plantilla Oficial Anexo de Ventas al Consumidor Final - F-07 Ministerio de Hacienda El Salvador',
    columnas: [
      'FECHA DE EMISION',
      'CLASE DE DOCUMENTO',
      'TIPO DE DOCUMENTO',
      'NUMERO DE RESOLUCION / CONTROL',
      'SERIE',
      'DOCUMENTO DEL',
      'DOCUMENTO AL',
      'VENTAS EXENTAS',
      'VENTAS NO SUJETAS',
      'VENTAS GRAVADAS LOCALES',
      'EXPORTACIONES',
      'TOTAL VENTAS',
    ],
    ejemplo: [
      '02/05/2026', '4 - DTE', 'FACTURA', 'N/A', 'N/A', '4AC6DE88-0320-4268-B7AE-370B6EAEE5F1',
      '4AC6DE88-0320-4268-B7AE-370B6EAEE5F1', 0, 0, 125.00, 0, 125.00,
    ],
  });
});

export const getLiquidacionImpuestos = asyncHandler(async (req: Request, res: Response) => {
  const codEmp = req.usuario?.cod_emp;
  if (!codEmp) throw new ApiError(400, 'El usuario no tiene cod_emp asignado');

  const now = new Date();
  const year = req.query.year ? Number(req.query.year) : now.getFullYear();
  const month = req.query.month ? Number(req.query.month) : (now.getMonth() + 1);

  const result = await vatReportService.getLiquidacionImpuestos(codEmp, year, month);
  res.json(result);
});
