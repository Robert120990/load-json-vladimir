import { Request, Response } from 'express';
import { pool } from '../config/db';

/**
 * Executes the Mayorización process for a given company and fiscal year.
 * Aggregates all non-annulled journal entries from cabecera_partida / detalle_partida,
 * populates or updates cuentas_saldos for month 01 to 12,
 * propagates child balances up the parent hierarchy (dep_cta),
 * and computes running monthly balances based on account nature (comportamiento: 1 deudor, 0 acreedor).
 */
export async function mayorizarCuentas(req: Request, res: Response) {
  const codEmp = req.usuario?.cod_emp ?? (req as any).user?.cod_emp;
  const { ano } = req.body;

  if (!codEmp) {
    return res.status(401).json({ error: 'Empresa no autenticada.' });
  }

  const ejercicio = Number(ano) || new Date().getFullYear();

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Get all accounts from cat_cuentas for this company and year
    const [accounts]: any = await connection.query(
      `SELECT cod_cta, dep_cta, nom_cta, nivel_cta, cod_tp_cta, deudor, acreedor
       FROM cat_cuentas 
       WHERE cod_emp = ? AND ejercicio = ?
       ORDER BY nivel_cta DESC, cod_cta ASC`,
      [codEmp, ejercicio]
    );

    if (accounts.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        error: `No se encontraron cuentas contables registradas para el ejercicio ${ejercicio}.`,
      });
    }

    // 2. Fetch all transactions per account and month from active journal entries
    const [transactions]: any = await connection.query(
      `SELECT 
         d.cod_cta,
         MONTH(c.fec_partida) AS mes,
         SUM(d.cargo_part) AS total_cargo,
         SUM(d.abono_part) AS total_abono
       FROM detalle_partida d
       INNER JOIN cabecera_partida c ON d.cod_part = c.cod_part
       WHERE c.cod_emp = ? 
         AND YEAR(c.fec_partida) = ?
         AND (c.anulada_part IS NULL OR c.anulada_part = 0)
       GROUP BY d.cod_cta, MONTH(c.fec_partida)`,
      [codEmp, ejercicio]
    );

    // Map account monthly direct transactions
    // accountCode -> { month: { cargo: number, abono: number } }
    const accountDirectTotals: Record<string, Record<number, { cargo: number; abono: number }>> = {};

    let grandTotalCargo = 0;
    let grandTotalAbono = 0;

    for (const tx of transactions) {
      const cta = String(tx.cod_cta).trim();
      const mes = Number(tx.mes);
      const cargo = Number(tx.total_cargo) || 0;
      const abono = Number(tx.total_abono) || 0;

      if (!accountDirectTotals[cta]) {
        accountDirectTotals[cta] = {};
      }
      accountDirectTotals[cta][mes] = { cargo, abono };

      grandTotalCargo += cargo;
      grandTotalAbono += abono;
    }

    // 3. Prepare data structure for all accounts with rollup
    type AccountData = {
      cod_cta: string;
      dep_cta: string;
      nom_cta: string;
      nivel_cta: string;
      cod_tp_cta: string;
      comportamiento: number; // 1: Deudor, 0: Acreedor
      cargos: number[]; // indices 0..12
      abonos: number[]; // indices 0..12
      saldos: number[]; // indices 0..12
    };

    const accountMap = new Map<string, AccountData>();

    for (const acc of accounts) {
      const cta = String(acc.cod_cta).trim();
      const dep = String(acc.dep_cta || '').trim();
      // Determine behavior: 1 for deudor, 0 for acreedor
      const isDeudor = acc.deudor === 1 || acc.deudor === '1' || (!acc.acreedor && !cta.startsWith('2') && !cta.startsWith('3') && !cta.startsWith('5'));
      const comportamiento = isDeudor ? 1 : 0;

      const cargos = new Array(13).fill(0);
      const abonos = new Array(13).fill(0);
      const saldos = new Array(13).fill(0);

      // Initialize with direct transactions if any
      const direct = accountDirectTotals[cta];
      if (direct) {
        for (let m = 1; m <= 12; m++) {
          if (direct[m]) {
            cargos[m] = direct[m].cargo;
            abonos[m] = direct[m].abono;
          }
        }
      }

      accountMap.set(cta, {
        cod_cta: cta,
        dep_cta: dep,
        nom_cta: acc.nom_cta,
        nivel_cta: String(acc.nivel_cta || '1'),
        cod_tp_cta: String(acc.cod_tp_cta || '01'),
        comportamiento,
        cargos,
        abonos,
        saldos,
      });
    }

    // 4. Rollup hierarchy: from deepest level to root accounts
    // Since accounts were sorted by `nivel_cta DESC`, we iterate and add child cargos & abonos to dep_cta
    for (const acc of accounts) {
      const cta = String(acc.cod_cta).trim();
      const dep = String(acc.dep_cta || '').trim();

      if (dep && dep !== cta && accountMap.has(dep)) {
        const childData = accountMap.get(cta)!;
        const parentData = accountMap.get(dep)!;

        // If the account has direct movements or child movements, roll up monthly to parent
        for (let m = 1; m <= 12; m++) {
          parentData.cargos[m] += childData.cargos[m];
          parentData.abonos[m] += childData.abonos[m];
        }
      }
    }

    // 5. Calculate monthly running balances (saldo01..saldo12)
    for (const [, accData] of accountMap) {
      let runningSaldo = accData.saldos[0]; // saldo00 (inicial)

      for (let m = 1; m <= 12; m++) {
        const netMovement = accData.comportamiento === 1
          ? accData.cargos[m] - accData.abonos[m] // Deudor: suma cargos, resta abonos
          : accData.abonos[m] - accData.cargos[m]; // Acreedor: suma abonos, resta cargos

        runningSaldo += netMovement;
        accData.saldos[m] = Math.round(runningSaldo * 100000) / 100000;
      }
    }

    // 6. Upsert into cuentas_saldos
    // Clean existing balances for this company & year or replace
    await connection.query(
      `DELETE FROM cuentas_saldos WHERE cod_emp = ? AND ejercicio = ?`,
      [codEmp, ejercicio]
    );

    const insertValues: any[] = [];
    const insertPlaceholders: string[] = [];

    for (const [, a] of accountMap) {
      insertPlaceholders.push('(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      insertValues.push(
        a.cod_cta,
        a.dep_cta,
        a.nom_cta,
        a.nivel_cta,
        a.cod_tp_cta,
        // Month 00
        a.cargos[0], a.abonos[0], a.saldos[0],
        // Month 01
        a.cargos[1], a.abonos[1], a.saldos[1],
        // Month 02
        a.cargos[2], a.abonos[2], a.saldos[2],
        // Month 03
        a.cargos[3], a.abonos[3], a.saldos[3],
        // Month 04
        a.cargos[4], a.abonos[4], a.saldos[4],
        // Month 05
        a.cargos[5], a.abonos[5], a.saldos[5],
        // Month 06
        a.cargos[6], a.abonos[6], a.saldos[6],
        // Month 07
        a.cargos[7], a.abonos[7], a.saldos[7],
        // Month 08
        a.cargos[8], a.abonos[8], a.saldos[8],
        // Month 09
        a.cargos[9], a.abonos[9], a.saldos[9],
        // Month 10
        a.cargos[10], a.abonos[10], a.saldos[10],
        // Month 11
        a.cargos[11], a.abonos[11], a.saldos[11],
        // Month 12
        a.cargos[12], a.abonos[12], a.saldos[12],
        a.comportamiento,
        ejercicio,
        codEmp
      );
    }

    // Insert in batches of 100 to avoid packet limits
    const batchSize = 100;
    for (let i = 0; i < insertPlaceholders.length; i += batchSize) {
      const chunkPlaceholders = insertPlaceholders.slice(i, i + batchSize);
      const chunkValues = insertValues.slice(i * 46, (i + chunkPlaceholders.length) * 46);

      const sql = `
        INSERT INTO cuentas_saldos (
          cod_cta, dep_cta, nom_cta, nivel_cta, cod_tp_cta,
          cargo00, abono00, saldo00,
          cargo01, abono01, saldo01,
          cargo02, abono02, saldo02,
          cargo03, abono03, saldo03,
          cargo04, abono04, saldo04,
          cargo05, abono05, saldo05,
          cargo06, abono06, saldo06,
          cargo07, abono07, saldo07,
          cargo08, abono08, saldo08,
          cargo09, abono09, saldo09,
          cargo10, abono10, saldo10,
          cargo11, abono11, saldo11,
          cargo12, abono12, saldo12,
          comportamiento, ejercicio, cod_emp
        ) VALUES ${chunkPlaceholders.join(', ')}
      `;

      await connection.query(sql, chunkValues);
    }

    await connection.commit();

    return res.json({
      success: true,
      message: `Mayorización finalizada exitosamente para el ejercicio ${ejercicio}.`,
      ejercicio,
      totalCuentas: accountMap.size,
      totalPartidasProcesadas: transactions.length,
      totalCargos: grandTotalCargo,
      totalAbonos: grandTotalAbono,
    });
  } catch (error: any) {
    await connection.rollback();
    console.error('[mayorizarCuentas Error]:', error);
    return res.status(500).json({
      error: 'Error al ejecutar la mayorización de cuentas: ' + (error.message || 'Error desconocido'),
    });
  } finally {
    connection.release();
  }
}

