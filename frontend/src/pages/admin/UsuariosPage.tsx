import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  CheckSquare,
  Edit2,
  Eye,
  EyeOff,
  KeyRound,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Square,
  Trash2,
  UserCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  createUser,
  deleteUser,
  fetchActiveCompanies,
  fetchAdminUsers,
  fetchUserCompanyAssignments,
  updateUser,
} from '../../api/admin';
import { obtenerError } from '../../api/client';
import ControlIvaLayout from '../../components/layout/ControlIvaLayout';
import Badge from '../../components/ui/Badge';
import DataTable, { Column } from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import type { AdminUserSummary, CompanyAssignment } from '../../types';
import { matchesSearchTokens } from '../../utils/searchUtils';

export default function UsuariosPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [activeCompanies, setActiveCompanies] = useState<CompanyAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // Modal Crear / Editar
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formNomUsu, setFormNomUsu] = useState('');
  const [formDescUsu, setFormDescUsu] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formCodRol, setFormCodRol] = useState('01');
  const [formCodPuntoVenta, setFormCodPuntoVenta] = useState('001');
  const [formSelectedCompanies, setFormSelectedCompanies] = useState<Set<number>>(new Set());
  const [companySearch, setCompanySearch] = useState('');
  const [saving, setSaving] = useState(false);

  // Modal Eliminar
  const [userToDelete, setUserToDelete] = useState<AdminUserSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Usuario autenticado actual
  const currentAuthUser = useMemo(() => {
    try {
      const u = JSON.parse(localStorage.getItem('usuario') || '{}');
      return (u?.nom_usu || '').trim().toUpperCase();
    } catch {
      return '';
    }
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [usersData, companiesData] = await Promise.all([
        fetchAdminUsers(),
        fetchActiveCompanies(),
      ]);
      setUsers(usersData);
      setActiveCompanies(companiesData);
    } catch (err) {
      toast.error(obtenerError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Filtrado de usuarios
  const filteredUsers = useMemo(() => {
    return users.filter((u) =>
      matchesSearchTokens([u.nom_usu, u.desc_usu, u.cod_rol], searchTerm)
    );
  }, [users, searchTerm]);

  // Paginación en cliente
  const paginatedUsers = useMemo(() => {
    const start = (page - 1) * limit;
    return filteredUsers.slice(start, start + limit);
  }, [filteredUsers, page, limit]);

  // Empresas filtradas dentro del modal
  const filteredModalCompanies = useMemo(() => {
    return activeCompanies.filter((c) =>
      matchesSearchTokens([c.nom_emp, c.nit, c.reg_fiscal, String(c.cod_emp)], companySearch)
    );
  }, [activeCompanies, companySearch]);

  function handleOpenCreateModal() {
    setIsEditing(false);
    setFormNomUsu('');
    setFormDescUsu('');
    setFormPassword('');
    setShowPassword(false);
    setFormCodRol('01');
    setFormCodPuntoVenta('001');
    const firstId = activeCompanies.length > 0 ? [activeCompanies[0].cod_emp] : [1];
    setFormSelectedCompanies(new Set(firstId));
    setCompanySearch('');
    setIsModalOpen(true);
  }

  async function handleOpenEditModal(user: AdminUserSummary) {
    setIsEditing(true);
    setFormNomUsu(user.nom_usu);
    setFormDescUsu(user.desc_usu || '');
    setFormPassword('');
    setShowPassword(false);
    setFormCodRol(user.cod_rol || '01');
    setFormCodPuntoVenta(user.cod_punto_venta || '001');
    setCompanySearch('');

    try {
      const assignments = await fetchUserCompanyAssignments(user.nom_usu);
      const assignedIds = new Set(assignments.filter((c) => c.assigned).map((c) => c.cod_emp));
      setFormSelectedCompanies(assignedIds);
    } catch {
      setFormSelectedCompanies(new Set(user.empresas_ids || []));
    }

    setIsModalOpen(true);
  }

  function toggleCompanySelection(codEmp: number) {
    setFormSelectedCompanies((prev) => {
      const next = new Set(prev);
      if (next.has(codEmp)) {
        next.delete(codEmp);
      } else {
        next.add(codEmp);
      }
      return next;
    });
  }

  function handleSelectAllCompanies() {
    const allIds = new Set(activeCompanies.map((c) => c.cod_emp));
    setFormSelectedCompanies(allIds);
  }

  function handleDeselectAllCompanies() {
    setFormSelectedCompanies(new Set());
  }

  async function handleSubmitForm(e: React.FormEvent) {
    e.preventDefault();

    const cleanNomUsu = formNomUsu.trim().toUpperCase();
    if (!cleanNomUsu) {
      toast.error('El nombre de usuario es obligatorio');
      return;
    }

    if (!isEditing && (!formPassword || formPassword.trim().length < 3)) {
      toast.error('La contraseña debe contener al menos 3 caracteres');
      return;
    }

    if (isEditing && formPassword && formPassword.trim().length < 3) {
      toast.error('La nueva contraseña debe contener al menos 3 caracteres');
      return;
    }

    if (formSelectedCompanies.size === 0) {
      toast.error('Debes asignar al menos una empresa al usuario');
      return;
    }

    setSaving(true);
    try {
      if (isEditing) {
        await updateUser(cleanNomUsu, {
          desc_usu: formDescUsu.trim(),
          password: formPassword.trim() || undefined,
          cod_rol: formCodRol,
          cod_punto_venta: formCodPuntoVenta.trim() || '001',
          codEmpresas: Array.from(formSelectedCompanies),
        });
        toast.success(`Usuario '${cleanNomUsu}' actualizado correctamente`);
      } else {
        await createUser({
          nom_usu: cleanNomUsu,
          desc_usu: formDescUsu.trim() || cleanNomUsu,
          password: formPassword.trim(),
          cod_rol: formCodRol,
          cod_punto_venta: formCodPuntoVenta.trim() || '001',
          codEmpresas: Array.from(formSelectedCompanies),
        });
        toast.success(`Usuario '${cleanNomUsu}' creado exitosamente`);
      }

      setIsModalOpen(false);
      loadData();
    } catch (err) {
      toast.error(obtenerError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmDelete() {
    if (!userToDelete) return;
    setDeleting(true);
    try {
      await deleteUser(userToDelete.nom_usu);
      toast.success(`Usuario '${userToDelete.nom_usu}' eliminado correctamente`);
      setUserToDelete(null);
      loadData();
    } catch (err) {
      toast.error(obtenerError(err));
    } finally {
      setDeleting(false);
    }
  }

  function handleEnterNavigation(e: React.KeyboardEvent<HTMLFormElement>) {
    if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
      if (e.target.type === 'submit' || e.target.type === 'button') return;
      e.preventDefault();
      const form = e.currentTarget;
      const elements = Array.from(
        form.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
          'input:not([disabled]):not([readonly]), select:not([disabled])'
        )
      );
      const index = elements.indexOf(e.target);
      if (index >= 0 && index < elements.length - 1) {
        elements[index + 1].focus();
      }
    }
  }

  const columns: Column<AdminUserSummary>[] = [
    {
      key: 'index',
      header: '#',
      align: 'center',
      className: 'w-12',
      render: (_row, idx) => (
        <span className="text-muted font-mono" style={{ fontSize: '0.78rem' }}>
          {(idx ?? 0) + 1 + (page - 1) * limit}
        </span>
      ),
    },
    {
      key: 'nom_usu',
      header: 'Usuario',
      render: (u) => {
        const isSuperAdmin = u.nom_usu.toUpperCase() === 'ADMIN';
        const isCurrentSession = u.nom_usu.toUpperCase() === currentAuthUser;

        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <strong className="font-mono text-primary">{u.nom_usu}</strong>
            {isSuperAdmin && (
              <Badge variant="info">
                <ShieldCheck size={11} style={{ marginRight: '4px' }} />
                ADMIN
              </Badge>
            )}
            {isCurrentSession && <Badge variant="neutral">Tú</Badge>}
          </div>
        );
      },
    },
    {
      key: 'desc_usu',
      header: 'Nombre o Descripción',
      render: (u) => (
        <span style={{ color: '#334155' }}>
          {u.desc_usu || <span className="text-muted italic">Sin descripción</span>}
        </span>
      ),
    },
    {
      key: 'cod_rol',
      header: 'Rol / Perfil',
      align: 'center',
      render: (u) => (
        <Badge variant={u.cod_rol === '01' ? 'primary' : u.cod_rol === '02' ? 'info' : 'neutral'}>
          {u.cod_rol === '01'
            ? '01 - Administrador'
            : u.cod_rol === '02'
            ? '02 - Contador'
            : u.cod_rol || '01'}
        </Badge>
      ),
    },
    {
      key: 'total_empresas',
      header: 'Empresas Asignadas',
      align: 'center',
      render: (u) => (
        <button
          type="button"
          onClick={() =>
            navigate(`/admin/asignacion-empresas?usuario=${encodeURIComponent(u.nom_usu)}`)
          }
          style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
          title={`Ver empresas de ${u.nom_usu}`}
        >
          <Badge variant={u.total_empresas > 0 ? 'success' : 'danger'}>
            {u.total_empresas} empresa{u.total_empresas === 1 ? '' : 's'}
          </Badge>
        </button>
      ),
    },
  ];

  return (
    <ControlIvaLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Gestión de Usuarios</h1>
          <p className="page-subtitle">
            Administración de cuentas, perfiles de acceso y empresas asignadas en el sistema
          </p>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="btn-secundario btn-icon-gap"
            onClick={loadData}
            disabled={loading}
            title="Refrescar usuarios"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            <span>Refrescar</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/asignacion-empresas')}
            className="btn-secundario btn-icon-gap"
            title="Ir a asignación masiva de empresas"
          >
            <ShieldCheck size={16} />
            <span>Asignación Masiva</span>
          </button>
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="btn-primario btn-icon-gap"
          >
            <Plus size={18} />
            <span>Nuevo Usuario</span>
          </button>
        </div>
      </div>

      <div className="card">
        <DataTable
          columns={columns}
          data={paginatedUsers}
          loading={loading}
          total={filteredUsers.length}
          page={page}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={(l) => {
            setLimit(l);
            setPage(1);
          }}
          searchTerm={searchTerm}
          onSearchChange={(s) => {
            setSearchTerm(s);
            setPage(1);
          }}
          searchPlaceholder="Buscar por usuario, nombre, rol..."
          emptyMessage="No se encontraron usuarios registrados coincidentes con la búsqueda."
          actions={(u) => {
            const isSuperAdmin = u.nom_usu.toUpperCase() === 'ADMIN';
            const isCurrentSession = u.nom_usu.toUpperCase() === currentAuthUser;

            return (
              <div className="acciones-fila">
                <button
                  type="button"
                  className="btn-accion btn-editar"
                  onClick={() => handleOpenEditModal(u)}
                  title={`Editar usuario ${u.nom_usu}`}
                >
                  <Edit2 size={16} />
                </button>
                <button
                  type="button"
                  className="btn-accion btn-ver"
                  onClick={() =>
                    navigate(
                      `/admin/asignacion-empresas?usuario=${encodeURIComponent(u.nom_usu)}`
                    )
                  }
                  title={`Asignar empresas a ${u.nom_usu}`}
                >
                  <Building2 size={16} />
                </button>
                <button
                  type="button"
                  className="btn-accion btn-eliminar"
                  onClick={() => setUserToDelete(u)}
                  disabled={isSuperAdmin || isCurrentSession}
                  title={
                    isSuperAdmin
                      ? 'No se puede eliminar el usuario ADMIN'
                      : isCurrentSession
                      ? 'No puedes eliminar tu propio usuario activo'
                      : `Eliminar usuario ${u.nom_usu}`
                  }
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          }}
        />
      </div>

      {/* Modal Crear / Editar Usuario */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isEditing ? `Editar Usuario: ${formNomUsu}` : 'Crear Nuevo Usuario'}
        maxWidth="2xl"
      >
        <form onSubmit={handleSubmitForm} onKeyDown={handleEnterNavigation} className="form-symmetrical">
          {/* Sección 1: Credenciales */}
          <div className="form-section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <KeyRound size={16} style={{ color: '#2563eb' }} />
            <span>1. Credenciales de Acceso</span>
          </div>

          <div className="form-grid-symmetrical cols-2">
            <div className="form-group">
              <label className="form-label">
                Usuario <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                className={`form-input font-mono font-bold uppercase ${
                  isEditing ? 'input-readonly' : ''
                }`}
                value={formNomUsu}
                onChange={(e) => setFormNomUsu(e.target.value.toUpperCase())}
                placeholder="EJ. CONTADOR2"
                maxLength={20}
                required
                disabled={isEditing}
              />
              <span className="text-muted" style={{ fontSize: '0.75rem', marginTop: '2px' }}>
                Máx. 20 caracteres en mayúsculas
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">
                Contraseña {isEditing ? '(Opcional)' : <span style={{ color: '#ef4444' }}>*</span>}
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  style={{ paddingRight: '40px' }}
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder={
                    isEditing ? 'Dejar en blanco para mantener actual' : 'Contraseña de acceso'
                  }
                  required={!isEditing}
                />
                <button
                  type="button"
                  style={{
                    position: 'absolute',
                    right: '8px',
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: '4px',
                  }}
                  onClick={() => setShowPassword((p) => !p)}
                  tabIndex={-1}
                  title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <span className="text-muted" style={{ fontSize: '0.75rem', marginTop: '2px' }}>
                Mínimo 3 caracteres
              </span>
            </div>
          </div>

          {/* Sección 2: Datos y Perfil */}
          <div className="form-section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
            <UserCheck size={16} style={{ color: '#2563eb' }} />
            <span>2. Datos del Usuario y Permisos</span>
          </div>

          <div className="form-grid-symmetrical cols-2">
            <div className="form-group">
              <label className="form-label">Nombre Completo o Descripción</label>
              <input
                type="text"
                className="form-input"
                value={formDescUsu}
                onChange={(e) => setFormDescUsu(e.target.value)}
                placeholder="Ej. Lic. Carlos Martínez - Contador"
                maxLength={50}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                Rol en el Sistema <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                className="form-input"
                value={formCodRol}
                onChange={(e) => setFormCodRol(e.target.value)}
                required
              >
                <option value="01">01 - Administrador</option>
                <option value="02">02 - Contador</option>
                <option value="03">03 - Auxiliar Contable</option>
                <option value="04">04 - Facturación / Ventas</option>
              </select>
            </div>
          </div>

          {/* Sección 3: Empresas Asignadas */}
          <div
            className="form-section-title"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building2 size={16} style={{ color: '#2563eb' }} />
              <span>
                3. Empresas Asignadas ({formSelectedCompanies.size} seleccionada
                {formSelectedCompanies.size === 1 ? '' : 's'})
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={handleSelectAllCompanies}
                className="btn-link-action"
              >
                Seleccionar Todas
              </button>
              <span style={{ color: '#cbd5e1' }}>|</span>
              <button
                type="button"
                onClick={handleDeselectAllCompanies}
                className="btn-link-action"
                style={{ color: '#64748b' }}
              >
                Desmarcar Todas
              </button>
            </div>
          </div>

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Filtrar empresas por nombre, código o NIT..."
              value={companySearch}
              onChange={(e) => setCompanySearch(e.target.value)}
              className="input-busqueda"
              style={{ fontSize: '0.85rem' }}
            />
          </div>

          <div
            style={{
              maxHeight: '180px',
              overflowY: 'auto',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '6px',
              background: '#f8fafc',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            {filteredModalCompanies.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                No se encontraron empresas activas
              </div>
            ) : (
              filteredModalCompanies.map((c) => {
                const isChecked = formSelectedCompanies.has(c.cod_emp);
                return (
                  <div
                    key={c.cod_emp}
                    onClick={() => toggleCompanySelection(c.cod_emp)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                      background: isChecked ? '#eff6ff' : '#ffffff',
                      border: isChecked ? '1px solid #bfdbfe' : '1px solid #f1f5f9',
                      color: isChecked ? '#1e40af' : '#1e293b',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {isChecked ? (
                        <CheckSquare size={16} style={{ color: '#2563eb', flexShrink: 0 }} />
                      ) : (
                        <Square size={16} style={{ color: '#94a3b8', flexShrink: 0 }} />
                      )}
                      <span>
                        <strong>#{c.cod_emp}</strong> - {c.nom_emp}
                      </span>
                    </div>
                    {c.nit && (
                      <span className="font-mono text-muted" style={{ fontSize: '0.75rem' }}>
                        {c.nit}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Botones de Acción */}
          <div className="modal-actions" style={{ marginTop: '20px' }}>
            <button
              type="button"
              className="btn-secundario"
              onClick={() => setIsModalOpen(false)}
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-primario btn-icon-gap"
              disabled={saving}
            >
              <CheckCircle2 size={16} />
              <span>{saving ? 'Guardando…' : isEditing ? 'Actualizar Usuario' : 'Crear Usuario'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Confirmación de Eliminación */}
      <Modal
        isOpen={Boolean(userToDelete)}
        onClose={() => !deleting && setUserToDelete(null)}
        title="Confirmar Eliminación de Usuario"
        maxWidth="md"
      >
        <div style={{ padding: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
            <div
              style={{
                padding: '12px',
                background: '#fef2f2',
                color: '#dc2626',
                borderRadius: '50%',
                flexShrink: 0,
              }}
            >
              <AlertTriangle size={24} />
            </div>
            <div>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                ¿Eliminar al usuario '{userToDelete?.nom_usu}'?
              </h4>
              <p style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#475569', lineHeight: 1.5 }}>
                Esta acción eliminará de forma permanente el usuario y revocará todos sus accesos a
                las empresas asignadas. Esta acción no se puede deshacer.
              </p>
              {userToDelete?.desc_usu && (
                <div
                  style={{
                    padding: '8px 12px',
                    background: '#f8fafc',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    color: '#475569',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <strong>Nombre asociado:</strong> {userToDelete.desc_usu}
                </div>
              )}
            </div>
          </div>

          <div className="modal-actions" style={{ marginTop: '20px' }}>
            <button
              type="button"
              className="btn-secundario"
              onClick={() => setUserToDelete(null)}
              disabled={deleting}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn-peligro btn-icon-gap"
              onClick={handleConfirmDelete}
              disabled={deleting}
            >
              <Trash2 size={16} />
              <span>{deleting ? 'Eliminando…' : 'Sí, Eliminar Usuario'}</span>
            </button>
          </div>
        </div>
      </Modal>
    </ControlIvaLayout>
  );
}
