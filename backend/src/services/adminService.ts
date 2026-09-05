import { pool } from '../config/db';
import { ApiError } from '../middlewares/error';

export interface AdminUserSummary {
  nom_usu: string;
  desc_usu: string | null;
  total_empresas: number;
  activas: number;
}

export interface CompanyAssignment {
  cod_emp: number;
  nom_emp: string;
  nit: string | null;
  reg_fiscal: string | null;
  assigned: boolean;
}

export async function getUsersList(): Promise<AdminUserSummary[]> {
  const [rows] = await pool.query(
    `SELECT
       u.nom_usu,
       COALESCE(MAX(NULLIF(TRIM(u.desc_usu), '')), u.nom_usu) AS desc_usu,
       COUNT(DISTINCT u.cod_emp) AS total_empresas,
       COUNT(DISTINCT CASE WHEN e.activa = 'S' THEN u.cod_emp END) AS activas
     FROM usuarios u
     LEFT JOIN empresas e ON e.cod_emp = u.cod_emp
     GROUP BY u.nom_usu
     ORDER BY u.nom_usu`,
  );

  return rows as AdminUserSummary[];
}

export async function getUserCompanies(nomUsu: string): Promise<CompanyAssignment[]> {
  const cleanNomUsu = nomUsu.trim();
  const [rows] = await pool.query(
    `SELECT
       e.cod_emp,
       e.nom_emp,
       e.nit,
       e.reg_fiscal,
       CASE WHEN u.cod_emp IS NOT NULL THEN 1 ELSE 0 END AS assigned
     FROM empresas e
     LEFT JOIN (
       SELECT DISTINCT cod_emp FROM usuarios WHERE nom_usu = ?
     ) u ON u.cod_emp = e.cod_emp
     WHERE e.activa = 'S'
     ORDER BY e.nom_emp`,
    [cleanNomUsu],
  );

  return (rows as any[]).map((r) => ({
    cod_emp: r.cod_emp,
    nom_emp: r.nom_emp ?? `Empresa ${r.cod_emp}`,
    nit: r.nit ?? null,
    reg_fiscal: r.reg_fiscal ?? null,
    assigned: Boolean(r.assigned),
  }));
}

export async function updateUserCompanies(
  nomUsu: string,
  codEmpresas: number[],
): Promise<{ ok: boolean; message: string; count: number }> {
  const cleanNomUsu = nomUsu.trim();
  const isAdmin = cleanNomUsu.toUpperCase() === 'ADMIN';

  if (!Array.isArray(codEmpresas)) {
    throw new ApiError(400, 'codEmpresas debe ser un arreglo de números');
  }

  // Prevenir que ADMIN se quede sin empresas asignadas
  if (isAdmin && codEmpresas.length === 0) {
    throw new ApiError(400, 'El usuario ADMIN debe tener al menos una empresa asignada');
  }

  // 1. Obtener fila base del usuario para copiar sus credenciales y datos
  const [baseRows] = await pool.query(
    'SELECT password_usu, desc_usu, cod_rol, cod_punto_venta FROM usuarios WHERE nom_usu = ? LIMIT 1',
    [cleanNomUsu],
  );
  const baselineList = baseRows as any[];
  if (baselineList.length === 0) {
    throw new ApiError(404, `El usuario ${cleanNomUsu} no existe`);
  }
  const baseline = baselineList[0];

  // 2. Obtener lista actual de empresas del usuario
  const [currentRows] = await pool.query(
    'SELECT DISTINCT cod_emp FROM usuarios WHERE nom_usu = ?',
    [cleanNomUsu],
  );
  const currentCompanies: number[] = (currentRows as any[])
    .map((r) => r.cod_emp)
    .filter((id) => typeof id === 'number');

  const uniqueRequested = Array.from(new Set(codEmpresas.map(Number))).filter(
    (id) => !Number.isNaN(id) && id > 0,
  );

  const toRemove = currentCompanies.filter((id) => !uniqueRequested.includes(id));
  const toAdd = uniqueRequested.filter((id) => !currentCompanies.includes(id));

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Eliminar las que fueron desmarcadas
    if (toRemove.length > 0) {
      await conn.query(
        'DELETE FROM usuarios WHERE nom_usu = ? AND cod_emp IN (?)',
        [cleanNomUsu, toRemove],
      );
    }

    // Insertar las nuevas empresas asignadas
    for (const codEmp of toAdd) {
      await conn.query(
        `INSERT INTO usuarios (nom_usu, password_usu, desc_usu, cod_emp, cod_rol, cod_punto_venta)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          cleanNomUsu,
          baseline.password_usu,
          baseline.desc_usu,
          codEmp,
          baseline.cod_rol || '01',
          baseline.cod_punto_venta || '001',
        ],
      );
    }

    await conn.commit();

    return {
      ok: true,
      message: `Se actualizaron las asignaciones de ${cleanNomUsu} exitosamente (${uniqueRequested.length} empresas asignadas)`,
      count: uniqueRequested.length,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
