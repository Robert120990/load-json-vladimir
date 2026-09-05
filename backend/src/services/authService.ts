import jwt from 'jsonwebtoken';
import { pool } from '../config/db';
import { ApiError } from '../middlewares/error';
import type { Empresa, UsuarioAutenticado, UsuarioRow } from '../types/entities';
import { codificarPassword } from '../utils/codificar';

export interface EmpresaOpcion {
  cod_emp: number;
  nom_emp?: string | null;
  nit?: string | null;
  reg_fiscal?: string | null;
}

export interface LoginResultado {
  tokenTemporal: string;
  empresas: EmpresaOpcion[];
}

export interface SeleccionResultado {
  token: string;
  usuario: UsuarioAutenticado;
}

export interface SwitchCompanyResultado {
  token: string;
  usuario: UsuarioAutenticado;
  empresa: Empresa;
}

interface TokenTemporalPayload {
  cod_usu: number;
  nom_usu: string;
  isAdmin: boolean;
  empresasPermitidas: number[];
}

const DURACION_TEMPORAL = '5m';
const DURACION_SESION = '8h';

function obtenerSecreto(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new ApiError(500, 'JWT_SECRET no configurado en el backend');
  }
  return secret;
}

export async function login(nomUsu: string, password: string): Promise<LoginResultado> {
  const cleanNomUsu = nomUsu.trim();
  const [rows] = await pool.query(
    'SELECT cod_usu, nom_usu, desc_usu, password_usu, cod_emp FROM usuarios WHERE nom_usu = ? ORDER BY cod_usu',
    [cleanNomUsu],
  );
  const usuarios = rows as UsuarioRow[];

  const passwordCodificada = codificarPassword(password.trim());
  const passwordInversa = codificarPassword(password.trim(), 1);

  let filaCoincidente: UsuarioRow | undefined;

  for (const usuario of usuarios) {
    const coincide = usuario.password_usu === passwordCodificada
      || usuario.password_usu === passwordInversa;
    if (coincide) {
      filaCoincidente = usuario;
      break;
    }
  }

  if (!filaCoincidente) {
    throw new ApiError(401, 'Usuario o contraseña incorrectos');
  }

  const isAdmin = cleanNomUsu.toUpperCase() === 'ADMIN';

  let empresas: EmpresaOpcion[] = [];

  if (isAdmin) {
    // Para el usuario ADMIN, obtener empresas activas asignadas; si no tiene asignaciones específicas, consultar todas las activas
    const [assignedRows] = await pool.query(
      `SELECT DISTINCT e.cod_emp, e.nom_emp, e.nit, e.reg_fiscal
       FROM usuarios u
       JOIN empresas e ON e.cod_emp = u.cod_emp
       WHERE u.nom_usu = ? AND e.activa = 'S'
       ORDER BY e.nom_emp`,
      [cleanNomUsu],
    );
    empresas = assignedRows as EmpresaOpcion[];

    if (empresas.length === 0) {
      const [allRows] = await pool.query(
        `SELECT cod_emp, nom_emp, nit, reg_fiscal FROM empresas
         WHERE activa = 'S' ORDER BY nom_emp`,
      );
      empresas = allRows as EmpresaOpcion[];
    }
  } else {
    // Para usuarios regulares, consultar ÚNICAMENTE empresas activas asignadas al usuario
    const [assignedRows] = await pool.query(
      `SELECT DISTINCT e.cod_emp, e.nom_emp, e.nit, e.reg_fiscal
       FROM usuarios u
       JOIN empresas e ON e.cod_emp = u.cod_emp
       WHERE u.nom_usu = ? AND e.activa = 'S'
       ORDER BY e.nom_emp`,
      [cleanNomUsu],
    );
    empresas = assignedRows as EmpresaOpcion[];
  }

  if (empresas.length === 0) {
    if (isAdmin) {
      throw new ApiError(400, 'No hay empresas activas registradas en el sistema');
    }
    throw new ApiError(403, 'El usuario no tiene empresas activas asignadas. Contacte al administrador.');
  }

  const empresasPermitidas = empresas.map((empresa) => empresa.cod_emp);

  const tokenTemporalPayload: TokenTemporalPayload = {
    cod_usu: filaCoincidente.cod_usu,
    nom_usu: filaCoincidente.nom_usu,
    isAdmin,
    empresasPermitidas,
  };
  const tokenTemporal = jwt.sign(tokenTemporalPayload, obtenerSecreto(), {
    expiresIn: DURACION_TEMPORAL,
  });

  return { tokenTemporal, empresas };
}

