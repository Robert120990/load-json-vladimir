export type TipoDte = 'ventas' | 'compras';

export interface PeriodoCompras {
  mes: number;
  anio: number;
}

export interface Usuario {
  cod_usu: number;
  nom_usu: string;
  desc_usu?: string | null;
  cod_emp?: number | null;
  isAdmin?: boolean;
}

export interface LoginResponse {
  tokenTemporal: string;
  empresas: EmpresaOpcion[];
}

export interface Empresa {
  cod_emp: number;
  nom_emp?: string | null;
  nit?: string | null;
  reg_fiscal?: string | null;
}

export interface EmpresaOpcion {
  cod_emp: number;
  nom_emp?: string | null;
  nit?: string | null;
  reg_fiscal?: string | null;
}

export interface SeleccionEmpresaResponse {
  token: string;
  usuario: Usuario;
  empresa?: Empresa;
}

export interface AdminUserSummary {
  nom_usu: string;
  desc_usu: string | null;
  cod_rol?: string;
  cod_punto_venta?: string;
  total_empresas: number;
  activas: number;
  empresas_ids?: number[];
}

export interface CreateUserPayload {
  nom_usu: string;
  desc_usu?: string;
  password: string;
  cod_rol?: string;
  cod_punto_venta?: string;
  codEmpresas?: number[];
}

export interface UpdateUserPayload {
  desc_usu?: string;
  password?: string;
  cod_rol?: string;
  cod_punto_venta?: string;
  codEmpresas?: number[];
}

export interface CompanyAssignment {
  cod_emp: number;
  nom_emp: string;
  nit: string | null;
  reg_fiscal: string | null;
  assigned: boolean;
}

export interface EmpresaAdminDetail {
  cod_emp: number;
  nom_emp: string;
  razon_social: string | null;
  nit: string | null;
  reg_fiscal: string | null;
  dir_emp: string | null;
  tel_emp: string | null;
  tipo_costo: string;
  contador: string;
  activa: 'S' | 'N';
  porcentaje_pago_cuenta: number;
  total_usuarios?: number;
}

export interface CreateEmpresaPayload {
  nom_emp: string;
  razon_social?: string;
  nit?: string;
  reg_fiscal?: string;
  dir_emp?: string;
  tel_emp?: string;
  tipo_costo?: string;
  contador?: string;
  activa?: 'S' | 'N';
  porcentaje_pago_cuenta?: number;
  usuariosAsignados?: string[];
}

export interface UpdateEmpresaPayload {
  nom_emp?: string;
  razon_social?: string;
  nit?: string;
  reg_fiscal?: string;
  dir_emp?: string;
  tel_emp?: string;
  tipo_costo?: string;
  contador?: string;
  activa?: 'S' | 'N';
  porcentaje_pago_cuenta?: number;
}

export interface SaveAssignmentsResponse {
  ok: boolean;
  message: string;
  count: number;
}

export interface DteSummary {
  id: number;
  fileName: string;
  pertenece: boolean;
  error?: string;
  tipoDte?: string;
  fecha?: string;
  codigoGeneracion?: string;
  numeroControl?: string;
  nitContraparte?: string;
  nrcContraparte?: string;
  nombreContraparte?: string;
  montoTotal?: number;
  sinSello?: boolean;
  fueraPeriodo?: boolean;
}

export interface ValidateItem {
  id: number;
  fileName: string;
  codigoGeneracion?: string;
  nitContraparte?: string;
  nrcContraparte?: string;
}

export type EstadoItem =
  | 'pendiente'
  | 'valido'
  | 'duplicado'
  | 'cliente_no_existe'
  | 'proveedor_no_existe'
  | 'no_pertenece'
  | 'error_parseo'
  | 'sin_sello'
  | 'fuera_periodo'
  | 'guardado'
  | 'error_guardar';

export type EstadoValidacion = 'valido' | 'duplicado' | 'cliente_no_existe' | 'proveedor_no_existe';

export interface ValidateResultado {
  id: number;
  estado: EstadoValidacion;
}

export interface SaveItem {
  fileName: string;
  content: string;
}

export interface SaveItemResultado {
  fileName: string;
  ok: boolean;
  error?: string;
}

export interface SaveResultado {
  insertados: number;
  errores: number;
  resultados: SaveItemResultado[];
}
