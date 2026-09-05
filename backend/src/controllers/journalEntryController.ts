import { Request, Response } from 'express';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { pool } from '../config/db';
import { CabeceraPartida, DetallePartida } from '../types/accounting';

/**
 * Get list of partida types (tipo_partida)
 */
export async function getPartidaTypes(req: Request, res: Response) {
  try {
    const codEmp = req.usuario?.cod_emp ?? (req as any).user?.cod_emp;
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT cod_tp_partida, nom_tp_partida, forma, cod_emp, tipo, corr
       FROM tipo_partida
       WHERE (cod_emp = ? OR cod_emp IS NULL)
       ORDER BY CAST(cod_tp_partida AS UNSIGNED) ASC, cod_tp_partida ASC`,
      [codEmp]
    );
    res.json(rows);
  } catch (error: any) {
    console.error('Error getting partida types:', error);
    res.status(500).json({ error: 'Error al obtener los tipos de partida' });
  }
}

/**
 * Get next correlatives for a journal entry (both cod_part and num_correl)
 */
export async function getNextCorrelatives(req: Request, res: Response) {
  try {
    const codEmp = req.usuario?.cod_emp ?? (req as any).user?.cod_emp;
    const { cod_tp_part, ano, mes } = req.query;

    const targetYear = parseInt(String(ano || new Date().getFullYear()), 10);
    const targetMonth = String(mes || new Date().getMonth() + 1).padStart(2, '0');
    const targetTpPart = String(cod_tp_part || '01');

    // Global correlativo for cod_part
    const [corrRows] = await pool.query<RowDataPacket[]>(
      `SELECT corr_conta_part FROM correlativos LIMIT 1`
    );
    let nextGlobal = 1;
    if (corrRows.length > 0 && corrRows[0].corr_conta_part) {
      nextGlobal = Number(corrRows[0].corr_conta_part) + 1;
    } else {
      const [maxPart] = await pool.query<RowDataPacket[]>(
        `SELECT cod_part FROM cabecera_partida ORDER BY cod_part DESC LIMIT 1`
      );
      if (maxPart.length > 0 && maxPart[0].cod_part) {
        const num = parseInt(maxPart[0].cod_part.replace(/[^0-9]/g, ''), 10);
        if (!isNaN(num)) nextGlobal = num + 1;
      }
    }
    const suggestedCodPart = `PAR${String(nextGlobal).padStart(7, '0')}`;

    // Correlativo per company, year, type, month
    let suggestedNumCorrel = 1;
    const monthCol = `\`${targetMonth}\``;

    const [corrConta] = await pool.query<RowDataPacket[]>(
      `SELECT ${monthCol} as mes_corr FROM correlativos_contabilidad 
       WHERE cod_emp = ? AND ano = ? AND cod_tp_partida = ? LIMIT 1`,
      [codEmp, targetYear, targetTpPart]
    );

    if (corrConta.length > 0 && corrConta[0].mes_corr !== undefined) {
      suggestedNumCorrel = Number(corrConta[0].mes_corr) + 1;
    } else {
      // Look up max in cabecera_partida for this period
      const [maxNum] = await pool.query<RowDataPacket[]>(
        `SELECT MAX(num_correl) as max_num FROM cabecera_partida 
         WHERE cod_emp = ? AND YEAR(fec_partida) = ? AND MONTH(fec_partida) = ? AND cod_tp_part = ?`,
        [codEmp, targetYear, parseInt(targetMonth, 10), targetTpPart]
      );
      if (maxNum.length > 0 && maxNum[0].max_num) {
        suggestedNumCorrel = Number(maxNum[0].max_num) + 1;
      }
    }

    res.json({
      suggestedCodPart,
      suggestedNumCorrel,
      ano: targetYear,
      mes: targetMonth,
      cod_tp_part: targetTpPart,
    });
  } catch (error: any) {
    console.error('Error calculating next correlative:', error);
    res.status(500).json({ error: 'Error al calcular el correlativo sugerido' });
  }
}

/**
 * List journal entries with filters and summary stats
 */
