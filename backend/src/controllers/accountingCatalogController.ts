import { Request, Response } from 'express';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { pool } from '../config/db';
import {
  AccountImportRow,
  CuentaContable,
  ImportVerificationResult,
} from '../types/accounting';

/**
 * Auto-derives parent account code (dep_cta) based on code length or prefix
 */
export function deriveParentCode(codCta: string): string | null {
  const clean = codCta.trim();
  if (clean.length <= 1) return null;
  if (clean.length === 2) return clean.substring(0, 1);
  if (clean.length <= 4) return clean.substring(0, 2);
  if (clean.length <= 6) return clean.substring(0, 4);
  if (clean.length <= 8) return clean.substring(0, 6);
  return clean.substring(0, clean.length - 2);
}

/**
 * Auto-derives level (nivel_cta) from code length
 */
export function deriveLevel(codCta: string): string {
  const len = codCta.trim().length;
  if (len === 1) return '1';
  if (len === 2) return '2';
  if (len <= 4) return '3';
  if (len <= 6) return '4';
  if (len <= 8) return '5';
  return '6';
}

/**
 * Auto-derives account type (cod_tp_cta) from first digit
 */
export function deriveAccountType(codCta: string): string {
  const first = codCta.trim().charAt(0);
  switch (first) {
    case '1': return '01'; // Activo
    case '2': return '02'; // Pasivo
    case '3': return '03'; // Capital
    case '4': return '04'; // Cuentas Deudoras / Costos / Gastos
    case '5': return '05'; // Cuentas Acreedoras / Ingresos
    case '6': return '06'; // Cuentas Liquidadoras / Pérdidas y Ganancias
    case '7': return '07'; // Cuentas de Cierre
    case '8': return '08'; // Cuentas de Orden Activo
    case '9': return '09'; // Cuentas de Orden Pasivo
    default: return '01';
  }
}

/**
 * Auto-derives nature (deudor / acreedor) from account type
 */
export function deriveNature(codTpCta: string): { deudor: number; acreedor: number } {
  const tp = codTpCta.padStart(2, '0');
  if (tp === '01' || tp === '04' || tp === '08') {
    return { deudor: 1, acreedor: 0 };
  }
  return { deudor: 0, acreedor: 1 };
}

/**
 * Auto-derives classification (g_d_m) from level
 */
export function deriveGDM(nivelCta: string): string {
  const num = parseInt(nivelCta, 10);
  if (num <= 3) return 'M'; // Mayor
  return 'D'; // Detalle (imputable)
}

/**
 * List accounts with filtering by year, search query, level, type, and g_d_m
 */
export async function listAccounts(req: Request, res: Response) {
  try {
    const codEmp = req.usuario?.cod_emp ?? (req as any).user?.cod_emp;
    const {
      ejercicio,
      search,
      nivel,
      tipo,
      g_d_m,
      soloImputables,
    } = req.query;

    let query = `
      SELECT 
        id_cta,
        cod_cta,
        nom_cta,
        cod_tp_cta,
        dep_cta,
        acreedor,
        deudor,
        ejercicio,
        mes,
        nivel_cta,
        cod_fnc,
        cod_emp,
        g_d_m
      FROM cat_cuentas
      WHERE (cod_emp = ? OR cod_emp IS NULL)
    `;
    const params: any[] = [codEmp];

    if (ejercicio) {
      query += ` AND ejercicio = ?`;
      params.push(String(ejercicio));
    }

    if (search) {
      query += ` AND (cod_cta LIKE ? OR nom_cta LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    if (nivel) {
      query += ` AND nivel_cta = ?`;
      params.push(String(nivel));
    }

    if (tipo) {
      query += ` AND cod_tp_cta = ?`;
      params.push(String(tipo));
    }

    if (g_d_m) {
      query += ` AND g_d_m = ?`;
      params.push(String(g_d_m));
    }

    if (soloImputables === 'true') {
      query += ` AND g_d_m = 'D'`;
    }

    query += ` ORDER BY cod_cta ASC`;

    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    res.json(rows);
  } catch (error: any) {
    console.error('Error listing accounts:', error);
    res.status(500).json({ error: 'Error al obtener el catálogo de cuentas' });
  }
}

/**
 * Get distinct available years (ejercicios) in catalog
 */
export async function getAvailableYears(req: Request, res: Response) {
  try {
    const codEmp = req.usuario?.cod_emp ?? (req as any).user?.cod_emp;
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT DISTINCT ejercicio 
       FROM cat_cuentas 
       WHERE (cod_emp = ? OR cod_emp IS NULL) AND ejercicio IS NOT NULL AND ejercicio != ''
       ORDER BY ejercicio DESC`,
      [codEmp]
    );
    const years = rows.map((r) => String(r.ejercicio));
    res.json(years);
  } catch (error: any) {
    console.error('Error getting catalog years:', error);
    res.status(500).json({ error: 'Error al obtener los ejercicios fiscales' });
  }
}

