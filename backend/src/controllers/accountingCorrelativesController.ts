import { Request, Response } from 'express';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { pool } from '../config/db';

/**
 * Get accounting correlatives for a given year and company
 */
export async function getAccountingCorrelatives(req: Request, res: Response) {
  try {
    const codEmp = req.usuario?.cod_emp ?? (req as any).user?.cod_emp;
    const ano = parseInt(String(req.query.ano || new Date().getFullYear()), 10);

    // 1. Get all active tipo_partida for this company
    const [tiposPartida] = await pool.query<RowDataPacket[]>(
      `SELECT cod_tp_partida, nom_tp_partida, forma, tipo
       FROM tipo_partida
       WHERE (cod_emp = ? OR cod_emp IS NULL)
       ORDER BY CAST(cod_tp_partida AS UNSIGNED) ASC, cod_tp_partida ASC`,
      [codEmp]
    );

    // 2. Get existing correlativos_contabilidad for this year
    const [existingCorr] = await pool.query<RowDataPacket[]>(
      `SELECT cc.*, tp.nom_tp_partida
       FROM correlativos_contabilidad cc
       LEFT JOIN tipo_partida tp ON cc.cod_tp_partida = tp.cod_tp_partida AND (tp.cod_emp = cc.cod_emp OR tp.cod_emp IS NULL)
       WHERE cc.cod_emp = ? AND cc.ano = ?
       ORDER BY CAST(cc.cod_tp_partida AS UNSIGNED) ASC, cc.cod_tp_partida ASC`,
      [codEmp, ano]
    );

    const existingCodes = new Set(existingCorr.map((r) => r.cod_tp_partida));

    // If any tipo_partida is missing for this year, create it automatically
    for (const tp of tiposPartida) {
      if (!existingCodes.has(tp.cod_tp_partida)) {
        await pool.query(
          `INSERT INTO correlativos_contabilidad 
           (cod_tp_partida, cod_emp, ano, tipo, \`01\`, \`02\`, \`03\`, \`04\`, \`05\`, \`06\`, \`07\`, \`08\`, \`09\`, \`10\`, \`11\`, \`12\`, unico)
           VALUES (?, ?, ?, ?, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)`,
          [tp.cod_tp_partida, codEmp, ano, tp.tipo || 'M']
        );
      }
    }

    // Query again to get complete list
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT cc.*, COALESCE(tp.nom_tp_partida, CONCAT('TIPO ', cc.cod_tp_partida)) AS nom_tp_partida
       FROM correlativos_contabilidad cc
       LEFT JOIN tipo_partida tp ON cc.cod_tp_partida = tp.cod_tp_partida AND (tp.cod_emp = cc.cod_emp OR tp.cod_emp IS NULL)
       WHERE cc.cod_emp = ? AND cc.ano = ?
       ORDER BY CAST(cc.cod_tp_partida AS UNSIGNED) ASC, cc.cod_tp_partida ASC`,
      [codEmp, ano]
    );

    // 3. Get list of available years
    const [yearRows] = await pool.query<RowDataPacket[]>(
      `SELECT DISTINCT ano FROM correlativos_contabilidad WHERE cod_emp = ?
       UNION
       SELECT DISTINCT YEAR(fec_partida) AS ano FROM cabecera_partida WHERE cod_emp = ? AND fec_partida IS NOT NULL
       ORDER BY ano DESC`,
      [codEmp, codEmp]
    );

    const availableYears = yearRows.map((r) => r.ano).filter(Boolean);
    if (!availableYears.includes(ano)) {
      availableYears.push(ano);
      availableYears.sort((a, b) => b - a);
    }

    // 4. Get global correlativo
    const [corrGlobalRow] = await pool.query<RowDataPacket[]>(
      `SELECT corr_conta_part FROM correlativos LIMIT 1`
    );
    const corrGlobal = corrGlobalRow.length > 0 ? Number(corrGlobalRow[0].corr_conta_part || 0) : 0;

    res.json({
      ano,
      correlativos: rows,
      availableYears,
      corrGlobal,
    });
  } catch (error: any) {
    console.error('Error fetching accounting correlatives:', error);
    res.status(500).json({ error: 'Error al obtener correlativos contables' });
  }
}

/**
 * Update accounting correlatives table (batch update)
 */
export async function updateAccountingCorrelatives(req: Request, res: Response) {
  try {
    const codEmp = req.usuario?.cod_emp ?? (req as any).user?.cod_emp;
    const { ano, rows, corrGlobal } = req.body;

    if (!ano || !Array.isArray(rows)) {
      return res.status(400).json({ error: 'Datos incompletos para actualizar correlativos' });
    }

    for (const row of rows) {
      await pool.query(
        `UPDATE correlativos_contabilidad SET
           \`01\` = ?, \`02\` = ?, \`03\` = ?, \`04\` = ?, \`05\` = ?, \`06\` = ?,
           \`07\` = ?, \`08\` = ?, \`09\` = ?, \`10\` = ?, \`11\` = ?, \`12\` = ?,
           unico = ?, tipo = ?
         WHERE cod_emp = ? AND ano = ? AND cod_tp_partida = ?`,
        [
          Number(row['01'] || 0),
          Number(row['02'] || 0),
          Number(row['03'] || 0),
          Number(row['04'] || 0),
          Number(row['05'] || 0),
          Number(row['06'] || 0),
          Number(row['07'] || 0),
          Number(row['08'] || 0),
          Number(row['09'] || 0),
          Number(row['10'] || 0),
          Number(row['11'] || 0),
          Number(row['12'] || 0),
          Number(row.unico || 0),
          row.tipo || 'M',
          codEmp,
          ano,
          row.cod_tp_partida,
        ]
      );
    }

    if (corrGlobal !== undefined) {
      await pool.query(`UPDATE correlativos SET corr_conta_part = ?`, [Number(corrGlobal)]);
    }

    res.json({ success: true, message: 'Correlativos actualizados correctamente' });
  } catch (error: any) {
    console.error('Error updating accounting correlatives:', error);
    res.status(500).json({ error: 'Error al actualizar los correlativos' });
  }
}

