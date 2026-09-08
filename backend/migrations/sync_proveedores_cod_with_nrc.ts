import { pool } from '../src/config/db';

async function runMigration() {
  const conn = await pool.getConnection();
  try {
    console.log('=== STARTING NRC SYNC MIGRATION ===');

    // 0. Backup tables before making changes
    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    const provBkp = `proveedores_bkp_nrc_${timestamp}`;
    const comprasBkp = `compras_iva_bkp_nrc_${timestamp}`;

    console.log(`Creating backups: ${provBkp} and ${comprasBkp}...`);
    await conn.query(`CREATE TABLE IF NOT EXISTS ${provBkp} AS SELECT * FROM proveedores`);
    await conn.query(`CREATE TABLE IF NOT EXISTS ${comprasBkp} AS SELECT * FROM compras_iva`);
    console.log('Backups created successfully.');

    await conn.beginTransaction();

    // 1. Deduplicate the 21 duplicate registro groups in proveedores
    const [dupRegistros] = await conn.query(`
      SELECT registro, COUNT(*) as cnt, GROUP_CONCAT(corr ORDER BY corr) as corrs, GROUP_CONCAT(cod_proveedor ORDER BY corr) as cods
      FROM proveedores
      GROUP BY registro
      HAVING cnt > 1
    `);
    console.log(`Duplicate registro groups to merge: ${(dupRegistros as any[]).length}`);

    for (const d of (dupRegistros as any[])) {
      const corrs = d.corrs.split(',').map(Number);
      const cods = d.cods.split(',');

      const bestIdx = cods.findIndex((c: string) => c === d.registro);
      const keepCorr = bestIdx >= 0 ? corrs[bestIdx] : corrs[0];
      const removeCorrs = corrs.filter((c: number) => c !== keepCorr);

      const removeCods = cods.filter((_: string, idx: number) => corrs[idx] !== keepCorr);
      if (removeCods.length > 0) {
        await conn.query(`
          UPDATE compras_iva 
          SET cod_proveedor = ? 
          WHERE cod_proveedor IN (?)
        `, [d.registro, removeCods]);

        await conn.query(`
          DELETE FROM proveedores WHERE corr IN (?)
        `, [removeCorrs]);
      }
    }
    console.log('Duplicate proveedores merged.');

    // 2. Restore missing providers from proveedores_bkp_20260905 that have purchases in compras_iva
    const [missingInBkp] = await conn.query(`
      SELECT DISTINCT b.cod_proveedor, b.nom_proveedor, b.registro, b.nit_proveedor, b.giro, b.dir_proveedor, b.cod_dept, b.cod_muni, b.telefono, b.tama, b.pais
      FROM proveedores_bkp_20260905 b
      LEFT JOIN proveedores p ON (b.registro = p.registro OR b.cod_proveedor = p.cod_proveedor)
      JOIN compras_iva c ON (c.cod_proveedor = b.cod_proveedor OR c.cod_proveedor = b.registro)
      WHERE p.cod_proveedor IS NULL
    `);

    const insertedRegs = new Set<string>();
    let restoredCount = 0;
    for (const m of (missingInBkp as any[])) {
      const reg = m.registro || m.cod_proveedor;
      if (!reg || insertedRegs.has(reg)) continue;
      insertedRegs.add(reg);

      await conn.query(`
        INSERT INTO proveedores (cod_emp, cod_proveedor, nom_proveedor, dir_proveedor, cod_dept, cod_muni, telefono, registro, nit_proveedor, giro, exento, exterior, activo, tama, pais, cuenta_contable, nombre_cuenta, con_credito, excede_credito, limite_credito, con_retencion, con_percepcion, identificacion_excluidos, deducible)
        VALUES (49, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 1, ?, ?, '', '', 0, 0, 0, 0, 0, '', 1)
      `, [
        reg,
        m.nom_proveedor,
        m.dir_proveedor || '',
        m.cod_dept || 0,
        m.cod_muni || 0,
        m.telefono || '',
        reg,
        m.nit_proveedor || '',
        m.giro || '',
        m.tama || 'PEQUEÑA',
        m.pais || 'EL SALVADOR',
      ]);
      restoredCount++;
    }
    console.log(`Restored ${restoredCount} missing providers.`);

    // 3. For any purchases in compras_iva that currently have 2019xxx-0, remap them to the provider's registro
    const [remapResult] = await conn.query(`
      UPDATE compras_iva c
      JOIN proveedores p ON c.cod_proveedor = p.cod_proveedor
      SET c.cod_proveedor = p.registro
      WHERE c.cod_proveedor != p.registro AND p.registro IS NOT NULL AND p.registro != ''
    `);
    console.log('Compras remapped to registro:', (remapResult as any).affectedRows);

    // 4. Update proveedores SET cod_proveedor = registro
    const [updateProvResult] = await conn.query(`
      UPDATE proveedores
      SET cod_proveedor = registro
      WHERE cod_proveedor != registro AND registro IS NOT NULL AND registro != ''
    `);
    console.log('Proveedores updated to cod_proveedor = registro:', (updateProvResult as any).affectedRows);

    await conn.commit();
    console.log('=== MIGRATION COMMITTED SUCCESSFULLY ===');

  } catch (err) {
    await conn.rollback();
    console.error('MIGRATION FAILED - ROLLED BACK:', err);
    throw err;
  } finally {
    conn.release();
    await pool.end();
  }
}

runMigration();
