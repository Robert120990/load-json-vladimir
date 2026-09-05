import { pool } from '../config/db';
import { ApiError } from '../middlewares/error';
import { obtenerLlave, obtenerClienteGenerico } from './dteService';
import type { PaginatedResult, SaleIva } from '../types/controlIva';

export interface ListSalesParams {
  search?: string;
  year?: number;
  month?: number;
  id_tipo_documento?: string;
  page?: number;
  limit?: number;
}

export async function listSales(
  codEmp: number,
  params: ListSalesParams,
): Promise<PaginatedResult<SaleIva>> {
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(params.limit) || 20));
  const offset = (page - 1) * limit;

  const conditions: string[] = ['v.cod_emp = ?'];
  const queryParams: unknown[] = [codEmp];

  if (params.year) {
    conditions.push('YEAR(v.fecha) = ?');
    queryParams.push(Number(params.year));
  }

  if (params.month) {
    conditions.push('MONTH(v.fecha) = ?');
    queryParams.push(Number(params.month));
  }

  if (params.id_tipo_documento) {
    conditions.push('v.id_tipo_documento = ?');
    queryParams.push(params.id_tipo_documento);
  }

  if (params.search && params.search.trim()) {
    const term = `%${params.search.trim()}%`;
    conditions.push(
      '(v.documento LIKE ? OR v.num_control LIKE ? OR c.nom_cliente LIKE ? OR c.registro LIKE ? OR c.nit_cliente LIKE ?)',
    );
    queryParams.push(term, term, term, term, term);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const [countRows] = await pool.query(
    `SELECT COUNT(*) as total 
     FROM ventas_iva v
     LEFT JOIN clientes c ON v.cod_cliente = c.cod_cliente
     ${whereClause}`,
    queryParams,
  );
  const total = Number((countRows as Array<{ total: number }>)[0]?.total ?? 0);

  const dataQuery = `
    SELECT 
      v.cod_emp, v.llave, DATE_FORMAT(v.fecha, '%Y-%m-%d') as fecha,
      v.id_tipo_documento, v.documento, v.cod_cliente,
      v.gravadas_locales, v.gravadas_exportacion, v.ventas_exentas,
      v.ventas_no_sujetas, v.cuentas_a_terceros, v.rebajas_y_devoluciones,
      v.iva_retenido, v.iva_percibido, v.debito_fiscal,
      v.debito_fiscal_a_terceros, v.corr_maquina_registradora,
      v.serie, v.formulario_unico, v.id_sucursal, v.anulada,
      v.es_rebajas_fac, v.num_control,
      c.nom_cliente, c.registro as registro_cliente, c.nit_cliente,
      tdv.nombre as nom_tipo_documento
    FROM ventas_iva v
    LEFT JOIN clientes c ON v.cod_cliente = c.cod_cliente
    LEFT JOIN tipos_documento_ventas tdv ON v.id_tipo_documento = tdv.id_tipo_documento
    ${whereClause}
    ORDER BY v.fecha DESC, v.llave DESC
    LIMIT ? OFFSET ?
  `;

  const [dataRows] = await pool.query(dataQuery, [...queryParams, limit, offset]);

  return {
    data: dataRows as SaleIva[],
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

export async function getSaleByLlave(llave: string, codEmp: number): Promise<SaleIva> {
  const [rows] = await pool.query(
    `SELECT 
      v.cod_emp, v.llave, DATE_FORMAT(v.fecha, '%Y-%m-%d') as fecha,
      v.id_tipo_documento, v.documento, v.cod_cliente,
      v.gravadas_locales, v.gravadas_exportacion, v.ventas_exentas,
      v.ventas_no_sujetas, v.cuentas_a_terceros, v.rebajas_y_devoluciones,
      v.iva_retenido, v.iva_percibido, v.debito_fiscal,
      v.debito_fiscal_a_terceros, v.corr_maquina_registradora,
      v.serie, v.formulario_unico, v.id_sucursal, v.anulada,
      v.es_rebajas_fac, v.num_control,
      c.nom_cliente, c.registro as registro_cliente, c.nit_cliente,
      tdv.nombre as nom_tipo_documento
    FROM ventas_iva v
    LEFT JOIN clientes c ON v.cod_cliente = c.cod_cliente
    LEFT JOIN tipos_documento_ventas tdv ON v.id_tipo_documento = tdv.id_tipo_documento
    WHERE v.llave = ? AND v.cod_emp = ? LIMIT 1`,
    [llave, codEmp],
  );

  const sale = (rows as SaleIva[])[0];
  if (!sale) {
    throw new ApiError(404, `No se encontró la venta con llave ${llave}`);
  }
  return sale;
}

export async function createSale(data: Partial<SaleIva>, codEmp: number): Promise<SaleIva> {
  const documento = (data.documento || '').trim();
  const codCliente = (data.cod_cliente || '').trim();
  const fecha = (data.fecha || '').trim();

  if (!documento) throw new ApiError(400, 'El número de documento o código de generación es obligatorio');
  if (!codCliente) throw new ApiError(400, 'El cliente es obligatorio');
  if (!fecha) throw new ApiError(400, 'La fecha de venta es obligatoria');

  // Check duplicate in ventas_iva
  const [existing] = await pool.query(
    'SELECT documento FROM ventas_iva WHERE cod_emp = ? AND documento = ? LIMIT 1',
    [codEmp, documento],
  );
  if ((existing as unknown[]).length > 0) {
    throw new ApiError(400, `Ya existe un documento de venta con el número ${documento} para esta empresa`);
  }

  const llave = await obtenerLlave(codEmp);

  const gravadasLocales = Number(data.gravadas_locales) || 0;
  // If debito fiscal is not passed, for Credito Fiscal ('03') or others calculate standard 13%
  const debitoFiscal = data.debito_fiscal !== undefined ? Number(data.debito_fiscal) : Number((gravadasLocales * 0.13).toFixed(2));

  const insertCols = [
    'cod_emp', 'llave', 'fecha', 'id_tipo_documento', 'documento', 'cod_cliente',
    'gravadas_locales', 'gravadas_exportacion', 'ventas_exentas', 'ventas_no_sujetas',
    'cuentas_a_terceros', 'rebajas_y_devoluciones', 'iva_retenido', 'iva_percibido',
    'debito_fiscal', 'debito_fiscal_a_terceros', 'corr_maquina_registradora',
    'serie', 'formulario_unico', 'id_sucursal', 'anulada', 'es_rebajas_fac', 'num_control',
  ];

  const insertVals = [
    codEmp,
    llave,
    fecha,
    data.id_tipo_documento || '03',
    documento,
    codCliente,
    gravadasLocales,
    Number(data.gravadas_exportacion) || 0,
    Number(data.ventas_exentas) || 0,
    Number(data.ventas_no_sujetas) || 0,
    Number(data.cuentas_a_terceros) || 0,
    Number(data.rebajas_y_devoluciones) || 0,
    Number(data.iva_retenido) || 0,
    Number(data.iva_percibido) || 0,
    debitoFiscal,
    Number(data.debito_fiscal_a_terceros) || 0,
    data.corr_maquina_registradora || '',
    data.serie || '',
    data.formulario_unico || '',
    data.id_sucursal || '01',
    data.anulada ? 1 : 0,
    data.es_rebajas_fac ? 1 : 0,
    data.num_control || '',
  ];

  const placeholders = insertCols.map(() => '?').join(', ');
  await pool.query(
    `INSERT INTO ventas_iva (${insertCols.join(', ')}) VALUES (${placeholders})`,
    insertVals,
  );

  return getSaleByLlave(llave, codEmp);
}

export async function updateSale(
  llave: string,
  data: Partial<SaleIva>,
  codEmp: number,
): Promise<SaleIva> {
  await getSaleByLlave(llave, codEmp); // verify existence

  const documento = (data.documento || '').trim();
  const codCliente = (data.cod_cliente || '').trim();
  const fecha = (data.fecha || '').trim();

  if (!documento) throw new ApiError(400, 'El número de documento es obligatorio');
  if (!codCliente) throw new ApiError(400, 'El cliente es obligatorio');
  if (!fecha) throw new ApiError(400, 'La fecha es obligatoria');

  const gravadasLocales = Number(data.gravadas_locales) || 0;
  const debitoFiscal = data.debito_fiscal !== undefined ? Number(data.debito_fiscal) : Number((gravadasLocales * 0.13).toFixed(2));

  const updateFields: string[] = [
    'fecha = ?',
    'id_tipo_documento = ?',
    'documento = ?',
    'cod_cliente = ?',
    'gravadas_locales = ?',
    'gravadas_exportacion = ?',
    'ventas_exentas = ?',
    'ventas_no_sujetas = ?',
    'cuentas_a_terceros = ?',
    'rebajas_y_devoluciones = ?',
    'iva_retenido = ?',
    'iva_percibido = ?',
    'debito_fiscal = ?',
    'debito_fiscal_a_terceros = ?',
    'serie = ?',
    'id_sucursal = ?',
    'anulada = ?',
    'es_rebajas_fac = ?',
    'num_control = ?',
  ];

  const updateVals = [
    fecha,
    data.id_tipo_documento || '03',
    documento,
    codCliente,
    gravadasLocales,
    Number(data.gravadas_exportacion) || 0,
    Number(data.ventas_exentas) || 0,
    Number(data.ventas_no_sujetas) || 0,
    Number(data.cuentas_a_terceros) || 0,
    Number(data.rebajas_y_devoluciones) || 0,
    Number(data.iva_retenido) || 0,
    Number(data.iva_percibido) || 0,
    debitoFiscal,
    Number(data.debito_fiscal_a_terceros) || 0,
    data.serie || '',
    data.id_sucursal || '01',
    data.anulada ? 1 : 0,
    data.es_rebajas_fac ? 1 : 0,
    data.num_control || '',
    llave,
    codEmp,
  ];

  await pool.query(
    `UPDATE ventas_iva SET ${updateFields.join(', ')} WHERE llave = ? AND cod_emp = ?`,
    updateVals,
  );

  return getSaleByLlave(llave, codEmp);
}

export async function deleteSale(llave: string, codEmp: number): Promise<void> {
  await getSaleByLlave(llave, codEmp);
  await pool.query('DELETE FROM ventas_iva WHERE llave = ? AND cod_emp = ?', [llave, codEmp]);
}

export interface QuickConsumerItem {
  codigoGeneracion: string;
  numeroControl?: string;
  selloRecepcion?: string;
  monto: number;
}

export interface BatchConsumidorFinalParams {
  fecha: string;
  items: QuickConsumerItem[];
}

export interface BatchConsumidorFinalResult {
  totalGuardados: number;
  duplicadosOmitidos: number;
}

export async function createBatchConsumidorFinal(
  codEmp: number,
  params: BatchConsumidorFinalParams,
): Promise<BatchConsumidorFinalResult> {
  const fecha = (params.fecha || '').trim();
  if (!fecha) {
    throw new ApiError(400, 'La fecha es obligatoria para el lote de consumidores finales');
  }

  const items = params.items || [];
  if (items.length === 0) {
    throw new ApiError(400, 'Debe incluir al menos un documento en el lote');
  }

  // 1. Obtener cliente genérico de consumidor final
  let codCliente = await obtenerClienteGenerico();
  if (!codCliente) {
    const [cRows] = await pool.query(
      "SELECT cod_cliente FROM clientes WHERE cod_cliente = '00000' LIMIT 1",
    );
    const existing = (cRows as Array<{ cod_cliente: string }>)[0];
    if (existing) {
      codCliente = existing.cod_cliente;
    } else {
      const [anyRows] = await pool.query(
        'SELECT cod_cliente FROM clientes LIMIT 1',
      );
      const anyCli = (anyRows as Array<{ cod_cliente: string }>)[0];
      if (anyCli) {
        codCliente = anyCli.cod_cliente;
      } else {
        throw new ApiError(400, 'No se encontró un cliente registrado para Consumidor Final');
      }
    }
  }

  const connection = await pool.getConnection();
  let guardados = 0;
  let duplicados = 0;

  try {
    await connection.beginTransaction();

    const insertCols = [
      'cod_emp', 'llave', 'fecha', 'id_tipo_documento', 'documento', 'cod_cliente',
      'gravadas_locales', 'gravadas_exportacion', 'ventas_exentas', 'ventas_no_sujetas',
      'cuentas_a_terceros', 'rebajas_y_devoluciones', 'iva_retenido', 'iva_percibido',
      'debito_fiscal', 'debito_fiscal_a_terceros', 'corr_maquina_registradora',
      'serie', 'formulario_unico', 'id_sucursal', 'anulada', 'es_rebajas_fac', 'num_control',
    ];
    const placeholders = insertCols.map(() => '?').join(', ');

    for (const item of items) {
      const doc = (item.codigoGeneracion || '').trim().toUpperCase();
      const numCtrl = (item.numeroControl || '').trim().toUpperCase();
      const sello = (item.selloRecepcion || '').trim();
      const monto = Number(item.monto) || 0;

      if (!doc) continue;

      // Verificar duplicado en la empresa
      const [dup] = await connection.query(
        'SELECT documento FROM ventas_iva WHERE cod_emp = ? AND documento = ? LIMIT 1',
        [codEmp, doc],
      );
      if ((dup as unknown[]).length > 0) {
        duplicados++;
        continue;
      }

      const llave = await obtenerLlave(codEmp);

      const vals = [
        codEmp,
        llave,
        fecha,
        '01', // Factura / Consumidor Final
        doc,
        codCliente,
        monto, // gravadas_locales = monto total
        0, // gravadas_exportacion
        0, // ventas_exentas
        0, // ventas_no_sujetas
        0, // cuentas_a_terceros
        0, // rebajas_y_devoluciones
        0, // iva_retenido
        0, // iva_percibido
        0, // debito_fiscal (para '01' se calcula en reporte y dashboard como gravadas_locales - gravadas_locales/1.13)
        0, // debito_fiscal_a_terceros
        '', // corr_maquina_registradora
        sello, // serie / sello recepción
        '', // formulario_unico
        '01', // id_sucursal
        0, // anulada
        0, // es_rebajas_fac
        numCtrl, // num_control
      ];

      await connection.query(
        `INSERT INTO ventas_iva (${insertCols.join(', ')}) VALUES (${placeholders})`,
        vals,
      );
      guardados++;
    }

    await connection.commit();

    return {
      totalGuardados: guardados,
      duplicadosOmitidos: duplicados,
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}
