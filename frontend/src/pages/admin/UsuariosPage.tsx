import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  CheckSquare,
  Eye,
  EyeOff,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Square,
  Trash2,
  UserCheck,
  Users,
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
import Modal from '../../components/ui/Modal';
import type { AdminUserSummary, CompanyAssignment } from '../../types';
import { matchesSearchTokens } from '../../utils/searchUtils';

export default function UsuariosPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [activeCompanies, setActiveCompanies] = useState<CompanyAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

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
      matchesSearchTokens([u.nom_usu, u.desc_usu, u.cod_rol, u.cod_punto_venta], searchTerm)
    );
  }, [users, searchTerm]);

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
    // Preseleccionar la primera empresa por defecto
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
        form.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input:not([disabled]):not([readonly]), select:not([disabled])')
      );
      const index = elements.indexOf(e.target);
      if (index >= 0 && index < elements.length - 1) {
        elements[index + 1].focus();
      }
    }
  }

  return (
    <ControlIvaLayout>
      <div className="page-header-container">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
              <Users size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Gestión de Usuarios</h1>
              <p className="text-sm text-slate-500">
                Administración de cuentas, perfiles de acceso y empresas asignadas en el sistema
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/admin/asignacion-empresas')}
              className="btn-secundario btn-icon-gap"
              title="Ir a asignación masiva de empresas"
            >
              <ShieldCheck size={16} />
              <span>Asignación de Empresas</span>
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

        {/* Barra de Filtros y Búsqueda */}
        <div className="filtros-card mb-6">
          <div className="search-box">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Buscar por usuario, nombre, rol o punto de venta..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="btn-secundario btn-sm"
              onClick={loadData}
              disabled={loading}
              title="Refrescar usuarios"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Actualizar</span>
            </button>
            <div className="registros-badge">
              <span>{filteredUsers.length} usuarios</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla de Usuarios */}
      <div className="tabla-container-card">
        <table className="tabla-moderna">
          <thead>
            <tr>
              <th className="w-12 text-center">#</th>
              <th>Usuario</th>
              <th>Nombre / Descripción</th>
              <th className="text-center">Rol / Perfil</th>
              <th className="text-center">Punto de Venta</th>
              <th className="text-center">Empresas Asignadas</th>
              <th className="text-center w-32">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="td-cargando">
                  Cargando usuarios del sistema…
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={7} className="td-vacio">
                  No se encontraron usuarios registrados coincidentes con la búsqueda.
                </td>
              </tr>
            ) : (
              filteredUsers.map((u, idx) => {
                const isSuperAdmin = u.nom_usu.toUpperCase() === 'ADMIN';
                const isCurrentSession = u.nom_usu.toUpperCase() === currentAuthUser;

                return (
                  <tr key={u.nom_usu}>
                    <td className="text-center font-mono text-xs text-muted">{idx + 1}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-800">{u.nom_usu}</span>
                        {isSuperAdmin && (
                          <span className="badge badge-info text-xs flex items-center gap-1 font-bold">
                            <ShieldCheck size={12} />
                            ADMIN
                          </span>
                        )}
                        {isCurrentSession && (
                          <span className="badge badge-neutral text-xs font-semibold">Tú</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="text-sm font-medium text-slate-700">
                        {u.desc_usu || <span className="text-muted italic">Sin descripción</span>}
                      </span>
                    </td>
                    <td className="text-center">
                      {u.cod_rol === '01' ? (
                        <span className="badge badge-primary text-xs font-semibold">
                          01 - Administrador
                        </span>
                      ) : u.cod_rol === '02' ? (
                        <span className="badge badge-info text-xs font-semibold">
                          02 - Contador
                        </span>
                      ) : (
                        <span className="badge badge-neutral text-xs font-semibold">
                          {u.cod_rol || '01'}
                        </span>
                      )}
                    </td>
                    <td className="text-center font-mono text-xs text-slate-600">
                      {u.cod_punto_venta || '001'}
                    </td>
                    <td className="text-center">
                      <span
                        className={`badge ${
                          u.total_empresas > 0 ? 'badge-primary' : 'badge-danger'
                        } text-xs font-bold`}
                      >
                        {u.total_empresas} empresa{u.total_empresas === 1 ? '' : 's'}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          className="btn-accion btn-accion-editar"
                          onClick={() => handleOpenEditModal(u)}
                          title={`Editar usuario ${u.nom_usu}`}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          className="btn-accion btn-accion-info"
                          onClick={() =>
                            navigate(
                              `/admin/asignacion-empresas?usuario=${encodeURIComponent(u.nom_usu)}`
                            )
                          }
                          title={`Asignar empresas a ${u.nom_usu}`}
                        >
                          <Building2 size={15} />
                        </button>
                        <button
                          type="button"
                          className="btn-accion btn-accion-eliminar"
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
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
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
          <div className="form-section-title flex items-center gap-2">
            <KeyRound size={16} className="text-blue-600" />
            <span>1. Credenciales de Acceso</span>
          </div>

          <div className="form-grid-symmetrical cols-2">
            <div className="form-group">
              <label className="form-label">
                Usuario (nom_usu) <span className="text-red-500">*</span>
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
              <span className="text-xs text-muted mt-1">Máx. 20 caracteres en mayúsculas</span>
            </div>

            <div className="form-group">
              <label className="form-label">
                Contraseña {isEditing ? '(Opcional)' : <span className="text-red-500">*</span>}
              </label>
              <div className="relative flex items-center">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-input pr-10"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder={
                    isEditing ? 'Dejar en blanco para mantener actual' : 'Contraseña de acceso'
                  }
                  required={!isEditing}
                />
                <button
                  type="button"
                  className="absolute right-2 text-slate-400 hover:text-slate-600 p-1"
                  onClick={() => setShowPassword((p) => !p)}
                  tabIndex={-1}
                  title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <span className="text-xs text-muted mt-1">Mínimo 3 caracteres</span>
            </div>
          </div>

          {/* Sección 2: Datos y Perfil */}
          <div className="form-section-title flex items-center gap-2 mt-4">
            <UserCheck size={16} className="text-blue-600" />
            <span>2. Datos del Usuario y Permisos</span>
          </div>

          <div className="form-grid-symmetrical cols-3">
            <div className="form-group col-span-2">
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
              <label className="form-label">Rol / Perfil</label>
              <select
                className="form-select"
                value={formCodRol}
                onChange={(e) => setFormCodRol(e.target.value)}
              >
                <option value="01">01 - Administrador</option>
                <option value="02">02 - Contador</option>
                <option value="03">03 - Operador / Auxiliar</option>
              </select>
            </div>
          </div>

          <div className="form-grid-symmetrical cols-3 mt-2">
            <div className="form-group">
              <label className="form-label">Punto de Venta</label>
              <input
                type="text"
                className="form-input font-mono text-center"
                value={formCodPuntoVenta}
                onChange={(e) => setFormCodPuntoVenta(e.target.value)}
                maxLength={4}
                placeholder="001"
              />
            </div>
          </div>

          {/* Sección 3: Asignación de Empresas */}
          <div className="form-section-title flex items-center justify-between mt-4">
            <div className="flex items-center gap-2">
              <Building2 size={16} className="text-blue-600" />
              <span>3. Empresas Asignadas ({formSelectedCompanies.size})</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                className="text-blue-600 hover:underline font-semibold"
                onClick={handleSelectAllCompanies}
              >
                Seleccionar todas
              </button>
              <span>|</span>
              <button
                type="button"
                className="text-slate-500 hover:underline"
                onClick={handleDeselectAllCompanies}
              >
                Desmarcar todas
              </button>
            </div>
          </div>

          <div className="mb-2">
            <input
              type="text"
              className="form-input text-xs"
              placeholder="Filtrar empresas por nombre, NIT o registro..."
              value={companySearch}
              onChange={(e) => setCompanySearch(e.target.value)}
            />
          </div>

          <div className="border border-slate-200 rounded-lg p-2 max-h-48 overflow-y-auto bg-slate-50/50 space-y-1">
            {filteredModalCompanies.length === 0 ? (
              <div className="text-center py-4 text-xs text-muted">
                No se encontraron empresas con ese filtro
              </div>
            ) : (
              filteredModalCompanies.map((c) => {
                const isChecked = formSelectedCompanies.has(c.cod_emp);
                return (
                  <div
                    key={c.cod_emp}
                    onClick={() => toggleCompanySelection(c.cod_emp)}
                    className={`flex items-center justify-between p-2 rounded-md cursor-pointer text-xs transition-colors ${
                      isChecked
                        ? 'bg-blue-50 border border-blue-200 text-blue-900 font-medium'
                        : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {isChecked ? (
                        <CheckSquare size={16} className="text-blue-600 flex-shrink-0" />
                      ) : (
                        <Square size={16} className="text-slate-400 flex-shrink-0" />
                      )}
                      <span>
                        <strong>#{c.cod_emp}</strong> - {c.nom_emp}
                      </span>
                    </div>
                    {c.nit && <span className="font-mono text-muted text-xs">{c.nit}</span>}
                  </div>
                );
              })
            )}
          </div>

          {/* Botones de Acción */}
          <div className="modal-actions mt-6">
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
        <div className="p-2">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-red-50 text-red-600 rounded-full flex-shrink-0">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h4 className="font-bold text-slate-800 text-base mb-1">
                ¿Eliminar al usuario '{userToDelete?.nom_usu}'?
              </h4>
              <p className="text-sm text-slate-600 mb-3">
                Esta acción eliminará de forma permanente el usuario y revocará todos sus accesos a
                las empresas asignadas. Esta acción no se puede deshacer.
              </p>
              {userToDelete?.desc_usu && (
                <div className="p-2 bg-slate-100 rounded text-xs text-slate-600 mb-2">
                  <strong>Nombre asociado:</strong> {userToDelete.desc_usu}
                </div>
              )}
            </div>
          </div>

          <div className="modal-actions mt-6">
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
