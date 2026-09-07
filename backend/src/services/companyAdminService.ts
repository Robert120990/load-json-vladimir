import { pool } from '../config/db';
import { ApiError } from '../middlewares/error';

export interface EmpresaAdminDetail {
  cod_emp: number;
  nom_emp: string;
  razon_social: string | null;
  nit: string | null;
  reg_fiscal: string | null;
  dir_emp: string | null;
  tel_emp: string | null;
  tipo_costo: string;
  contador: string;
  activa: 'S' | 'N';
  porcentaje_pago_cuenta: number;
  total_usuarios?: number;
}

export interface CreateCompanyInput {
  nom_emp: string;
  razon_social?: string;
  nit?: string;
  reg_fiscal?: string;
  dir_emp?: string;
  tel_emp?: string;
  tipo_costo?: string;
  contador?: string;
  activa?: 'S' | 'N';
  porcentaje_pago_cuenta?: number;
  usuariosAsignados?: string[];
}

export interface UpdateCompanyInput {
  nom_emp?: string;
  razon_social?: string;
  nit?: string;
  reg_fiscal?: string;
  dir_emp?: string;
  tel_emp?: string;
  tipo_costo?: string;
  contador?: string;
  activa?: 'S' | 'N';
  porcentaje_pago_cuenta?: number;
}

export async function getAllCompanies(): Promise<EmpresaAdminDetail[]> {
  const [rows] = await pool.query(
    `SELECT 
       e.cod_emp,
       e.nom_emp,
       e.razon_social,
       e.nit,
       e.reg_fiscal,
       e.dir_emp,
       e.tel_emp,
       e.tipo_costo,
       e.contador,
       e.activa,
       COALESCE(e.porcentaje_pago_cuenta, 1.75) AS porcentaje_pago_cuenta,
       (SELECT COUNT(DISTINCT u.nom_usu) FROM usuarios u WHERE u.cod_emp = e.cod_emp) AS total_usuarios
     FROM empresas e
     ORDER BY e.cod_emp ASC`,
  );

  return (rows as any[]).map((r) => ({
    cod_emp: r.cod_emp,
    nom_emp: r.nom_emp ?? `Empresa ${r.cod_emp}`,
    razon_social: r.razon_social ?? null,
    nit: r.nit ?? null,
    reg_fiscal: r.reg_fiscal ?? null,
    dir_emp: r.dir_emp ?? null,
    tel_emp: r.tel_emp ?? null,
    tipo_costo: r.tipo_costo ?? '01',
    contador: r.contador ?? '',
    activa: r.activa === 'N' ? 'N' : 'S',
    porcentaje_pago_cuenta: Number(r.porcentaje_pago_cuenta ?? 1.75),
    total_usuarios: Number(r.total_usuarios || 0),
  }));
}

export async function getCompanyById(codEmp: number): Promise<EmpresaAdminDetail> {
  const [rows] = await pool.query(
    `SELECT 
       e.cod_emp,
       e.nom_emp,
       e.razon_social,
       e.nit,
       e.reg_fiscal,
       e.dir_emp,
       e.tel_emp,
       e.tipo_costo,
       e.contador,
       e.activa,
       COALESCE(e.porcentaje_pago_cuenta, 1.75) AS porcentaje_pago_cuenta,
       (SELECT COUNT(DISTINCT u.nom_usu) FROM usuarios u WHERE u.cod_emp = e.cod_emp) AS total_usuarios
     FROM empresas e
     WHERE e.cod_emp = ?
     LIMIT 1`,
    [codEmp],
  );

  const list = rows as any[];
  if (list.length === 0) {
    throw new ApiError(404, `No se encontró la empresa con código ${codEmp}`);
  }

  const r = list[0];
  return {
    cod_emp: r.cod_emp,
    nom_emp: r.nom_emp ?? `Empresa ${r.cod_emp}`,
    razon_social: r.razon_social ?? null,
    nit: r.nit ?? null,
    reg_fiscal: r.reg_fiscal ?? null,
    dir_emp: r.dir_emp ?? null,
    tel_emp: r.tel_emp ?? null,
    tipo_costo: r.tipo_costo ?? '01',
    contador: r.contador ?? '',
    activa: r.activa === 'N' ? 'N' : 'S',
    porcentaje_pago_cuenta: Number(r.porcentaje_pago_cuenta ?? 1.75),
    total_usuarios: Number(r.total_usuarios || 0),
  };
}