/**
 * Get single account by ID
 */
export async function getAccountById(req: Request, res: Response) {
  try {
    const codEmp = req.usuario?.cod_emp ?? (req as any).user?.cod_emp;
    const { id } = req.params;

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM cat_cuentas WHERE id_cta = ? AND (cod_emp = ? OR cod_emp IS NULL)`,
      [id, codEmp]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Cuenta no encontrada' });
    }

    res.json(rows[0]);
  } catch (error: any) {
    console.error('Error getting account:', error);
    res.status(500).json({ error: 'Error al consultar la cuenta' });
  }
}

/**
 * Get list of account types (tipo_cuenta)
 */
export async function getAccountTypes(req: Request, res: Response) {
  try {
    const codEmp = req.usuario?.cod_emp ?? (req as any).user?.cod_emp;
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT cod_tp_cta, nom_cta, letra_cta, corr 
       FROM tipo_cuenta 
       WHERE (cod_emp = ? OR cod_emp IS NULL) 
       ORDER BY cod_tp_cta ASC`,
      [codEmp]
    );
    res.json(rows);
  } catch (error: any) {
    console.error('Error getting account types:', error);
    res.status(500).json({ error: 'Error al obtener los tipos de cuenta' });
  }
}

/**
 * Create a new account with auto-derived fields
 */
export async function createAccount(req: Request, res: Response) {
  try {
    const codEmp = req.usuario?.cod_emp ?? (req as any).user?.cod_emp;
    const body: CuentaContable = req.body;

    if (!body.cod_cta || !body.nom_cta || !body.ejercicio) {
      return res.status(400).json({ error: 'Código, nombre y ejercicio son obligatorios' });
    }

    const codCta = body.cod_cta.trim();
    const ejercicio = String(body.ejercicio).trim();

    // Check for duplicate in same year and company
    const [existing] = await pool.query<RowDataPacket[]>(
      `SELECT id_cta FROM cat_cuentas WHERE cod_cta = ? AND ejercicio = ? AND cod_emp = ?`,
      [codCta, ejercicio, codEmp]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: `La cuenta ${codCta} ya existe en el ejercicio ${ejercicio}` });
    }

    // Auto-derive fields if not supplied
    const codTpCta = body.cod_tp_cta || deriveAccountType(codCta);
    const depCta = body.dep_cta !== undefined ? body.dep_cta : deriveParentCode(codCta);
    const nivelCta = body.nivel_cta || deriveLevel(codCta);
    const gdm = body.g_d_m || deriveGDM(nivelCta);
    const defaultNature = deriveNature(codTpCta);
    const deudor = body.deudor !== undefined ? body.deudor : defaultNature.deudor;
    const acreedor = body.acreedor !== undefined ? body.acreedor : defaultNature.acreedor;

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO cat_cuentas 
        (cod_cta, nom_cta, cod_tp_cta, dep_cta, acreedor, deudor, ejercicio, mes, nivel_cta, cod_fnc, cod_emp, g_d_m)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        codCta,
        body.nom_cta.trim(),
        codTpCta,
        depCta,
        acreedor,
        deudor,
        ejercicio,
        body.mes || null,
        nivelCta,
        body.cod_fnc || null,
        codEmp,
        gdm,
      ]
    );

    res.status(201).json({
      message: 'Cuenta creada exitosamente',
      id_cta: result.insertId,
      account: {
        id_cta: result.insertId,
        cod_cta: codCta,
        nom_cta: body.nom_cta.trim(),
        cod_tp_cta: codTpCta,
        dep_cta: depCta,
        acreedor,
        deudor,
        ejercicio,
        nivel_cta: nivelCta,
        cod_emp: codEmp,
        g_d_m: gdm,
      },
    });
  } catch (error: any) {
    console.error('Error creating account:', error);
    res.status(500).json({ error: 'Error al registrar la cuenta contable' });
  }
}

