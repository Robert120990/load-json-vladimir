import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Calendar, Edit2, Eye, Plus, Trash2, Zap } from 'lucide-react';
import {
  createVenta,
  deleteVenta,
  fetchClientes,
  fetchTiposDocumentoVentas,
  fetchVentas,
  updateVenta,
} from '../../api/controlIva';
import { obtenerError } from '../../api/client';
import ControlIvaLayout from '../../components/layout/ControlIvaLayout';
import ConfirmModal from '../../components/ui/ConfirmModal';
import DataTable, { Column } from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import SearchableSelect from '../../components/ui/SearchableSelect';
import ClientModal from '../../components/control-iva/ClientModal';
import QuickConsumerModal from '../../components/control-iva/QuickConsumerModal';
import { handleEnterNavigation } from '../../utils/formNavigation';
import type { Client, DocumentType, SaleIva } from '../../types/controlIva';

const MONTHS = [
  { val: 1, name: 'Enero' },
  { val: 2, name: 'Febrero' },
  { val: 3, name: 'Marzo' },
  { val: 4, name: 'Abril' },
  { val: 5, name: 'Mayo' },
  { val: 6, name: 'Junio' },
  { val: 7, name: 'Julio' },
  { val: 8, name: 'Agosto' },
  { val: 9, name: 'Septiembre' },
  { val: 10, name: 'Octubre' },
  { val: 11, name: 'Noviembre' },
  { val: 12, name: 'Diciembre' },
];