export async function listJournalEntries(req: Request, res: Response) {
  try {
    const codEmp = req.usuario?.cod_emp ?? (req as any).user?.cod_emp;
    const {
      ano,
      mes,
      cod_tp_part,
      search,
      anulada,
      desde,
      hasta,
      limit = '100',
      offset = '0',
    } = req.query;

    let whereClause = ` WHERE c.cod_emp = ?`;
    const params: any[] = [codEmp];

    if (ano) {
      whereClause += ` AND YEAR(c.fec_partida) = ?`;
      params.push(Number(ano));
    }

    if (mes) {
      whereClause += ` AND MONTH(c.fec_partida) = ?`;
      params.push(Number(mes));
    }

    if (cod_tp_part) {
      whereClause += ` AND c.cod_tp_part = ?`;
      params.push(String(cod_tp_part));
    }

    if (anulada !== undefined && anulada !== '') {
      whereClause += ` AND c.anulada_part = ?`;
      params.push(Number(anulada));
    }

    if (desde) {
      whereClause += ` AND c.fec_partida >= ?`;
      params.push(String(desde));
    }

    if (hasta) {
      whereClause += ` AND c.fec_partida <= ?`;
      params.push(String(hasta));
    }

    if (search && typeof search === 'string' && search.trim()) {
      const tokens = search.trim().split(/\s+/).filter(Boolean);
      for (const token of tokens) {
        const term = `%${token}%`;
        whereClause += ` AND (c.cod_part LIKE ? OR c.concepto_part LIKE ? OR CAST(c.num_correl AS CHAR) LIKE ?)`;
        params.push(term, term, term);
      }
    }

    // Get count and totals
    const [summaryRows] = await pool.query<RowDataPacket[]>(
      `SELECT 
        COUNT(*) as total,
        COALESCE(SUM(c.cargo_part), 0) as total_cargos,
        COALESCE(SUM(c.abono_part), 0) as total_abonos,
        COALESCE(SUM(CASE WHEN c.anulada_part = 1 THEN 1 ELSE 0 END), 0) as total_anuladas,
        COALESCE(SUM(CASE WHEN c.anulada_part = 0 THEN 1 ELSE 0 END), 0) as total_activas
       FROM cabecera_partida c ${whereClause}`,
      params
    );

    const summary = summaryRows[0] || {
      total: 0,
      total_cargos: 0,
      total_abonos: 0,
      total_anuladas: 0,
      total_activas: 0,
    };

    // Get paginated list
    const query = `
      SELECT 
        c.cod_part,
        c.fec_partida,
        c.num_correl,
        c.concepto_part,
        c.anulada_part,
        c.cargo_part,
        c.abono_part,
        c.cod_emp,
        c.cod_tp_part,
        tp.nom_tp_partida
      FROM cabecera_partida c
      LEFT JOIN tipo_partida tp ON tp.cod_tp_partida = c.cod_tp_part AND (tp.cod_emp = c.cod_emp OR tp.cod_emp IS NULL)
      ${whereClause}
      ORDER BY c.fec_partida DESC, c.num_correl DESC, c.cod_part DESC
      LIMIT ? OFFSET ?
    `;

    const limitNum = parseInt(String(limit), 10) || 100;
    const offsetNum = parseInt(String(offset), 10) || 0;

    const [rows] = await pool.query<RowDataPacket[]>(query, [...params, limitNum, offsetNum]);

    res.json({
      data: rows,
      summary,
      limit: limitNum,
      offset: offsetNum,
    });
  } catch (error: any) {
    console.error('Error listing journal entries:', error);
    res.status(500).json({ error: 'Error al listar las partidas contables' });
  }
}

/**
 * Get single journal entry with its detail lines
 */