/**
 * Update an existing account
 */
export async function updateAccount(req: Request, res: Response) {
  try {
    const codEmp = req.usuario?.cod_emp ?? (req as any).user?.cod_emp;
    const { id } = req.params;
    const body: Partial<CuentaContable> = req.body;

    const [existing] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM cat_cuentas WHERE id_cta = ? AND (cod_emp = ? OR cod_emp IS NULL)`,
      [id, codEmp]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Cuenta no encontrada' });
    }

    const current = existing[0];
    const nomCta = body.nom_cta !== undefined ? body.nom_cta.trim() : current.nom_cta;
    const codTpCta = body.cod_tp_cta || current.cod_tp_cta;
    const depCta = body.dep_cta !== undefined ? body.dep_cta : current.dep_cta;
    const nivelCta = body.nivel_cta || current.nivel_cta;
    const gdm = body.g_d_m || current.g_d_m;
    const deudor = body.deudor !== undefined ? body.deudor : current.deudor;
    const acreedor = body.acreedor !== undefined ? body.acreedor : current.acreedor;

    await pool.query(
      `UPDATE cat_cuentas SET
        nom_cta = ?,
        cod_tp_cta = ?,
        dep_cta = ?,
        acreedor = ?,
        deudor = ?,
        nivel_cta = ?,
        g_d_m = ?
       WHERE id_cta = ? AND (cod_emp = ? OR cod_emp IS NULL)`,
      [nomCta, codTpCta, depCta, acreedor, deudor, nivelCta, gdm, id, codEmp]
    );

    res.json({ message: 'Cuenta actualizada exitosamente' });
  } catch (error: any) {
    console.error('Error updating account:', error);
    res.status(500).json({ error: 'Error al actualizar la cuenta contable' });
  }
}

/**
 * Delete an account (validating no dependencies or transactions)
 */
export async function deleteAccount(req: Request, res: Response) {
  try {
    const codEmp = req.usuario?.cod_emp ?? (req as any).user?.cod_emp;
    const { id } = req.params;

    const [existing] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM cat_cuentas WHERE id_cta = ? AND (cod_emp = ? OR cod_emp IS NULL)`,
      [id, codEmp]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Cuenta no encontrada' });
    }

    const account = existing[0];

    // Check if any child accounts depend on this account
    const [children] = await pool.query<RowDataPacket[]>(
      `SELECT id_cta FROM cat_cuentas WHERE dep_cta = ? AND ejercicio = ? AND cod_emp = ? LIMIT 1`,
      [account.cod_cta, account.ejercicio, codEmp]
    );

    if (children.length > 0) {
      return res.status(400).json({
        error: 'No se puede eliminar la cuenta porque tiene subcuentas que dependen de ella.',
      });
    }

    // Check if account is used in any journal entry details
    const [partidas] = await pool.query<RowDataPacket[]>(
      `SELECT cod_part FROM detalle_partida WHERE id_cta = ? OR (cod_cta = ? AND cod_emp = ?) LIMIT 1`,
      [id, account.cod_cta, codEmp]
    );

    if (partidas.length > 0) {
      return res.status(400).json({
        error: `No se puede eliminar la cuenta porque está registrada en partidas contables (${partidas[0].cod_part}).`,
      });
    }

    await pool.query(
      `DELETE FROM cat_cuentas WHERE id_cta = ? AND (cod_emp = ? OR cod_emp IS NULL)`,
      [id, codEmp]
    );

    res.json({ message: 'Cuenta eliminada exitosamente' });
  } catch (error: any) {
    console.error('Error deleting account:', error);
    res.status(500).json({ error: 'Error al eliminar la cuenta contable' });
  }
}

/**
 * Copy entire catalog from source year to target year
 */
