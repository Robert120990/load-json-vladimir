import { pool } from '../config/db';
import { ApiError } from '../middlewares/error';
import type { Empresa } from '../types/entities';

export async function getEmpresaPorCodEmp(codEmp: number): Promise<Empresa> {
  const [rows] = await pool.query(
    'SELECT cod_emp, nom_emp, nit, reg_fiscal FROM empresas WHERE cod_emp = ? LIMIT 1',
    [codEmp],
  );
  const empresa = (rows as Empresa[])[0];

  if (!empresa) {
    throw new ApiError(400, 'No se encontró la empresa asociada al usuario (cod_emp)');
  }
  return empresa;
}