export async function getJournalEntryByCode(req: Request, res: Response) {
  try {
    const codEmp = req.usuario?.cod_emp ?? (req as any).user?.cod_emp;
    const { codPart } = req.params;

    const [headers] = await pool.query<RowDataPacket[]>(
      `SELECT 
        c.cod_part,
        c.fec_partida,
        c.num_correl,
        c.concepto_part,
        c.anulada_part,
        c.cargo_part,
        c.abono_part,
        c.cod_emp,
        c.cod_tp_part,
        tp.nom_tp_partida
       FROM cabecera_partida c
       LEFT JOIN tipo_partida tp ON tp.cod_tp_partida = c.cod_tp_part AND (tp.cod_emp = c.cod_emp OR tp.cod_emp IS NULL)
       WHERE c.cod_part = ? AND c.cod_emp = ?`,
      [codPart, codEmp]
    );

    if (headers.length === 0) {
      return res.status(404).json({ error: 'Partida contable no encontrada' });
    }

    const [details] = await pool.query<RowDataPacket[]>(
      `SELECT 
        d.cod_part,
        d.id_cta,
        d.cod_cta,
        d.nom_cta,
        d.concepto,
        d.cargo_part,
        d.abono_part,
        d.cod_emp,
        d.marca
       FROM detalle_partida d
       WHERE d.cod_part = ? AND d.cod_emp = ?
       ORDER BY (d.cargo_part > 0) DESC, d.cod_cta ASC`,
      [codPart, codEmp]
    );

    res.json({
      ...headers[0],
      detalles: details,
    });
  } catch (error: any) {
    console.error('Error getting journal entry:', error);
    res.status(500).json({ error: 'Error al consultar la partida contable' });
  }
}

/**
 * Create a new journal entry with detail lines in a transaction
 */
export async function createJournalEntry(req: Request, res: Response) {
  const connection = await pool.getConnection();
  try {
    const codEmp = req.usuario?.cod_emp ?? (req as any).user?.cod_emp;
    const {
      fec_partida,
      concepto_part,
      cod_tp_part,
      detalles,
    } = req.body as {
      fec_partida: string;
      concepto_part: string;
      cod_tp_part: string;
      detalles: DetallePartida[];
    };

    if (!fec_partida || !concepto_part || !cod_tp_part) {
      return res.status(400).json({ error: 'Fecha, concepto y tipo de partida son obligatorios' });
    }

    if (!detalles || !Array.isArray(detalles) || detalles.length < 2) {
      return res.status(400).json({ error: 'La partida debe tener al menos 2 renglones en el detalle' });
    }

    // Calculate totals
    let totalCargos = 0;
    let totalAbonos = 0;

    for (const d of detalles) {
      const cargo = Number(d.cargo_part) || 0;
      const abono = Number(d.abono_part) || 0;
      if (cargo < 0 || abono < 0) {
        return res.status(400).json({ error: 'Los importes no pueden ser negativos' });
      }
      if (cargo === 0 && abono === 0) {
        return res.status(400).json({ error: `El renglón con cuenta ${d.cod_cta} no tiene cargo ni abono` });
      }
      totalCargos += cargo;
      totalAbonos += abono;
    }

    // Check balance
    const diff = Math.abs(totalCargos - totalAbonos);
    if (diff > 0.009) {
      return res.status(400).json({
        error: `La partida está descuadrada. Total Cargos: $${totalCargos.toFixed(2)}, Total Abonos: $${totalAbonos.toFixed(2)} (Diferencia: $${diff.toFixed(2)})`,
      });
    }

    await connection.beginTransaction();

    // 1. Generate unique cod_part
    const [corrRows] = await connection.query<RowDataPacket[]>(
      `SELECT corr_conta_part FROM correlativos FOR UPDATE`
    );
    let nextNum = 1;
    if (corrRows.length > 0 && corrRows[0].corr_conta_part) {
      nextNum = Number(corrRows[0].corr_conta_part) + 1;
      await connection.query(`UPDATE correlativos SET corr_conta_part = ?`, [nextNum]);
    } else {
      const [maxPart] = await connection.query<RowDataPacket[]>(
        `SELECT cod_part FROM cabecera_partida ORDER BY cod_part DESC LIMIT 1 FOR UPDATE`
      );
      if (maxPart.length > 0 && maxPart[0].cod_part) {
        const num = parseInt(maxPart[0].cod_part.replace(/[^0-9]/g, ''), 10);
        if (!isNaN(num)) nextNum = num + 1;
      }
      await connection.query(`UPDATE correlativos SET corr_conta_part = ?`, [nextNum]);
    }
    const codPart = `PAR${String(nextNum).padStart(7, '0')}`;

    // 2. Generate and update num_correl
    const partDate = new Date(fec_partida);
    const ano = partDate.getFullYear();
    const mesNumber = partDate.getMonth() + 1;
    const mesStr = String(mesNumber).padStart(2, '0');
    const monthCol = `\`${mesStr}\``;

    const [corrContaRows] = await connection.query<RowDataPacket[]>(
      `SELECT ${monthCol} as mes_corr FROM correlativos_contabilidad 
       WHERE cod_emp = ? AND ano = ? AND cod_tp_partida = ? FOR UPDATE`,
      [codEmp, ano, cod_tp_part]
    );

    let numCorrel = 1;
    if (corrContaRows.length > 0) {
      numCorrel = (Number(corrContaRows[0].mes_corr) || 0) + 1;
      await connection.query(
        `UPDATE correlativos_contabilidad SET ${monthCol} = ? 
         WHERE cod_emp = ? AND ano = ? AND cod_tp_partida = ?`,
        [numCorrel, codEmp, ano, cod_tp_part]
      );
    } else {
      // Insert initial record in correlativos_contabilidad
      await connection.query(
        `INSERT INTO correlativos_contabilidad (cod_tp_partida, cod_emp, ano, tipo, ${monthCol})
         VALUES (?, ?, ?, 'M', 1)`,
        [cod_tp_part, codEmp, ano]
      );
      numCorrel = 1;
    }

    // 3. Insert cabecera_partida
    await connection.query(
      `INSERT INTO cabecera_partida
        (cod_part, fec_partida, num_correl, concepto_part, anulada_part, cargo_part, abono_part, cod_emp, cod_tp_part)
       VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?)`,
      [
        codPart,
        fec_partida,
        numCorrel,
        concepto_part.trim(),
        totalCargos,
        totalAbonos,
        codEmp,
        cod_tp_part,
      ]
    );

    // 4. Insert detalle_partida
    const insertDetails = detalles.map((d) => [
      codPart,
      d.id_cta || null,
      d.cod_cta.trim(),
      d.nom_cta.trim(),
      (d.concepto || concepto_part).trim(),
      Number(d.cargo_part) || 0,
      Number(d.abono_part) || 0,
      codEmp,
      d.marca || 'D',
    ]);

    await connection.query(
      `INSERT INTO detalle_partida
        (cod_part, id_cta, cod_cta, nom_cta, concepto, cargo_part, abono_part, cod_emp, marca)
       VALUES ?`,
      [insertDetails]
    );

    await connection.commit();

    res.status(201).json({
      message: 'Partida contable registrada exitosamente',
      cod_part: codPart,
      num_correl: numCorrel,
    });
  } catch (error: any) {
    await connection.rollback();
    console.error('Error creating journal entry:', error);
    res.status(500).json({ error: 'Error al registrar la partida contable' });
  } finally {
    connection.release();
  }
}