export async function copyCatalogFromYear(req: Request, res: Response) {
  try {
    const codEmp = req.usuario?.cod_emp ?? (req as any).user?.cod_emp;
    const { sourceYear, targetYear } = req.body;

    if (!sourceYear || !targetYear) {
      return res.status(400).json({ error: 'Debe especificar el año de origen y el año de destino' });
    }

    if (String(sourceYear) === String(targetYear)) {
      return res.status(400).json({ error: 'El año de origen y destino no pueden ser iguales' });
    }

    // Check if source year has accounts
    const [sourceAccounts] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM cat_cuentas WHERE ejercicio = ? AND cod_emp = ?`,
      [String(sourceYear), codEmp]
    );

    if (sourceAccounts.length === 0) {
      return res.status(404).json({ error: `No se encontraron cuentas en el ejercicio ${sourceYear}` });
    }

    // Check if target year already has accounts
    const [targetExisting] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM cat_cuentas WHERE ejercicio = ? AND cod_emp = ?`,
      [String(targetYear), codEmp]
    );

    if (targetExisting[0].count > 0) {
      return res.status(400).json({
        error: `El ejercicio de destino ${targetYear} ya contiene ${targetExisting[0].count} cuentas. No se puede sobrescribir directamente.`,
      });
    }

    // Insert all accounts to target year
    const insertValues: any[] = [];
    for (const a of sourceAccounts) {
      insertValues.push([
        a.cod_cta,
        a.nom_cta,
        a.cod_tp_cta,
        a.dep_cta,
        a.acreedor,
        a.deudor,
        String(targetYear),
        a.mes,
        a.nivel_cta,
        a.cod_fnc,
        codEmp,
        a.g_d_m,
      ]);
    }

    const query = `
      INSERT INTO cat_cuentas 
        (cod_cta, nom_cta, cod_tp_cta, dep_cta, acreedor, deudor, ejercicio, mes, nivel_cta, cod_fnc, cod_emp, g_d_m)
      VALUES ?
    `;

    await pool.query(query, [insertValues]);

    res.json({
      message: `Catálogo copiado con éxito: ${sourceAccounts.length} cuentas migradas al ejercicio ${targetYear}`,
      totalCopied: sourceAccounts.length,
    });
  } catch (error: any) {
    console.error('Error copying catalog:', error);
    res.status(500).json({ error: 'Error al duplicar el catálogo de cuentas' });
  }
}

/**
 * Pre-save verification for bulk catalog import
 */
export async function verifyImportCatalog(req: Request, res: Response) {
  try {
    const codEmp = req.usuario?.cod_emp ?? (req as any).user?.cod_emp;
    const { rows, ejercicio } = req.body as { rows: AccountImportRow[]; ejercicio: string };

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'No se enviaron datos para verificar' });
    }

    if (!ejercicio) {
      return res.status(400).json({ error: 'Debe especificar el ejercicio fiscal de destino' });
    }

    // Load existing accounts for that company and year
    const [existingRows] = await pool.query<RowDataPacket[]>(
      `SELECT cod_cta, nom_cta, id_cta FROM cat_cuentas WHERE ejercicio = ? AND cod_emp = ?`,
      [String(ejercicio), codEmp]
    );

    const existingMap = new Map<string, any>();
    for (const ex of existingRows) {
      existingMap.set(String(ex.cod_cta).trim(), ex);
    }

    const verifiedRows: AccountImportRow[] = [];
    let newCount = 0;
    let existingCount = 0;
    let invalidCount = 0;

    const seenInFile = new Set<string>();

    for (const r of rows) {
      const codCta = String(r.cod_cta || '').trim();
      const nomCta = String(r.nom_cta || '').trim();

      if (!codCta || !nomCta) {
        verifiedRows.push({
          cod_cta: codCta || 'SIN CÓDIGO',
          nom_cta: nomCta || 'SIN NOMBRE',
          isValid: false,
          status: 'INVALID',
          message: 'Código o nombre de cuenta vacío',
        });
        invalidCount++;
        continue;
      }

      if (seenInFile.has(codCta)) {
        verifiedRows.push({
          cod_cta: codCta,
          nom_cta: nomCta,
          isValid: false,
          status: 'INVALID',
          message: 'Código duplicado en el mismo archivo',
        });
        invalidCount++;
        continue;
      }
      seenInFile.add(codCta);

      // Auto-derive fields
      const codTpCta = r.cod_tp_cta || deriveAccountType(codCta);
      const depCta = r.dep_cta !== undefined ? r.dep_cta : (deriveParentCode(codCta) || '');
      const nivelCta = r.nivel_cta || deriveLevel(codCta);
      const gdm = r.g_d_m || deriveGDM(nivelCta);
      const nature = deriveNature(codTpCta);
      const deudor = r.deudor !== undefined ? Number(r.deudor) : nature.deudor;
      const acreedor = r.acreedor !== undefined ? Number(r.acreedor) : nature.acreedor;

      const isExisting = existingMap.has(codCta);

      if (isExisting) {
        existingCount++;
        verifiedRows.push({
          cod_cta: codCta,
          nom_cta: nomCta,
          cod_tp_cta: codTpCta,
          dep_cta: depCta,
          nivel_cta: nivelCta,
          g_d_m: gdm,
          deudor,
          acreedor,
          isValid: true,
          status: 'UPDATE',
          message: 'Cuenta existente (se actualizará nombre y clasificación)',
        });
      } else {
        newCount++;
        verifiedRows.push({
          cod_cta: codCta,
          nom_cta: nomCta,
          cod_tp_cta: codTpCta,
          dep_cta: depCta,
          nivel_cta: nivelCta,
          g_d_m: gdm,
          deudor,
          acreedor,
          isValid: true,
          status: 'NEW',
          message: 'Cuenta nueva lista para ingresar',
        });
      }
    }

    const result: ImportVerificationResult = {
      totalRows: rows.length,
      newAccounts: newCount,
      existingAccounts: existingCount,
      invalidAccounts: invalidCount,
      rows: verifiedRows,
    };

    res.json(result);
  } catch (error: any) {
    console.error('Error verifying import catalog:', error);
    res.status(500).json({ error: 'Error al verificar el archivo de catálogo' });
  }
}

