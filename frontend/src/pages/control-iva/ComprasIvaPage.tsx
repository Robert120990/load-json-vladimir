import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Calendar, CheckCircle2, Edit2, Eye, Plus, Settings2, Trash2 } from 'lucide-react';
import {
  createCompra,
  deleteCompra,
  fetchCompras,
  fetchPeriodoCompras,
  fetchProveedores,
  fetchTiposDocumentoCompras,
  updateCompra,
  updatePeriodoCompras,
} from '../../api/controlIva';
import { obtenerError } from '../../api/client';
import ControlIvaLayout from '../../components/layout/ControlIvaLayout';
import ConfirmModal from '../../components/ui/ConfirmModal';
import DataTable, { Column } from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import SearchableSelect from '../../components/ui/SearchableSelect';
import SupplierModal from '../../components/control-iva/SupplierModal';
import { handleEnterNavigation } from '../../utils/formNavigation';
import type { DocumentType, PurchaseIva, Supplier } from '../../types/controlIva';

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

export default function ComprasIvaPage() {
  const now = new Date();
  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number>(now.getMonth() + 1);

  // Periodo compras activo en la base de datos
  const [periodoActivo, setPeriodoActivo] = useState<{ mes: number; anio: number } | null>(null);
  const [modalPeriodoOpen, setModalPeriodoOpen] = useState(false);
  const [nuevoPeriodoMes, setNuevoPeriodoMes] = useState<number>(now.getMonth() + 1);
  const [nuevoPeriodoAnio, setNuevoPeriodoAnio] = useState<number>(now.getFullYear());
  const [guardandoPeriodo, setGuardandoPeriodo] = useState(false);

  const [compras, setCompras] = useState<PurchaseIva[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodoInicializado, setPeriodoInicializado] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState('');

  // Catalogs
  const [docTypes, setDocTypes] = useState<DocumentType[]>([]);
  const [proveedores, setProveedores] = useState<Supplier[]>([]);
  const [searchingProveedores, setSearchingProveedores] = useState(false);

  // Modals
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view' | null>(null);
  const [selectedCompra, setSelectedCompra] = useState<PurchaseIva | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<PurchaseIva>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Delete State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [compraToDelete, setCompraToDelete] = useState<PurchaseIva | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Supplier on-the-fly Modal
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [supplierToEdit, setSupplierToEdit] = useState<Supplier | null>(null);

  const selectedProveedorRef = useRef(formData.cod_proveedor);
  selectedProveedorRef.current = formData.cod_proveedor;

  async function handleSearchProveedores(query: string) {
    try {
      setSearchingProveedores(true);
      const res = await fetchProveedores({ search: query, limit: 100 });
      setProveedores((prev) => {
        const selectedCode = selectedProveedorRef.current;
        const currentSelected = prev.find((p) => p.cod_proveedor === selectedCode);
        if (currentSelected && !res.data.some((p) => p.cod_proveedor === selectedCode)) {
          return [currentSelected, ...res.data];
        }
        return res.data;
      });
    } catch (err) {
      console.error('Error al buscar proveedores:', err);
    } finally {
      setSearchingProveedores(false);
    }
  }

  function abrirCrearProveedorDesdeCompras() {
    setSupplierToEdit(null);
    setSupplierModalOpen(true);
  }

  function abrirEditarProveedorDesdeCompras() {
    const p = proveedores.find((item) => item.cod_proveedor === formData.cod_proveedor);
    if (p) {
      setSupplierToEdit(p);
      setSupplierModalOpen(true);
    }
  }

  function handleProveedorGuardado(saved: Supplier) {
    setProveedores((prev) => {
      const exists = prev.some((item) => item.cod_proveedor === saved.cod_proveedor);
      if (exists) {
        return prev.map((item) => (item.cod_proveedor === saved.cod_proveedor ? saved : item));
      }
      return [saved, ...prev];
    });
    setFormData((prev) => ({ ...prev, cod_proveedor: saved.cod_proveedor }));
    setSupplierModalOpen(false);
  }

  useEffect(() => {
    fetchTiposDocumentoCompras()
      .then(setDocTypes)
      .catch(() => {});
    fetchProveedores({ limit: 100 })
      .then((res) => setProveedores(res.data))
      .catch(() => {});

    // Cargar período de compras activo antes de consultar compras
    fetchPeriodoCompras()
      .then((p) => {
        if (p) {
          setPeriodoActivo(p);
          setMonth(p.mes);
          setYear(p.anio);
          setNuevoPeriodoMes(p.mes);
          setNuevoPeriodoAnio(p.anio);
        }
      })
      .catch(() => {})
      .finally(() => {
        setPeriodoInicializado(true);
      });
  }, []);

  useEffect(() => {
    if (!periodoInicializado) return;

    let cancel = false;
    setLoading(true);

    fetchCompras({
      year,
      month,
      page,
      limit,
      search,
    })
      .then((res) => {
        if (!cancel) {
          setCompras(res.data);
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
  }, [periodoInicializado, year, month, page, limit, search]);

  async function cargarCompras() {
    try {
      setLoading(true);
      const res = await fetchCompras({
        year,
        month,
        page,
        limit,
        search,
      });
      setCompras(res.data);
      setTotal(res.total);
    } catch (err) {
      toast.error(obtenerError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleGuardarPeriodoActivo(e: React.FormEvent) {
    e.preventDefault();
    try {
      setGuardandoPeriodo(true);
      await updatePeriodoCompras(nuevoPeriodoMes, nuevoPeriodoAnio);
      setPeriodoActivo({ mes: nuevoPeriodoMes, anio: nuevoPeriodoAnio });
      setMonth(nuevoPeriodoMes);
      setYear(nuevoPeriodoAnio);
      toast.success('Período de compras activo actualizado exitosamente');
      setModalPeriodoOpen(false);
    } catch (err) {
      toast.error(obtenerError(err));
    } finally {
      setGuardandoPeriodo(false);
    }
  }

  function abrirModalCrear() {
    const today = new Date().toISOString().slice(0, 10);
    setFormData({
      fecha: today,
      id_tipo_documento: '02', // Credito Fiscal por defecto
      cod_proveedor: '',
      documento: '',
      num_control: '',
      sello_recepcion: '',
      gravadas_locales: 0,
      rebajas_y_devoluciones: 0,
      credito_fiscal: 0,
      exentas_locales: 0,
      no_sujetas: 0,
      anticipo_a_cuenta: 0,
      iva_retenido: 0,
      iva_percibido: 0,
      periodo_ano: year,
      periodo_mes: month,
    });
    setFormErrors({});
    setModalMode('create');
  }

  function abrirModalEditar(compra: PurchaseIva) {
    setSelectedCompra(compra);
    setFormData({ ...compra });
    setFormErrors({});
    if (compra.cod_proveedor) {
      setProveedores((prev) => {
        if (!prev.some((p) => p.cod_proveedor === compra.cod_proveedor)) {
          return [
            {
              cod_proveedor: compra.cod_proveedor,
              nom_proveedor: compra.nom_proveedor || compra.cod_proveedor,
              registro: compra.registro_proveedor || '',
              nit_proveedor: compra.nit_proveedor || '',
            } as Supplier,
            ...prev,
          ];
        }
        return prev;
      });
    }
    setModalMode('edit');
  }

  function abrirModalVer(compra: PurchaseIva) {
    setSelectedCompra(compra);
    setModalMode('view');
  }

  function abrirModalEliminar(compra: PurchaseIva) {
    setCompraToDelete(compra);
    setDeleteModalOpen(true);
  }

  // Recalcular crédito fiscal cuando cambian gravadas locales o descuentos
  function handleValoresChange(gravadas: number, descuento: number) {
    const baseNeta = Math.max(0, gravadas - descuento);
    const iva = Number((baseNeta * 0.13).toFixed(2));
    setFormData((prev) => ({
      ...prev,
      gravadas_locales: gravadas,
      rebajas_y_devoluciones: descuento,
      credito_fiscal: iva,
    }));
  }

  function calcularBaseNeta(): number {
    const grav = Number(formData.gravadas_locales) || 0;
    const desc = Number(formData.rebajas_y_devoluciones) || 0;
    return Math.max(0, Number((grav - desc).toFixed(2)));
  }

  function calcularTotalCompra(): number {
    const baseNeta = calcularBaseNeta();
    const cred = Number(formData.credito_fiscal) || 0;
    const exen = Number(formData.exentas_locales) || 0;
    const nosuj = Number(formData.no_sujetas) || 0;
    const ant = Number(formData.anticipo_a_cuenta) || 0;
    const ret = Number(formData.iva_retenido) || 0;
    const per = Number(formData.iva_percibido) || 0;
    return Number((baseNeta + cred + exen + nosuj + ant - ret + per).toFixed(2));
  }

  function validarFormulario(): boolean {
    const errors: Record<string, string> = {};
    if (!formData.fecha) errors.fecha = 'La fecha es obligatoria';
    if (!formData.documento?.trim()) errors.documento = 'El número de documento es obligatorio';
    if (!formData.cod_proveedor) errors.cod_proveedor = 'Selecciona un proveedor';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validarFormulario()) return;

    try {
      setSubmitting(true);
      if (modalMode === 'create') {
        await createCompra(formData);
        toast.success('Compra registrada correctamente');
      } else if (modalMode === 'edit' && selectedCompra) {
        await updateCompra(selectedCompra.llave, formData);
        toast.success('Compra actualizada correctamente');
      }
      setModalMode(null);
      cargarCompras();
    } catch (err) {
      toast.error(obtenerError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmDelete() {
    if (!compraToDelete) return;
    try {
      setDeleting(true);
      await deleteCompra(compraToDelete.llave);
      toast.success(`Compra con documento '${compraToDelete.documento}' eliminada exitosamente`);
      setDeleteModalOpen(false);
      setCompraToDelete(null);
      cargarCompras();
    } catch (err) {
      toast.error(obtenerError(err));
    } finally {
      setDeleting(false);
    }
  }

  const columns: Column<PurchaseIva>[] = [
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
          {row.sello_recepcion && (
            <div className="text-muted text-xs">Sello: {row.sello_recepcion.slice(0, 20)}…</div>
          )}
        </div>
      ),
    },
    {
      key: 'proveedor',
      header: 'Proveedor',
      render: (row) => (
        <div>
          <div className="font-semibold">{row.nom_proveedor || `Cód: ${row.cod_proveedor}`}</div>
          <div className="text-muted text-xs">
            NRC: {row.registro_proveedor || row.cod_proveedor}
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
      key: 'credito_fiscal',
      header: 'IVA Crédito',
      align: 'right',
      render: (row) => (
        <strong className="text-success">$ {(Number(row.credito_fiscal) || 0).toFixed(2)}</strong>
      ),
    },
    {
      key: 'total',
      header: 'Total Compra',
      align: 'right',
      render: (row) => {
        const grav = Number(row.gravadas_locales) || 0;
        const desc = Number(row.rebajas_y_devoluciones) || 0;
        const tot =
          Math.max(0, grav - desc) +
          (Number(row.credito_fiscal) || 0) +
          (Number(row.exentas_locales) || 0) +
          (Number(row.no_sujetas) || 0) -
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
          <h1 className="page-title">Gestión de Compras IVA</h1>
          <p className="page-subtitle">
            Registro, control y edición de compras y créditos fiscales para la empresa activa
          </p>
        </div>
        <button type="button" className="btn-primario" onClick={abrirModalCrear}>
          <Plus size={18} />
          Registrar Compra
        </button>
      </div>

      {/* Banner Período Activo y Selector */}
      <div className="card card-periodo">
        <div className="periodo-toolbar">
          <div className="periodo-selector-inner">
            <div className="periodo-icon">
              <Calendar size={20} />
              <span>Consultando Período:</span>
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

          {/* Badge Período de Compras Activo */}
          <div className="periodo-activo-badge-box">
            <div className="periodo-activo-info">
              <CheckCircle2 size={16} className="text-success" />
              <span>
                Período de Compras Activo:{' '}
                <strong>
                  {periodoActivo
                    ? `${MONTHS.find((m) => m.val === periodoActivo.mes)?.name || periodoActivo.mes} ${periodoActivo.anio}`
                    : 'No configurado'}
                </strong>
              </span>
            </div>
            <button
              type="button"
              className="btn-secundario btn-sm"
              onClick={() => setModalPeriodoOpen(true)}
              title="Cambiar período activo de compras"
            >
              <Settings2 size={14} />
              Cambiar Activo
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <DataTable
          columns={columns}
          data={compras}
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
          searchPlaceholder="Buscar por documento, código generación, proveedor o NRC..."
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
                title="Editar compra"
              >
                <Edit2 size={16} />
              </button>
              <button
                type="button"
                className="btn-accion btn-eliminar"
                onClick={() => abrirModalEliminar(row)}
                title="Eliminar compra"
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}
        />
      </div>

      {/* Modal Crear / Editar Compra (Diseño simétrico y proporcionado) */}
      {(modalMode === 'create' || modalMode === 'edit') && (
        <Modal
          isOpen={true}
          onClose={() => setModalMode(null)}
          title={modalMode === 'create' ? 'Registrar Compra IVA' : `Editar Compra: ${selectedCompra?.documento}`}
          maxWidth="2xl"
        >
          <form onSubmit={handleSubmit} onKeyDown={handleEnterNavigation} className="form-symmetrical">
            {/* Sección 1: Datos del Documento */}
            <div className="form-section-title">1. Datos del Documento y Proveedor</div>
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
                  value={formData.id_tipo_documento ?? '02'}
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
                  <label className="form-label">Proveedor *</label>
                  <div className="quick-actions">
                    <button
                      type="button"
                      className="btn-link-action"
                      onClick={abrirCrearProveedorDesdeCompras}
                      title="Crear nuevo proveedor"
                    >
                      <Plus size={13} />
                      <span>Nuevo</span>
                    </button>
                    {formData.cod_proveedor && (
                      <button
                        type="button"
                        className="btn-link-action text-edit"
                        onClick={abrirEditarProveedorDesdeCompras}
                        title="Editar proveedor seleccionado"
                      >
                        <Edit2 size={13} />
                        <span>Editar</span>
                      </button>
                    )}
                  </div>
                </div>
                <SearchableSelect
                  options={proveedores.map((p) => ({
                    value: p.cod_proveedor,
                    label: p.nom_proveedor,
                    subLabel: p.registro
                      ? `NRC: ${p.registro}`
                      : p.nit_proveedor
                      ? `NIT: ${p.nit_proveedor}`
                      : `Cód: ${p.cod_proveedor}`,
                    badge: p.registro || p.cod_proveedor,
                  }))}
                  value={formData.cod_proveedor ?? ''}
                  onChange={(val) => setFormData({ ...formData, cod_proveedor: val })}
                  onSearch={handleSearchProveedores}
                  isLoading={searchingProveedores}
                  placeholder="Buscar proveedor por nombre, NRC o código..."
                  hasError={!!formErrors.cod_proveedor}
                />
                {formErrors.cod_proveedor && (
                  <span className="form-error-msg">{formErrors.cod_proveedor}</span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Documento / Código Generación *</label>
                <input
                  type="text"
                  className={`form-input ${formErrors.documento ? 'input-error' : ''}`}
                  value={formData.documento ?? ''}
                  onChange={(e) => setFormData({ ...formData, documento: e.target.value })}
                  placeholder="Ej: D12173CB-C07D-4601-BF7F-1DC4F1B5DDA6"
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
                <label className="form-label">Sello de Recepción (MH)</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.sello_recepcion ?? ''}
                  onChange={(e) => setFormData({ ...formData, sello_recepcion: e.target.value })}
                  placeholder="Sello de recepción otorgado por Hacienda"
                />
              </div>
            </div>

            {/* Sección 2: Importes, Descuentos e Impuestos */}
            <div className="form-section-title">2. Valores, Descuentos e Impuestos</div>
            <div className="form-grid-symmetrical cols-3">
              <div className="form-group">
                <label className="form-label">Compras Gravadas ($)</label>
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
                <label className="form-label">IVA Crédito Fiscal ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-input font-bold text-success"
                  value={formData.credito_fiscal ?? 0}
                  onChange={(e) =>
                    setFormData({ ...formData, credito_fiscal: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>

              <div className="form-group">
                <label className="form-label">Compras Exentas ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-input"
                  value={formData.exentas_locales ?? 0}
                  onChange={(e) =>
                    setFormData({ ...formData, exentas_locales: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>

              <div className="form-group">
                <label className="form-label">Compras No Sujetas ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-input"
                  value={formData.no_sujetas ?? 0}
                  onChange={(e) =>
                    setFormData({ ...formData, no_sujetas: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>

              <div className="form-group">
                <label className="form-label">Anticipo a Cuenta ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-input"
                  value={formData.anticipo_a_cuenta ?? 0}
                  onChange={(e) =>
                    setFormData({ ...formData, anticipo_a_cuenta: parseFloat(e.target.value) || 0 })
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

            {/* Resumen Final de Compra Simétrico */}
            <div className="resumen-total-symmetrical">
              <div className="resumen-metric">
                <span className="resumen-label">Base Gravada Neta:</span>
                <span className="resumen-val">$ {calcularBaseNeta().toFixed(2)}</span>
              </div>
              <div className="resumen-metric">
                <span className="resumen-label">Crédito Fiscal (IVA):</span>
                <span className="resumen-val text-success font-bold">
                  $ {(Number(formData.credito_fiscal) || 0).toFixed(2)}
                </span>
              </div>
              <div className="resumen-metric highlight">
                <span className="resumen-label">Total Liquidación Compra:</span>
                <span className="resumen-val font-bold">$ {calcularTotalCompra().toFixed(2)}</span>
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
                  ? 'Registrar Compra'
                  : 'Guardar Cambios'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Configurar Período de Compras Activo */}
      {modalPeriodoOpen && (
        <Modal
          isOpen={true}
          onClose={() => setModalPeriodoOpen(false)}
          title="Configurar Período de Compras Activo"
          maxWidth="md"
        >
          <form onSubmit={handleGuardarPeriodoActivo} onKeyDown={handleEnterNavigation} className="form-grid">
            <p className="nota">
              El período activo define el mes y año contable habilitado para la recepción de DTE y
              compras de la empresa seleccionada.
            </p>

            <div className="form-row col-2">
              <div className="form-group">
                <label className="form-label">Mes</label>
                <select
                  className="form-input"
                  value={nuevoPeriodoMes}
                  onChange={(e) => setNuevoPeriodoMes(Number(e.target.value))}
                >
                  {MONTHS.map((m) => (
                    <option key={m.val} value={m.val}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Año</label>
                <input
                  type="number"
                  className="form-input"
                  value={nuevoPeriodoAnio}
                  onChange={(e) => setNuevoPeriodoAnio(Number(e.target.value))}
                  min={2000}
                  max={2099}
                />
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn-secundario"
                onClick={() => setModalPeriodoOpen(false)}
                disabled={guardandoPeriodo}
              >
                Cancelar
              </button>
              <button type="submit" className="btn-primario" disabled={guardandoPeriodo}>
                {guardandoPeriodo ? 'Guardando…' : 'Establecer Período Activo'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Ver Detalle */}
      {modalMode === 'view' && selectedCompra && (
        <Modal
          isOpen={true}
          onClose={() => setModalMode(null)}
          title={`Detalle de Compra: ${selectedCompra.documento}`}
          maxWidth="lg"
        >
          <div className="view-detail-grid">
            <div className="detail-item">
              <span className="detail-label">Llave Interna:</span>
              <span className="detail-value font-mono">{selectedCompra.llave}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Fecha:</span>
              <span className="detail-value">{selectedCompra.fecha}</span>
            </div>
            <div className="detail-item full-width">
              <span className="detail-label">Documento / Cód. Generación:</span>
              <span className="detail-value font-bold text-primary">{selectedCompra.documento}</span>
            </div>
            <div className="detail-item full-width">
              <span className="detail-label">Proveedor:</span>
              <span className="detail-value font-bold">
                {selectedCompra.nom_proveedor || selectedCompra.cod_proveedor}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">NRC Proveedor:</span>
              <span className="detail-value">{selectedCompra.registro_proveedor || selectedCompra.cod_proveedor}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">NIT Proveedor:</span>
              <span className="detail-value">{selectedCompra.nit_proveedor || 'N/D'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Tipo Documento:</span>
              <span className="detail-value">{selectedCompra.nom_tipo_documento || selectedCompra.id_tipo_documento}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Número de Control:</span>
              <span className="detail-value">{selectedCompra.num_control || 'N/D'}</span>
            </div>
            <div className="detail-item full-width">
              <span className="detail-label">Sello de Recepción:</span>
              <span className="detail-value font-mono text-xs">{selectedCompra.sello_recepcion || 'N/D'}</span>
            </div>

            <div className="detail-item">
              <span className="detail-label">Compras Gravadas:</span>
              <span className="detail-value">$ {(Number(selectedCompra.gravadas_locales) || 0).toFixed(2)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Descuentos / Rebajas:</span>
              <span className="detail-value text-danger">
                -$ {(Number(selectedCompra.rebajas_y_devoluciones) || 0).toFixed(2)}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Crédito Fiscal (IVA):</span>
              <span className="detail-value text-success font-bold">
                $ {(Number(selectedCompra.credito_fiscal) || 0).toFixed(2)}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Exentas Locales:</span>
              <span className="detail-value">$ {(Number(selectedCompra.exentas_locales) || 0).toFixed(2)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">No Sujetas:</span>
              <span className="detail-value">$ {(Number(selectedCompra.no_sujetas) || 0).toFixed(2)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">IVA Retenido / Percibido:</span>
              <span className="detail-value">
                Ret: $ {(Number(selectedCompra.iva_retenido) || 0).toFixed(2)} · Per: ${' '}
                {(Number(selectedCompra.iva_percibido) || 0).toFixed(2)}
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
                abrirModalEditar(selectedCompra);
              }}
            >
              <Edit2 size={16} />
              Editar esta compra
            </button>
          </div>
        </Modal>
      )}

      {/* Modal Confirmar Eliminación */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Confirmar Eliminación de Compra"
        message={`¿Estás seguro de que deseas eliminar permanentemente esta compra del registro fiscal?`}
        itemName={compraToDelete?.nom_proveedor}
        itemCode={compraToDelete?.documento}
        isDeleting={deleting}
      />

      {/* Modal Crear / Editar Proveedor al Vuelo */}
      <SupplierModal
        isOpen={supplierModalOpen}
        onClose={() => setSupplierModalOpen(false)}
        supplierToEdit={supplierToEdit}
        onSuccess={handleProveedorGuardado}
      />
    </ControlIvaLayout>
  );
}