/**
 * Update an existing journal entry
 */
export async function updateJournalEntry(req: Request, res: Response) {
  const connection = await pool.getConnection();
  try {
    const codEmp = req.usuario?.cod_emp ?? (req as any).user?.cod_emp;
    const { codPart } = req.params;
    const {
      fec_partida,
      concepto_part,
      cod_tp_part,
      detalles,
    } = req.body as {
      fec_partida: string;
      concepto_part: string;
      cod_tp_part: string;
      detalles: DetallePartida[];
    };

    const [headers] = await connection.query<RowDataPacket[]>(
      `SELECT * FROM cabecera_partida WHERE cod_part = ? AND cod_emp = ?`,
      [codPart, codEmp]
    );

    if (headers.length === 0) {
      return res.status(404).json({ error: 'Partida no encontrada' });
    }

    if (headers[0].anulada_part === 1) {
      return res.status(400).json({ error: 'No se puede editar una partida anulada. Primero reactívela.' });
    }

    if (!detalles || !Array.isArray(detalles) || detalles.length < 2) {
      return res.status(400).json({ error: 'La partida debe tener al menos 2 renglones en el detalle' });
    }

    let totalCargos = 0;
    let totalAbonos = 0;

    for (const d of detalles) {
      const cargo = Number(d.cargo_part) || 0;
      const abono = Number(d.abono_part) || 0;
      if (cargo < 0 || abono < 0) {
        return res.status(400).json({ error: 'Los importes no pueden ser negativos' });
      }
      totalCargos += cargo;
      totalAbonos += abono;
    }

    const diff = Math.abs(totalCargos - totalAbonos);
    if (diff > 0.009) {
      return res.status(400).json({
        error: `La partida está descuadrada. Total Cargos: $${totalCargos.toFixed(2)}, Total Abonos: $${totalAbonos.toFixed(2)}`,
      });
    }

    await connection.beginTransaction();

    // Update header
    await connection.query(
      `UPDATE cabecera_partida SET
        fec_partida = ?,
        concepto_part = ?,
        cod_tp_part = ?,
        cargo_part = ?,
        abono_part = ?
       WHERE cod_part = ? AND cod_emp = ?`,
      [
        fec_partida,
        concepto_part.trim(),
        cod_tp_part,
        totalCargos,
        totalAbonos,
        codPart,
        codEmp,
      ]
    );

    // Replace details
    await connection.query(`DELETE FROM detalle_partida WHERE cod_part = ? AND cod_emp = ?`, [
      codPart,
      codEmp,
    ]);

    const insertDetails = detalles.map((d) => [
      codPart,
      d.id_cta || null,
      d.cod_cta.trim(),
      d.nom_cta.trim(),
      (d.concepto || concepto_part).trim(),
      Number(d.cargo_part) || 0,
      Number(d.abono_part) || 0,
      codEmp,
      d.marca || 'D',
    ]);

    await connection.query(
      `INSERT INTO detalle_partida
        (cod_part, id_cta, cod_cta, nom_cta, concepto, cargo_part, abono_part, cod_emp, marca)
       VALUES ?`,
      [insertDetails]
    );

    await connection.commit();

    res.json({ message: 'Partida contable actualizada exitosamente' });
  } catch (error: any) {
    await connection.rollback();
    console.error('Error updating journal entry:', error);
    res.status(500).json({ error: 'Error al actualizar la partida contable' });
  } finally {
    connection.release();
  }
}

