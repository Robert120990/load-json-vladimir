import { pool } from '../config/db';
import { ApiError } from '../middlewares/error';
import { codificarPassword } from '../utils/codificar';

export interface AdminUserSummary {
  nom_usu: string;
  desc_usu: string | null;
  cod_rol: string;
  cod_punto_venta: string;
  total_empresas: number;
  activas: number;
  empresas_ids: number[];
}

export interface CompanyAssignment {
  cod_emp: number;
  nom_emp: string;
  nit: string | null;
  reg_fiscal: string | null;
  assigned: boolean;
}

export interface CreateUserInput {
  nom_usu: string;
  desc_usu?: string;
  password: string;
  cod_rol?: string;
  cod_punto_venta?: string;
  codEmpresas?: number[];
}

export interface UpdateUserInput {
  desc_usu?: string;
  password?: string;
  cod_rol?: string;
  cod_punto_venta?: string;
  codEmpresas?: number[];
}

export async function getUsersList(): Promise<AdminUserSummary[]> {
  const [rows] = await pool.query(
    `SELECT
       u.nom_usu,
       COALESCE(MAX(NULLIF(TRIM(u.desc_usu), '')), u.nom_usu) AS desc_usu,
       COALESCE(MAX(NULLIF(TRIM(u.cod_rol), '')), '01') AS cod_rol,
       COALESCE(MAX(NULLIF(TRIM(u.cod_punto_venta), '')), '001') AS cod_punto_venta,
       COUNT(DISTINCT u.cod_emp) AS total_empresas,
       COUNT(DISTINCT CASE WHEN e.activa = 'S' THEN u.cod_emp END) AS activas,
       GROUP_CONCAT(DISTINCT u.cod_emp ORDER BY u.cod_emp SEPARATOR ',') AS empresas_concat
     FROM usuarios u
     LEFT JOIN empresas e ON e.cod_emp = u.cod_emp
     GROUP BY u.nom_usu
     ORDER BY u.nom_usu`,
  );

  return (rows as any[]).map((r) => ({
    nom_usu: r.nom_usu,
    desc_usu: r.desc_usu,
    cod_rol: r.cod_rol || '01',
    cod_punto_venta: r.cod_punto_venta || '001',
    total_empresas: Number(r.total_empresas || 0),
    activas: Number(r.activas || 0),
    empresas_ids: r.empresas_concat
      ? r.empresas_concat
          .split(',')
          .map((id: string) => Number(id.trim()))
          .filter((n: number) => !Number.isNaN(n))
      : [],
  }));
}

