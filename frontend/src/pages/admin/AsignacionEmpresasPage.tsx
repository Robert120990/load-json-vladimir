import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  CheckSquare,
  Loader2,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Square,
  UserCheck,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchAdminUsers, fetchUserCompanyAssignments, saveUserCompanyAssignments } from '../../api/admin';
import type { AdminUserSummary, CompanyAssignment } from '../../types';
import { matchesSearchTokens } from '../../utils/searchUtils';
import ControlIvaLayout from '../../components/layout/ControlIvaLayout';

export default function AsignacionEmpresasPage() {
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [userSearch, setUserSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  const [companies, setCompanies] = useState<CompanyAssignment[]>([]);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<Set<number>>(new Set());
  const [originalCompanyIds, setOriginalCompanyIds] = useState<Set<number>>(new Set());
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [companySearch, setCompanySearch] = useState('');
  const [saving, setSaving] = useState(false);

  // Cargar lista de usuarios
  async function loadUsers(maintainSelection = true) {
    setLoadingUsers(true);
    try {
      const data = await fetchAdminUsers();
      setUsers(data);
      if (data.length > 0) {
        if (!maintainSelection || !selectedUser || !data.some((u) => u.nom_usu === selectedUser)) {
          setSelectedUser(data[0].nom_usu);
        }
      }
    } catch {
      toast.error('Error al cargar la lista de usuarios');
    } finally {
      setLoadingUsers(false);
    }
  }

  useEffect(() => {
    loadUsers(false);
  }, []);

  // Cargar asignaciones del usuario seleccionado
  useEffect(() => {
    if (!selectedUser) return;

    let isMounted = true;
    setLoadingCompanies(true);
    setCompanySearch('');

    fetchUserCompanyAssignments(selectedUser)
      .then((data) => {
        if (!isMounted) return;
        setCompanies(data);
        const assigned = new Set(data.filter((c) => c.assigned).map((c) => c.cod_emp));
        setSelectedCompanyIds(assigned);
        setOriginalCompanyIds(new Set(assigned));
      })
      .catch(() => {
        if (isMounted) toast.error(`Error al consultar empresas para ${selectedUser}`);
      })
      .finally(() => {
        if (isMounted) setLoadingCompanies(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedUser]);

  // Filtrado de usuarios
  const filteredUsers = useMemo(() => {
    return users.filter((u) =>
      matchesSearchTokens([u.nom_usu, u.desc_usu], userSearch)
    );
  }, [users, userSearch]);

  // Filtrado de empresas
  const filteredCompanies = useMemo(() => {
    return companies.filter((c) =>
      matchesSearchTokens([c.nom_emp, c.nit, c.reg_fiscal, String(c.cod_emp)], companySearch)
    );
  }, [companies, companySearch]);

  // Toggle de una empresa individual
  function toggleCompany(codEmp: number) {
    setSelectedCompanyIds((prev) => {
      const next = new Set(prev);
      if (next.has(codEmp)) {
        next.delete(codEmp);
      } else {
        next.add(codEmp);
      }
      return next;
    });
  }

  // Seleccionar todas las filtradas
  function handleSelectAllFiltered() {
    setSelectedCompanyIds((prev) => {
      const next = new Set(prev);
      filteredCompanies.forEach((c) => next.add(c.cod_emp));
      return next;
    });
  }

  // Deseleccionar todas las filtradas
  function handleDeselectAllFiltered() {
    setSelectedCompanyIds((prev) => {
      const next = new Set(prev);
      filteredCompanies.forEach((c) => next.delete(c.cod_emp));
      return next;
    });
  }

  // Verificar si hay cambios sin guardar
  const hasChanges = useMemo(() => {
    if (selectedCompanyIds.size !== originalCompanyIds.size) return true;
    for (const id of selectedCompanyIds) {
      if (!originalCompanyIds.has(id)) return true;
    }
    return false;
  }, [selectedCompanyIds, originalCompanyIds]);

  // Guardar asignaciones
  async function handleSave() {
    if (!selectedUser) return;

    if (selectedUser.toUpperCase() === 'ADMIN' && selectedCompanyIds.size === 0) {
      toast.error('El usuario ADMIN debe tener al menos una empresa asignada');
      return;
    }

    setSaving(true);
    try {
      const codEmpresas = Array.from(selectedCompanyIds);
      const res = await saveUserCompanyAssignments(selectedUser, codEmpresas);
      toast.success(res.message || 'Asignaciones guardadas correctamente');

      // Actualizar estado local
      setOriginalCompanyIds(new Set(selectedCompanyIds));

      // Actualizar conteos de usuarios
      await loadUsers(true);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err.message || 'Error al guardar asignaciones';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  const currentUserObj = users.find((u) => u.nom_usu === selectedUser);

  return (
    <ControlIvaLayout>
      <div className="asignacion-page">
        {/* Cabecera de Página */}
        <div className="asignacion-header">
          <div className="asignacion-title-group">
            <div className="asignacion-icon-badge">
              <ShieldCheck size={26} />
            </div>
            <div>
              <h1 className="asignacion-title">Asignación de Empresas a Usuarios</h1>
              <p className="asignacion-subtitle">
                Control de visibilidad y acceso por empresa para cada usuario (Exclusivo Administrador)
              </p>
            </div>
          </div>

          <div>
            <button
              type="button"
              className="btn-secundario btn-icon-gap"
              onClick={() => loadUsers(true)}
              disabled={loadingUsers}
            >
              <RefreshCw size={16} className={loadingUsers ? 'animate-spin' : ''} />
              <span>Refrescar</span>
            </button>
          </div>
        </div>

        {/* Master-Detail Layout de 2 Columnas */}
        <div className="asignacion-grid">
          {/* Panel Izquierdo: Lista de Usuarios (Maestro) */}
          <div className="asignacion-users-card">
            <div className="asignacion-card-header">
              <div className="asignacion-card-title-row">
                <div className="asignacion-card-title">
                  <Users size={18} className="text-blue-600" />
                  <span>Usuarios del Sistema</span>
                </div>
                <span className="asignacion-pill-count">
                  {users.length}
                </span>
              </div>

              {/* Buscador de usuarios */}
              <div className="asignacion-search-wrap">
                <Search size={16} className="asignacion-search-icon" />
                <input
                  type="text"
                  placeholder="Buscar usuario o nombre..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="asignacion-search-input"
                />
              </div>
            </div>

            {/* Listado de Usuarios con Scroll Vertical */}
            <div className="asignacion-users-list">
              {loadingUsers ? (
                <div style={{ padding: '36px 16px', textAlign: 'center', color: '#94a3b8' }}>
                  <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px auto', color: '#2563eb' }} />
                  <span style={{ fontSize: '0.85rem' }}>Cargando usuarios…</span>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div style={{ padding: '36px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                  No se encontraron usuarios
                </div>
              ) : (
                filteredUsers.map((u) => {
                  const isSelected = u.nom_usu === selectedUser;
                  return (
                    <button
                      key={u.nom_usu}
                      type="button"
                      onClick={() => {
                        if (hasChanges) {
                          if (
                            !window.confirm(
                              'Tienes cambios sin guardar en el usuario actual. ¿Deseas descartarlos y cambiar de usuario?'
                            )
                          ) {
                            return;
                          }
                        }
                        setSelectedUser(u.nom_usu);
                      }}
                      className={`asignacion-user-item ${isSelected ? 'active' : ''}`}
                    >
                      <div className="asignacion-user-main">
                        <div className="asignacion-user-name-row">
                          <span className="asignacion-user-username">
                            {u.nom_usu}
                          </span>
                          {u.nom_usu.toUpperCase() === 'ADMIN' && (
                            <span className="asignacion-user-admin-badge">
                              Admin
                            </span>
                          )}
                        </div>
                        <div className="asignacion-user-desc">
                          {u.desc_usu || 'Sin descripción'}
                        </div>
                      </div>

                      <div>
                        <span
                          className={`asignacion-user-badge-pill ${
                            u.activas > 0 ? 'active' : 'empty'
                          }`}
                          title={`${u.activas} empresas activas asignadas`}
                        >
                          {u.activas} activas
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Panel Derecho: Asignación de Empresas (Detalle) */}
          <div className="asignacion-detail-card">
            {/* Cabecera del usuario seleccionado */}
            <div className="asignacion-detail-header">
              <div className="asignacion-user-profile">
                <div className="asignacion-user-avatar">
                  <UserCheck size={24} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h2 className="asignacion-user-title">
                      {currentUserObj?.nom_usu ?? selectedUser ?? 'Selecciona un usuario'}
                    </h2>
                    {currentUserObj?.nom_usu.toUpperCase() === 'ADMIN' && (
                      <span className="asignacion-user-admin-badge" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
                        Administrador Principal
                      </span>
                    )}
                  </div>
                  <div className="asignacion-user-subtitle">
                    {currentUserObj?.desc_usu || 'Gestión de empresas asignadas'}
                  </div>
                </div>
              </div>

              {/* Botón de Guardar superior */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {hasChanges && (
                  <span className="asignacion-unsaved-alert">
                    Cambios sin guardar
                  </span>
                )}
                <button
                  type="button"
                  className="btn-primario btn-icon-gap"
                  onClick={handleSave}
                  disabled={saving || !hasChanges}
                >
                  {saving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Guardando…</span>
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      <span>Guardar Asignaciones</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Barra de herramientas y filtros */}
            <div className="asignacion-toolbar">
              <div className="asignacion-search-wrap">
                <Search size={16} className="asignacion-search-icon" />
                <input
                  type="text"
                  placeholder="Buscar empresa por código, nombre o NIT..."
                  value={companySearch}
                  onChange={(e) => setCompanySearch(e.target.value)}
                  className="asignacion-search-input"
                />
              </div>

              <div className="asignacion-toolbar-actions">
                <button
                  type="button"
                  className="btn-secundario btn-sm btn-icon-gap"
                  onClick={handleSelectAllFiltered}
                  title="Marcar todas las empresas mostradas"
                >
                  <CheckSquare size={14} />
                  <span>Marcar todas</span>
                </button>
                <button
                  type="button"
                  className="btn-secundario btn-sm btn-icon-gap"
                  onClick={handleDeselectAllFiltered}
                  title="Desmarcar todas las empresas mostradas"
                >
                  <Square size={14} />
                  <span>Desmarcar todas</span>
                </button>
                <div className="asignacion-count-badge">
                  {selectedCompanyIds.size} de {companies.length} asignadas
                </div>
              </div>
            </div>

            {/* Tabla de Empresas */}
            <div className="asignacion-table-wrap">
              {loadingCompanies ? (
                <div style={{ padding: '48px 16px', textAlign: 'center', color: '#94a3b8' }}>
                  <Loader2 size={28} className="animate-spin" style={{ margin: '0 auto 10px auto', color: '#2563eb' }} />
                  <span style={{ fontSize: '0.88rem' }}>Cargando empresas activas…</span>
                </div>
              ) : filteredCompanies.length === 0 ? (
                <div style={{ padding: '48px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '0.88rem' }}>
                  No se encontraron empresas con el criterio de búsqueda.
                </div>
              ) : (
                <table className="asignacion-table">
                  <thead>
                    <tr>
                      <th style={{ width: '54px', textAlign: 'center' }}>Acceso</th>
                      <th style={{ width: '80px' }}>Código</th>
                      <th>Nombre de la Empresa</th>
                      <th style={{ width: '160px' }}>NIT</th>
                      <th style={{ width: '140px' }}>Reg. Fiscal</th>
                      <th style={{ width: '120px', textAlign: 'center' }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCompanies.map((c) => {
                      const isAssigned = selectedCompanyIds.has(c.cod_emp);
                      return (
                        <tr
                          key={c.cod_emp}
                          onClick={() => toggleCompany(c.cod_emp)}
                          className={isAssigned ? 'row-assigned' : ''}
                        >
                          <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isAssigned}
                              onChange={() => toggleCompany(c.cod_emp)}
                              className="asignacion-table-checkbox"
                            />
                          </td>
                          <td style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.78rem', color: '#475569' }}>
                            #{c.cod_emp}
                          </td>
                          <td>
                            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.88rem' }}>{c.nom_emp}</div>
                          </td>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#475569' }}>
                            {c.nit || '—'}
                          </td>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#475569' }}>
                            {c.reg_fiscal || '—'}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {isAssigned ? (
                              <span className="asignacion-badge-assigned">
                                <CheckCircle2 size={12} />
                                Asignada
                              </span>
                            ) : (
                              <span className="asignacion-badge-unassigned">
                                Sin acceso
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer con resumen y acción */}
            <div className="asignacion-detail-footer">
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Selecciona las empresas que <strong>{selectedUser}</strong> podrá visualizar e intervenir en el sistema.
              </div>

              <div>
                <button
                  type="button"
                  className="btn-primario btn-icon-gap"
                  onClick={handleSave}
                  disabled={saving || !hasChanges}
                >
                  {saving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Guardando…</span>
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      <span>Guardar Asignaciones</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ControlIvaLayout>
  );
}
