import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  CheckSquare,
  FileSpreadsheet,
  Pencil,
  Percent,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Square,
  Trash2,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  createEmpresa,
  deleteEmpresa,
  fetchAllEmpresas,
  fetchAdminUsers,
  updateEmpresa,
} from '../../api/admin';
import { obtenerError } from '../../api/client';
import ControlIvaLayout from '../../components/layout/ControlIvaLayout';
import Modal from '../../components/ui/Modal';
import type { AdminUserSummary, EmpresaAdminDetail } from '../../types';
import { matchesSearchTokens } from '../../utils/searchUtils';

export default function EmpresasPage() {
  const navigate = useNavigate();
  const [empresas, setEmpresas] = useState<EmpresaAdminDetail[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'S' | 'N'>('ALL');

  // Modal Crear / Editar
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingCodEmp, setEditingCodEmp] = useState<number | null>(null);

  // Form fields
  const [formNomEmp, setFormNomEmp] = useState('');
  const [formRazonSocial, setFormRazonSocial] = useState('');
  const [formNit, setFormNit] = useState('');
  const [formRegFiscal, setFormRegFiscal] = useState('');
  const [formPorcentajePagoCuenta, setFormPorcentajePagoCuenta] = useState<number | string>(1.75);
  const [formTipoCosto, setFormTipoCosto] = useState('PROMEDIO');
  const [formContador, setFormContador] = useState('');
  const [formDirEmp, setFormDirEmp] = useState('');
  const [formTelEmp, setFormTelEmp] = useState('');
  const [formActiva, setFormActiva] = useState<'S' | 'N'>('S');
  const [formSelectedUsers, setFormSelectedUsers] = useState<Set<string>>(new Set());
  const [userSearch, setUserSearch] = useState('');
  const [saving, setSaving] = useState(false);

  // Modal Eliminar / Desactivar
  const [empresaToDelete, setEmpresaToDelete] = useState<EmpresaAdminDetail | null>(null);
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
      const [empresasData, usersData] = await Promise.all([
        fetchAllEmpresas(),
        fetchAdminUsers(),
      ]);
      setEmpresas(empresasData);
      setAdminUsers(usersData);
    } catch (err) {
      toast.error(obtenerError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Filtrado de empresas
  const filteredEmpresas = useMemo(() => {
    return empresas.filter((e) => {
      if (statusFilter !== 'ALL' && e.activa !== statusFilter) {
        return false;
      }
      return matchesSearchTokens(
        [
          e.nom_emp,
          e.razon_social,
          e.nit,
          e.reg_fiscal,
          e.tel_emp,
          e.contador,
          String(e.cod_emp),
        ],
        searchTerm
      );
    });
  }, [empresas, statusFilter, searchTerm]);

  // Usuarios filtrados dentro del modal de creación
  const filteredModalUsers = useMemo(() => {
    return adminUsers.filter((u) =>
      matchesSearchTokens([u.nom_usu, u.desc_usu, u.cod_rol], userSearch)
    );
  }, [adminUsers, userSearch]);

  function handleOpenCreateModal() {
    setIsEditing(false);
    setEditingCodEmp(null);
    setFormNomEmp('');
    setFormRazonSocial('');
    setFormNit('');
    setFormRegFiscal('');
    setFormPorcentajePagoCuenta(1.75);
    setFormTipoCosto('PROMEDIO');
    setFormContador('');
    setFormDirEmp('');
    setFormTelEmp('');
    setFormActiva('S');
    setUserSearch('');

    // Pre-asignar ADMIN y el usuario logueado por defecto
    const defaultUsers = new Set<string>();
    defaultUsers.add('ADMIN');
    if (currentAuthUser) {
      defaultUsers.add(currentAuthUser);
    }
    setFormSelectedUsers(defaultUsers);

    setIsModalOpen(true);
  }

  function handleOpenEditModal(empresa: EmpresaAdminDetail) {
    setIsEditing(true);
    setEditingCodEmp(empresa.cod_emp);
    setFormNomEmp(empresa.nom_emp);
    setFormRazonSocial(empresa.razon_social || '');
    setFormNit(empresa.nit || '');
    setFormRegFiscal(empresa.reg_fiscal || '');
    setFormPorcentajePagoCuenta(empresa.porcentaje_pago_cuenta ?? 1.75);
    setFormTipoCosto(empresa.tipo_costo || 'PROMEDIO');
    setFormContador(empresa.contador || '');
    setFormDirEmp(empresa.dir_emp || '');
    setFormTelEmp(empresa.tel_emp || '');
    setFormActiva(empresa.activa || 'S');
    setIsModalOpen(true);
  }

  function toggleUserSelection(nomUsu: string) {
    // Si es ADMIN, no permitir deseleccionarlo
    if (nomUsu.toUpperCase() === 'ADMIN') {
      toast('El usuario ADMIN siempre debe mantener acceso a la empresa', { icon: 'ℹ️' });
      return;
    }
    setFormSelectedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(nomUsu)) {
        next.delete(nomUsu);
      } else {
        next.add(nomUsu);
      }
      return next;
    });
  }

  function handleSelectAllUsers() {
    const allUsers = new Set(adminUsers.map((u) => u.nom_usu.toUpperCase()));
    allUsers.add('ADMIN');
    setFormSelectedUsers(allUsers);
  }

  function handleDeselectAllUsers() {
    // Mantener al menos ADMIN
    const adminOnly = new Set<string>(['ADMIN']);
    if (currentAuthUser) adminOnly.add(currentAuthUser);
    setFormSelectedUsers(adminOnly);
  }

  async function handleSubmitForm(e: React.FormEvent) {
    e.preventDefault();

    const cleanNomEmp = formNomEmp.trim().toUpperCase();
    if (!cleanNomEmp) {
      toast.error('El nombre comercial de la empresa es obligatorio');
      return;
    }

    const pctNum = Number(formPorcentajePagoCuenta);
    if (isNaN(pctNum) || pctNum < 0 || pctNum > 100) {
      toast.error('El porcentaje de pago a cuenta debe ser un valor numérico entre 0 y 100');
      return;
    }

    setSaving(true);
    try {
      if (isEditing && editingCodEmp !== null) {
        await updateEmpresa(editingCodEmp, {
          nom_emp: cleanNomEmp,
          razon_social: formRazonSocial.trim() || undefined,
          nit: formNit.trim() || undefined,
          reg_fiscal: formRegFiscal.trim() || undefined,
          dir_emp: formDirEmp.trim() || undefined,
          tel_emp: formTelEmp.trim() || undefined,
          tipo_costo: formTipoCosto.trim() || 'PROMEDIO',
          contador: formContador.trim() || undefined,
          activa: formActiva,
          porcentaje_pago_cuenta: pctNum,
        });
        toast.success(`Empresa #${editingCodEmp} actualizada exitosamente`);
      } else {
        const assignedUsersList = Array.from(formSelectedUsers);
        const res = await createEmpresa({
          nom_emp: cleanNomEmp,
          razon_social: formRazonSocial.trim() || undefined,
          nit: formNit.trim() || undefined,
          reg_fiscal: formRegFiscal.trim() || undefined,
          dir_emp: formDirEmp.trim() || undefined,
          tel_emp: formTelEmp.trim() || undefined,
          tipo_costo: formTipoCosto.trim() || 'PROMEDIO',
          contador: formContador.trim() || undefined,
          activa: formActiva,
          porcentaje_pago_cuenta: pctNum,
          usuariosAsignados: assignedUsersList,
        });
        toast.success(res.message || `Empresa creada exitosamente con código #${res.cod_emp}`);
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
    if (!empresaToDelete) return;
    setDeleting(true);
    try {
      const res = await deleteEmpresa(empresaToDelete.cod_emp);
      toast.success(res.message);
      setEmpresaToDelete(null);
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

  return (
    <ControlIvaLayout>
      <div className="page-header-container">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
              <Building2 size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Gestión de Empresas</h1>
              <p className="text-sm text-slate-500">
                Administración de empresas emisoras, datos fiscales, tasa de pago a cuenta y configuración contable
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/admin/usuarios')}
              className="btn-secundario btn-icon-gap"
              title="Ir a gestión de usuarios"
            >
              <Users size={16} />
              <span>Gestión de Usuarios</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/admin/asignacion-empresas')}
              className="btn-secundario btn-icon-gap"
              title="Ir a asignación de empresas"
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
              <span>Nueva Empresa</span>
            </button>
          </div>
        </div>

        {/* Barra de Filtros y Búsqueda */}
        <div className="filtros-card mb-6">
          <div className="search-box">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Buscar por nombre comercial, razón social, NIT, NRC, teléfono..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'S' | 'N')}
              className="form-input text-xs"
              style={{ width: 'auto', minWidth: '150px' }}
            >
              <option value="ALL">Todas las empresas</option>
              <option value="S">Solo Activas</option>
              <option value="N">Solo Inactivas</option>
            </select>

            <button
              type="button"
              className="btn-secundario btn-sm"
              onClick={loadData}
              disabled={loading}
              title="Refrescar listado"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Actualizar</span>
            </button>

            <div className="registros-badge">
              <span>{filteredEmpresas.length} empresas</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla de Empresas */}
      <div className="tabla-container-card">
        <table className="tabla-moderna">
          <thead>
            <tr>
              <th className="w-12 text-center">#</th>
              <th className="w-16 text-center">Cód.</th>
              <th>Nombre Comercial</th>
              <th>Razón Social</th>
              <th>NIT / NRC</th>
              <th className="text-center">% Pago Cuenta</th>
              <th className="text-center">Usuarios</th>
              <th className="text-center">Estado</th>
              <th className="text-center w-32">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="td-cargando">
                  Cargando empresas del sistema…
                </td>
              </tr>
            ) : filteredEmpresas.length === 0 ? (
              <tr>
                <td colSpan={9} className="td-vacio">
                  No se encontraron empresas registradas coincidentes con los filtros aplicados.
                </td>
              </tr>
            ) : (
              filteredEmpresas.map((e, idx) => {
                const isActive = e.activa === 'S';
                const pct = Number(e.porcentaje_pago_cuenta ?? 1.75);

                return (
                  <tr key={e.cod_emp} className={!isActive ? 'opacity-70 bg-slate-50' : ''}>
                    <td className="text-center font-mono text-xs text-muted">{idx + 1}</td>
                    <td className="text-center font-mono font-bold text-slate-800">
                      #{e.cod_emp}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{e.nom_emp}</span>
                        {e.contador && (
                          <span
                            className="text-xs text-slate-400"
                            title={`Contador: ${e.contador}`}
                          >
                            • {e.contador}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="text-sm text-slate-600">
                        {e.razon_social || <span className="text-muted italic">—</span>}
                      </span>
                    </td>
                    <td>
                      <div className="flex flex-col font-mono text-xs">
                        <span className="text-slate-800 font-medium">
                          NIT: {e.nit || <span className="text-muted italic">Sin NIT</span>}
                        </span>
                        {e.reg_fiscal && (
                          <span className="text-slate-500">NRC: {e.reg_fiscal}</span>
                        )}
                      </div>
                    </td>
                    <td className="text-center">
                      <span className="badge badge-info font-mono font-bold text-xs">
                        {pct.toFixed(2)}%
                      </span>
                    </td>
                    <td className="text-center">
                      <button
                        type="button"
                        onClick={() => navigate('/admin/asignacion-empresas')}
                        className={`badge ${
                          (e.total_usuarios || 0) > 0 ? 'badge-primary' : 'badge-danger'
                        } text-xs font-semibold cursor-pointer hover:opacity-80 transition-opacity`}
                        title="Ver usuarios asignados a esta empresa"
                      >
                        {e.total_usuarios || 0} usuario{(e.total_usuarios || 0) === 1 ? '' : 's'}
                      </button>
                    </td>
                    <td className="text-center">
                      {isActive ? (
                        <span className="badge badge-success text-xs font-semibold">
                          Activa
                        </span>
                      ) : (
                        <span className="badge badge-neutral text-xs font-semibold">
                          Inactiva
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          className="btn-accion btn-accion-editar"
                          onClick={() => handleOpenEditModal(e)}
                          title={`Editar empresa #${e.cod_emp} - ${e.nom_emp}`}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          className="btn-accion btn-accion-info"
                          onClick={() => navigate('/admin/asignacion-empresas')}
                          title={`Gestionar accesos a #${e.cod_emp}`}
                        >
                          <Users size={15} />
                        </button>
                        <button
                          type="button"
                          className="btn-accion btn-accion-eliminar"
                          onClick={() => setEmpresaToDelete(e)}
                          title={`Eliminar o desactivar empresa #${e.cod_emp}`}
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

      {/* Modal Crear / Editar Empresa */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isEditing ? `Editar Empresa #${editingCodEmp}: ${formNomEmp}` : 'Crear Nueva Empresa'}
        maxWidth="4xl"
      >
        <form onSubmit={handleSubmitForm} onKeyDown={handleEnterNavigation} className="form-symmetrical">
          {/* Banner de Inicialización Automática (Solo al Crear) */}
          {!isEditing && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 mb-4 text-blue-900 shadow-sm">
              <div className="font-bold flex items-center gap-2 mb-1.5 text-blue-800 text-sm">
                <Sparkles size={18} className="text-blue-600" />
                <span>Inicialización Automática de Catálogos Contables y Tributarios</span>
              </div>
              <p className="text-xs text-blue-700 leading-relaxed mb-2">
                Al guardar, el sistema configurará automáticamente los catálogos base para esta empresa:
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs text-blue-800 font-medium bg-white/70 rounded-lg p-2.5 border border-blue-100">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-600 flex-shrink-0" />
                  <span>9 Tipos de Cuenta (Activo, Pasivo, Capital...)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-600 flex-shrink-0" />
                  <span>13 Tipos de Partida (Ingresos, Egresos, Diario...)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-600 flex-shrink-0" />
                  <span>12 Tipos de Documento (CCF, FAC, FEX, NCR...)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-600 flex-shrink-0" />
                  <span>2 Tipos de Pago (01 Contado, 02 Crédito)</span>
                </div>
              </div>
            </div>
          )}

          {/* Sección 1: Datos de Identificación y Fiscales */}
          <div className="form-section-title flex items-center gap-2">
            <Building2 size={16} className="text-blue-600" />
            <span>1. Identificación y Registro Fiscal</span>
          </div>

          <div className="form-grid-symmetrical cols-2">
            <div className="form-group col-span-2">
              <label className="form-label">
                Nombre Comercial <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="form-input font-bold uppercase"
                value={formNomEmp}
                onChange={(e) => setFormNomEmp(e.target.value.toUpperCase())}
                placeholder="EJ. COMERCIAL SALVADOREÑA S.A. DE C.V."
                maxLength={60}
                required
              />
              <span className="text-xs text-muted mt-1">Nombre visible en encabezados y reportes</span>
            </div>

            <div className="form-group col-span-2">
              <label className="form-label">Razón Social</label>
              <input
                type="text"
                className="form-input uppercase"
                value={formRazonSocial}
                onChange={(e) => setFormRazonSocial(e.target.value.toUpperCase())}
                placeholder="Nombre o Razón Social registrada legalmente"
                maxLength={100}
              />
            </div>

            <div className="form-group">
              <label className="form-label">NIT (Número de Identificación Tributaria)</label>
              <input
                type="text"
                className="form-input font-mono"
                value={formNit}
                onChange={(e) => setFormNit(e.target.value)}
                placeholder="0614-010190-101-1"
                maxLength={20}
              />
            </div>

            <div className="form-group">
              <label className="form-label">NRC / Registro Fiscal</label>
              <input
                type="text"
                className="form-input font-mono"
                value={formRegFiscal}
                onChange={(e) => setFormRegFiscal(e.target.value)}
                placeholder="123456-7"
                maxLength={20}
              />
            </div>
          </div>

          {/* Sección 2: Parámetros Tributarios y Contables */}
          <div className="form-section-title flex items-center gap-2 mt-4">
            <Percent size={16} className="text-blue-600" />
            <span>2. Parámetros Tributarios y Configuración de Pago a Cuenta</span>
          </div>

          <div className="form-grid-symmetrical cols-3">
            <div className="form-group">
              <label className="form-label">
                % Pago a Cuenta <span className="text-red-500">*</span>
              </label>
              <div className="relative flex items-center">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  className="form-input font-mono font-bold pr-8"
                  value={formPorcentajePagoCuenta}
                  onChange={(e) => setFormPorcentajePagoCuenta(e.target.value)}
                  placeholder="1.75"
                  required
                />
                <span className="absolute right-3 text-slate-400 font-bold text-sm">%</span>
              </div>
              <span className="text-xs text-muted mt-1">
                Por defecto <strong>1.75%</strong>. Gasolineras: 0.30%, Agro: 0.75%.
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">Tipo de Costeo</label>
              <select
                className="form-input font-semibold"
                value={formTipoCosto}
                onChange={(e) => setFormTipoCosto(e.target.value)}
              >
                <option value="PROMEDIO">PROMEDIO PONDERADO</option>
                <option value="PEPS">PEPS (PRIMERO EN ENTRAR, PRIMERO EN SALIR)</option>
                <option value="UEPS">UEPS (ÚLTIMO EN ENTRAR, PRIMERO EN SALIR)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Estado de la Empresa</label>
              <select
                className="form-input font-semibold"
                value={formActiva}
                onChange={(e) => setFormActiva(e.target.value as 'S' | 'N')}
              >
                <option value="S">ACTIVA (Habilitada en el sistema)</option>
                <option value="N">INACTIVA (Deshabilitada)</option>
              </select>
            </div>

            <div className="form-group col-span-3">
              <label className="form-label">Nombre del Contador / Auditor</label>
              <input
                type="text"
                className="form-input"
                value={formContador}
                onChange={(e) => setFormContador(e.target.value)}
                placeholder="Nombre del contador público o representante contable"
                maxLength={50}
              />
            </div>
          </div>

          {/* Sección 3: Contacto y Domicilio */}
          <div className="form-section-title flex items-center gap-2 mt-4">
            <FileSpreadsheet size={16} className="text-blue-600" />
            <span>3. Domicilio y Contacto</span>
          </div>

          <div className="form-grid-symmetrical cols-3">
            <div className="form-group col-span-2">
              <label className="form-label">Dirección Fiscal / Domicilio</label>
              <input
                type="text"
                className="form-input"
                value={formDirEmp}
                onChange={(e) => setFormDirEmp(e.target.value)}
                placeholder="Dirección completa del establecimiento"
                maxLength={100}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Teléfono</label>
              <input
                type="text"
                className="form-input font-mono"
                value={formTelEmp}
                onChange={(e) => setFormTelEmp(e.target.value)}
                placeholder="2222-0000"
                maxLength={15}
              />
            </div>
          </div>

          {/* Sección 4: Asignación Inicial de Usuarios (Solo al Crear) */}
          {!isEditing && (
            <>
              <div className="form-section-title flex items-center justify-between mt-4">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-blue-600" />
                  <span>4. Asignación Inicial de Usuarios</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAllUsers}
                    className="text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                  >
                    Seleccionar Todos
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={handleDeselectAllUsers}
                    className="text-xs text-slate-500 hover:text-slate-700 font-semibold cursor-pointer"
                  >
                    Solo Administrador
                  </button>
                </div>
              </div>

              <div className="search-box mb-2">
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  placeholder="Filtrar usuarios para asignación..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="search-input text-xs"
                />
              </div>

              <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1 bg-slate-50/50">
                {filteredModalUsers.length === 0 ? (
                  <div className="p-3 text-center text-xs text-slate-400">
                    No se encontraron usuarios coincidentes
                  </div>
                ) : (
                  filteredModalUsers.map((u) => {
                    const isChecked = formSelectedUsers.has(u.nom_usu.toUpperCase());
                    const isSuperAdmin = u.nom_usu.toUpperCase() === 'ADMIN';

                    return (
                      <div
                        key={u.nom_usu}
                        onClick={() => toggleUserSelection(u.nom_usu)}
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors text-xs ${
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
                          <span className="font-mono font-bold">{u.nom_usu}</span>
                          {u.desc_usu && (
                            <span className="text-slate-500 font-normal">
                              ({u.desc_usu})
                            </span>
                          )}
                          {isSuperAdmin && (
                            <span className="badge badge-info text-2xs font-bold py-0 px-1">
                              ADMIN
                            </span>
                          )}
                        </div>
                        <span className="text-muted text-2xs">Rol: {u.cod_rol || '01'}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}

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
              <span>{saving ? 'Guardando…' : isEditing ? 'Actualizar Empresa' : 'Crear Empresa'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Confirmación de Eliminación / Desactivación */}
      <Modal
        isOpen={Boolean(empresaToDelete)}
        onClose={() => !deleting && setEmpresaToDelete(null)}
        title="Confirmar Eliminación o Desactivación"
        maxWidth="md"
      >
        <div className="p-2">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-red-50 text-red-600 rounded-full flex-shrink-0">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h4 className="font-bold text-slate-800 text-base mb-1">
                ¿Eliminar o Desactivar la Empresa #{empresaToDelete?.cod_emp}?
              </h4>
              <p className="text-sm font-semibold text-slate-700 mb-2">
                {empresaToDelete?.nom_emp}
              </p>
              <p className="text-xs text-slate-600 mb-3 leading-relaxed">
                Si la empresa ya cuenta con movimientos tributarios (compras/ventas) o partidas
                contables registradas, el sistema la <strong>desactivará de forma segura</strong>{' '}
                (Estado: Inactiva) para preservar la integridad de los libros fiscales.
              </p>
              <p className="text-xs text-slate-500 mb-3 leading-relaxed">
                Si es una empresa recién creada sin movimientos, será eliminada completamente de la base
                de datos.
              </p>
              {empresaToDelete?.razon_social && (
                <div className="p-2 bg-slate-100 rounded text-xs text-slate-600 mb-2">
                  <strong>Razón Social:</strong> {empresaToDelete.razon_social}
                </div>
              )}
            </div>
          </div>

          <div className="modal-actions mt-6">
            <button
              type="button"
              className="btn-secundario"
              onClick={() => setEmpresaToDelete(null)}
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
              <span>{deleting ? 'Procesando…' : 'Sí, Proceder'}</span>
            </button>
          </div>
        </div>
      </Modal>
    </ControlIvaLayout>
  );
}
