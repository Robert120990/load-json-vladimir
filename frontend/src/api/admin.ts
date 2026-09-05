import type {
  AdminUserSummary,
  CompanyAssignment,
  SaveAssignmentsResponse,
} from '../types';
import { api } from './client';

export async function fetchAdminUsers(): Promise<AdminUserSummary[]> {
  const { data } = await api.get<AdminUserSummary[]>('/admin/users');
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
