import jwt from 'jsonwebtoken';
import { pool } from '../config/db';
import { ApiError } from '../middlewares/error';
import type { UsuarioAutenticado, UsuarioRow } from '../types/entities';
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

interface TokenTemporalPayload {
  cod_usu: number;
  nom_usu: string;
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
  const [rows] = await pool.query(
    'SELECT cod_usu, nom_usu, desc_usu, password_usu, cod_emp FROM usuarios WHERE nom_usu = ? ORDER BY cod_usu',
    [nomUsu.trim()],
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

  const [empresasRows] = await pool.query(
    `SELECT cod_emp, nom_emp, nit, reg_fiscal FROM empresas
     WHERE activa = 'S' ORDER BY nom_emp`,
  );
  const empresas = empresasRows as EmpresaOpcion[];

  if (empresas.length === 0) {
    throw new ApiError(400, 'No hay empresas activas registradas');
  }

  const empresasPermitidas = empresas.map((empresa) => empresa.cod_emp);

  const tokenTemporalPayload: TokenTemporalPayload = {
    cod_usu: filaCoincidente.cod_usu,
    nom_usu: filaCoincidente.nom_usu,
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

  const token = jwt.sign(
    { cod_usu: payload.cod_usu, nom_usu: payload.nom_usu, cod_emp: codEmp },
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
    },
  };
}
