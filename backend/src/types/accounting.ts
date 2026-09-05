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
  detalles?: DetallePartida[];
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
  // Verification flags
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
