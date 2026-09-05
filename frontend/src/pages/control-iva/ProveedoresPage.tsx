import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Edit2, Eye, Plus, Trash2 } from 'lucide-react';
import {
  createProveedor,
  deleteProveedor,
  fetchDepartamentos,
  fetchMunicipios,
  fetchProveedores,
  updateProveedor,
} from '../../api/controlIva';
import { obtenerError } from '../../api/client';
import ControlIvaLayout from '../../components/layout/ControlIvaLayout';
import Badge from '../../components/ui/Badge';
import ConfirmModal from '../../components/ui/ConfirmModal';
import DataTable, { Column } from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import type { Department, Municipality, Supplier } from '../../types/controlIva';

export default function ProveedoresPage() {
  const [proveedores, setProveedores] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState('');

  // Catalogs
  const [departamentos, setDepartamentos] = useState<Department[]>([]);
  const [municipios, setMunicipios] = useState<Municipality[]>([]);

  // Modals state
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view' | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  // Form state
  const [formData, setFormData] = useState<Partial<Supplier>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchDepartamentos()
      .then(setDepartamentos)
      .catch(() => {});
  }, []);

  useEffect(() => {
    cargarProveedores();
  }, [page, limit, search]);

  async function cargarProveedores() {
    try {
      setLoading(true);
      const res = await fetchProveedores({ page, limit, search });
      setProveedores(res.data);
      setTotal(res.total);
    } catch (err) {
      toast.error(obtenerError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleDeptChange(deptId: number) {
    setFormData((prev) => ({ ...prev, cod_dept: deptId, cod_muni: undefined }));
    try {
      const res = await fetchMunicipios(deptId);
      setMunicipios(res);
    } catch {
      setMunicipios([]);
    }
  }

  function abrirModalCrear() {
    setFormData({
      cod_proveedor: '',
      nom_proveedor: '',
      registro: '',
      nit_proveedor: '',
      dir_proveedor: '',
      telefono: '',
      giro: '',
      pais: 'EL SALVADOR',
      cod_dept: departamentos[0]?.cod_dept ?? 1,
      cod_muni: 1,
      activo: 1,
      exento: 0,
      exterior: 0,
      con_retencion: 0,
      con_percepcion: 0,
      deducible: 100,
    });
    setFormErrors({});
    if (departamentos[0]?.cod_dept) {
      fetchMunicipios(departamentos[0].cod_dept).then(setMunicipios);
    }
    setModalMode('create');
  }

  async function abrirModalEditar(supplier: Supplier) {
    setSelectedSupplier(supplier);
    setFormData({ ...supplier });
    setFormErrors({});
    if (supplier.cod_dept) {
      const munis = await fetchMunicipios(supplier.cod_dept).catch(() => []);
      setMunicipios(munis);
    }
    setModalMode('edit');
  }

  function abrirModalVer(supplier: Supplier) {
    setSelectedSupplier(supplier);
    setModalMode('view');
  }

  function abrirModalEliminar(supplier: Supplier) {
    setSupplierToDelete(supplier);
    setDeleteModalOpen(true);
  }

  function validarFormulario(): boolean {
    const errors: Record<string, string> = {};
    if (!formData.nom_proveedor?.trim()) {
      errors.nom_proveedor = 'El nombre del proveedor es obligatorio';
    }
    if (modalMode === 'create' && !formData.cod_proveedor?.trim() && !formData.registro?.trim()) {
      errors.cod_proveedor = 'El código o NRC es obligatorio';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validarFormulario()) return;

    const sanitizedData: Partial<Supplier> = {
      ...formData,
      cod_proveedor: formData.cod_proveedor?.trim().toUpperCase(),
      registro: formData.registro?.trim().toUpperCase(),
      nom_proveedor: formData.nom_proveedor?.trim().toUpperCase(),
      nit_proveedor: formData.nit_proveedor?.trim().toUpperCase(),
      telefono: formData.telefono?.trim().toUpperCase(),
      giro: formData.giro?.trim().toUpperCase(),
      dir_proveedor: formData.dir_proveedor?.trim().toUpperCase(),
    };

    try {
      setSubmitting(true);
      if (modalMode === 'create') {
        await createProveedor(sanitizedData);
        toast.success('Proveedor creado correctamente');
      } else if (modalMode === 'edit' && selectedSupplier) {
        await updateProveedor(selectedSupplier.cod_proveedor, sanitizedData);
        toast.success('Proveedor actualizado correctamente');
      }
      setModalMode(null);
      cargarProveedores();
    } catch (err) {
      toast.error(obtenerError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmDelete() {
    if (!supplierToDelete) return;
    try {
      setDeleting(true);
      await deleteProveedor(supplierToDelete.cod_proveedor);
      toast.success(`Proveedor '${supplierToDelete.nom_proveedor}' eliminado exitosamente`);
      setDeleteModalOpen(false);
      setSupplierToDelete(null);
      cargarProveedores();
    } catch (err) {
      toast.error(obtenerError(err));
    } finally {
      setDeleting(false);
    }
  }

  const columns: Column<Supplier>[] = [
    {
      key: 'cod_proveedor',
      header: 'Código / NRC',
      render: (row) => (
        <div>
          <strong className="text-primary">{row.cod_proveedor}</strong>
          {row.registro && row.registro !== row.cod_proveedor && (
            <div className="text-muted text-xs">NRC: {row.registro}</div>
          )}
        </div>
      ),
    },
    {
      key: 'nom_proveedor',
      header: 'Proveedor / Razón Social',
      render: (row) => (
        <div>
          <div className="font-semibold">{row.nom_proveedor}</div>
          {row.giro && <div className="text-muted text-xs truncate max-w-xs">{row.giro}</div>}
        </div>
      ),
    },
    {
      key: 'nit_proveedor',
      header: 'NIT',
      render: (row) => row.nit_proveedor || '-',
    },
    {
      key: 'telefono',
      header: 'Teléfono',
      render: (row) => row.telefono || '-',
    },
    {
      key: 'ubicacion',
      header: 'Ubicación',
      render: (row) => (
        <span className="text-xs">
          {row.nom_dept ? `${row.nom_dept}${row.nom_muni ? ` / ${row.nom_muni}` : ''}` : '-'}
        </span>
      ),
    },
  ];

  return (
    <ControlIvaLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Catálogo Global de Proveedores</h1>
          <p className="page-subtitle">
            Administra los proveedores registrados para la emisión y control de compras IVA
          </p>
        </div>
        <button type="button" className="btn-primario" onClick={abrirModalCrear}>
          <Plus size={18} />
          Nuevo Proveedor
        </button>
      </div>

      <div className="card">
        <DataTable
          columns={columns}
          data={proveedores}
          loading={loading}
          total={total}
          page={page}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={(l) => {
            setLimit(l);
            setPage(1);
          }}
          searchTerm={search}
          onSearchChange={(s) => {
            setSearch(s);
            setPage(1);
          }}
          searchPlaceholder="Buscar por nombre, NRC, NIT o código..."
          actions={(row) => (
            <div className="acciones-fila">
              <button
                type="button"
                className="btn-accion btn-ver"
                onClick={() => abrirModalVer(row)}
                title="Ver detalle"
              >
                <Eye size={16} />
              </button>
              <button
                type="button"
                className="btn-accion btn-editar"
                onClick={() => abrirModalEditar(row)}
                title="Editar proveedor"
              >
                <Edit2 size={16} />
              </button>
              <button
                type="button"
                className="btn-accion btn-eliminar"
                onClick={() => abrirModalEliminar(row)}
                title="Eliminar proveedor"
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}
        />
      </div>

      {/* Modal Crear / Editar */}
      {(modalMode === 'create' || modalMode === 'edit') && (
        <Modal
          isOpen={true}
          onClose={() => setModalMode(null)}
          title={
            modalMode === 'create'
              ? 'Agregar Nuevo Proveedor'
              : `Editar Proveedor: ${selectedSupplier?.nom_proveedor}`
          }
          maxWidth="2xl"
        >
          <form onSubmit={handleSubmit} className="form-grid">
            <div className="form-row col-2">
              <div className="form-group">
                <label className="form-label">Código / NRC *</label>
                <input
                  type="text"
                  className={`form-input input-uppercase ${formErrors.cod_proveedor ? 'input-error' : ''}`}
                  value={formData.cod_proveedor ?? ''}
                  onChange={(e) => setFormData({ ...formData, cod_proveedor: e.target.value.toUpperCase() })}
                  placeholder="Ej: 102590-2"
                  disabled={modalMode === 'edit'}
                />
                {formErrors.cod_proveedor && (
                  <span className="form-error-msg">{formErrors.cod_proveedor}</span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Número de Registro (NRC)</label>
                <input
                  type="text"
                  className="form-input input-uppercase"
                  value={formData.registro ?? ''}
                  onChange={(e) => setFormData({ ...formData, registro: e.target.value.toUpperCase() })}
                  placeholder="Ej: 102590-2"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Nombre o Razón Social *</label>
              <input
                type="text"
                className={`form-input input-uppercase ${formErrors.nom_proveedor ? 'input-error' : ''}`}
                value={formData.nom_proveedor ?? ''}
                onChange={(e) => setFormData({ ...formData, nom_proveedor: e.target.value.toUpperCase() })}
                placeholder="Nombre completo o razón social del proveedor"
              />
              {formErrors.nom_proveedor && (
                <span className="form-error-msg">{formErrors.nom_proveedor}</span>
              )}
            </div>

            <div className="form-row col-2">
              <div className="form-group">
                <label className="form-label">NIT</label>
                <input
                  type="text"
                  className="form-input input-uppercase"
                  value={formData.nit_proveedor ?? ''}
                  onChange={(e) => setFormData({ ...formData, nit_proveedor: e.target.value.toUpperCase() })}
                  placeholder="0614-000000-000-0"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Teléfono</label>
                <input
                  type="text"
                  className="form-input input-uppercase"
                  value={formData.telefono ?? ''}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value.toUpperCase() })}
                  placeholder="2222-0000"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Giro o Actividad Económica</label>
              <input
                type="text"
                className="form-input input-uppercase"
                value={formData.giro ?? ''}
                onChange={(e) => setFormData({ ...formData, giro: e.target.value.toUpperCase() })}
                placeholder="Actividad económica del proveedor"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Dirección</label>
              <textarea
                className="form-input input-uppercase"
                rows={2}
                value={formData.dir_proveedor ?? ''}
                onChange={(e) => setFormData({ ...formData, dir_proveedor: e.target.value.toUpperCase() })}
                placeholder="Dirección del proveedor"
              />
            </div>

            <div className="form-row col-2">
              <div className="form-group">
                <label className="form-label">Departamento</label>
                <select
                  className="form-input"
                  value={formData.cod_dept ?? 1}
                  onChange={(e) => handleDeptChange(Number(e.target.value))}
                >
                  {departamentos.map((d) => (
                    <option key={d.cod_dept} value={d.cod_dept}>
                      {d.nom_dept}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Municipio</label>
                <select
                  className="form-input"
                  value={formData.cod_muni ?? 1}
                  onChange={(e) => setFormData({ ...formData, cod_muni: Number(e.target.value) })}
                >
                  {municipios.map((m) => (
                    <option key={m.cod_muni} value={m.cod_muni}>
                      {m.nom_muni}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row col-3">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={Boolean(formData.activo)}
                  onChange={(e) => setFormData({ ...formData, activo: e.target.checked ? 1 : 0 })}
                />
                <span>Proveedor Activo</span>
              </label>

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={Boolean(formData.con_retencion)}
                  onChange={(e) =>
                    setFormData({ ...formData, con_retencion: e.target.checked ? 1 : 0 })
                  }
                />
                <span>Agente de Retención</span>
              </label>

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={Boolean(formData.con_percepcion)}
                  onChange={(e) =>
                    setFormData({ ...formData, con_percepcion: e.target.checked ? 1 : 0 })
                  }
                />
                <span>Agente de Percepción</span>
              </label>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn-secundario"
                onClick={() => setModalMode(null)}
                disabled={submitting}
              >
                Cancelar
              </button>
              <button type="submit" className="btn-primario" disabled={submitting}>
                {submitting
                  ? 'Guardando…'
                  : modalMode === 'create'
                  ? 'Crear Proveedor'
                  : 'Guardar Cambios'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Ver Detalle */}
      {modalMode === 'view' && selectedSupplier && (
        <Modal
          isOpen={true}
          onClose={() => setModalMode(null)}
          title={`Detalle de Proveedor: ${selectedSupplier.nom_proveedor}`}
          maxWidth="lg"
        >
          <div className="view-detail-grid">
            <div className="detail-item">
              <span className="detail-label">Código:</span>
              <span className="detail-value">{selectedSupplier.cod_proveedor}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Registro (NRC):</span>
              <span className="detail-value">{selectedSupplier.registro || 'No registrado'}</span>
            </div>
            <div className="detail-item full-width">
              <span className="detail-label">Nombre / Razón Social:</span>
              <span className="detail-value font-bold">{selectedSupplier.nom_proveedor}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">NIT:</span>
              <span className="detail-value">{selectedSupplier.nit_proveedor || 'No registrado'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Teléfono:</span>
              <span className="detail-value">{selectedSupplier.telefono || 'No registrado'}</span>
            </div>
            <div className="detail-item full-width">
              <span className="detail-label">Giro / Actividad:</span>
              <span className="detail-value">{selectedSupplier.giro || 'No especificado'}</span>
            </div>
            <div className="detail-item full-width">
              <span className="detail-label">Dirección:</span>
              <span className="detail-value">{selectedSupplier.dir_proveedor || 'No registrada'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Departamento:</span>
              <span className="detail-value">{selectedSupplier.nom_dept || 'N/D'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Municipio:</span>
              <span className="detail-value">{selectedSupplier.nom_muni || 'N/D'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Estado:</span>
              <span className="detail-value">
                {selectedSupplier.activo ? (
                  <Badge variant="success">Activo</Badge>
                ) : (
                  <Badge variant="danger">Inactivo</Badge>
                )}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">País:</span>
              <span className="detail-value">{selectedSupplier.pais || 'EL SALVADOR'}</span>
            </div>
          </div>
          <div className="modal-actions">
            <button
              type="button"
              className="btn-secundario"
              onClick={() => setModalMode(null)}
            >
              Cerrar
            </button>
            <button
              type="button"
              className="btn-primario"
              onClick={() => {
                abrirModalEditar(selectedSupplier);
              }}
            >
              <Edit2 size={16} />
              Editar este proveedor
            </button>
          </div>
        </Modal>
      )}

      {/* Modal Confirmar Eliminación */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Confirmar Eliminación de Proveedor"
        message={`¿Estás seguro de que deseas eliminar permanentemente este proveedor del catálogo?`}
        itemName={supplierToDelete?.nom_proveedor}
        itemCode={supplierToDelete?.cod_proveedor}
        isDeleting={deleting}
      />
    </ControlIvaLayout>
  );
}
