import { Request, Response } from 'express';
import { RowDataPacket } from 'mysql2';
import { pool } from '../config/db';
import { FirmaContable } from '../types/accounting';

/**
 * Get signatures configured for active company
 */
export async function getAccountingSignatures(req: Request, res: Response) {
  try {
    const codEmp = req.usuario?.cod_emp ?? (req as any).user?.cod_emp;
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id_firma, nom_firma, puesto, cod_emp 
       FROM firmas_conta 
       WHERE cod_emp = ? 
       ORDER BY id_firma ASC`,
      [codEmp]
    );

    // Provide structured default signatures if fewer than 3 are defined
    const defaults = [
      { id_firma: 1, nom_firma: '', puesto: 'Representante Legal', cod_emp: codEmp },
      { id_firma: 2, nom_firma: '', puesto: 'Auditor Externo', cod_emp: codEmp },
      { id_firma: 3, nom_firma: '', puesto: 'Contador General', cod_emp: codEmp },
    ];

    const result = defaults.map((def) => {
      const found = rows.find((r) => r.id_firma === def.id_firma);
      return found ? { ...def, nom_firma: found.nom_firma, puesto: found.puesto } : def;
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error getting accounting signatures:', error);
    res.status(500).json({ error: 'Error al obtener las firmas contables' });
  }
}

/**
 * Save / update signatures for active company
 */
export async function saveAccountingSignatures(req: Request, res: Response) {
  const connection = await pool.getConnection();
  try {
    const codEmp = req.usuario?.cod_emp ?? (req as any).user?.cod_emp;
    const { firmas } = req.body as { firmas: FirmaContable[] };

    if (!firmas || !Array.isArray(firmas)) {
      return res.status(400).json({ error: 'Formato de firmas inválido' });
    }

    await connection.beginTransaction();

    for (const f of firmas) {
      const idFirma = Number(f.id_firma) || 1;
      const nomFirma = (f.nom_firma || '').trim();
      const puesto = (f.puesto || '').trim();

      const [existing] = await connection.query<RowDataPacket[]>(
        `SELECT id_firma FROM firmas_conta WHERE cod_emp = ? AND id_firma = ?`,
        [codEmp, idFirma]
      );

      if (existing.length > 0) {
        await connection.query(
          `UPDATE firmas_conta SET nom_firma = ?, puesto = ? WHERE cod_emp = ? AND id_firma = ?`,
          [nomFirma, puesto, codEmp, idFirma]
        );
      } else {
        await connection.query(
          `INSERT INTO firmas_conta (id_firma, nom_firma, puesto, cod_emp) VALUES (?, ?, ?, ?)`,
          [idFirma, nomFirma, puesto, codEmp]
        );
      }
    }

    await connection.commit();

    res.json({ message: 'Firmas contables guardadas exitosamente' });
  } catch (error: any) {
    await connection.rollback();
    console.error('Error saving accounting signatures:', error);
    res.status(500).json({ error: 'Error al guardar las firmas contables' });
  } finally {
    connection.release();
  }
}
