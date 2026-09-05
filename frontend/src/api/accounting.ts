import { api } from './client';
import {
  AccountImportRow,
  CabeceraPartida,
  CuentaContable,
  FirmaContable,
  ImportVerificationResult,
  JournalEntriesResponse,
  TipoCuenta,
  TipoPartida,
  CorrelativosResponse,
  CorrelativoContabilidad,
  ReenumerarParams,
  ReenumerarResponse,
} from '../types/accounting';

// --- CATÁLOGO DE CUENTAS ---

export async function listarCuentas(params?: {
  ejercicio?: string;
  search?: string;
  nivel?: string;
  tipo?: string;
  g_d_m?: string;
  soloImputables?: boolean;
}): Promise<CuentaContable[]> {
  const { data } = await api.get<CuentaContable[]>('/accounting/catalogo', { params });
  return data;
}

export async function obtenerEjerciciosCatalogo(): Promise<string[]> {
  const { data } = await api.get<string[]>('/accounting/catalogo/ejercicios');
  return data;
}

export async function obtenerTiposCuenta(): Promise<TipoCuenta[]> {
  const { data } = await api.get<TipoCuenta[]>('/accounting/catalogo/tipos-cuenta');
  return data;
}

export async function obtenerCuenta(id: number): Promise<CuentaContable> {
  const { data } = await api.get<CuentaContable>(`/accounting/catalogo/${id}`);
  return data;
}

export async function crearCuenta(cuenta: CuentaContable): Promise<{ message: string; id_cta: number; account: CuentaContable }> {
  const { data } = await api.post<{ message: string; id_cta: number; account: CuentaContable }>('/accounting/catalogo', cuenta);
  return data;
}

export async function actualizarCuenta(id: number, cuenta: Partial<CuentaContable>): Promise<{ message: string }> {
  const { data } = await api.put<{ message: string }>(`/accounting/catalogo/${id}`, cuenta);
  return data;
}

export async function eliminarCuenta(id: number): Promise<{ message: string }> {
  const { data } = await api.delete<{ message: string }>(`/accounting/catalogo/${id}`);
  return data;
}

export async function copiarCatalogoEjercicio(sourceYear: string, targetYear: string): Promise<{ message: string; totalCopied: number }> {
  const { data } = await api.post<{ message: string; totalCopied: number }>('/accounting/catalogo/copiar-ejercicio', {
    sourceYear,
    targetYear,
  });
  return data;
}

// Importación de Catálogo
export async function verificarImportacionCatalogo(rows: AccountImportRow[], ejercicio: string): Promise<ImportVerificationResult> {
  const { data } = await api.post<ImportVerificationResult>('/accounting/catalogo/importar/verificar', {
    rows,
    ejercicio,
  });
  return data;
}

export async function guardarImportacionCatalogo(rows: AccountImportRow[], ejercicio: string, mode: 'ALL' | 'ONLY_NEW' = 'ALL'): Promise<{ message: string; inserted: number; updated: number }> {
  const { data } = await api.post<{ message: string; inserted: number; updated: number }>('/accounting/catalogo/importar/guardar', {
    rows,
    ejercicio,
    mode,
  });
  return data;
}

// --- PARTIDAS CONTABLES ---

export async function listarPartidas(params?: {
  ano?: number | string;
  mes?: number | string;
  cod_tp_part?: string;
  search?: string;
  anulada?: number | string;
  desde?: string;
  hasta?: string;
  limit?: number;
  offset?: number;
}): Promise<JournalEntriesResponse> {
  const { data } = await api.get<JournalEntriesResponse>('/accounting/partidas', { params });
  return data;
}

export async function obtenerTiposPartida(): Promise<TipoPartida[]> {
  const { data } = await api.get<TipoPartida[]>('/accounting/partidas/tipos');
  return data;
}

export async function obtenerSiguienteCorrelativo(params: {
  cod_tp_part: string;
  ano?: number;
  mes?: number | string;
}): Promise<{ suggestedCodPart: string; suggestedNumCorrel: number; ano: number; mes: string; cod_tp_part: string }> {
  const { data } = await api.get<{ suggestedCodPart: string; suggestedNumCorrel: number; ano: number; mes: string; cod_tp_part: string }>('/accounting/partidas/siguiente-correlativo', { params });
  return data;
}

export async function obtenerPartida(codPart: string): Promise<CabeceraPartida> {
  const { data } = await api.get<CabeceraPartida>(`/accounting/partidas/${codPart}`);
  return data;
}

export async function crearPartida(partida: {
  fec_partida: string;
  concepto_part: string;
  cod_tp_part: string;
  detalles: any[];
}): Promise<{ message: string; cod_part: string; num_correl: number }> {
  const { data } = await api.post<{ message: string; cod_part: string; num_correl: number }>('/accounting/partidas', partida);
  return data;
}

export async function actualizarPartida(codPart: string, partida: {
  fec_partida: string;
  concepto_part: string;
  cod_tp_part: string;
  detalles: any[];
}): Promise<{ message: string }> {
  const { data } = await api.put<{ message: string }>(`/accounting/partidas/${codPart}`, partida);
  return data;
}

export async function alternarAnulacionPartida(codPart: string): Promise<{ message: string; anulada_part: number }> {
  const { data } = await api.patch<{ message: string; anulada_part: number }>(`/accounting/partidas/${codPart}/anular`);
  return data;
}

export async function eliminarPartida(codPart: string): Promise<{ message: string }> {
  const { data } = await api.delete<{ message: string }>(`/accounting/partidas/${codPart}`);
  return data;
}

// --- FIRMAS CONTABLES ---

export async function obtenerFirmasContables(): Promise<FirmaContable[]> {
  const { data } = await api.get<FirmaContable[]>('/accounting/firmas');
  return data;
}

export async function guardarFirmasContables(firmas: FirmaContable[]): Promise<{ message: string }> {
  const { data } = await api.post<{ message: string }>('/accounting/firmas', { firmas });
  return data;
}

// --- CORRELATIVOS CONTABLES Y REENUMERACIÓN ---

export async function obtenerCorrelativosContables(ano?: number): Promise<CorrelativosResponse> {
  const { data } = await api.get<CorrelativosResponse>('/accounting/correlativos', {
    params: { ano },
  });
  return data;
}

export async function guardarCorrelativosContables(payload: {
  ano: number;
  rows: CorrelativoContabilidad[];
  corrGlobal?: number;
}): Promise<{ success: boolean; message: string }> {
  const { data } = await api.put<{ success: boolean; message: string }>('/accounting/correlativos', payload);
  return data;
}

export async function inicializarAnoCorrelativos(ano: number): Promise<{ success: boolean; message: string }> {
  const { data } = await api.post<{ success: boolean; message: string }>('/accounting/correlativos/inicializar-ano', { ano });
  return data;
}

export async function reenumerarPartidas(params: ReenumerarParams): Promise<ReenumerarResponse> {
  const { data } = await api.post<ReenumerarResponse>('/accounting/correlativos/reenumerar', params);
  return data;
}