export async function seleccionarEmpresa(
  tokenTemporal: string,
  codEmp: number,
): Promise<SeleccionResultado> {
  let payload: TokenTemporalPayload;
  try {
    payload = jwt.verify(tokenTemporal, obtenerSecreto()) as TokenTemporalPayload;
  } catch {
    throw new ApiError(401, 'La sesión temporal expiró, vuelve a ingresar');
  }

  if (!Array.isArray(payload.empresasPermitidas) || !payload.empresasPermitidas.includes(codEmp)) {
    throw new ApiError(403, 'No tienes acceso a esa empresa');
  }

  const [rows] = await pool.query(
    'SELECT cod_usu, nom_usu, desc_usu FROM usuarios WHERE cod_usu = ? LIMIT 1',
    [payload.cod_usu],
  );
  const usuarioFila = (rows as Array<{ cod_usu: number; nom_usu: string; desc_usu?: string | null }>)[0];
  const isAdmin = payload.isAdmin ?? (payload.nom_usu?.trim().toUpperCase() === 'ADMIN');

  const token = jwt.sign(
    { cod_usu: payload.cod_usu, nom_usu: payload.nom_usu, cod_emp: codEmp, isAdmin },
    obtenerSecreto(),
    { expiresIn: DURACION_SESION },
  );

  return {
    token,
    usuario: {
      cod_usu: payload.cod_usu,
      nom_usu: payload.nom_usu,
      desc_usu: usuarioFila?.desc_usu ?? null,
      cod_emp: codEmp,
      isAdmin,
    },
  };
}

export async function getMyCompanies(nomUsu: string): Promise<EmpresaOpcion[]> {
  const cleanNomUsu = nomUsu.trim();
  const isAdmin = cleanNomUsu.toUpperCase() === 'ADMIN';

  // Obtener exclusivamente empresas activas asignadas al usuario
  const [rows] = await pool.query(
    `SELECT DISTINCT e.cod_emp, e.nom_emp, e.nit, e.reg_fiscal
     FROM usuarios u
     JOIN empresas e ON e.cod_emp = u.cod_emp
     WHERE u.nom_usu = ? AND e.activa = 'S'
     ORDER BY e.nom_emp`,
    [cleanNomUsu],
  );
  let empresas = rows as EmpresaOpcion[];

  // Salvaguarda para ADMIN si no tiene registros individuales
  if (empresas.length === 0 && isAdmin) {
    const [allRows] = await pool.query(
      `SELECT cod_emp, nom_emp, nit, reg_fiscal FROM empresas
       WHERE activa = 'S' ORDER BY nom_emp`,
    );
    empresas = allRows as EmpresaOpcion[];
  }

  return empresas;
}

export async function switchCompany(
  nomUsu: string,
  currentCodUsu: number,
  newCodEmp: number,
): Promise<SwitchCompanyResultado> {
  const cleanNomUsu = nomUsu.trim();
  const isAdmin = cleanNomUsu.toUpperCase() === 'ADMIN';

  // 1. Validar que la empresa exista y esté activa
  const [empRows] = await pool.query(
    'SELECT cod_emp, nom_emp, nit, reg_fiscal, activa FROM empresas WHERE cod_emp = ? LIMIT 1',
    [newCodEmp],
  );
  const empresas = empRows as Array<Empresa & { activa: string }>;
  if (empresas.length === 0 || empresas[0].activa !== 'S') {
    throw new ApiError(400, 'La empresa seleccionada no existe o no se encuentra activa');
  }
  const empresa = empresas[0];

  // 2. Validar que el usuario tenga acceso asignado a esta empresa (a menos que sea ADMIN)
  if (!isAdmin) {
    const [accessRows] = await pool.query(
      'SELECT cod_usu FROM usuarios WHERE nom_usu = ? AND cod_emp = ? LIMIT 1',
      [cleanNomUsu, newCodEmp],
    );
    if ((accessRows as any[]).length === 0) {
      throw new ApiError(403, 'No tienes acceso a la empresa seleccionada');
    }
  }

  // 3. Obtener información del usuario
  const [userRows] = await pool.query(
    'SELECT cod_usu, nom_usu, desc_usu FROM usuarios WHERE nom_usu = ? LIMIT 1',
    [cleanNomUsu],
  );
  const usuarioInfo = (userRows as Array<{ cod_usu: number; nom_usu: string; desc_usu?: string | null }>)[0];

  // 4. Generar nuevo token de sesión con el nuevo cod_emp
  const token = jwt.sign(
    { cod_usu: currentCodUsu, nom_usu: cleanNomUsu, cod_emp: newCodEmp, isAdmin },
    obtenerSecreto(),
    { expiresIn: DURACION_SESION },
  );

  return {
    token,
    usuario: {
      cod_usu: currentCodUsu,
      nom_usu: cleanNomUsu,
      desc_usu: usuarioInfo?.desc_usu ?? null,
      cod_emp: newCodEmp,
      isAdmin,
    },
    empresa: {
      cod_emp: empresa.cod_emp,
      nom_emp: empresa.nom_emp,
      nit: empresa.nit,
      reg_fiscal: empresa.reg_fiscal,
    },
  };
}
