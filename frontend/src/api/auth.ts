import type { Empresa, EmpresaOpcion, LoginResponse, SeleccionEmpresaResponse } from '../types';
import { api } from './client';

export async function login(nomUsu: string, password: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/login', { nomUsu, password });
  return data;
}

export async function seleccionarEmpresa(
  tokenTemporal: string,
  codEmp: number,
): Promise<SeleccionEmpresaResponse> {
  const { data } = await api.post<SeleccionEmpresaResponse>('/auth/select-empresa', {
    tokenTemporal,
    codEmp,
  });
  return data;
}

export async function obtenerEmpresa(): Promise<Empresa> {
  const { data } = await api.get<Empresa>('/auth/company');
  return data;
}

export async function obtenerMisEmpresas(): Promise<EmpresaOpcion[]> {
  const { data } = await api.get<EmpresaOpcion[]>('/auth/my-companies');
  return data;
}

export async function cambiarEmpresaActiva(
  codEmp: number,
): Promise<SeleccionEmpresaResponse & { empresa: Empresa }> {
  const { data } = await api.post<SeleccionEmpresaResponse & { empresa: Empresa }>(
    '/auth/switch-company',
    { codEmp },
  );
  return data;
}
