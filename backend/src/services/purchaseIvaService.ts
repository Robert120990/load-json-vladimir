import { pool } from '../config/db';
import { ApiError } from '../middlewares/error';
import { obtenerLlave } from './dteService';
import type { PaginatedResult, PurchaseIva } from '../types/controlIva';

export interface ListPurchasesParams {
  search?: string;
  year?: number;
  month?: number;
  page?: number;
  limit?: number;
}

export async function listPurchases(
  codEmp: number,
  params: ListPurchasesParams,
): Promise<PaginatedResult<PurchaseIva>> {
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(params.limit) || 20));
  const offset = (page - 1) * limit;

  const conditions: string[] = ['c.cod_emp = ?'];
  const queryParams: unknown[] = [codEmp];

  if (params.year) {
    conditions.push('c.periodo_ano = ?');
    queryParams.push(Number(params.year));
  }

  if (params.month) {
    conditions.push('c.periodo_mes = ?');
    queryParams.push(Number(params.month));
  }

  if (params.search && params.search.trim()) {
    const term = `%${params.search.trim()}%`;
    conditions.push(
      '(c.documento LIKE ? OR c.num_control LIKE ? OR p.nom_proveedor LIKE ? OR p.registro LIKE ? OR p.nit_proveedor LIKE ?)',
    );
    queryParams.push(term, term, term, term, term);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const [countRows] = await pool.query(
    `SELECT COUNT(*) as total 
     FROM compras_iva c
     LEFT JOIN proveedores p ON c.cod_proveedor = p.cod_proveedor
     ${whereClause}`,
    queryParams,
  );
  const total = Number((countRows as Array<{ total: number }>)[0]?.total ?? 0);

  const dataQuery = `
    SELECT 
      c.cod_emp, c.llave, DATE_FORMAT(c.fecha, '%Y-%m-%d') as fecha,
      c.id_tipo_documento, c.documento, c.cod_proveedor,
      c.periodo_ano, c.periodo_mes,
      c.exentas_locales, c.exentas_importaciones, c.exentas_internaciones,
      c.gravadas_locales, c.gravadas_importaciones, c.gravadas_internaciones,
      c.no_sujetas, c.credito_fiscal, c.anticipo_a_cuenta,
      c.iva_retenido, c.retencion_a_terceros, c.compras_a_excluidos,
      c.rebajas_y_devoluciones, c.iva_rebajas_y_devoluciones,
      c.corr_maquina_registradora, c.iva_percibido,
      c.cod_sucursal, c.cod_punto_venta, c.num_control, c.sello_recepcion,
      p.nom_proveedor, p.registro as registro_proveedor, p.nit_proveedor,
      tdc.nombre as nom_tipo_documento
    FROM compras_iva c
    LEFT JOIN proveedores p ON c.cod_proveedor = p.cod_proveedor
    LEFT JOIN tipos_documento_compras tdc ON c.id_tipo_documento = tdc.id_tipo_documento
    ${whereClause}
    ORDER BY c.fecha DESC, c.llave DESC
    LIMIT ? OFFSET ?
  `;

  const [dataRows] = await pool.query(dataQuery, [...queryParams, limit, offset]);

  return {
    data: dataRows as PurchaseIva[],
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

export async function getPurchaseByLlave(llave: string, codEmp: number): Promise<PurchaseIva> {
  const [rows] = await pool.query(
    `SELECT 
      c.cod_emp, c.llave, DATE_FORMAT(c.fecha, '%Y-%m-%d') as fecha,
      c.id_tipo_documento, c.documento, c.cod_proveedor,
      c.periodo_ano, c.periodo_mes,
      c.exentas_locales, c.exentas_importaciones, c.exentas_internaciones,
      c.gravadas_locales, c.gravadas_importaciones, c.gravadas_internaciones,
      c.no_sujetas, c.credito_fiscal, c.anticipo_a_cuenta,
      c.iva_retenido, c.retencion_a_terceros, c.compras_a_excluidos,
      c.rebajas_y_devoluciones, c.iva_rebajas_y_devoluciones,
      c.corr_maquina_registradora, c.iva_percibido,
      c.cod_sucursal, c.cod_punto_venta, c.num_control, c.sello_recepcion,
      p.nom_proveedor, p.registro as registro_proveedor, p.nit_proveedor,
      tdc.nombre as nom_tipo_documento
    FROM compras_iva c
    LEFT JOIN proveedores p ON c.cod_proveedor = p.cod_proveedor
    LEFT JOIN tipos_documento_compras tdc ON c.id_tipo_documento = tdc.id_tipo_documento
    WHERE c.llave = ? AND c.cod_emp = ? LIMIT 1`,
    [llave, codEmp],
  );

  const purchase = (rows as PurchaseIva[])[0];
  if (!purchase) {
    throw new ApiError(404, `No se encontró la compra con llave ${llave}`);
  }
  return purchase;
}

export async function createPurchase(
  data: Partial<PurchaseIva>,
  codEmp: number,
): Promise<PurchaseIva> {
  const documento = (data.documento || '').trim();
  const codProveedor = (data.cod_proveedor || '').trim();
  const fecha = (data.fecha || '').trim();

  if (!documento) throw new ApiError(400, 'El número de documento o código de generación es obligatorio');
  if (!codProveedor) throw new ApiError(400, 'El proveedor es obligatorio');
  if (!fecha) throw new ApiError(400, 'La fecha de compra es obligatoria');

  // Parse year and month from fecha if not explicitly provided
  const dateObj = new Date(fecha);
  const periodoAno = data.periodo_ano || dateObj.getFullYear();
  const periodoMes = data.periodo_mes || (dateObj.getMonth() + 1);

  // Check duplicate in compras_iva
  const [existing] = await pool.query(
    'SELECT documento FROM compras_iva WHERE cod_emp = ? AND documento = ? LIMIT 1',
    [codEmp, documento],
  );
  if ((existing as unknown[]).length > 0) {
    throw new ApiError(400, `Ya existe un documento de compra con el número ${documento} para esta empresa`);
  }

  const llave = await obtenerLlave(codEmp);

  const gravadasLocales = Number(data.gravadas_locales) || 0;
  const creditoFiscal = data.credito_fiscal !== undefined ? Number(data.credito_fiscal) : Number((gravadasLocales * 0.13).toFixed(2));

  const insertCols = [
    'cod_emp', 'llave', 'fecha', 'id_tipo_documento', 'documento', 'cod_proveedor',
    'periodo_ano', 'periodo_mes', 'exentas_locales', 'exentas_importaciones', 'exentas_internaciones',
    'gravadas_locales', 'gravadas_importaciones', 'gravadas_internaciones',
    'no_sujetas', 'credito_fiscal', 'anticipo_a_cuenta', 'iva_retenido',
    'retencion_a_terceros', 'compras_a_excluidos', 'rebajas_y_devoluciones',
    'iva_rebajas_y_devoluciones', 'corr_maquina_registradora', 'iva_percibido',
    'cod_sucursal', 'cod_punto_venta', 'num_control', 'sello_recepcion',
  ];

  const insertVals = [
    codEmp,
    llave,
    fecha,
    data.id_tipo_documento || '02',
    documento,
    codProveedor,
    periodoAno,
    periodoMes,
    Number(data.exentas_locales) || 0,
    Number(data.exentas_importaciones) || 0,
    Number(data.exentas_internaciones) || 0,
    gravadasLocales,
    Number(data.gravadas_importaciones) || 0,
    Number(data.gravadas_internaciones) || 0,
    Number(data.no_sujetas) || 0,
    creditoFiscal,
    Number(data.anticipo_a_cuenta) || 0,
    Number(data.iva_retenido) || 0,
    Number(data.retencion_a_terceros) || 0,
    Number(data.compras_a_excluidos) || 0,
    Number(data.rebajas_y_devoluciones) || 0,
    Number(data.iva_rebajas_y_devoluciones) || 0,
    data.corr_maquina_registradora || '0',
    Number(data.iva_percibido) || 0,
    data.cod_sucursal || '01',
    data.cod_punto_venta || 'P',
    data.num_control || '',
    data.sello_recepcion || '',
  ];

  const placeholders = insertCols.map(() => '?').join(', ');
  await pool.query(
    `INSERT INTO compras_iva (${insertCols.join(', ')}) VALUES (${placeholders})`,
    insertVals,
  );

  return getPurchaseByLlave(llave, codEmp);
}

export async function updatePurchase(
  llave: string,
  data: Partial<PurchaseIva>,
  codEmp: number,
): Promise<PurchaseIva> {
  await getPurchaseByLlave(llave, codEmp); // verify existence

  const documento = (data.documento || '').trim();
  const codProveedor = (data.cod_proveedor || '').trim();
  const fecha = (data.fecha || '').trim();

  if (!documento) throw new ApiError(400, 'El número de documento es obligatorio');
  if (!codProveedor) throw new ApiError(400, 'El proveedor es obligatorio');
  if (!fecha) throw new ApiError(400, 'La fecha es obligatoria');

  const dateObj = new Date(fecha);
  const periodoAno = data.periodo_ano || dateObj.getFullYear();
  const periodoMes = data.periodo_mes || (dateObj.getMonth() + 1);

  const gravadasLocales = Number(data.gravadas_locales) || 0;
  const creditoFiscal = data.credito_fiscal !== undefined ? Number(data.credito_fiscal) : Number((gravadasLocales * 0.13).toFixed(2));

  const updateFields: string[] = [
    'fecha = ?',
    'id_tipo_documento = ?',
    'documento = ?',
    'cod_proveedor = ?',
    'periodo_ano = ?',
    'periodo_mes = ?',
    'exentas_locales = ?',
    'exentas_importaciones = ?',
    'exentas_internaciones = ?',
    'gravadas_locales = ?',
    'gravadas_importaciones = ?',
    'gravadas_internaciones = ?',
    'no_sujetas = ?',
    'credito_fiscal = ?',
    'anticipo_a_cuenta = ?',
    'iva_retenido = ?',
    'retencion_a_terceros = ?',
    'compras_a_excluidos = ?',
    'rebajas_y_devoluciones = ?',
    'iva_rebajas_y_devoluciones = ?',
    'iva_percibido = ?',
    'cod_sucursal = ?',
    'cod_punto_venta = ?',
    'num_control = ?',
    'sello_recepcion = ?',
  ];

  const updateVals = [
    fecha,
    data.id_tipo_documento || '02',
    documento,
    codProveedor,
    periodoAno,
    periodoMes,
    Number(data.exentas_locales) || 0,
    Number(data.exentas_importaciones) || 0,
    Number(data.exentas_internaciones) || 0,
    gravadasLocales,
    Number(data.gravadas_importaciones) || 0,
    Number(data.gravadas_internaciones) || 0,
    Number(data.no_sujetas) || 0,
    creditoFiscal,
    Number(data.anticipo_a_cuenta) || 0,
    Number(data.iva_retenido) || 0,
    Number(data.retencion_a_terceros) || 0,
    Number(data.compras_a_excluidos) || 0,
    Number(data.rebajas_y_devoluciones) || 0,
    Number(data.iva_rebajas_y_devoluciones) || 0,
    Number(data.iva_percibido) || 0,
    data.cod_sucursal || '01',
    data.cod_punto_venta || 'P',
    data.num_control || '',
    data.sello_recepcion || '',
    llave,
    codEmp,
  ];

  await pool.query(
    `UPDATE compras_iva SET ${updateFields.join(', ')} WHERE llave = ? AND cod_emp = ?`,
    updateVals,
  );

  return getPurchaseByLlave(llave, codEmp);
}

export async function deletePurchase(llave: string, codEmp: number): Promise<void> {
  await getPurchaseByLlave(llave, codEmp);
  await pool.query('DELETE FROM compras_iva WHERE llave = ? AND cod_emp = ?', [llave, codEmp]);
}
