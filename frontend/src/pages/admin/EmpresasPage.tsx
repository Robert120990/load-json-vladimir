import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  CheckSquare,
  Edit2,
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
import Badge from '../../components/ui/Badge';
import DataTable, { Column } from '../../components/ui/DataTable';
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
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

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

  // Paginación
  const paginatedEmpresas = useMemo(() => {
    const start = (page - 1) * limit;
    return filteredEmpresas.slice(start, start + limit);
  }, [filteredEmpresas, page, limit]);

  // Usuarios filtrados en el modal
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

  const columns: Column<EmpresaAdminDetail>[] = [
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
      key: 'cod_emp',
      header: 'Cód.',
      align: 'center',
      render: (e) => (
        <strong className="font-mono text-primary" style={{ fontSize: '0.85rem' }}>
          #{e.cod_emp}
        </strong>
      ),
    },
    {
      key: 'nom_emp',
      header: 'Nombre Comercial',
      render: (e) => (
        <div>
          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.88rem' }}>{e.nom_emp}</div>
          {e.contador && (
            <div className="text-muted text-xs" style={{ marginTop: '2px' }}>
              Contador: {e.contador}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'razon_social',
      header: 'Razón Social',
      render: (e) => (
        <span style={{ color: '#475569', fontSize: '0.82rem' }}>
          {e.razon_social || <span className="text-muted italic">—</span>}
        </span>
      ),
    },
    {
      key: 'fiscal',
      header: 'NIT / NRC',
      render: (e) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontFamily: 'monospace', fontSize: '0.78rem' }}>
          <div>
            <span style={{ color: '#64748b' }}>NIT: </span>
            <strong style={{ color: '#1e293b' }}>{e.nit || '—'}</strong>
          </div>
          {e.reg_fiscal && (
            <div>
              <span style={{ color: '#64748b' }}>NRC: </span>
              <span style={{ color: '#475569' }}>{e.reg_fiscal}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'porcentaje_pago_cuenta',
      header: '% Pago Cuenta',
      align: 'center',
      render: (e) => (
        <Badge variant="info">
          {Number(e.porcentaje_pago_cuenta ?? 1.75).toFixed(2)}%
        </Badge>
      ),
    },
    {
      key: 'total_usuarios',
      header: 'Usuarios',
      align: 'center',
      render: (e) => (
        <button
          type="button"
          onClick={() => navigate('/admin/asignacion-empresas')}
          style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
          title="Ver usuarios asignados a esta empresa"
        >
          <Badge variant={(e.total_usuarios || 0) > 0 ? 'primary' : 'danger'}>
            {e.total_usuarios || 0} {(e.total_usuarios === 1 ? 'usuario' : 'usuarios')}
          </Badge>
        </button>
      ),
    },
    {
      key: 'activa',
      header: 'Estado',
      align: 'center',
      render: (e) => (
        <Badge variant={e.activa === 'S' ? 'success' : 'neutral'}>
          {e.activa === 'S' ? 'Activa' : 'Inactiva'}
        </Badge>
      ),
    },
  ];

  return (
    <ControlIvaLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Gestión de Empresas</h1>
          <p className="page-subtitle">
            Administración de empresas emisoras, datos fiscales, tasa de pago a cuenta y configuración contable
          </p>
        </div>

        <div className="header-actions">
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

      <div className="card">
        {/* Barra superior de filtros de estado y refrescar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '14px',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>
              Filtrar por estado:
            </span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as 'ALL' | 'S' | 'N');
                setPage(1);
              }}
              className="select-periodo"
              style={{ padding: '6px 12px', fontSize: '0.85rem', minWidth: '160px' }}
            >
              <option value="ALL">Todas las empresas</option>
              <option value="S">Solo Activas</option>
              <option value="N">Solo Inactivas</option>
            </select>
          </div>

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
        </div>

        <DataTable
          columns={columns}
          data={paginatedEmpresas}
          loading={loading}
          total={filteredEmpresas.length}
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
          searchPlaceholder="Buscar por nombre comercial, razón social, NIT, NRC, teléfono..."
          emptyMessage="No se encontraron empresas registradas coincidentes con los filtros aplicados."
          actions={(e) => (
            <div className="acciones-fila">
              <button
                type="button"
                className="btn-accion btn-editar"
                onClick={() => handleOpenEditModal(e)}
                title={`Editar empresa #${e.cod_emp} - ${e.nom_emp}`}
              >
                <Edit2 size={16} />
              </button>
              <button
                type="button"
                className="btn-accion btn-ver"
                onClick={() => navigate('/admin/asignacion-empresas')}
                title={`Gestionar accesos a #${e.cod_emp}`}
              >
                <Users size={16} />
              </button>
              <button
                type="button"
                className="btn-accion btn-eliminar"
                onClick={() => setEmpresaToDelete(e)}
                title={`Eliminar o desactivar empresa #${e.cod_emp}`}
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}
        />
      </div>

      {/* Modal Crear / Editar Empresa */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isEditing ? `Editar Empresa #${editingCodEmp}: ${formNomEmp}` : 'Crear Nueva Empresa'}
        maxWidth="2xl"
      >
        <form onSubmit={handleSubmitForm} onKeyDown={handleEnterNavigation} className="form-symmetrical">
          {/* Banner de Inicialización Automática (Solo al Crear) */}
          {!isEditing && (
            <div
              style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '10px',
                padding: '14px 16px',
                color: '#1e3a8a',
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '6px',
                  color: '#1d4ed8',
                  fontSize: '0.88rem',
                }}
              >
                <Sparkles size={18} style={{ color: '#2563eb' }} />
                <span>Inicialización Automática de Catálogos Contables y Tributarios</span>
              </div>
              <p style={{ fontSize: '0.78rem', color: '#1e40af', margin: '0 0 8px 0', lineHeight: 1.4 }}>
                Al guardar, el sistema configurará automáticamente los catálogos base para esta empresa:
              </p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '6px',
                  fontSize: '0.76rem',
                  background: 'rgba(255, 255, 255, 0.7)',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  border: '1px solid #dbeafe',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle2 size={14} style={{ color: '#16a34a', flexShrink: 0 }} />
                  <span>9 Tipos de Cuenta (Activo, Pasivo, etc.)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle2 size={14} style={{ color: '#16a34a', flexShrink: 0 }} />
                  <span>13 Tipos de Partida (Diario, Gastos, etc.)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle2 size={14} style={{ color: '#16a34a', flexShrink: 0 }} />
                  <span>12 Tipos de Documento (CCF, FAC, etc.)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle2 size={14} style={{ color: '#16a34a', flexShrink: 0 }} />
                  <span>2 Tipos de Pago (Contado, Crédito)</span>
                </div>
              </div>
            </div>
          )}

          {/* Sección 1: Datos de Identificación y Fiscales */}
          <div className="form-section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 size={16} style={{ color: '#2563eb' }} />
            <span>1. Identificación y Registro Fiscal</span>
          </div>

          <div className="form-grid-symmetrical cols-2">
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">
                Nombre Comercial <span style={{ color: '#ef4444' }}>*</span>
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
              <span className="text-muted" style={{ fontSize: '0.75rem', marginTop: '2px' }}>
                Nombre visible en encabezados y reportes
              </span>
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
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
              <label className="form-label">NIT</label>
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
          <div className="form-section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
            <Percent size={16} style={{ color: '#2563eb' }} />
            <span>2. Parámetros Tributarios y Configuración de Pago a Cuenta</span>
          </div>

          <div className="form-grid-symmetrical cols-3">
            <div className="form-group">
              <label className="form-label">
                % Pago a Cuenta <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  className="form-input font-mono font-bold"
                  style={{ paddingRight: '32px' }}
                  value={formPorcentajePagoCuenta}
                  onChange={(e) => setFormPorcentajePagoCuenta(e.target.value)}
                  placeholder="1.75"
                  required
                />
                <span
                  style={{
                    position: 'absolute',
                    right: '10px',
                    color: '#94a3b8',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                  }}
                >
                  %
                </span>
              </div>
              <span className="text-muted" style={{ fontSize: '0.72rem', marginTop: '2px' }}>
                Por defecto <strong>1.75%</strong>.
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">Tipo de Costeo</label>
              <select
                className="form-input"
                value={formTipoCosto}
                onChange={(e) => setFormTipoCosto(e.target.value)}
              >
                <option value="PROMEDIO">PROMEDIO PONDERADO</option>
                <option value="PEPS">PEPS (PRIMERO EN ENTRAR...)</option>
                <option value="UEPS">UEPS (ÚLTIMO EN ENTRAR...)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Estado de la Empresa</label>
              <select
                className="form-input"
                value={formActiva}
                onChange={(e) => setFormActiva(e.target.value as 'S' | 'N')}
              >
                <option value="S">ACTIVA (Habilitada)</option>
                <option value="N">INACTIVA (Deshabilitada)</option>
              </select>
            </div>

            <div className="form-group" style={{ gridColumn: 'span 3' }}>
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
          <div className="form-section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
            <Building2 size={16} style={{ color: '#2563eb' }} />
            <span>3. Domicilio y Contacto</span>
          </div>

          <div className="form-grid-symmetrical cols-3">
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
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
                  <Users size={16} style={{ color: '#2563eb' }} />
                  <span>
                    4. Asignación Inicial de Usuarios ({formSelectedUsers.size} seleccionados)
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={handleSelectAllUsers}
                    className="btn-link-action"
                  >
                    Seleccionar Todos
                  </button>
                  <span style={{ color: '#cbd5e1' }}>|</span>
                  <button
                    type="button"
                    onClick={handleDeselectAllUsers}
                    className="btn-link-action"
                    style={{ color: '#64748b' }}
                  >
                    Solo Administrador
                  </button>
                </div>
              </div>

              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  placeholder="Filtrar usuarios para asignación..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
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
                {filteredModalUsers.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
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
                          <span className="font-mono" style={{ fontWeight: 700 }}>
                            {u.nom_usu}
                          </span>
                          {u.desc_usu && (
                            <span style={{ color: '#64748b' }}>({u.desc_usu})</span>
                          )}
                          {isSuperAdmin && <Badge variant="info">ADMIN</Badge>}
                        </div>
                        <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                          Rol: {u.cod_rol || '01'}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}

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
                ¿Eliminar o Desactivar la Empresa #{empresaToDelete?.cod_emp}?
              </h4>
              <p style={{ margin: '0 0 8px 0', fontSize: '0.9rem', fontWeight: 600, color: '#1e293b' }}>
                {empresaToDelete?.nom_emp}
              </p>
              <p style={{ margin: '0 0 10px 0', fontSize: '0.82rem', color: '#475569', lineHeight: 1.5 }}>
                Si la empresa ya cuenta con movimientos tributarios (compras/ventas) o partidas
                contables registradas, el sistema la <strong>desactivará de forma segura</strong>{' '}
                (Estado: Inactiva) para preservar la integridad de los libros fiscales.
              </p>
              <p style={{ margin: '0 0 10px 0', fontSize: '0.8rem', color: '#64748b', lineHeight: 1.5 }}>
                Si es una empresa recién creada sin movimientos, será eliminada completamente de la base
                de datos.
              </p>
              {empresaToDelete?.razon_social && (
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
                  <strong>Razón Social:</strong> {empresaToDelete.razon_social}
                </div>
              )}
            </div>
          </div>

          <div className="modal-actions" style={{ marginTop: '20px' }}>
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