/**
 * Initialize a new year in correlativos_contabilidad
 */
export async function initializeYear(req: Request, res: Response) {
  try {
    const codEmp = req.usuario?.cod_emp ?? (req as any).user?.cod_emp;
    const { ano } = req.body;

    if (!ano) {
      return res.status(400).json({ error: 'El año a inicializar es requerido' });
    }

    const targetYear = parseInt(String(ano), 10);

    const [tiposPartida] = await pool.query<RowDataPacket[]>(
      `SELECT cod_tp_partida, tipo FROM tipo_partida WHERE cod_emp = ? OR cod_emp IS NULL`,
      [codEmp]
    );

    for (const tp of tiposPartida) {
      await pool.query(
        `INSERT IGNORE INTO correlativos_contabilidad 
         (cod_tp_partida, cod_emp, ano, tipo, \`01\`, \`02\`, \`03\`, \`04\`, \`05\`, \`06\`, \`07\`, \`08\`, \`09\`, \`10\`, \`11\`, \`12\`, unico)
         VALUES (?, ?, ?, ?, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)
         ON DUPLICATE KEY UPDATE cod_tp_partida = cod_tp_partida`,
        [tp.cod_tp_partida, codEmp, targetYear, tp.tipo || 'M']
      );
    }

    res.json({ success: true, message: `Año ${targetYear} inicializado correctamente` });
  } catch (error: any) {
    console.error('Error initializing year:', error);
    res.status(500).json({ error: 'Error al inicializar el año' });
  }
}

/**
 * Re-enumerate journal entries (Reenumerar Partidas)
 */