/**
 * Save verified bulk catalog import
 */
export async function saveImportCatalog(req: Request, res: Response) {
  const connection = await pool.getConnection();
  try {
    const codEmp = req.usuario?.cod_emp ?? (req as any).user?.cod_emp;
    const { rows, ejercicio, mode } = req.body as {
      rows: AccountImportRow[];
      ejercicio: string;
      mode?: 'ALL' | 'ONLY_NEW';
    };

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'No hay cuentas para guardar' });
    }

    if (!ejercicio) {
      return res.status(400).json({ error: 'Ejercicio fiscal no especificado' });
    }

    await connection.beginTransaction();

    let inserted = 0;
    let updated = 0;

    for (const r of rows) {
      if (!r.isValid && r.status === 'INVALID') continue;

      const codCta = String(r.cod_cta).trim();
      const nomCta = String(r.nom_cta).trim();
      const codTpCta = r.cod_tp_cta || deriveAccountType(codCta);
      const depCta = r.dep_cta !== undefined ? r.dep_cta : deriveParentCode(codCta);
      const nivelCta = r.nivel_cta || deriveLevel(codCta);
      const gdm = r.g_d_m || deriveGDM(nivelCta);
      const nature = deriveNature(codTpCta);
      const deudor = r.deudor !== undefined ? Number(r.deudor) : nature.deudor;
      const acreedor = r.acreedor !== undefined ? Number(r.acreedor) : nature.acreedor;

      const [existing] = await connection.query<RowDataPacket[]>(
        `SELECT id_cta FROM cat_cuentas WHERE cod_cta = ? AND ejercicio = ? AND cod_emp = ?`,
        [codCta, String(ejercicio), codEmp]
      );

      if (existing.length > 0) {
        if (mode !== 'ONLY_NEW') {
          await connection.query(
            `UPDATE cat_cuentas SET
              nom_cta = ?,
              cod_tp_cta = ?,
              dep_cta = ?,
              acreedor = ?,
              deudor = ?,
              nivel_cta = ?,
              g_d_m = ?
             WHERE id_cta = ?`,
            [nomCta, codTpCta, depCta, acreedor, deudor, nivelCta, gdm, existing[0].id_cta]
          );
          updated++;
        }
      } else {
        await connection.query(
          `INSERT INTO cat_cuentas
            (cod_cta, nom_cta, cod_tp_cta, dep_cta, acreedor, deudor, ejercicio, mes, nivel_cta, cod_emp, g_d_m)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            codCta,
            nomCta,
            codTpCta,
            depCta || null,
            acreedor,
            deudor,
            String(ejercicio),
            null,
            nivelCta,
            codEmp,
            gdm,
          ]
        );
        inserted++;
      }
    }

    await connection.commit();

    res.json({
      message: `Importación completada con éxito: ${inserted} creadas, ${updated} actualizadas`,
      inserted,
      updated,
    });
  } catch (error: any) {
    await connection.rollback();
    console.error('Error saving imported catalog:', error);
    res.status(500).json({ error: 'Error al procesar el guardado del catálogo' });
  } finally {
    connection.release();
  }
}
