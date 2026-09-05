import { pool } from '../config/db';
import type {
  AccountingSignature,
  Department,
  DocumentType,
  Municipality,
} from '../types/controlIva';

function cleanCatalogText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/GUATAJIAG\?A/gi, 'GUATAJIAGUA')
    .replace(/MERCEDES UMA\?A/gi, 'MERCEDES UMAÑA')
    .replace(/CABA\?\?AS/gi, 'CABAÑAS')
    .replace(/CABA\?AS/gi, 'CABAÑAS');
}

export async function getDepartamentos(): Promise<Department[]> {
  const [rows] = await pool.query('SELECT cod_dept, nom_dept FROM departamentos ORDER BY cod_dept ASC');
  return (rows as Department[]).map((d) => ({
    ...d,
    nom_dept: cleanCatalogText(d.nom_dept),
  }));
}

export async function getMunicipios(codDept?: number): Promise<Municipality[]> {
  let query = 'SELECT cod_muni, nom_muni, cod_dep FROM municipios';
  const params: unknown[] = [];
  if (codDept) {
    query += ' WHERE cod_dep = ?';
    params.push(codDept);
  }
  query += ' ORDER BY cod_muni ASC';
  const [rows] = await pool.query(query, params);
  return (rows as Municipality[]).map((m) => ({
    ...m,
    nom_muni: cleanCatalogText(m.nom_muni),
  }));
}

export async function getTiposDocumentoCompras(): Promise<DocumentType[]> {
  const [rows] = await pool.query(
    'SELECT id_tipo_documento, nombre FROM tipos_documento_compras ORDER BY corr ASC',
  );
  return rows as DocumentType[];
}

export async function getTiposDocumentoVentas(): Promise<DocumentType[]> {
  const [rows] = await pool.query(
    'SELECT id_tipo_documento, nombre FROM tipos_documento_ventas ORDER BY corr ASC',
  );
  return rows as DocumentType[];
}

export async function getFirmasConta(codEmp: number): Promise<AccountingSignature[]> {
  const [rows] = await pool.query(
    'SELECT id_firma, nom_firma, puesto FROM firmas_conta WHERE cod_emp = ? ORDER BY id_firma ASC',
    [codEmp],
  );
  return rows as AccountingSignature[];
}

export async function getPeriodoCompras(codEmp: number): Promise<{ mes: number; anio: number } | null> {
  const [rows] = await pool.query(
    'SELECT mes, anio FROM periodo_compras WHERE cod_emp = ? LIMIT 1',
    [codEmp],
  );
  const fila = (rows as Array<{ mes: number; anio: number }>)[0];
  return fila ? { mes: fila.mes, anio: fila.anio } : null;
}

export async function setPeriodoCompras(
  codEmp: number,
  mes: number,
  anio: number,
): Promise<{ mes: number; anio: number }> {
  const [rows] = await pool.query('SELECT 1 FROM periodo_compras WHERE cod_emp = ? LIMIT 1', [codEmp]);
  if ((rows as unknown[]).length > 0) {
    await pool.query('UPDATE periodo_compras SET mes = ?, anio = ? WHERE cod_emp = ?', [mes, anio, codEmp]);
  } else {
    await pool.query('INSERT INTO periodo_compras (cod_emp, mes, anio) VALUES (?, ?, ?)', [codEmp, mes, anio]);
  }
  return { mes, anio };
}