export async function getActiveCompanies(): Promise<CompanyAssignment[]> {
  const [rows] = await pool.query(
    `SELECT
       cod_emp,
       nom_emp,
       nit,
       reg_fiscal,
       1 AS assigned
     FROM empresas
     WHERE activa = 'S'
     ORDER BY nom_emp`,
  );

  return (rows as any[]).map((r) => ({
    cod_emp: r.cod_emp,
    nom_emp: r.nom_emp ?? `Empresa ${r.cod_emp}`,
    nit: r.nit ?? null,
    reg_fiscal: r.reg_fiscal ?? null,
    assigned: true,
  }));
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

export async function createUser(
  data: CreateUserInput,
): Promise<{ ok: boolean; message: string; nom_usu: string }> {
  const cleanNomUsu = (data.nom_usu || '').trim().toUpperCase();
  if (!cleanNomUsu) {
    throw new ApiError(400, 'El nombre de usuario es obligatorio');
  }
  if (cleanNomUsu.length > 20) {
    throw new ApiError(400, 'El nombre de usuario no puede exceder 20 caracteres');
  }

  const cleanPassword = (data.password || '').trim();
  if (!cleanPassword || cleanPassword.length < 3) {
    throw new ApiError(400, 'La contraseña es obligatoria (mínimo 3 caracteres)');
  }

  const [existing] = await pool.query(
    'SELECT cod_usu FROM usuarios WHERE nom_usu = ? LIMIT 1',
    [cleanNomUsu],
  );
  if ((existing as any[]).length > 0) {
    throw new ApiError(409, `El usuario '${cleanNomUsu}' ya existe en el sistema`);
  }

  const encodedPassword = codificarPassword(cleanPassword, 0);
  const descUsu = (data.desc_usu || '').trim() || cleanNomUsu;
  const codRol = (data.cod_rol || '').trim() || '01';
  const codPuntoVenta = (data.cod_punto_venta || '').trim() || '001';

  let empresas = Array.isArray(data.codEmpresas)
    ? Array.from(new Set(data.codEmpresas.map(Number))).filter((id) => !Number.isNaN(id) && id > 0)
    : [];

  if (empresas.length === 0) {
    const [firstEmp] = await pool.query(
      "SELECT cod_emp FROM empresas WHERE activa = 'S' ORDER BY cod_emp LIMIT 1",
    );
    if ((firstEmp as any[]).length > 0) {
      empresas = [(firstEmp as any[])[0].cod_emp];
    } else {
      empresas = [1];
    }
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const codEmp of empresas) {
      await conn.query(
        `INSERT INTO usuarios (nom_usu, password_usu, desc_usu, cod_emp, cod_rol, cod_punto_venta)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [cleanNomUsu, encodedPassword, descUsu, codEmp, codRol, codPuntoVenta],
      );
    }
    await conn.commit();
    return {
      ok: true,
      message: `Usuario '${cleanNomUsu}' creado exitosamente con ${empresas.length} empresa(s) asignada(s)`,
      nom_usu: cleanNomUsu,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function updateUser(
  nomUsu: string,
  data: UpdateUserInput,
): Promise<{ ok: boolean; message: string }> {
  const cleanNomUsu = nomUsu.trim();
  const [existing] = await pool.query(
    'SELECT password_usu, desc_usu, cod_rol, cod_punto_venta FROM usuarios WHERE nom_usu = ? LIMIT 1',
    [cleanNomUsu],
  );
  const baselineList = existing as any[];
  if (baselineList.length === 0) {
    throw new ApiError(404, `El usuario '${cleanNomUsu}' no existe`);
  }
  const baseline = baselineList[0];

  const descUsu = data.desc_usu !== undefined ? data.desc_usu.trim() : baseline.desc_usu;
  const codRol = data.cod_rol !== undefined ? data.cod_rol.trim() : baseline.cod_rol;
  const codPuntoVenta =
    data.cod_punto_venta !== undefined ? data.cod_punto_venta.trim() : baseline.cod_punto_venta;

  let passwordToSet = baseline.password_usu;
  if (data.password && data.password.trim().length > 0) {
    if (data.password.trim().length < 3) {
      throw new ApiError(400, 'La nueva contraseña debe tener al menos 3 caracteres');
    }
    passwordToSet = codificarPassword(data.password.trim(), 0);
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Actualizar datos en todas las filas del usuario
    await conn.query(
      `UPDATE usuarios 
       SET desc_usu = ?, password_usu = ?, cod_rol = ?, cod_punto_venta = ?
       WHERE nom_usu = ?`,
      [descUsu, passwordToSet, codRol, codPuntoVenta, cleanNomUsu],
    );

    // Si se enviaron empresas, sincronizar
    if (Array.isArray(data.codEmpresas)) {
      const isAdmin = cleanNomUsu.toUpperCase() === 'ADMIN';
      const uniqueRequested = Array.from(new Set(data.codEmpresas.map(Number))).filter(
        (id) => !Number.isNaN(id) && id > 0,
      );

      if (isAdmin && uniqueRequested.length === 0) {
        throw new ApiError(400, 'El usuario ADMIN debe tener al menos una empresa asignada');
      }

      const [currentRows] = await conn.query(
        'SELECT DISTINCT cod_emp FROM usuarios WHERE nom_usu = ?',
        [cleanNomUsu],
      );
      const currentCompanies: number[] = (currentRows as any[])
        .map((r) => r.cod_emp)
        .filter((id) => typeof id === 'number');

      const toRemove = currentCompanies.filter((id) => !uniqueRequested.includes(id));
      const toAdd = uniqueRequested.filter((id) => !currentCompanies.includes(id));

      if (toRemove.length > 0) {
        await conn.query(
          'DELETE FROM usuarios WHERE nom_usu = ? AND cod_emp IN (?)',
          [cleanNomUsu, toRemove],
        );
      }

      for (const codEmp of toAdd) {
        await conn.query(
          `INSERT INTO usuarios (nom_usu, password_usu, desc_usu, cod_emp, cod_rol, cod_punto_venta)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [cleanNomUsu, passwordToSet, descUsu, codEmp, codRol, codPuntoVenta],
        );
      }
    }

    await conn.commit();
    return {
      ok: true,
      message: `Usuario '${cleanNomUsu}' actualizado exitosamente`,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function deleteUser(
  nomUsu: string,
  currentAuthUser?: string,
): Promise<{ ok: boolean; message: string }> {
  const cleanNomUsu = nomUsu.trim();
  if (cleanNomUsu.toUpperCase() === 'ADMIN') {
    throw new ApiError(400, 'No es posible eliminar el usuario administrador principal (ADMIN)');
  }

  if (currentAuthUser && currentAuthUser.trim().toUpperCase() === cleanNomUsu.toUpperCase()) {
    throw new ApiError(400, 'No puedes eliminar tu propio usuario mientras tienes la sesión activa');
  }

  const [existing] = await pool.query(
    'SELECT cod_usu FROM usuarios WHERE nom_usu = ? LIMIT 1',
    [cleanNomUsu],
  );
  if ((existing as any[]).length === 0) {
    throw new ApiError(404, `El usuario '${cleanNomUsu}' no existe`);
  }

  await pool.query('DELETE FROM usuarios WHERE nom_usu = ?', [cleanNomUsu]);

  return {
    ok: true,
    message: `Usuario '${cleanNomUsu}' eliminado exitosamente`,
  };
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