/**
 * Toggle annul status of journal entry (anulada_part)
 */
export async function toggleAnnulJournalEntry(req: Request, res: Response) {
  try {
    const codEmp = req.usuario?.cod_emp ?? (req as any).user?.cod_emp;
    const { codPart } = req.params;

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT anulada_part FROM cabecera_partida WHERE cod_part = ? AND cod_emp = ?`,
      [codPart, codEmp]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Partida no encontrada' });
    }

    const currentStatus = rows[0].anulada_part;
    const newStatus = currentStatus === 1 ? 0 : 1;

    await pool.query(
      `UPDATE cabecera_partida SET anulada_part = ? WHERE cod_part = ? AND cod_emp = ?`,
      [newStatus, codPart, codEmp]
    );

    res.json({
      message: newStatus === 1 ? 'Partida anulada exitosamente' : 'Partida reactivada exitosamente',
      anulada_part: newStatus,
    });
  } catch (error: any) {
    console.error('Error toggling annul status:', error);
    res.status(500).json({ error: 'Error al cambiar el estado de la partida' });
  }
}

/**
 * Delete a journal entry
 */
export async function deleteJournalEntry(req: Request, res: Response) {
  const connection = await pool.getConnection();
  try {
    const codEmp = req.usuario?.cod_emp ?? (req as any).user?.cod_emp;
    const { codPart } = req.params;

    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT cod_part FROM cabecera_partida WHERE cod_part = ? AND cod_emp = ?`,
      [codPart, codEmp]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Partida no encontrada' });
    }

    await connection.beginTransaction();

    await connection.query(`DELETE FROM detalle_partida WHERE cod_part = ? AND cod_emp = ?`, [
      codPart,
      codEmp,
    ]);

    await connection.query(`DELETE FROM cabecera_partida WHERE cod_part = ? AND cod_emp = ?`, [
      codPart,
      codEmp,
    ]);

    await connection.commit();

    res.json({ message: 'Partida eliminada exitosamente' });
  } catch (error: any) {
    await connection.rollback();
    console.error('Error deleting journal entry:', error);
    res.status(500).json({ error: 'Error al eliminar la partida contable' });
  } finally {
    connection.release();
  }
}
