import type {
  AdminUserSummary,
  CompanyAssignment,
  CreateEmpresaPayload,
  CreateUserPayload,
  EmpresaAdminDetail,
  SaveAssignmentsResponse,
  UpdateEmpresaPayload,
  UpdateUserPayload,
} from '../types';
import { api } from './client';

export async function fetchAdminUsers(): Promise<AdminUserSummary[]> {
  const { data } = await api.get<AdminUserSummary[]>('/admin/users');
  return data;
}

export async function fetchActiveCompanies(): Promise<CompanyAssignment[]> {
  const { data } = await api.get<CompanyAssignment[]>('/admin/companies');
  return data;
}

export async function fetchUserCompanyAssignments(
  nomUsu: string,
): Promise<CompanyAssignment[]> {
  const { data } = await api.get<CompanyAssignment[]>(
    `/admin/users/${encodeURIComponent(nomUsu)}/companies`,
  );
  return data;
}

export async function saveUserCompanyAssignments(
  nomUsu: string,
  codEmpresas: number[],
): Promise<SaveAssignmentsResponse> {
  const { data } = await api.put<SaveAssignmentsResponse>(
    `/admin/users/${encodeURIComponent(nomUsu)}/companies`,
    { codEmpresas },
  );
  return data;
}

export async function createUser(
  payload: CreateUserPayload,
): Promise<{ ok: boolean; message: string; nom_usu: string }> {
  const { data } = await api.post<{ ok: boolean; message: string; nom_usu: string }>(
    '/admin/users',
    payload,
  );
  return data;
}

export async function updateUser(
  nomUsu: string,
  payload: UpdateUserPayload,
): Promise<{ ok: boolean; message: string }> {
  const { data } = await api.put<{ ok: boolean; message: string }>(
    `/admin/users/${encodeURIComponent(nomUsu)}`,
    payload,
  );
  return data;
}

export async function deleteUser(
  nomUsu: string,
): Promise<{ ok: boolean; message: string }> {
  const { data } = await api.delete<{ ok: boolean; message: string }>(
    `/admin/users/${encodeURIComponent(nomUsu)}`,
  );
  return data;
}

export async function fetchAllEmpresas(): Promise<EmpresaAdminDetail[]> {
  const { data } = await api.get<EmpresaAdminDetail[]>('/admin/empresas');
  return data;
}

export async function fetchEmpresaById(codEmp: number): Promise<EmpresaAdminDetail> {
  const { data } = await api.get<EmpresaAdminDetail>(`/admin/empresas/${codEmp}`);
  return data;
}

export async function createEmpresa(
  payload: CreateEmpresaPayload,
): Promise<{ ok: boolean; message: string; cod_emp: number }> {
  const { data } = await api.post<{ ok: boolean; message: string; cod_emp: number }>(
    '/admin/empresas',
    payload,
  );
  return data;
}

export async function updateEmpresa(
  codEmp: number,
  payload: UpdateEmpresaPayload,
): Promise<{ ok: boolean; message: string }> {
  const { data } = await api.put<{ ok: boolean; message: string }>(
    `/admin/empresas/${codEmp}`,
    payload,
  );
  return data;
}

export async function deleteEmpresa(
  codEmp: number,
): Promise<{ ok: boolean; message: string; softDeactivated: boolean }> {
  const { data } = await api.delete<{ ok: boolean; message: string; softDeactivated: boolean }>(
    `/admin/empresas/${codEmp}`,
  );
  return data;
}
