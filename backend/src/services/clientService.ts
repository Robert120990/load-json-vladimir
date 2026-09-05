import { pool } from '../config/db';
import { ApiError } from '../middlewares/error';
import type { Client, PaginatedResult } from '../types/controlIva';

export interface ListClientsParams {
  search?: string;
  page?: number;
  limit?: number;
}

export async function listClients(params: ListClientsParams): Promise<PaginatedResult<Client>> {
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
        '(c.nom_cliente LIKE ? OR c.cod_cliente LIKE ? OR c.registro LIKE ? OR c.nit_cliente LIKE ? OR c.giro LIKE ?)',
      );
      queryParams.push(term, term, term, term, term);
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const [countRows] = await pool.query(
    `SELECT COUNT(*) as total FROM clientes c ${whereClause}`,
    queryParams,
  );
  const total = Number((countRows as Array<{ total: number }>)[0]?.total ?? 0);

  // Get paginated data
  const dataQuery = `
    SELECT 
      c.corr, c.cod_cliente, c.cod_emp, c.nom_cliente, c.dir_cliente,
      c.cod_dept, c.cod_muni, c.telefono, c.registro, c.nit_cliente,
      c.giro, c.exento, c.exterior, c.activo, c.tama, c.con_credito,
      c.limite_credito, c.excede_credito, c.con_retencion, c.con_percepcion,
      c.cuenta_cxc, c.cuenta_ac,
      d.nom_dept, m.nom_muni
    FROM clientes c
    LEFT JOIN departamentos d ON c.cod_dept = d.cod_dept
    LEFT JOIN municipios m ON c.cod_muni = m.cod_muni
    ${whereClause}
    ORDER BY c.nom_cliente ASC
    LIMIT ? OFFSET ?
  `;

  const [dataRows] = await pool.query(dataQuery, [...queryParams, limit, offset]);

  return {
    data: dataRows as Client[],
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

export async function getClientByCode(codCliente: string): Promise<Client> {
  const [rows] = await pool.query(
    `SELECT 
      c.corr, c.cod_cliente, c.cod_emp, c.nom_cliente, c.dir_cliente,
      c.cod_dept, c.cod_muni, c.telefono, c.registro, c.nit_cliente,
      c.giro, c.exento, c.exterior, c.activo, c.tama, c.con_credito,
      c.limite_credito, c.excede_credito, c.con_retencion, c.con_percepcion,
      c.cuenta_cxc, c.cuenta_ac,
      d.nom_dept, m.nom_muni
    FROM clientes c
    LEFT JOIN departamentos d ON c.cod_dept = d.cod_dept
    LEFT JOIN municipios m ON c.cod_muni = m.cod_muni
    WHERE c.cod_cliente = ? LIMIT 1`,
    [codCliente],
  );
  const client = (rows as Client[])[0];
  if (!client) {
    throw new ApiError(404, `No se encontró el cliente con código ${codCliente}`);
  }
  return client;
}

export async function createClient(data: Partial<Client>, codEmp: number | null): Promise<Client> {
  const codCliente = (data.cod_cliente || data.registro || '').trim().toUpperCase();
  const nomCliente = (data.nom_cliente || '').trim().toUpperCase();

  if (!codCliente) {
    throw new ApiError(400, 'El código o registro del cliente es obligatorio');
  }
  if (!nomCliente) {
    throw new ApiError(400, 'El nombre del cliente es obligatorio');
  }

  // Check duplicate
  const [existing] = await pool.query('SELECT cod_cliente FROM clientes WHERE cod_cliente = ? LIMIT 1', [
    codCliente,
  ]);
  if ((existing as unknown[]).length > 0) {
    throw new ApiError(400, `Ya existe un cliente con el código ${codCliente}`);
  }

  const insertCols = [
    'cod_cliente', 'cod_emp', 'nom_cliente', 'dir_cliente', 'cod_dept', 'cod_muni',
    'telefono', 'registro', 'nit_cliente', 'giro', 'exento', 'exterior',
    'activo', 'tama', 'con_credito', 'limite_credito', 'excede_credito',
    'con_retencion', 'con_percepcion', 'cuenta_cxc', 'cuenta_ac',
  ];

  const insertVals = [
    codCliente,
    codEmp ?? null,
    nomCliente,
    (data.dir_cliente || '').trim().toUpperCase(),
    data.cod_dept ?? 1,
    data.cod_muni ?? 1,
    (data.telefono || '').trim().toUpperCase(),
    (data.registro || '').trim().toUpperCase(),
    (data.nit_cliente || '').trim().toUpperCase(),
    (data.giro || '').trim().toUpperCase(),
    data.exento ? 1 : 0,
    data.exterior ? 1 : 0,
    data.activo ?? 1,
    (data.tama || 'MEDIANO').trim().toUpperCase(),
    data.con_credito ? 1 : 0,
    Number(data.limite_credito) || 0,
    data.excede_credito ? 1 : 0,
    data.con_retencion ? 1 : 0,
    data.con_percepcion ? 1 : 0,
    (data.cuenta_cxc || '').trim().toUpperCase(),
    (data.cuenta_ac || '').trim().toUpperCase(),
  ];

  const placeholders = insertCols.map(() => '?').join(', ');
  await pool.query(
    `INSERT INTO clientes (${insertCols.join(', ')}) VALUES (${placeholders})`,
    insertVals,
  );

  return getClientByCode(codCliente);
}

export async function updateClient(codCliente: string, data: Partial<Client>): Promise<Client> {
  await getClientByCode(codCliente); // verify existence

  const nomCliente = (data.nom_cliente || '').trim().toUpperCase();
  if (!nomCliente) {
    throw new ApiError(400, 'El nombre del cliente es obligatorio');
  }

  const updateFields: string[] = [
    'nom_cliente = ?',
    'dir_cliente = ?',
    'cod_dept = ?',
    'cod_muni = ?',
    'telefono = ?',
    'registro = ?',
    'nit_cliente = ?',
    'giro = ?',
    'exento = ?',
    'exterior = ?',
    'activo = ?',
    'tama = ?',
    'con_credito = ?',
    'limite_credito = ?',
    'excede_credito = ?',
    'con_retencion = ?',
    'con_percepcion = ?',
    'cuenta_cxc = ?',
    'cuenta_ac = ?',
  ];

  const updateVals = [
    nomCliente,
    (data.dir_cliente || '').trim().toUpperCase(),
    data.cod_dept ?? 1,
    data.cod_muni ?? 1,
    (data.telefono || '').trim().toUpperCase(),
    (data.registro || '').trim().toUpperCase(),
    (data.nit_cliente || '').trim().toUpperCase(),
    (data.giro || '').trim().toUpperCase(),
    data.exento ? 1 : 0,
    data.exterior ? 1 : 0,
    data.activo ?? 1,
    (data.tama || 'MEDIANO').trim().toUpperCase(),
    data.con_credito ? 1 : 0,
    Number(data.limite_credito) || 0,
    data.excede_credito ? 1 : 0,
    data.con_retencion ? 1 : 0,
    data.con_percepcion ? 1 : 0,
    (data.cuenta_cxc || '').trim().toUpperCase(),
    (data.cuenta_ac || '').trim().toUpperCase(),
    codCliente,
  ];

  await pool.query(`UPDATE clientes SET ${updateFields.join(', ')} WHERE cod_cliente = ?`, updateVals);

  return getClientByCode(codCliente);
}

export async function deleteClient(codCliente: string): Promise<void> {
  const client = await getClientByCode(codCliente);

  // Check references in ventas_iva
  const [sales] = await pool.query(
    'SELECT documento FROM ventas_iva WHERE cod_cliente = ? LIMIT 1',
    [codCliente],
  );
  if ((sales as unknown[]).length > 0) {
    throw new ApiError(
      400,
      `No se puede eliminar el cliente '${client.nom_cliente}' porque tiene ventas registradas en ventas_iva`,
    );
  }

  await pool.query('DELETE FROM clientes WHERE cod_cliente = ?', [codCliente]);
}