export default function VentasIvaPage() {
  const now = new Date();
  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number>(now.getMonth() + 1);

  const [ventas, setVentas] = useState<SaleIva[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState('');

  // Catalogs
  const [docTypes, setDocTypes] = useState<DocumentType[]>([]);
  const [clientes, setClientes] = useState<Client[]>([]);

  // Modals
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view' | null>(null);
  const [selectedVenta, setSelectedVenta] = useState<SaleIva | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<SaleIva>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Delete State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [ventaToDelete, setVentaToDelete] = useState<SaleIva | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Client on-the-fly Modal
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<Client | null>(null);

  // Quick Consumer Batch Modal
  const [quickConsumerOpen, setQuickConsumerOpen] = useState(false);

  function abrirCrearClienteDesdeVentas() {
    setClientToEdit(null);
    setClientModalOpen(true);
  }

  function abrirEditarClienteDesdeVentas() {
    const c = clientes.find((item) => item.cod_cliente === formData.cod_cliente);
    if (c) {
      setClientToEdit(c);
      setClientModalOpen(true);
    }
  }

  function handleClienteGuardado(saved: Client) {
    setClientes((prev) => {
      const exists = prev.some((item) => item.cod_cliente === saved.cod_cliente);
      if (exists) {
        return prev.map((item) => (item.cod_cliente === saved.cod_cliente ? saved : item));
      }
      return [saved, ...prev];
    });
    setFormData((prev) => ({ ...prev, cod_cliente: saved.cod_cliente }));
    setClientModalOpen(false);
  }

  useEffect(() => {
    fetchTiposDocumentoVentas()
      .then(setDocTypes)
      .catch(() => {});
    fetchClientes({ limit: 500 })
      .then((res) => setClientes(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancel = false;
    setLoading(true);

    fetchVentas({
      year,
      month,
      page,
      limit,
      search,
    })
      .then((res) => {
        if (!cancel) {
          setVentas(res.data);
          setTotal(res.total);
        }
      })
      .catch((err) => {
        if (!cancel) {
          toast.error(obtenerError(err));
        }
      })
      .finally(() => {
        if (!cancel) {
          setLoading(false);
        }
      });

    return () => {
      cancel = true;
    };
  }, [year, month, page, limit, search]);

  async function cargarVentas() {
    try {
      setLoading(true);
      const res = await fetchVentas({
        year,
        month,
        page,
        limit,
        search,
      });
      setVentas(res.data);
      setTotal(res.total);
    } catch (err) {
      toast.error(obtenerError(err));
    } finally {
      setLoading(false);
    }
  }

  function abrirModalCrear() {
    const today = new Date().toISOString().slice(0, 10);
    setFormData({
      fecha: today,
      id_tipo_documento: '03', // Credito Fiscal por defecto
      cod_cliente: '',
      documento: '',
      num_control: '',
      serie: '',
      gravadas_locales: 0,
      rebajas_y_devoluciones: 0,
      debito_fiscal: 0,
      gravadas_exportacion: 0,
      ventas_exentas: 0,
      ventas_no_sujetas: 0,
      iva_retenido: 0,
      iva_percibido: 0,
    });
    setFormErrors({});
    setModalMode('create');
  }

  function abrirModalEditar(venta: SaleIva) {
    setSelectedVenta(venta);
    setFormData({ ...venta });
    setFormErrors({});
    setModalMode('edit');
  }

  function abrirModalVer(venta: SaleIva) {
    setSelectedVenta(venta);
    setModalMode('view');
  }

  function abrirModalEliminar(venta: SaleIva) {
    setVentaToDelete(venta);
    setDeleteModalOpen(true);
  }

  function handleValoresChange(gravadas: number, descuento: number) {
    const baseNeta = Math.max(0, gravadas - descuento);
    const iva = Number((baseNeta * 0.13).toFixed(2));
    setFormData((prev) => ({
      ...prev,
      gravadas_locales: gravadas,
      rebajas_y_devoluciones: descuento,
      debito_fiscal: iva,
    }));
  }

  function calcularBaseNeta(): number {
    const grav = Number(formData.gravadas_locales) || 0;
    const desc = Number(formData.rebajas_y_devoluciones) || 0;
    return Math.max(0, Number((grav - desc).toFixed(2)));
  }

  function calcularTotalVenta(): number {
    const baseNeta = calcularBaseNeta();
    const deb = Number(formData.debito_fiscal) || 0;
    const exp = Number(formData.gravadas_exportacion) || 0;
    const exen = Number(formData.ventas_exentas) || 0;
    const nosuj = Number(formData.ventas_no_sujetas) || 0;
    const ret = Number(formData.iva_retenido) || 0;
    const per = Number(formData.iva_percibido) || 0;
    return Number((baseNeta + deb + exp + exen + nosuj - ret + per).toFixed(2));
  }

  function validarFormulario(): boolean {
    const errors: Record<string, string> = {};
    if (!formData.fecha) errors.fecha = 'La fecha es obligatoria';
    if (!formData.documento?.trim()) errors.documento = 'El número de documento es obligatorio';
    if (!formData.cod_cliente) errors.cod_cliente = 'Selecciona un cliente';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validarFormulario()) return;

    try {
      setSubmitting(true);
      if (modalMode === 'create') {
        await createVenta(formData);
        toast.success('Venta registrada correctamente');
      } else if (modalMode === 'edit' && selectedVenta) {
        await updateVenta(selectedVenta.llave, formData);
        toast.success('Venta actualizada correctamente');
      }
      setModalMode(null);
      cargarVentas();
    } catch (err) {
      toast.error(obtenerError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmDelete() {
    if (!ventaToDelete) return;
    try {
      setDeleting(true);
      await deleteVenta(ventaToDelete.llave);
      toast.success(`Venta con documento '${ventaToDelete.documento}' eliminada exitosamente`);
      setDeleteModalOpen(false);
      setVentaToDelete(null);
      cargarVentas();
    } catch (err) {
      toast.error(obtenerError(err));
    } finally {
      setDeleting(false);
    }
  }

  const columns: Column<SaleIva>[] = [
    {
      key: 'fecha',
      header: 'Fecha',
      render: (row) => <span className="whitespace-nowrap font-medium">{row.fecha}</span>,
    },
    {
      key: 'documento',
      header: 'Documento / Cód. Generación',
      render: (row) => (
        <div>
          <div className="font-semibold text-primary">{row.documento}</div>
          {row.num_control && <div className="text-muted text-xs">Ctrl: {row.num_control}</div>}
        </div>
      ),
    },
    {
      key: 'cliente',
      header: 'Cliente',
      render: (row) => (
        <div>
          <div className="font-semibold">{row.nom_cliente || `Cód: ${row.cod_cliente}`}</div>
          <div className="text-muted text-xs">
            NRC: {row.registro_cliente || row.cod_cliente}
          </div>
        </div>
      ),
    },
    {
      key: 'tipoDoc',
      header: 'Tipo Doc.',
      render: (row) => (
        <span className="badge badge-neutral text-xs">
          {row.nom_tipo_documento || row.id_tipo_documento}
        </span>
      ),
    },
    {
      key: 'gravadas_locales',
      header: 'Gravadas',
      align: 'right',
      render: (row) => `$ ${(Number(row.gravadas_locales) || 0).toFixed(2)}`,
    },
    {
      key: 'rebajas_y_devoluciones',
      header: 'Descuento',
      align: 'right',
      render: (row) =>
        Number(row.rebajas_y_devoluciones) > 0 ? (
          <span className="text-danger font-medium">
            -$ {(Number(row.rebajas_y_devoluciones) || 0).toFixed(2)}
          </span>
        ) : (
          <span className="text-muted">$ 0.00</span>
        ),
    },
    {
      key: 'debito_fiscal',
      header: 'IVA Débito',
      align: 'right',
      render: (row) => (
        <strong className="text-primary">$ {(Number(row.debito_fiscal) || 0).toFixed(2)}</strong>
      ),
    },
    {
      key: 'total',
      header: 'Total Venta',
      align: 'right',
      render: (row) => {
        const grav = Number(row.gravadas_locales) || 0;
        const desc = Number(row.rebajas_y_devoluciones) || 0;
        const tot =
          Math.max(0, grav - desc) +
          (Number(row.debito_fiscal) || 0) +
          (Number(row.gravadas_exportacion) || 0) +
          (Number(row.ventas_exentas) || 0) +
          (Number(row.ventas_no_sujetas) || 0) -
          (Number(row.iva_retenido) || 0) +
          (Number(row.iva_percibido) || 0);
        return <strong>$ {tot.toFixed(2)}</strong>;
      },
    },
  ];

  return (
    <ControlIvaLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Gestión de Ventas IVA</h1>
          <p className="page-subtitle">
            Registro, control y edición de ventas, comprobantes fiscales y débitos para la empresa activa
          </p>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="btn-secundario btn-quick-consumer"
            onClick={() => setQuickConsumerOpen(true)}
            title="Ingreso masivo y rápido de facturas a consumidor final (FAC)"
          >
            <Zap size={16} className="icon-zap-amber" />
            <span>Ingreso rápido FAC</span>
          </button>
          <button type="button" className="btn-primario" onClick={abrirModalCrear}>
            <Plus size={18} />
            <span>Registrar Venta</span>
          </button>
        </div>
      </div>

      {/* Period Selector Card */}
      <div className="card card-periodo">
        <div className="periodo-selector-inner">
          <div className="periodo-icon">
            <Calendar size={20} />
            <span>Período Fiscal:</span>
          </div>
          <div className="periodo-inputs">
            <select
              className="select-periodo"
              value={month}
              onChange={(e) => {
                setMonth(Number(e.target.value));
                setPage(1);
              }}
            >
              {MONTHS.map((m) => (
                <option key={m.val} value={m.val}>
                  {m.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              className="input-periodo-year"
              value={year}
              onChange={(e) => {
                setYear(Number(e.target.value));
                setPage(1);
              }}
              min={2000}
              max={2099}
            />
          </div>
        </div>
      </div>

      <div className="card">
        <DataTable
          columns={columns}
          data={ventas}
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
          searchPlaceholder="Buscar por documento, código generación, cliente o NRC..."
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
                title="Editar venta"
              >
                <Edit2 size={16} />
              </button>
              <button
                type="button"
                className="btn-accion btn-eliminar"
                onClick={() => abrirModalEliminar(row)}
                title="Eliminar venta"
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}
        />
      </div>

      {/* Modal Crear / Editar Venta (Symmetrical Layout) */}
      {(modalMode === 'create' || modalMode === 'edit') && (
        <Modal
          isOpen={true}
          onClose={() => setModalMode(null)}
          title={modalMode === 'create' ? 'Registrar Venta IVA' : `Editar Venta: ${selectedVenta?.documento}`}
          maxWidth="2xl"
        >
          <form onSubmit={handleSubmit} onKeyDown={handleEnterNavigation} className="form-symmetrical">
            {/* Sección 1: Datos del Documento */}
            <div className="form-section-title">1. Datos del Documento y Cliente</div>
            <div className="form-grid-symmetrical cols-2">
              <div className="form-group">
                <label className="form-label">Fecha de Emisión *</label>
                <input
                  type="date"
                  className={`form-input ${formErrors.fecha ? 'input-error' : ''}`}
                  value={formData.fecha ?? ''}
                  onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                />
                {formErrors.fecha && <span className="form-error-msg">{formErrors.fecha}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">Tipo de Documento</label>
                <select
                  className="form-input"
                  value={formData.id_tipo_documento ?? '03'}
                  onChange={(e) => setFormData({ ...formData, id_tipo_documento: e.target.value })}
                >
                  {docTypes.map((t) => (
                    <option key={t.id_tipo_documento} value={t.id_tipo_documento}>
                      {t.nombre} ({t.id_tipo_documento})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <div className="label-with-actions">
                  <label className="form-label">Cliente *</label>
                  <div className="quick-actions">
                    <button
                      type="button"
                      className="btn-link-action"
                      onClick={abrirCrearClienteDesdeVentas}
                      title="Crear nuevo cliente"
                    >
                      <Plus size={13} />
                      <span>Nuevo</span>
                    </button>
                    {formData.cod_cliente && (
                      <button
                        type="button"
                        className="btn-link-action text-edit"
                        onClick={abrirEditarClienteDesdeVentas}
                        title="Editar cliente seleccionado"
                      >
                        <Edit2 size={13} />
                        <span>Editar</span>
                      </button>
                    )}
                  </div>
                </div>
                <SearchableSelect
                  options={clientes.map((c) => ({
                    value: c.cod_cliente,
                    label: c.nom_cliente,
                    subLabel: c.registro
                      ? `NRC: ${c.registro}`
                      : c.nit_cliente
                      ? `NIT: ${c.nit_cliente}`
                      : `Cód: ${c.cod_cliente}`,
                    badge: c.registro || c.cod_cliente,
                  }))}
                  value={formData.cod_cliente ?? ''}
                  onChange={(val) => setFormData({ ...formData, cod_cliente: val })}
                  placeholder="Buscar cliente por nombre, NRC o código..."
                  hasError={!!formErrors.cod_cliente}
                />
                {formErrors.cod_cliente && (
                  <span className="form-error-msg">{formErrors.cod_cliente}</span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Documento / Código Generación *</label>
                <input
                  type="text"
                  className={`form-input ${formErrors.documento ? 'input-error' : ''}`}
                  value={formData.documento ?? ''}
                  onChange={(e) => setFormData({ ...formData, documento: e.target.value })}
                  placeholder="Ej: 525C3F8F-F6DA-4D20-BBF2-04C46C7ED149"
                />
                {formErrors.documento && (
                  <span className="form-error-msg">{formErrors.documento}</span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Número de Control</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.num_control ?? ''}
                  onChange={(e) => setFormData({ ...formData, num_control: e.target.value })}
                  placeholder="Ej: DTE-03-M001P001-000000000001"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Serie</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.serie ?? ''}
                  onChange={(e) => setFormData({ ...formData, serie: e.target.value })}
                  placeholder="Ej: 1"
                />
              </div>
            </div>

            {/* Sección 2: Importes, Descuentos e Impuestos */}
            <div className="form-section-title">2. Valores, Descuentos e Impuestos</div>
            <div className="form-grid-symmetrical cols-3">
              <div className="form-group">
                <label className="form-label">Ventas Gravadas ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-input"
                  value={formData.gravadas_locales ?? 0}
                  onChange={(e) =>
                    handleValoresChange(
                      parseFloat(e.target.value) || 0,
                      Number(formData.rebajas_y_devoluciones) || 0,
                    )
                  }
                />
              </div>

              <div className="form-group">
                <label className="form-label">Descuentos / Rebajas ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-input input-descuento"
                  value={formData.rebajas_y_devoluciones ?? 0}
                  onChange={(e) =>
                    handleValoresChange(
                      Number(formData.gravadas_locales) || 0,
                      parseFloat(e.target.value) || 0,
                    )
                  }
                />
              </div>

              <div className="form-group">
                <label className="form-label">Base Gravada Neta ($)</label>
                <input
                  type="text"
                  className="form-input input-readonly"
                  value={`$ ${calcularBaseNeta().toFixed(2)}`}
                  readOnly
                  disabled
                />
              </div>

              <div className="form-group">
                <label className="form-label">IVA Débito Fiscal ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-input font-bold text-primary"
                  value={formData.debito_fiscal ?? 0}
                  onChange={(e) =>
                    setFormData({ ...formData, debito_fiscal: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>

              <div className="form-group">
                <label className="form-label">Ventas Exportación ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-input"
                  value={formData.gravadas_exportacion ?? 0}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      gravadas_exportacion: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>

              <div className="form-group">
                <label className="form-label">Ventas Exentas ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-input"
                  value={formData.ventas_exentas ?? 0}
                  onChange={(e) =>
                    setFormData({ ...formData, ventas_exentas: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>

              <div className="form-group">
                <label className="form-label">Ventas No Sujetas ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-input"
                  value={formData.ventas_no_sujetas ?? 0}
                  onChange={(e) =>
                    setFormData({ ...formData, ventas_no_sujetas: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>

              <div className="form-group">
                <label className="form-label">IVA Retenido 1% ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-input"
                  value={formData.iva_retenido ?? 0}
                  onChange={(e) =>
                    setFormData({ ...formData, iva_retenido: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>

              <div className="form-group">
                <label className="form-label">IVA Percibido 1% ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-input"
                  value={formData.iva_percibido ?? 0}
                  onChange={(e) =>
                    setFormData({ ...formData, iva_percibido: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
            </div>

            {/* Resumen Final de Venta Simétrico */}
            <div className="resumen-total-symmetrical">
              <div className="resumen-metric">
                <span className="resumen-label">Base Gravada Neta:</span>
                <span className="resumen-val">$ {calcularBaseNeta().toFixed(2)}</span>
              </div>
              <div className="resumen-metric">
                <span className="resumen-label">Débito Fiscal (IVA):</span>
                <span className="resumen-val text-primary font-bold">
                  $ {(Number(formData.debito_fiscal) || 0).toFixed(2)}
                </span>
              </div>
              <div className="resumen-metric highlight">
                <span className="resumen-label">Total Liquidación Venta:</span>
                <span className="resumen-val font-bold">$ {calcularTotalVenta().toFixed(2)}</span>
              </div>
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
                  ? 'Registrar Venta'
                  : 'Guardar Cambios'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Ver Detalle */}
      {modalMode === 'view' && selectedVenta && (
        <Modal
          isOpen={true}
          onClose={() => setModalMode(null)}
          title={`Detalle de Venta: ${selectedVenta.documento}`}
          maxWidth="lg"
        >
          <div className="view-detail-grid">
            <div className="detail-item">
              <span className="detail-label">Llave Interna:</span>
              <span className="detail-value font-mono">{selectedVenta.llave}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Fecha:</span>
              <span className="detail-value">{selectedVenta.fecha}</span>
            </div>
            <div className="detail-item full-width">
              <span className="detail-label">Documento / Cód. Generación:</span>
              <span className="detail-value font-bold text-primary">{selectedVenta.documento}</span>
            </div>
            <div className="detail-item full-width">
              <span className="detail-label">Cliente:</span>
              <span className="detail-value font-bold">
                {selectedVenta.nom_cliente || selectedVenta.cod_cliente}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">NRC Cliente:</span>
              <span className="detail-value">{selectedVenta.registro_cliente || selectedVenta.cod_cliente}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">NIT Cliente:</span>
              <span className="detail-value">{selectedVenta.nit_cliente || 'N/D'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Tipo Documento:</span>
              <span className="detail-value">{selectedVenta.nom_tipo_documento || selectedVenta.id_tipo_documento}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Número de Control:</span>
              <span className="detail-value">{selectedVenta.num_control || 'N/D'}</span>
            </div>

            <div className="detail-item">
              <span className="detail-label">Ventas Gravadas:</span>
              <span className="detail-value">$ {(Number(selectedVenta.gravadas_locales) || 0).toFixed(2)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Descuentos / Rebajas:</span>
              <span className="detail-value text-danger">
                -$ {(Number(selectedVenta.rebajas_y_devoluciones) || 0).toFixed(2)}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Débito Fiscal (IVA):</span>
              <span className="detail-value text-primary font-bold">
                $ {(Number(selectedVenta.debito_fiscal) || 0).toFixed(2)}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Exportación:</span>
              <span className="detail-value">$ {(Number(selectedVenta.gravadas_exportacion) || 0).toFixed(2)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Ventas Exentas:</span>
              <span className="detail-value">$ {(Number(selectedVenta.ventas_exentas) || 0).toFixed(2)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">No Sujetas:</span>
              <span className="detail-value">$ {(Number(selectedVenta.ventas_no_sujetas) || 0).toFixed(2)}</span>
            </div>
            <div className="detail-item full-width">
              <span className="detail-label">IVA Retenido / Percibido:</span>
              <span className="detail-value">
                Ret: $ {(Number(selectedVenta.iva_retenido) || 0).toFixed(2)} · Per: ${' '}
                {(Number(selectedVenta.iva_percibido) || 0).toFixed(2)}
              </span>
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
                abrirModalEditar(selectedVenta);
              }}
            >
              <Edit2 size={16} />
              Editar esta venta
            </button>
          </div>
        </Modal>
      )}

      {/* Modal Confirmar Eliminación */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Confirmar Eliminación de Venta"
        message={`¿Estás seguro de que deseas eliminar permanentemente esta venta del registro fiscal?`}
        itemName={ventaToDelete?.nom_cliente}
        itemCode={ventaToDelete?.documento}
        isDeleting={deleting}
      />

      {/* Modal Crear / Editar Cliente al Vuelo */}
      <ClientModal
        isOpen={clientModalOpen}
        onClose={() => setClientModalOpen(false)}
        clientToEdit={clientToEdit}
        onSuccess={handleClienteGuardado}
      />

      {/* Modal Ingreso Rápido de Consumidores Finales */}
      <QuickConsumerModal
        isOpen={quickConsumerOpen}
        onClose={() => setQuickConsumerOpen(false)}
        onSuccess={() => cargarVentas()}
        defaultYear={year}
        defaultMonth={month}
      />
    </ControlIvaLayout>
  );
}
