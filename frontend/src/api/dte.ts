import type {
  DteSummary,
  PeriodoCompras,
  SaveItem,
  SaveResultado,
  TipoDte,
  ValidateItem,
  ValidateResultado,
} from '../types';
import { api } from './client';

export async function obtenerPeriodo(): Promise<PeriodoCompras | null> {
  const { data } = await api.get<{ periodo: PeriodoCompras | null }>('/dte/periodo');
  return data.periodo;
}

export async function subirArchivos(tipo: TipoDte, archivos: File[]): Promise<DteSummary[]> {
  const formData = new FormData();
  formData.append('tipo', tipo);
  archivos.forEach((archivo) => formData.append('files', archivo));

  const { data } = await api.post<{ items: DteSummary[] }>('/dte/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.items;
}

export async function validar(tipo: TipoDte, items: ValidateItem[]): Promise<ValidateResultado[]> {
  const { data } = await api.post<{ resultados: ValidateResultado[] }>('/dte/validate', {
    tipo,
    items,
  });
  return data.resultados;
}

export async function guardar(tipo: TipoDte, items: SaveItem[]): Promise<SaveResultado> {
  const { data } = await api.post<SaveResultado>('/dte/save', { tipo, items });
  return data;
}