export async function createCompany(
  data: CreateCompanyInput,
  currentAuthUser?: string,
): Promise<{ ok: boolean; message: string; cod_emp: number }> {
  const cleanNomEmp = (data.nom_emp || '').trim();
  if (!cleanNomEmp) {
    throw new ApiError(400, 'El nombre comercial de la empresa es obligatorio');
  }

  const cleanRazonSocial = (data.razon_social || '').trim() || cleanNomEmp;
  const cleanNit = (data.nit || '').trim();
  const cleanRegFiscal = (data.reg_fiscal || '').trim();
  const cleanDir = (data.dir_emp || '').trim();
  const cleanTel = (data.tel_emp || '').trim();
  const cleanTipoCosto = (data.tipo_costo || '').trim() || '01';
  const cleanContador = (data.contador || '').trim();
  const activa = data.activa === 'N' ? 'N' : 'S';
  const porcentajePagoCuenta =
    typeof data.porcentaje_pago_cuenta === 'number' && data.porcentaje_pago_cuenta >= 0
      ? data.porcentaje_pago_cuenta
      : 1.75;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Insertar registro principal en empresas
    const [insertResult] = await conn.query(
      `INSERT INTO empresas (
         nom_emp, razon_social, nit, reg_fiscal, dir_emp, tel_emp,
         tipo_costo, contador, activa, porcentaje_pago_cuenta
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        cleanNomEmp,
        cleanRazonSocial,
        cleanNit,
        cleanRegFiscal,
        cleanDir,
        cleanTel,
        cleanTipoCosto,
        cleanContador,
        activa,
        porcentajePagoCuenta,
      ],
    );

    const newCodEmp = (insertResult as any).insertId;

    // 2. Asignar usuarios a la nueva empresa (ADMIN + usuario en sesión + seleccionados)
    const usersToAssign = new Set<string>();
    usersToAssign.add('ADMIN');
    if (currentAuthUser && currentAuthUser.trim()) {
      usersToAssign.add(currentAuthUser.trim().toUpperCase());
    }
    if (Array.isArray(data.usuariosAsignados)) {
      for (const u of data.usuariosAsignados) {
        if (u && u.trim()) usersToAssign.add(u.trim().toUpperCase());
      }
    }

    for (const nomUsu of usersToAssign) {
      const [baseRows] = await conn.query(
        'SELECT password_usu, desc_usu, cod_rol, cod_punto_venta FROM usuarios WHERE nom_usu = ? LIMIT 1',
        [nomUsu],
      );
      const list = baseRows as any[];
      if (list.length > 0) {
        const base = list[0];
        await conn.query(
          `INSERT INTO usuarios (nom_usu, password_usu, desc_usu, cod_emp, cod_rol, cod_punto_venta)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            nomUsu,
            base.password_usu,
            base.desc_usu,
            newCodEmp,
            base.cod_rol || '01',
            base.cod_punto_venta || '001',
          ],
        );
      }
    }

    // 3. Sembrar TIPOS DE CUENTA (9 registros estándar)
    const tiposCuenta = [
      ['01', 'A', 'CUENTAS DE ACTIVO'],
      ['02', 'P', 'CUENTAS DE PASIVO'],
      ['03', 'C', 'CUENTAS DE CAPITAL'],
      ['04', 'D', 'CUENTAS DEUDORAS'],
      ['05', 'H', 'CUENTAS ACREEDORAS'],
      ['06', 'L', 'CUENTAS LIQUIDADORAS'],
      ['07', 'O', 'CUENTAS DE CIERRE'],
      ['08', 'R', 'CTA DE ORDEN ACTIVO'],
      ['09', 'Q', 'CTA DE ORDEN PASIVO'],
    ];
    for (const [cod, letra, nom] of tiposCuenta) {
      await conn.query(
        'INSERT INTO tipo_cuenta (cod_tp_cta, letra_cta, nom_cta, cod_emp) VALUES (?, ?, ?, ?)',
        [cod, letra, nom, newCodEmp],
      );
    }

    // 4. Sembrar TIPOS DE PARTIDA (13 registros estándar)
    const tiposPartida = [
      ['01', 'INGRESOS', 'PARTIDAS CONTABLES'],
      ['02', 'EGRESOS', 'PARTIDAS CONTABLES'],
      ['03', 'DIARIO', 'PARTIDAS CONTABLES'],
      ['04', 'GASTOS', 'PARTIDAS CONTABLES'],
      ['05', 'DESEMBOLSOS', 'PARTIDAS CONTABLES'],
      ['06', 'DEPRESIACION', 'PARTIDAS CONTABLES'],
      ['07', 'ANTICIPOS DE PLANILLA', 'PARTIDAS CONTABLES'],
      ['08', 'PAGO DE PLANILLA', 'PARTIDAS CONTABLES'],
      ['09', 'AJUSTES', 'PARTIDAS CONTABLES'],
      ['10', 'CIERRE', 'PARTIDAS CONTABLES'],
      ['11', 'INICIO', 'PARTIDAS CONTABLES'],
      ['12', 'PARITDAS BANCARIAS', 'PARTIDAS BANCARIAS'],
      ['13', 'PARTIDAS DE REMESA', 'PARTIDAS REMESAS'],
    ];
    for (const [cod, nom, forma] of tiposPartida) {
      await conn.query(
        'INSERT INTO tipo_partida (cod_tp_partida, nom_tp_partida, forma, cod_emp, tipo) VALUES (?, ?, ?, ?, ?)',
        [cod, nom, forma, newCodEmp, 'M'],
      );
    }

    // 5. Sembrar TIPOS DE DOCUMENTO (12 registros estándar)
    const tiposDocumento = [
      ['CCF', 'FACTURA CREDITO FISCAL'],
      ['CEB', 'COMPROBANTE DE ENTREGA DE BODEGA'],
      ['CSB', 'COMPROBANDE DE SALIDA DE BODAGA'],
      ['CTZ', 'COTIZACION'],
      ['FAC', 'FACTURA CONSUMIDOR FINAL'],
      ['FEX', 'FACTURA DE EXPORTACION'],
      ['IMP', 'FACTURA DE IMPORTACION'],
      ['NCR', 'NOTA DE CREDITO'],
      ['NDB', 'NOTA DE DEBITO'],
      ['NDE', 'NOTA DE ENVIO'],
      ['NRM', 'NOTA DE REMISION'],
      ['ODC', 'ORDEN DE COMPRA'],
    ];
    for (const [id, descripcion] of tiposDocumento) {
      await conn.query(
        'INSERT INTO tipos_documentos (id, descripcion, cod_emp) VALUES (?, ?, ?)',
        [id, descripcion, newCodEmp],
      );
    }

    // 6. Sembrar TIPOS DE PAGO (2 registros estándar)
    const tiposPago = [
      ['01', 'CONTADO'],
      ['02', 'CREDITO'],
    ];
    for (const [id, descripcion] of tiposPago) {
      await conn.query(
        'INSERT INTO tipos_pago (id, descripcion, cod_emp) VALUES (?, ?, ?)',
        [id, descripcion, newCodEmp],
      );
    }

    await conn.commit();

    return {
      ok: true,
      message: `Empresa '${cleanNomEmp}' creada exitosamente con código #${newCodEmp} y configuraciones iniciales sembradas.`,
      cod_emp: newCodEmp,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function updateCompany(
  codEmp: number,
  data: UpdateCompanyInput,
): Promise<{ ok: boolean; message: string }> {
  const [existing] = await pool.query(
    'SELECT cod_emp, nom_emp FROM empresas WHERE cod_emp = ? LIMIT 1',
    [codEmp],
  );
  if ((existing as any[]).length === 0) {
    throw new ApiError(404, `No existe la empresa con código ${codEmp}`);
  }

  const cleanNomEmp = (data.nom_emp || '').trim();
  if (!cleanNomEmp) {
    throw new ApiError(400, 'El nombre comercial de la empresa es obligatorio');
  }

  const cleanRazonSocial = (data.razon_social || '').trim() || cleanNomEmp;
  const cleanNit = (data.nit || '').trim();
  const cleanRegFiscal = (data.reg_fiscal || '').trim();
  const cleanDir = (data.dir_emp || '').trim();
  const cleanTel = (data.tel_emp || '').trim();
  const cleanTipoCosto = (data.tipo_costo || '').trim() || '01';
  const cleanContador = (data.contador || '').trim();
  const activa = data.activa === 'N' ? 'N' : 'S';
  const porcentajePagoCuenta =
    typeof data.porcentaje_pago_cuenta === 'number' && data.porcentaje_pago_cuenta >= 0
      ? data.porcentaje_pago_cuenta
      : 1.75;

  await pool.query(
    `UPDATE empresas SET
       nom_emp = ?,
       razon_social = ?,
       nit = ?,
       reg_fiscal = ?,
       dir_emp = ?,
       tel_emp = ?,
       tipo_costo = ?,
       contador = ?,
       activa = ?,
       porcentaje_pago_cuenta = ?
     WHERE cod_emp = ?`,
    [
      cleanNomEmp,
      cleanRazonSocial,
      cleanNit,
      cleanRegFiscal,
      cleanDir,
      cleanTel,
      cleanTipoCosto,
      cleanContador,
      activa,
      porcentajePagoCuenta,
      codEmp,
    ],
  );

  return {
    ok: true,
    message: `Empresa '${cleanNomEmp}' actualizada exitosamente`,
  };
}

export async function deleteCompany(
  codEmp: number,
): Promise<{ ok: boolean; message: string; action: 'deleted' | 'deactivated' }> {
  const [existing] = await pool.query(
    'SELECT nom_emp FROM empresas WHERE cod_emp = ? LIMIT 1',
    [codEmp],
  );
  const list = existing as any[];
  if (list.length === 0) {
    throw new ApiError(404, `No existe la empresa con código ${codEmp}`);
  }
  const nomEmp = list[0].nom_emp;

  // Verificar si tiene transacciones registradas
  const [[{ count: cCompras }]] = (await pool.query(
    'SELECT COUNT(*) as count FROM compras_iva WHERE cod_emp = ?',
    [codEmp],
  )) as any;
  const [[{ count: cVentas }]] = (await pool.query(
    'SELECT COUNT(*) as count FROM ventas_iva WHERE cod_emp = ?',
    [codEmp],
  )) as any;
  const [[{ count: cPartidas }]] = (await pool.query(
    'SELECT COUNT(*) as count FROM cabecera_partida WHERE cod_emp = ?',
    [codEmp],
  )) as any;

  const totalMovimientos = Number(cCompras || 0) + Number(cVentas || 0) + Number(cPartidas || 0);

  if (totalMovimientos > 0) {
    // Desactivar lógicamente para preservar historial
    await pool.query("UPDATE empresas SET activa = 'N' WHERE cod_emp = ?", [codEmp]);
    return {
      ok: true,
      message: `La empresa '${nomEmp}' tiene ${totalMovimientos} movimientos registrados en libros o partidas. Ha sido desactivada para preservar la integridad histórica.`,
      action: 'deactivated',
    };
  }

  // Si no tiene movimientos, eliminar limpiamente
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query('DELETE FROM tipo_cuenta WHERE cod_emp = ?', [codEmp]);
    await conn.query('DELETE FROM tipo_partida WHERE cod_emp = ?', [codEmp]);
    await conn.query('DELETE FROM tipos_documentos WHERE cod_emp = ?', [codEmp]);
    await conn.query('DELETE FROM tipos_pago WHERE cod_emp = ?', [codEmp]);
    await conn.query('DELETE FROM usuarios WHERE cod_emp = ?', [codEmp]);
    await conn.query('DELETE FROM empresas WHERE cod_emp = ?', [codEmp]);

    await conn.commit();
    return {
      ok: true,
      message: `La empresa '${nomEmp}' y sus registros iniciales fueron eliminados exitosamente.`,
      action: 'deleted',
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
