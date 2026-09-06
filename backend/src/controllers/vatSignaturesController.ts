import { Request, Response } from 'express';
import * as vatSignaturesService from '../services/vatSignaturesService';
import { FirmaIva } from '../types/controlIva';

export async function getVatSignatures(req: Request, res: Response) {
  try {
    const codEmp = req.usuario?.cod_emp ?? (req as any).user?.cod_emp;
    if (!codEmp) {
      return res.status(400).json({ error: 'No se ha seleccionado una empresa activa' });
    }
    const result = await vatSignaturesService.getFirmasIva(codEmp);
    res.json(result);
  } catch (error: any) {
    console.error('Error getting VAT signatures:', error);
    res.status(500).json({ error: 'Error al obtener las firmas de IVA' });
  }
}

export async function saveVatSignatures(req: Request, res: Response) {
  try {
    const codEmp = req.usuario?.cod_emp ?? (req as any).user?.cod_emp;
    if (!codEmp) {
      return res.status(400).json({ error: 'No se ha seleccionado una empresa activa' });
    }
    const { firmas } = req.body as { firmas: FirmaIva[] };

    if (!firmas || !Array.isArray(firmas)) {
      return res.status(400).json({ error: 'Formato de firmas inválido' });
    }

    await vatSignaturesService.saveFirmasIva(codEmp, firmas);
    res.json({ message: 'Firmas de libros de IVA guardadas exitosamente' });
  } catch (error: any) {
    console.error('Error saving VAT signatures:', error);
    res.status(500).json({ error: 'Error al guardar las firmas de IVA' });
  }
}

export async function copyFromAccounting(req: Request, res: Response) {
  try {
    const codEmp = req.usuario?.cod_emp ?? (req as any).user?.cod_emp;
    if (!codEmp) {
      return res.status(400).json({ error: 'No se ha seleccionado una empresa activa' });
    }
    const result = await vatSignaturesService.copiarFirmasDesdeContabilidad(codEmp);
    res.json(result);
  } catch (error: any) {
    console.error('Error copying signatures from accounting:', error);
    res.status(500).json({ error: 'Error al copiar firmas de contabilidad' });
  }
}
