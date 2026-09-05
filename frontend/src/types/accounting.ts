export interface CuentaContable {
  id_cta?: number;
  cod_cta: string;
  nom_cta: string;
  cod_tp_cta?: string;
  dep_cta?: string | null;
  acreedor?: number;
  deudor?: number;
  ejercicio?: string;
  mes?: string | null;
  nivel_cta?: string;
  cod_fnc?: string | null;
  cod_emp?: number;
  g_d_m?: string; // 'G' | 'M' | 'D'
}

export interface TipoCuenta {
  cod_tp_cta: string;
  letra_cta?: string;
  nom_cta: string;
  cod_emp: number;
  corr?: number;
}

export interface TipoPartida {
  cod_tp_partida: string;
  nom_tp_partida: string;
  forma?: string;
  cod_emp: number;
  tipo?: string;
  corr?: number;
}

export interface DetallePartida {
  cod_part?: string;
  id_cta?: number;
  cod_cta: string;
  nom_cta: string;
  concepto: string;
  cargo_part: number;
  abono_part: number;
  cod_emp?: number;
  marca?: string;
}

export interface CabeceraPartida {
  cod_part: string;
  fec_partida: string;
  num_correl: number;
  concepto_part: string;
  anulada_part: number;
  cargo_part: number;
  abono_part: number;
  cod_emp: number;
  cod_tp_part: string;
  nom_tp_partida?: string;
  detalles?: DetallePartida[];
}

export interface JournalEntriesResponse {
  data: CabeceraPartida[];
  summary: {
    total: number;
    total_cargos: number;
    total_abonos: number;
    total_anuladas: number;
    total_activas: number;
  };
  limit: number;
  offset: number;
}

export interface FirmaContable {
  id_firma: number;
  nom_firma: string;
  puesto: string;
  cod_emp: number;
}

export interface AccountImportRow {
  cod_cta: string;
  nom_cta: string;
  dep_cta?: string;
  nivel_cta?: string;
  g_d_m?: string;
  cod_tp_cta?: string;
  deudor?: number;
  acreedor?: number;
  isValid?: boolean;
  status?: 'NEW' | 'UPDATE' | 'INVALID';
  message?: string;
}

export interface ImportVerificationResult {
  totalRows: number;
  newAccounts: number;
  existingAccounts: number;
  invalidAccounts: number;
  rows: AccountImportRow[];
}

export interface CorrelativoContabilidad {
  cod_tp_partida: string;
  nom_tp_partida?: string;
  cod_emp: number;
  ano: number;
  tipo: string; // 'M' | 'A'
  '01': number;
  '02': number;
  '03': number;
  '04': number;
  '05': number;
  '06': number;
  '07': number;
  '08': number;
  '09': number;
  '10': number;
  '11': number;
  '12': number;
  unico: number;
}

export interface CorrelativosResponse {
  ano: number;
  correlativos: CorrelativoContabilidad[];
  availableYears: number[];
  corrGlobal: number;
}

export interface ReenumerarParams {
  ano: number;
  mes?: string; // 'ALL' or '01'..'12'
  cod_tp_partida?: string; // 'ALL' or code
  criterio?: 'FECHA' | 'COD_PART';
  numeroInicial?: number;
  actualizarTablaCorrelativos?: boolean;
}

export interface ReenumerarResponse {
  success: boolean;
  totalReenumeradas: number;
  message: string;
  detalles: Array<{
    cod_tp_partida: string;
    nom_tp_partida: string;
    mes: string;
    total: number;
    rango: string;
  }>;
}