export async function renumberJournalEntries(req: Request, res: Response) {
  const connection = await pool.getConnection();
  try {
    const codEmp = req.usuario?.cod_emp ?? (req as any).user?.cod_emp;
    const {
      ano,
      mes, // 'ALL' or '01'..'12'
      cod_tp_partida, // 'ALL' or specific code
      criterio = 'FECHA', // 'FECHA' | 'COD_PART'
      numeroInicial = 1,
      actualizarTablaCorrelativos = true,
    } = req.body;

    if (!ano) {
      return res.status(400).json({ error: 'El año es obligatorio para reenumerar' });
    }

    await connection.beginTransaction();

    // 1. Build filter query for cabecera_partida
    const whereClauses: string[] = ['cod_emp = ?', 'YEAR(fec_partida) = ?'];
    const queryParams: any[] = [codEmp, parseInt(String(ano), 10)];

    if (mes && mes !== 'ALL') {
      whereClauses.push('MONTH(fec_partida) = ?');
      queryParams.push(parseInt(String(mes), 10));
    }

    if (cod_tp_partida && cod_tp_partida !== 'ALL') {
      whereClauses.push('cod_tp_part = ?');
      queryParams.push(String(cod_tp_partida));
    }

    let orderBy = 'fec_partida ASC, num_correl ASC, cod_part ASC';
    if (criterio === 'COD_PART') {
      orderBy = 'cod_part ASC';
    }

    const [partidas] = await connection.query<RowDataPacket[]>(
      `SELECT cod_part, fec_partida, num_correl, cod_tp_part, MONTH(fec_partida) AS mes_num
       FROM cabecera_partida
       WHERE ${whereClauses.join(' AND ')}
       ORDER BY ${orderBy}`,
      queryParams
    );

    if (partidas.length === 0) {
      await connection.rollback();
      return res.json({
        success: true,
        totalReenumeradas: 0,
        message: 'No se encontraron partidas con los filtros seleccionados para reenumerar.',
        detalles: [],
      });
    }

    // 2. Group partidas by (cod_tp_part, mes_num) to assign sequential numbers starting from numeroInicial
    // Check if each tipo_partida is 'M' (monthly) or 'A' (annual)
    const [tiposInfo] = await connection.query<RowDataPacket[]>(
      `SELECT cod_tp_partida, tipo, nom_tp_partida FROM tipo_partida WHERE cod_emp = ? OR cod_emp IS NULL`,
      [codEmp]
    );
    const tipoMap = new Map<string, { tipo: string; nom: string }>();
    tiposInfo.forEach((t) => tipoMap.set(t.cod_tp_partida, { tipo: t.tipo || 'M', nom: t.nom_tp_partida }));

    // Grouping structure: key -> Array of partida records
    const groups = new Map<string, RowDataPacket[]>();
    for (const p of partidas) {
      const tp = p.cod_tp_part;
      const isAnnual = tipoMap.get(tp)?.tipo === 'A';
      const groupKey = isAnnual ? `${tp}_ANNUAL` : `${tp}_M_${String(p.mes_num).padStart(2, '0')}`;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(p);
    }

    let totalUpdated = 0;
    const detallesSummary: Array<{
      cod_tp_partida: string;
      nom_tp_partida: string;
      mes: string;
      total: number;
      rango: string;
    }> = [];

    // Map to keep track of max correlatives for updating correlativos_contabilidad
    // key: `${cod_tp_partida}_${mesStr}` -> maxNum
    const maxCorrMap = new Map<string, number>();

    for (const [groupKey, groupPartidas] of groups.entries()) {
      let currentSeq = parseInt(String(numeroInicial), 10) || 1;
      const startNum = currentSeq;
      const first = groupPartidas[0];
      const codTp = first.cod_tp_part;
      const mesStr = String(first.mes_num).padStart(2, '0');
      const isAnnual = tipoMap.get(codTp)?.tipo === 'A';

      for (const p of groupPartidas) {
        await connection.query(
          `UPDATE cabecera_partida SET num_correl = ? WHERE cod_part = ? AND cod_emp = ?`,
          [currentSeq, p.cod_part, codEmp]
        );
        currentSeq++;
        totalUpdated++;
      }

      const endNum = currentSeq - 1;
      const maxVal = endNum;

      if (isAnnual) {
        maxCorrMap.set(`${codTp}_unico`, maxVal);
      } else {
        maxCorrMap.set(`${codTp}_${mesStr}`, maxVal);
      }

      const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
      ];
      const mesLabel = isAnnual ? 'Anual' : `${mesStr} - ${monthNames[first.mes_num - 1] || mesStr}`;

      detallesSummary.push({
        cod_tp_partida: codTp,
        nom_tp_partida: tipoMap.get(codTp)?.nom || `Tipo ${codTp}`,
        mes: mesLabel,
        total: groupPartidas.length,
        rango: `N° ${startNum} al ${endNum}`,
      });
    }

    // 3. Update correlativos_contabilidad if requested
    if (actualizarTablaCorrelativos) {
      for (const [key, maxVal] of maxCorrMap.entries()) {
        const [codTp, field] = key.split('_');
        const colName = field === 'unico' ? 'unico' : `\`${field}\``;

        await connection.query(
          `UPDATE correlativos_contabilidad 
           SET ${colName} = ? 
           WHERE cod_emp = ? AND ano = ? AND cod_tp_partida = ?`,
          [maxVal, codEmp, parseInt(String(ano), 10), codTp]
        );
      }
    }

    await connection.commit();

    res.json({
      success: true,
      totalReenumeradas: totalUpdated,
      message: `Se reenumeraron exitosamente ${totalUpdated} partidas contables.`,
      detalles: detallesSummary,
    });
  } catch (error: any) {
    await connection.rollback();
    console.error('Error renumbering journal entries:', error);
    res.status(500).json({ error: 'Error al reenumerar las partidas contables' });
  } finally {
    connection.release();
  }
}
