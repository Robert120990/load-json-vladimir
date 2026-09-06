import { RowDataPacket } from 'mysql2';
import { pool } from '../config/db';
import { AccountingSignature, FirmaIva } from '../types/controlIva';

const DEFAULT_SIGNATURE_SLOTS = [
  { id_firma: 1, nom_firma: '', puesto: 'Representante Legal' },
  { id_firma: 2, nom_firma: '', puesto: 'Auditor Externo' },
  { id_firma: 3, nom_firma: '', puesto: 'Contador General' },
];

/**
 * Get configured signatures for VAT books (firmas_iva) for the active company.
 * If not yet saved in firmas_iva, defaults to the signatures in firmas_conta.
 */
export async function getFirmasIva(codEmp: number): Promise<AccountingSignature[]> {
  // 1. Check firmas_iva
  const [ivaRows] = await pool.query<RowDataPacket[]>(
    `SELECT id_firma, nom_firma, puesto, cod_emp 
     FROM firmas_iva 
     WHERE cod_emp = ? 
     ORDER BY id_firma ASC`,
    [codEmp]
  );

  if (ivaRows.length > 0) {
    const result = DEFAULT_SIGNATURE_SLOTS.map((def) => {
      const found = ivaRows.find((r) => r.id_firma === def.id_firma);
      return {
        id_firma: def.id_firma,
        nom_firma: found ? (found.nom_firma || '').trim() : '',
        puesto: found && found.puesto && found.puesto.trim() ? found.puesto.trim() : def.puesto,
      };
    });

    ivaRows.forEach((r) => {
      if (!result.some((f) => f.id_firma === r.id_firma)) {
        result.push({
          id_firma: r.id_firma,
          nom_firma: (r.nom_firma || '').trim(),
          puesto: (r.puesto || '').trim() || 'Firma Autorizada',
        });
      }
    });

    return result;
  }

  // 2. Fallback to firmas_conta
  const [contaRows] = await pool.query<RowDataPacket[]>(
    `SELECT id_firma, nom_firma, puesto, cod_emp 
     FROM firmas_conta 
     WHERE cod_emp = ? 
     ORDER BY id_firma ASC`,
    [codEmp]
  );

  const result = DEFAULT_SIGNATURE_SLOTS.map((def) => {
    const found = contaRows.find((r) => r.id_firma === def.id_firma);
    return {
      id_firma: def.id_firma,
      nom_firma: found ? (found.nom_firma || '').trim() : '',
      puesto: found && found.puesto && found.puesto.trim() ? found.puesto.trim() : def.puesto,
    };
  });

  contaRows.forEach((r) => {
    if (!result.some((f) => f.id_firma === r.id_firma)) {
      result.push({
        id_firma: r.id_firma,
        nom_firma: (r.nom_firma || '').trim(),
        puesto: (r.puesto || '').trim() || 'Firma Autorizada',
      });
    }
  });

  return result;
}

/**
 * Save or update signatures specifically for VAT books in firmas_iva.
 */
export async function saveFirmasIva(codEmp: number, firmas: FirmaIva[]): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    for (const f of firmas) {
      const idFirma = Number(f.id_firma) || 1;
      const nomFirma = (f.nom_firma || '').trim();
      const puesto = (f.puesto || '').trim();

      await connection.query(
        `INSERT INTO firmas_iva (id_firma, nom_firma, puesto, cod_emp)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE nom_firma = VALUES(nom_firma), puesto = VALUES(puesto)`,
        [idFirma, nomFirma, puesto, codEmp]
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Copy signatures directly from accounting (firmas_conta) for the given company.
 */
export async function copiarFirmasDesdeContabilidad(codEmp: number): Promise<AccountingSignature[]> {
  const [contaRows] = await pool.query<RowDataPacket[]>(
    `SELECT id_firma, nom_firma, puesto, cod_emp 
     FROM firmas_conta 
     WHERE cod_emp = ? 
     ORDER BY id_firma ASC`,
    [codEmp]
  );

  const result = DEFAULT_SIGNATURE_SLOTS.map((def) => {
    const found = contaRows.find((r) => r.id_firma === def.id_firma);
    return {
      id_firma: def.id_firma,
      nom_firma: found ? (found.nom_firma || '').trim() : '',
      puesto: found && found.puesto && found.puesto.trim() ? found.puesto.trim() : def.puesto,
    };
  });

  return result;
}
