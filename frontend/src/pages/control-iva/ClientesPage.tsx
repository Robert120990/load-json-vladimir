import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Edit2, Eye, Plus, Trash2 } from 'lucide-react';
import {
  createCliente,
  deleteCliente,
  fetchClientes,
  fetchDepartamentos,
  fetchMunicipios,
  updateCliente,
} from '../../api/controlIva';
import { obtenerError } from '../../api/client';
import ControlIvaLayout from '../../components/layout/ControlIvaLayout';
import Badge from '../../components/ui/Badge';
import ConfirmModal from '../../components/ui/ConfirmModal';
import DataTable, { Column } from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import type { Client, Department, Municipality } from '../../types/controlIva';

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Client[]>([]);
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
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // Form state
  const [formData, setFormData] = useState<Partial<Client>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchDepartamentos()
      .then(setDepartamentos)
      .catch(() => {});
  }, []);

  useEffect(() => {
    cargarClientes();
  }, [page, limit, search]);

  async function cargarClientes() {
    try {
      setLoading(true);
      const res = await fetchClientes({ page, limit, search });
      setClientes(res.data);
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
      cod_cliente: '',
      nom_cliente: '',
      registro: '',
      nit_cliente: '',
      dir_cliente: '',
      telefono: '',
      giro: '',
      cod_dept: departamentos[0]?.cod_dept ?? 1,
      cod_muni: 1,
      activo: 1,
      exento: 0,
      exterior: 0,
      con_credito: 0,
      limite_credito: 0,
      con_retencion: 0,
      con_percepcion: 0,
    });
    setFormErrors({});
    if (departamentos[0]?.cod_dept) {
      fetchMunicipios(departamentos[0].cod_dept).then(setMunicipios);
    }
    setModalMode('create');
  }

  async function abrirModalEditar(client: Client) {
    setSelectedClient(client);
    setFormData({ ...client });
    setFormErrors({});
    if (client.cod_dept) {
      const munis = await fetchMunicipios(client.cod_dept).catch(() => []);
      setMunicipios(munis);
    }
    setModalMode('edit');
  }

  function abrirModalVer(client: Client) {
    setSelectedClient(client);
    setModalMode('view');
  }

  function abrirModalEliminar(client: Client) {
    setClientToDelete(client);
    setDeleteModalOpen(true);
  }

  function validarFormulario(): boolean {
    const errors: Record<string, string> = {};
    if (!formData.nom_cliente?.trim()) {
      errors.nom_cliente = 'El nombre del cliente es obligatorio';
    }
    if (modalMode === 'create' && !formData.cod_cliente?.trim() && !formData.registro?.trim()) {
      errors.cod_cliente = 'El código o NRC es obligatorio';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validarFormulario()) return;

    const sanitizedData: Partial<Client> = {
      ...formData,
      cod_cliente: formData.cod_cliente?.trim().toUpperCase(),
      registro: formData.registro?.trim().toUpperCase(),
      nom_cliente: formData.nom_cliente?.trim().toUpperCase(),
      nit_cliente: formData.nit_cliente?.trim().toUpperCase(),
      telefono: formData.telefono?.trim().toUpperCase(),
      giro: formData.giro?.trim().toUpperCase(),
      dir_cliente: formData.dir_cliente?.trim().toUpperCase(),
    };

    try {
      setSubmitting(true);
      if (modalMode === 'create') {
        await createCliente(sanitizedData);
        toast.success('Cliente creado correctamente');
      } else if (modalMode === 'edit' && selectedClient) {
        await updateCliente(selectedClient.cod_cliente, sanitizedData);
        toast.success('Cliente actualizado correctamente');
      }
      setModalMode(null);
      cargarClientes();
    } catch (err) {
      toast.error(obtenerError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmDelete() {
    if (!clientToDelete) return;
    try {
      setDeleting(true);
      await deleteCliente(clientToDelete.cod_cliente);
      toast.success(`Cliente '${clientToDelete.nom_cliente}' eliminado exitosamente`);
      setDeleteModalOpen(false);
      setClientToDelete(null);
      cargarClientes();
    } catch (err) {
      toast.error(obtenerError(err));
    } finally {
      setDeleting(false);
    }
  }

  const columns: Column<Client>[] = [
    {
      key: 'cod_cliente',
      header: 'Código / NRC',
      render: (row) => (
        <div>
          <strong className="text-primary">{row.cod_cliente}</strong>
          {row.registro && row.registro !== row.cod_cliente && (
            <div className="text-muted text-xs">NRC: {row.registro}</div>
          )}
        </div>
      ),
    },
    {
      key: 'nom_cliente',
      header: 'Nombre o Razón Social',
      render: (row) => (
        <div>
          <div className="font-semibold">{row.nom_cliente}</div>
          {row.giro && <div className="text-muted text-xs truncate max-w-xs">{row.giro}</div>}
        </div>
      ),
    },
    {
      key: 'nit_cliente',
      header: 'NIT',
      render: (row) => row.nit_cliente || '-',
    },
    {
      key: 'telefono',
      header: 'Teléfono',
      render: (row) => row.telefono || '-',
    },
    {
      key: 'departamento',
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
          <h1 className="page-title">Catálogo Global de Clientes</h1>
          <p className="page-subtitle">
            Administra los clientes disponibles para la facturación y ventas de la empresa
          </p>
        </div>
        <button type="button" className="btn-primario" onClick={abrirModalCrear}>
          <Plus size={18} />
          Nuevo Cliente
        </button>
      </div>

      <div className="card">
        <DataTable
          columns={columns}
          data={clientes}
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
                title="Editar cliente"
              >
                <Edit2 size={16} />
              </button>
              <button
                type="button"
                className="btn-accion btn-eliminar"
                onClick={() => abrirModalEliminar(row)}
                title="Eliminar cliente"
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
          title={modalMode === 'create' ? 'Agregar Nuevo Cliente' : `Editar Cliente: ${selectedClient?.nom_cliente}`}
          maxWidth="2xl"
        >
          <form onSubmit={handleSubmit} className="form-grid">
            <div className="form-row col-2">
              <div className="form-group">
                <label className="form-label">Código / NRC *</label>
                <input
                  type="text"
                  className={`form-input input-uppercase ${formErrors.cod_cliente ? 'input-error' : ''}`}
                  value={formData.cod_cliente ?? ''}
                  onChange={(e) => setFormData({ ...formData, cod_cliente: e.target.value.toUpperCase() })}
                  placeholder="Ej: 59530-6"
                  disabled={modalMode === 'edit'}
                />
                {formErrors.cod_cliente && (
                  <span className="form-error-msg">{formErrors.cod_cliente}</span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Número de Registro (NRC)</label>
                <input
                  type="text"
                  className="form-input input-uppercase"
                  value={formData.registro ?? ''}
                  onChange={(e) => setFormData({ ...formData, registro: e.target.value.toUpperCase() })}
                  placeholder="Ej: 59530-6"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Nombre o Razón Social *</label>
              <input
                type="text"
                className={`form-input input-uppercase ${formErrors.nom_cliente ? 'input-error' : ''}`}
                value={formData.nom_cliente ?? ''}
                onChange={(e) => setFormData({ ...formData, nom_cliente: e.target.value.toUpperCase() })}
                placeholder="Nombre completo o comercial"
              />
              {formErrors.nom_cliente && (
                <span className="form-error-msg">{formErrors.nom_cliente}</span>
              )}
            </div>

            <div className="form-row col-2">
              <div className="form-group">
                <label className="form-label">NIT</label>
                <input
                  type="text"
                  className="form-input input-uppercase"
                  value={formData.nit_cliente ?? ''}
                  onChange={(e) => setFormData({ ...formData, nit_cliente: e.target.value.toUpperCase() })}
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
                placeholder="Actividad comercial del cliente"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Dirección</label>
              <textarea
                className="form-input input-uppercase"
                rows={2}
                value={formData.dir_cliente ?? ''}
                onChange={(e) => setFormData({ ...formData, dir_cliente: e.target.value.toUpperCase() })}
                placeholder="Dirección del cliente"
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
                <span>Cliente Activo</span>
              </label>

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={Boolean(formData.exento)}
                  onChange={(e) => setFormData({ ...formData, exento: e.target.checked ? 1 : 0 })}
                />
                <span>Exento de IVA</span>
              </label>

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={Boolean(formData.con_retencion)}
                  onChange={(e) =>
                    setFormData({ ...formData, con_retencion: e.target.checked ? 1 : 0 })
                  }
                />
                <span>Aplica Retención 1%</span>
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
                  ? 'Crear Cliente'
                  : 'Guardar Cambios'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Ver Detalle */}
      {modalMode === 'view' && selectedClient && (
        <Modal
          isOpen={true}
          onClose={() => setModalMode(null)}
          title={`Detalle de Cliente: ${selectedClient.nom_cliente}`}
          maxWidth="lg"
        >
          <div className="view-detail-grid">
            <div className="detail-item">
              <span className="detail-label">Código:</span>
              <span className="detail-value">{selectedClient.cod_cliente}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Registro (NRC):</span>
              <span className="detail-value">{selectedClient.registro || 'No registrado'}</span>
            </div>
            <div className="detail-item full-width">
              <span className="detail-label">Nombre / Razón Social:</span>
              <span className="detail-value font-bold">{selectedClient.nom_cliente}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">NIT:</span>
              <span className="detail-value">{selectedClient.nit_cliente || 'No registrado'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Teléfono:</span>
              <span className="detail-value">{selectedClient.telefono || 'No registrado'}</span>
            </div>
            <div className="detail-item full-width">
              <span className="detail-label">Giro / Actividad:</span>
              <span className="detail-value">{selectedClient.giro || 'No especificado'}</span>
            </div>
            <div className="detail-item full-width">
              <span className="detail-label">Dirección:</span>
              <span className="detail-value">{selectedClient.dir_cliente || 'No registrada'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Departamento:</span>
              <span className="detail-value">{selectedClient.nom_dept || 'N/D'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Municipio:</span>
              <span className="detail-value">{selectedClient.nom_muni || 'N/D'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Estado:</span>
              <span className="detail-value">
                {selectedClient.activo ? (
                  <Badge variant="success">Activo</Badge>
                ) : (
                  <Badge variant="danger">Inactivo</Badge>
                )}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Exento de IVA:</span>
              <span className="detail-value">{selectedClient.exento ? 'Sí' : 'No'}</span>
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
                abrirModalEditar(selectedClient);
              }}
            >
              <Edit2 size={16} />
              Editar este cliente
            </button>
          </div>
        </Modal>
      )}

      {/* Modal Confirmar Eliminación */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Confirmar Eliminación de Cliente"
        message={`¿Estás seguro de que deseas eliminar permanentemente este cliente del catálogo?`}
        itemName={clientToDelete?.nom_cliente}
        itemCode={clientToDelete?.cod_cliente}
        isDeleting={deleting}
      />
    </ControlIvaLayout>
  );
}