const MONTH_NAMES = [
  '',
  'ENERO',
  'FEBRERO',
  'MARZO',
  'ABRIL',
  'MAYO',
  'JUNIO',
  'JULIO',
  'AGOSTO',
  'SEPTIEMBRE',
  'OCTUBRE',
  'NOVIEMBRE',
  'DICIEMBRE',
];

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Generates data for any of the 12 official accounting reports.
 */
export async function generarReporteContable(req: Request, res: Response) {
  try {
    const codEmp = req.usuario?.cod_emp ?? (req as any).user?.cod_emp;
    if (!codEmp) {
      return res.status(401).json({ error: 'Empresa no autenticada.' });
    }

    const {
      reportId,
      ano: paramAno,
      mes: paramMes,
      fecha_desde: paramFechaDesde,
      fecha_hasta: paramFechaHasta,
      cuenta_desde: paramCuentaDesde,
      cuenta_hasta: paramCuentaHasta,
      nivel_max: paramNivelMax,
      ano_comparativo: paramAnoComp,
      cod_tipo_partida: paramTipoPart,
    } = req.body;

    const ano = Number(paramAno) || new Date().getFullYear();
    const mes = Number(paramMes) || new Date().getMonth() + 1;
    const nivelMax = Number(paramNivelMax) || 9;
    const anoComp = Number(paramAnoComp) || ano - 1;

    // 1. Fetch Company Information from `empresas`
    const [empRows]: any = await pool.query(
      `SELECT cod_emp, nom_emp, razon_social, nit, reg_fiscal FROM empresas WHERE cod_emp = ? LIMIT 1`,
      [codEmp]
    );
    const empresa = empRows[0] || {
      cod_emp: codEmp,
      nom_emp: 'EMPRESA REGISTRADA',
      nit: '0000-000000-000-0',
      reg_fiscal: '000000-0',
    };

    // 2. Fetch Signatures from `firmas_conta`
    const [firmasRows]: any = await pool.query(
      `SELECT id_firma, nom_firma, puesto FROM firmas_conta WHERE cod_emp = ? ORDER BY id_firma ASC`,
      [codEmp]
    );

    const defaultFirmas = [
      { id_firma: 1, nom_firma: '', puesto: 'Representante Legal' },
      { id_firma: 2, nom_firma: '', puesto: 'Contador' },
      { id_firma: 3, nom_firma: '', puesto: 'Auditor Externo' },
    ];

    const firmas = defaultFirmas.map((def) => {
      const found = firmasRows.find((r: any) => r.id_firma === def.id_firma);
      return found ? { ...def, nom_firma: found.nom_firma || '', puesto: found.puesto || def.puesto } : def;
    });
    firmasRows.forEach((r: any) => {
      if (!firmas.some((f) => f.id_firma === r.id_firma)) {
        firmas.push({ id_firma: r.id_firma, nom_firma: r.nom_firma || '', puesto: r.puesto || '' });
      }
    });

    const mesNombre = MONTH_NAMES[mes] || '';
    const lastDayOfMonth = new Date(ano, mes, 0).getDate();

    let titulo = '';
    let periodoTexto = '';
    let data: any = {};

    switch (reportId) {
      // -------------------------------------------------------------
      // 1. AUXILIAR DE OPERACIONES
      // -------------------------------------------------------------
      case 'auxiliar_operaciones': {
        titulo = 'AUXILIAR DE OPERACIONES';
        const fDesde = paramFechaDesde || `${ano}-01-01`;
        const fHasta = paramFechaHasta || `${ano}-12-31`;
        periodoTexto = `DEL ${formatDateDMA(fDesde)} AL ${formatDateDMA(fHasta)}`;

        const ctaDesde = (paramCuentaDesde || '').trim();
        const ctaHasta = (paramCuentaHasta || '').trim();

        let queryTx = `
          SELECT 
            d.id_cta,
            d.cod_cta,
            d.cargo_part,
            d.abono_part,
            d.concepto,
            DATE_FORMAT(c.fec_partida, '%Y-%m-%d') as fec_iso,
            c.num_correl,
            c.concepto_part,
            tp.cod_tp_partida,
            tp.nom_tp_partida,
            a.nom_cta,
            a.deudor,
            a.acreedor
          FROM detalle_partida d
          INNER JOIN cabecera_partida c ON d.cod_part = c.cod_part
          LEFT JOIN tipo_partida tp ON c.cod_tp_part = tp.cod_tp_partida AND tp.cod_emp = c.cod_emp
          LEFT JOIN cat_cuentas a ON d.cod_cta = a.cod_cta AND a.cod_emp = c.cod_emp AND a.ejercicio = YEAR(c.fec_partida)
          WHERE c.cod_emp = ?
            AND c.fec_partida BETWEEN ? AND ?
            AND (c.anulada_part IS NULL OR c.anulada_part = 0)
        `;
        const queryParams: any[] = [codEmp, fDesde, fHasta];

        if (ctaDesde) {
          queryTx += ` AND d.cod_cta >= ?`;
          queryParams.push(ctaDesde);
        }
        if (ctaHasta) {
          queryTx += ` AND d.cod_cta <= ?`;
          queryParams.push(ctaHasta);
        }

        queryTx += ` ORDER BY d.cod_cta ASC, c.fec_partida ASC, c.num_correl ASC, d.id_cta ASC`;

        const [txRows]: any = await pool.query(queryTx, queryParams);

        // Fetch initial balances prior to fDesde for these accounts
        const [initRows]: any = await pool.query(
          `SELECT 
             d.cod_cta,
             SUM(d.cargo_part) as sum_cargo,
             SUM(d.abono_part) as sum_abono
           FROM detalle_partida d
           INNER JOIN cabecera_partida c ON d.cod_part = c.cod_part
           WHERE c.cod_emp = ?
             AND YEAR(c.fec_partida) = ?
             AND c.fec_partida < ?
             AND (c.anulada_part IS NULL OR c.anulada_part = 0)
           GROUP BY d.cod_cta`,
          [codEmp, ano, fDesde]
        );

        const initMap = new Map<string, number>();
        for (const r of initRows) {
          const cta = String(r.cod_cta).trim();
          const isAcreedor = cta.startsWith('2') || cta.startsWith('3') || cta.startsWith('5');
          const net = isAcreedor
            ? (Number(r.sum_abono) || 0) - (Number(r.sum_cargo) || 0)
            : (Number(r.sum_cargo) || 0) - (Number(r.sum_abono) || 0);
          initMap.set(cta, net);
        }

        // Group by account
        const cuentasMap = new Map<string, any>();

        for (const r of txRows) {
          const cta = String(r.cod_cta).trim();
          if (!cuentasMap.has(cta)) {
            const isAcreedor = r.acreedor === 1 || (!r.deudor && (cta.startsWith('2') || cta.startsWith('3') || cta.startsWith('5')));
            const saldoIni = initMap.get(cta) || 0;
            cuentasMap.set(cta, {
              cod_cta: cta,
              nom_cta: r.nom_cta || 'CUENTA SIN NOMBRE',
              saldoInicial: saldoIni,
              isAcreedor,
              movimientos: [],
              totalesCargos: 0,
              totalesAbonos: 0,
              saldoFinal: saldoIni,
            });
          }

          const accGroup = cuentasMap.get(cta)!;
          const cargo = Number(r.cargo_part) || 0;
          const abono = Number(r.abono_part) || 0;

          if (accGroup.isAcreedor) {
            accGroup.saldoFinal += (abono - cargo);
          } else {
            accGroup.saldoFinal += (cargo - abono);
          }

          accGroup.totalesCargos += cargo;
          accGroup.totalesAbonos += abono;

          accGroup.movimientos.push({
            fecha: formatDateDMA(r.fec_iso),
            tipoPartida: `${r.num_correl} ${pad2(r.cod_tp_partida || 0)} ${r.nom_tp_partida || ''}`.trim(),
            concepto: r.concepto || r.concepto_part || '',
            cargo,
            abono,
            saldo: Math.round(accGroup.saldoFinal * 100) / 100,
          });
        }

        const cuentas = Array.from(cuentasMap.values());
        let grandCargos = 0;
        let grandAbonos = 0;
        cuentas.forEach((c) => {
          c.totalesCargos = Math.round(c.totalesCargos * 100) / 100;
          c.totalesAbonos = Math.round(c.totalesAbonos * 100) / 100;
          c.saldoFinal = Math.round(c.saldoFinal * 100) / 100;
          grandCargos += c.totalesCargos;
          grandAbonos += c.totalesAbonos;
        });

        data = {
          cuentas,
          totalCargos: Math.round(grandCargos * 100) / 100,
          totalAbonos: Math.round(grandAbonos * 100) / 100,
          totalCuentasImpresas: cuentas.length,
        };
        break;
      }

      // -------------------------------------------------------------
      // 2. BALANCE DE COMPROBACIÓN (CARGOS Y ABONOS)
      // -------------------------------------------------------------
      case 'bal_comp_cargos_abonos': {
        titulo = 'BALANCE DE COMPROBACION';
        periodoTexto = `DEL 01 AL ${lastDayOfMonth} DE ${mesNombre} DE ${ano}`;

        const colSaldoAnt = mes === 1 ? 'saldo00' : `saldo${pad2(mes - 1)}`;
        const colCargo = `cargo${pad2(mes)}`;
        const colAbono = `abono${pad2(mes)}`;
        const colSaldoFin = `saldo${pad2(mes)}`;

        const [rows]: any = await pool.query(
          `SELECT 
             cod_cta, nom_cta, nivel_cta,
             ${colSaldoAnt} AS saldo_inicial,
             ${colCargo} AS cargo,
             ${colAbono} AS abono,
             ${colSaldoFin} AS saldo_final
           FROM cuentas_saldos
           WHERE cod_emp = ? AND ejercicio = ? AND CAST(nivel_cta AS SIGNED) <= ?
           ORDER BY cod_cta ASC`,
          [codEmp, ano, nivelMax]
        );

        // Calculate actual sum of transactions for this month to match PDF grand totals
        const [txTotals]: any = await pool.query(
          `SELECT 
             SUM(d.cargo_part) as total_cargo,
             SUM(d.abono_part) as total_abono
           FROM detalle_partida d
           INNER JOIN cabecera_partida c ON d.cod_part = c.cod_part
           WHERE c.cod_emp = ? 
             AND YEAR(c.fec_partida) = ? 
             AND MONTH(c.fec_partida) = ?
             AND (c.anulada_part IS NULL OR c.anulada_part = 0)`,
          [codEmp, ano, mes]
        );

        const filas = rows.map((r: any) => ({
          cod_cta: r.cod_cta,
          nom_cta: r.nom_cta,
          nivel_cta: Number(r.nivel_cta),
          saldo_inicial: Number(r.saldo_inicial) || 0,
          cargo: Number(r.cargo) || 0,
          abono: Number(r.abono) || 0,
          saldo_final: Number(r.saldo_final) || 0,
        }));

        data = {
          filas,
          totalCargos: Number(txTotals[0]?.total_cargo) || 0,
          totalAbonos: Number(txTotals[0]?.total_abono) || 0,
          totalCuentasImpresas: filas.length,
        };
        break;
      }

      // -------------------------------------------------------------
      // 3. BALANCE DE COMPROBACIÓN POR NIVELES
      // -------------------------------------------------------------
      case 'bal_comp_niveles': {
        titulo = 'BALANCE DE COMPROBACION';
        periodoTexto = `AL ${lastDayOfMonth} DE ${mesNombre} DE ${ano}`;

        const colSaldoFin = `saldo${pad2(mes)}`;
        const [rows]: any = await pool.query(
          `SELECT cod_cta, nom_cta, nivel_cta, ${colSaldoFin} AS saldo_final
           FROM cuentas_saldos
           WHERE cod_emp = ? AND ejercicio = ? AND CAST(nivel_cta AS SIGNED) <= ?
           ORDER BY cod_cta ASC`,
          [codEmp, ano, nivelMax]
        );

        let totalActivo = 0;
        let totalPasivo = 0;
        let totalCapital = 0;
        let totalAcreedoras = 0;
        let totalDeudoras = 0;

        const filas = rows.map((r: any) => {
          const nivel = Number(r.nivel_cta) || 1;
          const saldo = Number(r.saldo_final) || 0;
          const cta = String(r.cod_cta).trim();

          // Section subtotals based on level 1 accounts
          if (cta === '1') totalActivo = Math.abs(saldo);
          if (cta === '2') totalPasivo = Math.abs(saldo);
          if (cta === '3') totalCapital = Math.abs(saldo);
          if (cta === '5') totalAcreedoras = Math.abs(saldo);
          if (cta === '4') totalDeudoras = Math.abs(saldo);

          return {
            cod_cta: cta,
            nom_cta: r.nom_cta,
            nivel_cta: nivel,
            saldo,
            nivelAnt: nivel > 5 ? saldo : null,
            nivel5: nivel === 5 ? saldo : null,
            nivel4: nivel === 4 ? saldo : null,
            nivel3: nivel === 3 ? saldo : null,
            nivel2: nivel === 2 ? saldo : null,
            nivel1: nivel === 1 ? saldo : null,
          };
        });

        const utilidadEjercicio = totalAcreedoras - totalDeudoras;

        data = {
          filas,
          totalActivo,
          totalPasivo,
          totalCapital,
          totalAcreedoras,
          totalDeudoras,
          utilidadEjercicio,
          totalCuentasImpresas: filas.length,
        };
        break;
      }

      // -------------------------------------------------------------
      // 4. BALANCE GENERAL - CUENTA
      // -------------------------------------------------------------
      case 'balance_general_cuenta': {
        titulo = 'BALANCE GENERAL';
        periodoTexto = `AL ${lastDayOfMonth} DE ${mesNombre} DE ${ano}`;

        const colSaldoFin = `saldo${pad2(mes)}`;
        const [rows]: any = await pool.query(
          `SELECT cod_cta, nom_cta, nivel_cta, ${colSaldoFin} AS saldo_final
           FROM cuentas_saldos
           WHERE cod_emp = ? AND ejercicio = ? AND CAST(nivel_cta AS SIGNED) <= ?
           ORDER BY cod_cta ASC`,
          [codEmp, ano, Math.min(nivelMax, 4)]
        );

        let totalActivo = 0;
        let totalPasivo = 0;
        let totalCapital = 0;
        let totalAcreedoras = 0;
        let totalDeudoras = 0;

        const activoRows: any[] = [];
        const pasivoRows: any[] = [];
        const patrimonioRows: any[] = [];

        for (const r of rows) {
          const cta = String(r.cod_cta).trim();
          const saldo = Number(r.saldo_final) || 0;
          const nivel = Number(r.nivel_cta) || 1;

          if (cta === '1') totalActivo = saldo;
          if (cta === '2') totalPasivo = saldo;
          if (cta === '3') totalCapital = saldo;
          if (cta === '5') totalAcreedoras = saldo;
          if (cta === '4') totalDeudoras = saldo;

          const item = { cod_cta: cta, nom_cta: r.nom_cta, nivel_cta: nivel, saldo };

          if (cta.startsWith('1')) activoRows.push(item);
          else if (cta.startsWith('2')) pasivoRows.push(item);
          else if (cta.startsWith('3')) patrimonioRows.push(item);
        }

        const utilidadEjercicio = totalAcreedoras - totalDeudoras;
        const totalPasivoPatrimonio = totalPasivo + totalCapital + utilidadEjercicio;

        data = {
          activoRows,
          pasivoRows,
          patrimonioRows,
          totalActivo,
          totalPasivo,
          totalCapital,
          utilidadEjercicio,
          totalPasivoPatrimonio,
        };
        break;
      }

      // -------------------------------------------------------------
      // 5. BALANCE DE COMPROBACIÓN - CUENTA
      // -------------------------------------------------------------
      case 'bal_comp_cuenta': {
        titulo = 'BALANCE DE COMPROBACION';
        periodoTexto = `AL ${lastDayOfMonth} DE ${mesNombre} DE ${ano}`;

        const colSaldoFin = `saldo${pad2(mes)}`;
        const [rows]: any = await pool.query(
          `SELECT cod_cta, nom_cta, nivel_cta, ${colSaldoFin} AS saldo_final
           FROM cuentas_saldos
           WHERE cod_emp = ? AND ejercicio = ? AND CAST(nivel_cta AS SIGNED) <= ?
           ORDER BY cod_cta ASC`,
          [codEmp, ano, Math.min(nivelMax, 4)]
        );

        let totalActivo = 0;
        let totalPasivo = 0;
        let totalPatrimonio = 0;
        let totalAcreedoras = 0;
        let totalDeudoras = 0;

        const leftRows: any[] = [];
        const rightRows: any[] = [];

        for (const r of rows) {
          const cta = String(r.cod_cta).trim();
          const saldo = Number(r.saldo_final) || 0;
          const item = { cod_cta: cta, nom_cta: r.nom_cta, nivel_cta: Number(r.nivel_cta), saldo };

          if (cta === '1') totalActivo = saldo;
          if (cta === '2') totalPasivo = saldo;
          if (cta === '3') totalPatrimonio = saldo;
          if (cta === '4') totalDeudoras = saldo;
          if (cta === '5') totalAcreedoras = saldo;

          if (cta.startsWith('4') || cta.startsWith('1')) {
            leftRows.push(item);
          } else if (cta.startsWith('5') || cta.startsWith('3') || cta.startsWith('2')) {
            rightRows.push(item);
          }
        }

        const totalIzquierda = totalDeudoras + totalActivo;
        const totalDerecha = totalAcreedoras + totalPatrimonio + totalPasivo;

        data = {
          leftRows,
          rightRows,
          totalDeudoras,
          totalActivo,
          totalAcreedoras,
          totalPatrimonio,
          totalPasivo,
          totalIzquierda,
          totalDerecha,
        };
        break;
      }

      // -------------------------------------------------------------
      // 6. ANEXO AL BALANCE GENERAL
      // -------------------------------------------------------------
      case 'anexo_balance_general': {
        titulo = 'ANEXO AL BALANCE GENERAL';
        periodoTexto = `AL ${lastDayOfMonth} DE ${mesNombre} DE ${ano}`;

        const colSaldoFin = `saldo${pad2(mes)}`;
        const [rows]: any = await pool.query(
          `SELECT cod_cta, nom_cta, nivel_cta, ${colSaldoFin} AS saldo_final
           FROM cuentas_saldos
           WHERE cod_emp = ? AND ejercicio = ? 
             AND (cod_cta LIKE '1%' OR cod_cta LIKE '2%' OR cod_cta LIKE '3%')
             AND CAST(nivel_cta AS SIGNED) <= ?
           ORDER BY cod_cta ASC`,
          [codEmp, ano, nivelMax]
        );

        // Also get results for current exercise utility
        const [resRows]: any = await pool.query(
          `SELECT cod_cta, ${colSaldoFin} AS saldo_final
           FROM cuentas_saldos
           WHERE cod_emp = ? AND ejercicio = ? AND (cod_cta = '4' OR cod_cta = '5')`,
          [codEmp, ano]
        );

        let totalDeudoras = 0;
        let totalAcreedoras = 0;
        for (const r of resRows) {
          if (r.cod_cta === '4') totalDeudoras = Number(r.saldo_final) || 0;
          if (r.cod_cta === '5') totalAcreedoras = Number(r.saldo_final) || 0;
        }
        const utilidadEjercicio = totalAcreedoras - totalDeudoras;

        let totalActivo = 0;
        let totalPasivo = 0;
        let totalCapital = 0;

        const filas = rows.map((r: any) => {
          const cta = String(r.cod_cta).trim();
          const nivel = Number(r.nivel_cta) || 1;
          const saldo = Number(r.saldo_final) || 0;

          if (cta === '1') totalActivo = saldo;
          if (cta === '2') totalPasivo = saldo;
          if (cta === '3') totalCapital = saldo;

          return {
            cod_cta: cta,
            nom_cta: r.nom_cta,
            nivel_cta: nivel,
            saldo,
            nivelAnt: nivel > 5 ? saldo : null,
            nivel5: nivel === 5 ? saldo : null,
            nivel4: nivel === 4 ? saldo : null,
            nivel3: nivel === 3 ? saldo : null,
            nivel2: nivel === 2 ? saldo : null,
            nivel1: nivel === 1 ? saldo : null,
          };
        });

        data = {
          filas,
          totalActivo,
          totalPasivo,
          totalCapital,
          utilidadEjercicio,
          totalCuentasImpresas: filas.length,
        };
        break;
      }

      // -------------------------------------------------------------
      // 7. LIBRO DIARIO MAYOR
      // -------------------------------------------------------------
      case 'diario_mayor': {
        titulo = 'LIBRO DIARIO MAYOR';
        periodoTexto = `CORRESPONDIENTE AL MES DE ${mesNombre} DE ${ano}`;

        const [txRows]: any = await pool.query(
          `SELECT 
             d.cod_cta,
             a.nom_cta,
             a.deudor,
             a.acreedor,
             DATE_FORMAT(c.fec_partida, '%Y-%m-%d') as fec_iso,
             c.num_correl,
             d.concepto,
             c.concepto_part,
             d.cargo_part,
             d.abono_part
           FROM detalle_partida d
           INNER JOIN cabecera_partida c ON d.cod_part = c.cod_part
           LEFT JOIN cat_cuentas a ON d.cod_cta = a.cod_cta AND a.cod_emp = c.cod_emp AND a.ejercicio = YEAR(c.fec_partida)
           WHERE c.cod_emp = ?
             AND YEAR(c.fec_partida) = ?
             AND MONTH(c.fec_partida) = ?
             AND (c.anulada_part IS NULL OR c.anulada_part = 0)
           ORDER BY d.cod_cta ASC, c.fec_partida ASC, c.num_correl ASC`,
          [codEmp, ano, mes]
        );

        // Group by account
        const cuentasMap = new Map<string, any>();
        for (const r of txRows) {
          const cta = String(r.cod_cta).trim();
          if (!cuentasMap.has(cta)) {
            const isAcreedor = r.acreedor === 1 || (!r.deudor && (cta.startsWith('2') || cta.startsWith('3') || cta.startsWith('5')));
            cuentasMap.set(cta, {
              cod_cta: cta,
              nom_cta: r.nom_cta || '',
              isAcreedor,
              movimientos: [],
              totalCargos: 0,
              totalAbonos: 0,
              saldoFinal: 0,
            });
          }
          const acc = cuentasMap.get(cta)!;
          const cargo = Number(r.cargo_part) || 0;
          const abono = Number(r.abono_part) || 0;
          acc.totalCargos += cargo;
          acc.totalAbonos += abono;
          if (acc.isAcreedor) acc.saldoFinal += (abono - cargo);
          else acc.saldoFinal += (cargo - abono);

          acc.movimientos.push({
            fecha: formatDateDMA(r.fec_iso),
            corr_part: r.num_correl,
            concepto: r.concepto || r.concepto_part || '',
            cargo,
            abono,
            saldo: Math.round(acc.saldoFinal * 100) / 100,
          });
        }

        const cuentas = Array.from(cuentasMap.values());
        let grandTotalCargos = 0;
        let grandTotalAbonos = 0;
        cuentas.forEach((c) => {
          grandTotalCargos += c.totalCargos;
          grandTotalAbonos += c.totalAbonos;
        });

        data = {
          cuentas,
          grandTotalCargos: Math.round(grandTotalCargos * 100) / 100,
          grandTotalAbonos: Math.round(grandTotalAbonos * 100) / 100,
          totalCuentas: cuentas.length,
        };
        break;
      }

      // -------------------------------------------------------------
      // 8. LIBRO DIARIO
      // -------------------------------------------------------------
      case 'diario': {
        titulo = 'LIBRO DIARIO';
        const fDesde = paramFechaDesde || `${ano}-01-01`;
        const fHasta = paramFechaHasta || `${ano}-12-31`;
        periodoTexto = `DEL ${formatDateDMA(fDesde)} AL ${formatDateDMA(fHasta)}`;

        let queryPart = `
          SELECT 
            c.cod_part,
            c.num_correl,
            DATE_FORMAT(c.fec_partida, '%Y-%m-%d') as fec_iso,
            c.concepto_part,
            tp.cod_tp_partida,
            tp.nom_tp_partida,
            d.id_cta,
            d.cod_cta,
            a.nom_cta,
            d.concepto,
            d.cargo_part,
            d.abono_part
          FROM cabecera_partida c
          INNER JOIN detalle_partida d ON c.cod_part = d.cod_part
          LEFT JOIN tipo_partida tp ON c.cod_tp_part = tp.cod_tp_partida AND tp.cod_emp = c.cod_emp
          LEFT JOIN cat_cuentas a ON d.cod_cta = a.cod_cta AND a.cod_emp = c.cod_emp AND a.ejercicio = YEAR(c.fec_partida)
          WHERE c.cod_emp = ?
            AND c.fec_partida BETWEEN ? AND ?
            AND (c.anulada_part IS NULL OR c.anulada_part = 0)
        `;
        const qParams: any[] = [codEmp, fDesde, fHasta];

        if (paramTipoPart) {
          queryPart += ` AND c.cod_tp_part = ?`;
          qParams.push(paramTipoPart);
        }

        queryPart += ` ORDER BY c.fec_partida ASC, c.num_correl ASC, d.id_cta ASC`;

        const [rows]: any = await pool.query(queryPart, qParams);

        // Group by journal entry
        const partidasMap = new Map<number, any>();
        let grandTotalDebe = 0;
        let grandTotalHaber = 0;

        for (const r of rows) {
          const codPart = Number(r.cod_part);
          if (!partidasMap.has(codPart)) {
            partidasMap.set(codPart, {
              cod_part: codPart,
              corr_part: r.num_correl,
              fecha: formatDateDMA(r.fec_iso),
              tipo: `${pad2(r.cod_tp_partida || 0)} - ${r.nom_tp_partida || ''}`,
              concepto: r.concepto_part || '',
              lineas: [],
              totalDebe: 0,
              totalHaber: 0,
            });
          }

          const p = partidasMap.get(codPart)!;
          const debe = Number(r.cargo_part) || 0;
          const haber = Number(r.abono_part) || 0;
          p.totalDebe += debe;
          p.totalHaber += haber;
          grandTotalDebe += debe;
          grandTotalHaber += haber;

          p.lineas.push({
            cod_cta: r.cod_cta,
            nom_cta: r.nom_cta || '',
            concepto: r.concepto || '',
            debe,
            haber,
          });
        }

        const partidas = Array.from(partidasMap.values());
        data = {
          partidas,
          grandTotalDebe: Math.round(grandTotalDebe * 100) / 100,
          grandTotalHaber: Math.round(grandTotalHaber * 100) / 100,
          totalPartidas: partidas.length,
        };
        break;
      }

      // -------------------------------------------------------------
      // 9. LIBRO DIARIO MAYOR CONSOLIDADO
      // -------------------------------------------------------------
      case 'diario_mayor_consolidado': {
        titulo = 'LIBRO DIARIO MAYOR CONSOLIDADO';
        periodoTexto = `MES DE ${mesNombre} DE ${ano}`;

        const colSaldoAnt = mes === 1 ? 'saldo00' : `saldo${pad2(mes - 1)}`;
        const colCargo = `cargo${pad2(mes)}`;
        const colAbono = `abono${pad2(mes)}`;
        const colSaldoFin = `saldo${pad2(mes)}`;

        const [rows]: any = await pool.query(
          `SELECT 
             cod_cta, nom_cta, nivel_cta,
             ${colSaldoAnt} AS saldo_ant,
             ${colCargo} AS debito,
             ${colAbono} AS credito,
             ${colSaldoFin} AS saldo_act
           FROM cuentas_saldos
           WHERE cod_emp = ? AND ejercicio = ? AND CAST(nivel_cta AS SIGNED) <= 3
           ORDER BY cod_cta ASC`,
          [codEmp, ano]
        );

        let totalDebitos = 0;
        let totalCreditos = 0;
        const filas = rows.map((r: any) => {
          const deb = Number(r.debito) || 0;
          const cred = Number(r.credito) || 0;
          totalDebitos += deb;
          totalCreditos += cred;
          return {
            cod_cta: r.cod_cta,
            nom_cta: r.nom_cta,
            nivel_cta: Number(r.nivel_cta),
            saldo_ant: Number(r.saldo_ant) || 0,
            debito: deb,
            credito: cred,
            saldo_act: Number(r.saldo_act) || 0,
          };
        });

        data = {
          filas,
          totalDebitos: Math.round(totalDebitos * 100) / 100,
          totalCreditos: Math.round(totalCreditos * 100) / 100,
        };
        break;
      }

      // -------------------------------------------------------------
      // 10. ESTADO DE RESULTADOS
      // -------------------------------------------------------------
      case 'estado_resultados': {
        titulo = 'ESTADO DE RESULTADOS';
        periodoTexto = `DEL 01 DE ENERO AL ${lastDayOfMonth} DE ${mesNombre} DE ${ano}`;

        const colSaldoFin = `saldo${pad2(mes)}`;
        const [rows]: any = await pool.query(
          `SELECT cod_cta, nom_cta, nivel_cta, ${colSaldoFin} AS saldo_final
           FROM cuentas_saldos
           WHERE cod_emp = ? AND ejercicio = ? 
             AND (cod_cta LIKE '4%' OR cod_cta LIKE '5%')
             AND CAST(nivel_cta AS SIGNED) <= 3
           ORDER BY cod_cta ASC`,
          [codEmp, ano]
        );

        let ingresosOrdinarios = 0;
        let costosOrdinarios = 0;
        let gastosAdmin = 0;
        let gastosVenta = 0;
        let gastosFinancieros = 0;
        let otrosIngresos = 0;

        for (const r of rows) {
          const cta = String(r.cod_cta).trim();
          const saldo = Number(r.saldo_final) || 0;

          if (cta === '51') ingresosOrdinarios = saldo;
          else if (cta === '41') costosOrdinarios = saldo;
          else if (cta === '4201') gastosAdmin = saldo;
          else if (cta === '4202') gastosVenta = saldo;
          else if (cta === '42') {
            if (gastosAdmin === 0 && gastosVenta === 0) gastosAdmin = saldo;
          } else if (cta === '43') gastosFinancieros = saldo;
          else if (cta === '52') otrosIngresos = saldo;
        }

        const utilidadBruta = ingresosOrdinarios - costosOrdinarios;
        const totalGastosOperacion = gastosAdmin + gastosVenta;
        const utilidadOperacion = utilidadBruta - totalGastosOperacion;
        const utilidadAntesImpuestos = utilidadOperacion - gastosFinancieros + otrosIngresos;

        // Salvadoran standards: Reserva legal 7% for corporations if profitable
        const reservaLegal = utilidadAntesImpuestos > 0 ? Math.round(utilidadAntesImpuestos * 0.07 * 100) / 100 : 0;
        // Income tax 25% or 30% if income > 150k
        const tasaIsr = ingresosOrdinarios > 150000 ? 0.30 : 0.25;
        const baseImponible = Math.max(0, utilidadAntesImpuestos - reservaLegal);
        const impuestoRenta = baseImponible > 0 ? Math.round(baseImponible * tasaIsr * 100) / 100 : 0;
        const utilidadNeta = utilidadAntesImpuestos - reservaLegal - impuestoRenta;

        data = {
          ingresosOrdinarios,
          costosOrdinarios,
          utilidadBruta,
          gastosAdmin,
          gastosVenta,
          totalGastosOperacion,
          utilidadOperacion,
          gastosFinancieros,
          otrosIngresos,
          utilidadAntesImpuestos,
          reservaLegal,
          impuestoRenta,
          utilidadNeta,
          detalles: rows.map((r: any) => ({
            cod_cta: r.cod_cta,
            nom_cta: r.nom_cta,
            nivel_cta: Number(r.nivel_cta),
            saldo: Number(r.saldo_final) || 0,
          })),
        };
        break;
      }

      // -------------------------------------------------------------
      // 11. CUADRO DE INGRESOS Y GASTOS
      // -------------------------------------------------------------
      case 'cuadro_ingresos_gastos': {
        titulo = 'CUADRO ANALITICO DE INGRESOS Y GASTOS';
        periodoTexto = `AL ${lastDayOfMonth} DE ${mesNombre} DE ${ano}`;

        const colSaldoAnt = mes === 1 ? 'saldo00' : `saldo${pad2(mes - 1)}`;
        const colCargo = `cargo${pad2(mes)}`;
        const colAbono = `abono${pad2(mes)}`;
        const colSaldoFin = `saldo${pad2(mes)}`;

        const [rows]: any = await pool.query(
          `SELECT 
             cod_cta, nom_cta, nivel_cta,
             ${colSaldoAnt} AS saldo_ant,
             ${colCargo} AS cargos,
             ${colAbono} AS abonos,
             ${colSaldoFin} AS saldo_act
           FROM cuentas_saldos
           WHERE cod_emp = ? AND ejercicio = ? 
             AND (cod_cta LIKE '4%' OR cod_cta LIKE '5%')
             AND CAST(nivel_cta AS SIGNED) <= ?
           ORDER BY cod_cta ASC`,
          [codEmp, ano, nivelMax]
        );

        let totalIngresos = 0;
        let totalGastos = 0;

        const filas = rows.map((r: any) => {
          const cta = String(r.cod_cta).trim();
          const saldo = Number(r.saldo_act) || 0;
          if (cta === '5') totalIngresos = saldo;
          if (cta === '4') totalGastos = saldo;

          return {
            cod_cta: cta,
            nom_cta: r.nom_cta,
            nivel_cta: Number(r.nivel_cta),
            saldo_ant: Number(r.saldo_ant) || 0,
            cargos: Number(r.cargos) || 0,
            abonos: Number(r.abonos) || 0,
            saldo_act: saldo,
            esIngreso: cta.startsWith('5'),
          };
        });

        data = {
          filas,
          totalIngresos,
          totalGastos,
          resultadoNeto: totalIngresos - totalGastos,
        };
        break;
      }

      // -------------------------------------------------------------
      // 12. BALANCE COMPARATIVO
      // -------------------------------------------------------------
      case 'balance_comparativo': {
        titulo = 'BALANCE COMPARATIVO';
        periodoTexto = `EJERCICIO ${ano} VS ${anoComp} (AL MES DE ${mesNombre})`;

        const colSaldo = `saldo${pad2(mes)}`;

        const [baseRows]: any = await pool.query(
          `SELECT cod_cta, nom_cta, nivel_cta, ${colSaldo} AS saldo
           FROM cuentas_saldos
           WHERE cod_emp = ? AND ejercicio = ? AND CAST(nivel_cta AS SIGNED) <= ?
           ORDER BY cod_cta ASC`,
          [codEmp, ano, Math.min(nivelMax, 4)]
        );

        const [compRows]: any = await pool.query(
          `SELECT cod_cta, ${colSaldo} AS saldo
           FROM cuentas_saldos
           WHERE cod_emp = ? AND ejercicio = ? AND CAST(nivel_cta AS SIGNED) <= ?`,
          [codEmp, anoComp, Math.min(nivelMax, 4)]
        );

        const compMap = new Map<string, number>();
        for (const r of compRows) {
          compMap.set(String(r.cod_cta).trim(), Number(r.saldo) || 0);
        }

        const filas = baseRows.map((r: any) => {
          const cta = String(r.cod_cta).trim();
          const saldoBase = Number(r.saldo) || 0;
          const saldoComp = compMap.get(cta) || 0;
          const variacionAbs = saldoBase - saldoComp;
          const variacionPorc = saldoComp !== 0 ? (variacionAbs / Math.abs(saldoComp)) * 100 : 0;

          return {
            cod_cta: cta,
            nom_cta: r.nom_cta,
            nivel_cta: Number(r.nivel_cta),
            saldoBase,
            saldoComp,
            variacionAbs: Math.round(variacionAbs * 100) / 100,
            variacionPorc: Math.round(variacionPorc * 10) / 10,
          };
        });

        data = {
          filas,
          anoBase: ano,
          anoComp,
        };
        break;
      }

      default:
        return res.status(400).json({ error: `Tipo de reporte desconocido: ${reportId}` });
    }

    return res.json({
      success: true,
      reportId,
      titulo,
      periodoTexto,
      empresa,
      firmas,
      data,
    });
  } catch (error: any) {
    console.error('[generarReporteContable Error]:', error);
    return res.status(500).json({
      error: 'Error al generar datos del reporte contable: ' + (error.message || 'Error desconocido'),
    });
  }
}

function formatDateDMA(dateStr: string): string {
  if (!dateStr) return '';
  const parts = String(dateStr).split('T')[0].split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

