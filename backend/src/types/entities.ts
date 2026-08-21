export interface UsuarioRow {
  cod_usu: number;
  nom_usu: string;
  password_usu: string;
  desc_usu?: string | null;
  cod_emp: number | null;
  cod_rol?: string;
  cod_punto_venta?: string;
}

export interface UsuarioAutenticado {
  cod_usu: number;
  nom_usu: string;
  desc_usu?: string | null;
  cod_emp: number | null;
}

export interface Empresa {
  cod_emp: number;
  nom_emp?: string | null;
  nit?: string | null;
  reg_fiscal?: string | null;
}

export type FilaVenta = Array<string | number | null>;
export type FilaCompra = Array<string | number | null>;
