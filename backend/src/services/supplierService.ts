import { pool } from '../config/db';
import { ApiError } from '../middlewares/error';
import type { PaginatedResult, Supplier } from '../types/controlIva';

export interface ListSuppliersParams {
  search?: string;
  page?: number;
  limit?: number;
}

export async function listSuppliers(params: ListSuppliersParams): Promise<PaginatedResult<Supplier>> {
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(params.limit) || 20));
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const queryParams: unknown[] = [];

  if (params.search && params.search.trim()) {
    const tokens = params.search.trim().split(/\s+/).filter(Boolean);
    for (const token of tokens) {
      const term = `%${token}%`;
      conditions.push(
        '(p.nom_proveedor LIKE ? OR p.cod_proveedor LIKE ? OR p.registro LIKE ? OR p.nit_proveedor LIKE ? OR p.giro LIKE ?)',
      );
      queryParams.push(term, term, term, term, term);
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const [countRows] = await pool.query(
    `SELECT COUNT(*) as total FROM proveedores p ${whereClause}`,
    queryParams,
  );
  const total = Number((countRows as Array<{ total: number }>)[0]?.total ?? 0);

  // Get paginated data
  const dataQuery = `
    SELECT 
      p.corr, p.cod_proveedor, p.cod_emp, p.nom_proveedor, p.dir_proveedor,
      p.cod_dept, p.cod_muni, p.telefono, p.registro, p.nit_proveedor,
      p.giro, p.exento, p.exterior, p.activo, p.tama, p.pais,
      p.cuenta_contable, p.nombre_cuenta, p.con_credito, p.excede_credito,
      p.limite_credito, p.con_retencion, p.con_percepcion,
      p.identificacion_excluidos, p.deducible,
      d.nom_dept, m.nom_muni
    FROM proveedores p
    LEFT JOIN departamentos d ON p.cod_dept = d.cod_dept
    LEFT JOIN municipios m ON p.cod_muni = m.cod_muni
    ${whereClause}
    ORDER BY p.nom_proveedor ASC
    LIMIT ? OFFSET ?
  `;

  const [dataRows] = await pool.query(dataQuery, [...queryParams, limit, offset]);

  return {
    data: dataRows as Supplier[],
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

export async function getSupplierByCode(codProveedor: string): Promise<Supplier> {
  const [rows] = await pool.query(
    `SELECT 
      p.corr, p.cod_proveedor, p.cod_emp, p.nom_proveedor, p.dir_proveedor,
      p.cod_dept, p.cod_muni, p.telefono, p.registro, p.nit_proveedor,
      p.giro, p.exento, p.exterior, p.activo, p.tama, p.pais,
      p.cuenta_contable, p.nombre_cuenta, p.con_credito, p.excede_credito,
      p.limite_credito, p.con_retencion, p.con_percepcion,
      p.identificacion_excluidos, p.deducible,
      d.nom_dept, m.nom_muni
    FROM proveedores p
    LEFT JOIN departamentos d ON p.cod_dept = d.cod_dept
    LEFT JOIN municipios m ON p.cod_muni = m.cod_muni
    WHERE p.cod_proveedor = ? LIMIT 1`,
    [codProveedor],
  );
  const supplier = (rows as Supplier[])[0];
  if (!supplier) {
    throw new ApiError(404, `No se encontró el proveedor con código ${codProveedor}`);
  }
  return supplier;
}

export async function createSupplier(data: Partial<Supplier>, codEmp: number | null): Promise<Supplier> {
  const codProveedor = (data.cod_proveedor || data.registro || '').trim().toUpperCase();
  const nomProveedor = (data.nom_proveedor || '').trim().toUpperCase();

  if (!codProveedor) {
    throw new ApiError(400, 'El código o registro del proveedor es obligatorio');
  }
  if (!nomProveedor) {
    throw new ApiError(400, 'El nombre del proveedor es obligatorio');
  }

  // Check duplicate
  const [existing] = await pool.query(
    'SELECT cod_proveedor FROM proveedores WHERE cod_proveedor = ? LIMIT 1',
    [codProveedor],
  );
  if ((existing as unknown[]).length > 0) {
    throw new ApiError(400, `Ya existe un proveedor con el código ${codProveedor}`);
  }

  const insertCols = [
    'cod_proveedor', 'cod_emp', 'nom_proveedor', 'dir_proveedor', 'cod_dept', 'cod_muni',
    'telefono', 'registro', 'nit_proveedor', 'giro', 'exento', 'exterior',
    'activo', 'tama', 'pais', 'cuenta_contable', 'nombre_cuenta',
    'con_credito', 'excede_credito', 'limite_credito', 'con_retencion',
    'con_percepcion', 'identificacion_excluidos', 'deducible',
  ];

  const insertVals = [
    codProveedor,
    codEmp ?? 1,
    nomProveedor,
    (data.dir_proveedor || '').trim().toUpperCase(),
    data.cod_dept ?? 1,
    data.cod_muni ?? 1,
    (data.telefono || '').trim().toUpperCase(),
    (data.registro || '').trim().toUpperCase(),
    (data.nit_proveedor || '').trim().toUpperCase(),
    (data.giro || '').trim().toUpperCase(),
    data.exento ? 1 : 0,
    data.exterior ? 1 : 0,
    data.activo ?? 1,
    (data.tama || 'MEDIANO').trim().toUpperCase(),
    (data.pais || 'EL SALVADOR').trim().toUpperCase(),
    (data.cuenta_contable || '').trim().toUpperCase(),
    (data.nombre_cuenta || '').trim().toUpperCase(),
    data.con_credito ? 1 : 0,
    data.excede_credito ? 1 : 0,
    Number(data.limite_credito) || 0,
    data.con_retencion ? 1 : 0,
    data.con_percepcion ? 1 : 0,
    (data.identificacion_excluidos || '').trim().toUpperCase(),
    Number(data.deducible) || 0,
  ];

  const placeholders = insertCols.map(() => '?').join(', ');
  await pool.query(
    `INSERT INTO proveedores (${insertCols.join(', ')}) VALUES (${placeholders})`,
    insertVals,
  );

  return getSupplierByCode(codProveedor);
}

export async function updateSupplier(codProveedor: string, data: Partial<Supplier>): Promise<Supplier> {
  await getSupplierByCode(codProveedor); // verify existence

  const nomProveedor = (data.nom_proveedor || '').trim().toUpperCase();
  if (!nomProveedor) {
    throw new ApiError(400, 'El nombre del proveedor es obligatorio');
  }

  const updateFields: string[] = [
    'nom_proveedor = ?',
    'dir_proveedor = ?',
    'cod_dept = ?',
    'cod_muni = ?',
    'telefono = ?',
    'registro = ?',
    'nit_proveedor = ?',
    'giro = ?',
    'exento = ?',
    'exterior = ?',
    'activo = ?',
    'tama = ?',
    'pais = ?',
    'cuenta_contable = ?',
    'nombre_cuenta = ?',
    'con_credito = ?',
    'excede_credito = ?',
    'limite_credito = ?',
    'con_retencion = ?',
    'con_percepcion = ?',
    'identificacion_excluidos = ?',
    'deducible = ?',
  ];

  const updateVals = [
    nomProveedor,
    (data.dir_proveedor || '').trim().toUpperCase(),
    data.cod_dept ?? 1,
    data.cod_muni ?? 1,
    (data.telefono || '').trim().toUpperCase(),
    (data.registro || '').trim().toUpperCase(),
    (data.nit_proveedor || '').trim().toUpperCase(),
    (data.giro || '').trim().toUpperCase(),
    data.exento ? 1 : 0,
    data.exterior ? 1 : 0,
    data.activo ?? 1,
    (data.tama || 'MEDIANO').trim().toUpperCase(),
    (data.pais || 'EL SALVADOR').trim().toUpperCase(),
    (data.cuenta_contable || '').trim().toUpperCase(),
    (data.nombre_cuenta || '').trim().toUpperCase(),
    data.con_credito ? 1 : 0,
    data.excede_credito ? 1 : 0,
    Number(data.limite_credito) || 0,
    data.con_retencion ? 1 : 0,
    data.con_percepcion ? 1 : 0,
    (data.identificacion_excluidos || '').trim().toUpperCase(),
    Number(data.deducible) || 0,
    codProveedor,
  ];

  await pool.query(
    `UPDATE proveedores SET ${updateFields.join(', ')} WHERE cod_proveedor = ?`,
    updateVals,
  );

  return getSupplierByCode(codProveedor);
}

export async function deleteSupplier(codProveedor: string): Promise<void> {
  const supplier = await getSupplierByCode(codProveedor);

  // Check references in compras_iva
  const [purchases] = await pool.query(
    'SELECT documento FROM compras_iva WHERE cod_proveedor = ? LIMIT 1',
    [codProveedor],
  );
  if ((purchases as unknown[]).length > 0) {
    throw new ApiError(
      400,
      `No se puede eliminar el proveedor '${supplier.nom_proveedor}' porque tiene compras registradas en compras_iva`,
    );
  }

  await pool.query('DELETE FROM proveedores WHERE cod_proveedor = ?', [codProveedor]);
}
