import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Edit2,
  Eye,
  Filter,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  alternarAnulacionPartida,
  crearPartida,
  eliminarPartida,
  listarCuentas,
  listarPartidas,
  obtenerFirmasContables,
  obtenerPartida,
  obtenerSiguienteCorrelativo,
  obtenerTiposPartida,
  actualizarPartida,
} from '../../api/accounting';
import { obtenerEmpresa } from '../../api/auth';
import ControlIvaLayout from '../../components/layout/ControlIvaLayout';
import Modal from '../../components/ui/Modal';
import {
  CabeceraPartida,
  CuentaContable,
  DetallePartida,
  FirmaContable,
  TipoPartida,
} from '../../types/accounting';
import type { Empresa } from '../../types';
import { handleEnterNavigation } from '../../utils/formNavigation';
import { matchesSearchTokens } from '../../utils/searchUtils';

function formatFechaDDMMYYYY(fec: string | null | undefined): string {
  if (!fec) return '—';
  if (typeof fec === 'string' && fec.includes('-') && fec.length >= 10) {
    const parts = fec.split('T')[0].split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  }
  const d = new Date(fec);
  if (isNaN(d.getTime())) return '—';
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

export default function PartidasContablesPage() {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();

  const [partidas, setPartidas] = useState<CabeceraPartida[]>([]);
  const [tiposPartida, setTiposPartida] = useState<TipoPartida[]>([]);
  const [cuentasImputables, setCuentasImputables] = useState<CuentaContable[]>([]);
  const [firmas, setFirmas] = useState<FirmaContable[]>([]);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [loading, setLoading] = useState(false);

  // Filters (default to all months of the current year)
  const [filterYear, setFilterYear] = useState<number>(currentYear);
  const [filterMonth, setFilterMonth] = useState<number>(0);
  const [filterTipo, setFilterTipo] = useState<string>('');
  const [filterAnulada, setFilterAnulada] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Summary
  const [summary, setSummary] = useState({
    total: 0,
    total_cargos: 0,
    total_abonos: 0,
    total_anuladas: 0,
    total_activas: 0,
  });

  // Modal State - Editor
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingCodPart, setEditingCodPart] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [formPartida, setFormPartida] = useState<{
    fec_partida: string;
    cod_tp_part: string;
    num_correl: number;
    concepto_part: string;
    detalles: DetallePartida[];
  }>({
    fec_partida: new Date().toISOString().split('T')[0],
    cod_tp_part: '01',
    num_correl: 1,
    concepto_part: '',
    detalles: [],
  });

  // Quick Entry Row State
  const [quickCta, setQuickCta] = useState<CuentaContable | null>(null);
  const [quickCtaSearch, setQuickCtaSearch] = useState('');
  const [isQuickCtaDropdownOpen, setIsQuickCtaDropdownOpen] = useState(false);
  const [quickConcepto, setQuickConcepto] = useState('');
  const [quickCargo, setQuickCargo] = useState<string>('');
  const [quickAbono, setQuickAbono] = useState<string>('');

  const quickCtaInputRef = useRef<HTMLInputElement>(null);
  const quickConceptoInputRef = useRef<HTMLInputElement>(null);
  const quickCargoInputRef = useRef<HTMLInputElement>(null);
  const quickAbonoInputRef = useRef<HTMLInputElement>(null);

  // Modal State - View / Print Preview
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewPartida, setPreviewPartida] = useState<CabeceraPartida | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    cargarTiposYEmpresa();
  }, []);

  useEffect(() => {
    cargarListadoPartidas();
  }, [filterYear, filterMonth, filterTipo, filterAnulada]);

  useEffect(() => {
    cargarCuentasDelEjercicio(filterYear);
  }, [filterYear]);

  async function cargarTiposYEmpresa() {
    try {
      const [tipos, companyData, firmasData] = await Promise.all([
        obtenerTiposPartida(),
        obtenerEmpresa().catch(() => null),
        obtenerFirmasContables().catch(() => []),
      ]);
      setTiposPartida(tipos);
      setEmpresa(companyData);
      setFirmas(firmasData);
    } catch (err) {
      console.error(err);
    }
  }

  async function cargarCuentasDelEjercicio(year: number) {
    try {
      const data = await listarCuentas({
        ejercicio: String(year),
        soloImputables: true,
      });
      setCuentasImputables(data);
    } catch (err) {
      console.error(err);
    }
  }

  async function cargarListadoPartidas() {
    setLoading(true);
    try {
      const res = await listarPartidas({
        ano: filterYear,
        mes: filterMonth || undefined,
        cod_tp_part: filterTipo || undefined,
        anulada: filterAnulada !== '' ? filterAnulada : undefined,
        search: searchTerm || undefined,
      });
      setPartidas(res.data);
      setSummary(res.summary);
    } catch (err) {
      console.error(err);
      toast.error('Error al cargar las partidas contables');
    } finally {
      setLoading(false);
    }
  }

  const filteredQuickAccounts = useMemo(() => {
    if (!quickCtaSearch.trim()) return cuentasImputables.slice(0, 40);
    return cuentasImputables
      .filter((c) => matchesSearchTokens([c.cod_cta, c.nom_cta], quickCtaSearch))
      .slice(0, 40);
  }, [cuentasImputables, quickCtaSearch]);

  async function abrirModalNueva() {
    const todayStr = new Date().toISOString().split('T')[0];
    const defaultTipo = tiposPartida.length > 0 ? tiposPartida[0].cod_tp_partida : '01';

    let nextCorrel = 1;
    try {
      const corrData = await obtenerSiguienteCorrelativo({
        cod_tp_part: defaultTipo,
        ano: new Date(todayStr).getFullYear(),
        mes: new Date(todayStr).getMonth() + 1,
      });
      nextCorrel = corrData.suggestedNumCorrel;
    } catch (err) {
      console.error(err);
    }

    setEditingCodPart(null);
    setFormPartida({
      fec_partida: todayStr,
      cod_tp_part: defaultTipo,
      num_correl: nextCorrel,
      concepto_part: '',
      detalles: [],
    });

    setQuickCta(null);
    setQuickCtaSearch('');
    setQuickConcepto('');
    setQuickCargo('');
    setQuickAbono('');
    setIsQuickCtaDropdownOpen(false);
    setIsEditorOpen(true);
  }

  async function abrirModalEditar(codPart: string) {
    try {
      const p = await obtenerPartida(codPart);
      if (p.anulada_part === 1) {
        toast.error('No se puede editar una partida anulada. Primero debe reactivarla.');
        return;
      }

      setEditingCodPart(codPart);
      setFormPartida({
        fec_partida: p.fec_partida.split('T')[0],
        cod_tp_part: p.cod_tp_part,
        num_correl: p.num_correl,
        concepto_part: p.concepto_part,
        detalles: p.detalles || [],
      });

      setQuickCta(null);
      setQuickCtaSearch('');
      setQuickConcepto('');
      setQuickCargo('');
      setQuickAbono('');
      setIsQuickCtaDropdownOpen(false);
      setIsEditorOpen(true);
    } catch (err) {
      console.error(err);
      toast.error('Error al cargar la partida');
    }
  }

  async function abrirModalVistaPrevia(codPart: string) {
    setLoadingPreview(true);
    setIsPreviewOpen(true);
    try {
      const p = await obtenerPartida(codPart);
      setPreviewPartida(p);
    } catch (err) {
      console.error(err);
      toast.error('Error al cargar la vista previa de la partida');
      setIsPreviewOpen(false);
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleFechaOrTipoChange(newFecha: string, newTipo: string) {
    setFormPartida((prev) => ({ ...prev, fec_partida: newFecha, cod_tp_part: newTipo }));
    if (!editingCodPart) {
      try {
        const d = new Date(newFecha);
        const corrData = await obtenerSiguienteCorrelativo({
          cod_tp_part: newTipo,
          ano: d.getFullYear(),
          mes: d.getMonth() + 1,
        });
        setFormPartida((prev) => ({ ...prev, num_correl: corrData.suggestedNumCorrel }));
      } catch (err) {
        console.error(err);
      }
    }
  }

  function handleSelectQuickAccount(cta: CuentaContable) {
    setQuickCta(cta);
    setQuickCtaSearch(`${cta.cod_cta} - ${cta.nom_cta}`);
    setIsQuickCtaDropdownOpen(false);
    setTimeout(() => {
      quickConceptoInputRef.current?.focus();
    }, 50);
  }

  function handleAgregarRenglonRapido(e?: React.FormEvent) {
    if (e) e.preventDefault();

    if (!quickCta) {
      toast.error('Seleccione una cuenta contable imputable');
      quickCtaInputRef.current?.focus();
      return;
    }

    const cargoNum = parseFloat(quickCargo) || 0;
    const abonoNum = parseFloat(quickAbono) || 0;

    if (cargoNum <= 0 && abonoNum <= 0) {
      toast.error('Ingrese un monto válido en Cargo o en Abono');
      quickCargoInputRef.current?.focus();
      return;
    }

    const nuevoRenglon: DetallePartida = {
      id_cta: quickCta.id_cta,
      cod_cta: quickCta.cod_cta,
      nom_cta: quickCta.nom_cta,
      concepto: quickConcepto.trim() || formPartida.concepto_part || '',
      cargo_part: cargoNum,
      abono_part: abonoNum,
      marca: 'D',
    };

    setFormPartida((prev) => ({
      ...prev,
      detalles: [...prev.detalles, nuevoRenglon],
    }));

    // Reset quick fields and return focus to Account search
    setQuickCta(null);
    setQuickCtaSearch('');
    setQuickConcepto('');
    setQuickCargo('');
    setQuickAbono('');
    setIsQuickCtaDropdownOpen(false);

    setTimeout(() => {
      quickCtaInputRef.current?.focus();
    }, 50);
  }

  function eliminarRenglon(index: number) {
    setFormPartida((prev) => ({
      ...prev,
      detalles: prev.detalles.filter((_, i) => i !== index),
    }));
  }

  // Live Balance
  const totalCargosForm = useMemo(() => {
    return formPartida.detalles.reduce((acc, d) => acc + (Number(d.cargo_part) || 0), 0);
  }, [formPartida.detalles]);

  const totalAbonosForm = useMemo(() => {
    return formPartida.detalles.reduce((acc, d) => acc + (Number(d.abono_part) || 0), 0);
  }, [formPartida.detalles]);

  const diferenciaForm = useMemo(() => {
    return Math.abs(totalCargosForm - totalAbonosForm);
  }, [totalCargosForm, totalAbonosForm]);

  const isCuadrada = useMemo(() => {
    return totalCargosForm > 0 && diferenciaForm < 0.009;
  }, [totalCargosForm, diferenciaForm]);

  async function handleGuardarPartida(e: React.FormEvent) {
    e.preventDefault();

    if (!formPartida.concepto_part.trim()) {
      toast.error('Debe ingresar el concepto general de la partida');
      return;
    }

    if (formPartida.detalles.length < 2) {
      toast.error('La partida debe contener al menos 2 renglones');
      return;
    }

    // Check that every line has an account and amounts
    for (let i = 0; i < formPartida.detalles.length; i++) {
      const d = formPartida.detalles[i];
      if (!d.cod_cta.trim()) {
        toast.error(`El renglón #${i + 1} no tiene una cuenta seleccionada`);
        return;
      }
      const cargo = Number(d.cargo_part) || 0;
      const abono = Number(d.abono_part) || 0;
      if (cargo === 0 && abono === 0) {
        toast.error(`El renglón #${i + 1} (${d.cod_cta}) debe tener un valor en Cargo o Abono`);
        return;
      }
    }

    if (!isCuadrada) {
      toast.error(
        `La partida está descuadrada. Total Cargos: $${totalCargosForm.toFixed(
          2
        )}, Total Abonos: $${totalAbonosForm.toFixed(2)} (Diferencia: $${diferenciaForm.toFixed(2)})`
      );
      return;
    }

    setSaving(true);
    try {
      if (editingCodPart) {
        await actualizarPartida(editingCodPart, formPartida);
        toast.success('Partida contable actualizada exitosamente');
      } else {
        const res = await crearPartida(formPartida);
        toast.success(`Partida ${res.cod_part} registrada exitosamente`);
      }
      setIsEditorOpen(false);
      cargarListadoPartidas();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al guardar la partida contable');
    } finally {
      setSaving(false);
    }
  }

  async function handleAlternarAnulacion(p: CabeceraPartida) {
    const accion = p.anulada_part === 1 ? 'reactivar' : 'anular';
    if (!window.confirm(`¿Está seguro de ${accion} la partida ${p.cod_part}?`)) {
      return;
    }

    try {
      const res = await alternarAnulacionPartida(p.cod_part);
      toast.success(res.message);
      cargarListadoPartidas();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al cambiar estado de la partida');
    }
  }

  async function handleEliminarPartida(p: CabeceraPartida) {
    if (!window.confirm(`¿Está seguro de ELIMINAR permanentemente la partida ${p.cod_part}?`)) {
      return;
    }

    try {
      await eliminarPartida(p.cod_part);
      toast.success('Partida eliminada exitosamente');
      cargarListadoPartidas();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al eliminar la partida');
    }
  }

  const meses = [
    { num: 1, name: 'Enero' },
    { num: 2, name: 'Febrero' },
    { num: 3, name: 'Marzo' },
    { num: 4, name: 'Abril' },
    { num: 5, name: 'Mayo' },
    { num: 6, name: 'Junio' },
    { num: 7, name: 'Julio' },
    { num: 8, name: 'Agosto' },
    { num: 9, name: 'Septiembre' },
    { num: 10, name: 'Octubre' },
    { num: 11, name: 'Noviembre' },
    { num: 12, name: 'Diciembre' },
  ];

  return (
    <ControlIvaLayout>
      <div className="partidas-page">
      {/* Top Header & Actions */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Partidas Contables</h1>
          <p className="page-subtitle">
            Registro de diario, egresos, ingresos, ajustes contables y partidas de cierre
          </p>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="btn-primario"
            onClick={abrirModalNueva}
          >
            <Plus size={18} />
            <span>Nueva Partida</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="catalogo-stats-grid">
        <div className="catalogo-stat-card">
          <div className="stat-label">Total Partidas</div>
          <div className="stat-val text-primary">{summary.total}</div>
          <div className="stat-desc">Período seleccionado</div>
        </div>
        <div className="catalogo-stat-card">
          <div className="stat-label">Total Cargos ($)</div>
          <div className="stat-val font-mono text-emerald">
            ${Number(summary.total_cargos).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="stat-desc">Sumatoria de cargos</div>
        </div>
        <div className="catalogo-stat-card">
          <div className="stat-label">Total Abonos ($)</div>
          <div className="stat-val font-mono text-primary">
            ${Number(summary.total_abonos).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="stat-desc">Sumatoria de abonos</div>
        </div>
        <div className="catalogo-stat-card">
          <div className="stat-label">Partidas Activas</div>
          <div className="stat-val text-emerald">{summary.total_activas}</div>
          <div className="stat-desc">Válidas para reportes</div>
        </div>
        <div className="catalogo-stat-card">
          <div className="stat-label">Partidas Anuladas</div>
          <div className="stat-val text-danger">{summary.total_anuladas}</div>
          <div className="stat-desc">Sin efecto contable</div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="catalogo-filters-bar card">
        <div className="search-input-wrap">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Buscar por concepto, correlativo o código (PAR...)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') cargarListadoPartidas();
            }}
          />
          {searchTerm && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => {
                setSearchTerm('');
                cargarListadoPartidas();
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className="filters-group">
          {/* Year selector */}
          <div className="filter-item">
            <select
              className="filter-select font-bold"
              value={filterYear}
              onChange={(e) => setFilterYear(Number(e.target.value))}
            >
              {[2027, 2026, 2025, 2024, 2023, 2022].map((y) => (
                <option key={y} value={y}>
                  Año {y}
                </option>
              ))}
            </select>
          </div>

          {/* Month selector */}
          <div className="filter-item">
            <select
              className="filter-select"
              value={filterMonth}
              onChange={(e) => setFilterMonth(Number(e.target.value))}
            >
              <option value="0">Todos los Meses</option>
              {meses.map((m) => (
                <option key={m.num} value={m.num}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Partida type */}
          <div className="filter-item">
            <Filter size={15} className="filter-icon" />
            <select
              className="filter-select"
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value)}
            >
              <option value="">Todos los Tipos</option>
              {tiposPartida.map((tp) => (
                <option key={tp.cod_tp_partida} value={tp.cod_tp_partida}>
                  {tp.nom_tp_partida}
                </option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div className="filter-item">
            <select
              className="filter-select"
              value={filterAnulada}
              onChange={(e) => setFilterAnulada(e.target.value)}
            >
              <option value="">Todas (Activas/Anuladas)</option>
              <option value="0">Solo Activas</option>
              <option value="1">Solo Anuladas</option>
            </select>
          </div>

          <button
            type="button"
            className="btn-secundario btn-sm"
            onClick={cargarListadoPartidas}
            title="Recargar listado"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Partidas Table Card */}
      <div className="card">
        <div className="tabla-contenedor">
          <table className="tabla-registros">
            <thead>
              <tr>
                <th style={{ width: '90px', textAlign: 'center' }}>Correlativo</th>
                <th style={{ width: '130px' }}>Código Partida</th>
                <th style={{ width: '110px' }}>Fecha</th>
                <th style={{ width: '140px' }}>Tipo Partida</th>
                <th>Concepto General</th>
                <th style={{ width: '130px', textAlign: 'right' }}>Cargos ($)</th>
                <th style={{ width: '130px', textAlign: 'right' }}>Abonos ($)</th>
                <th className="text-center th-acciones" style={{ width: '120px' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-8">
                    <div className="loading-state">
                      <RefreshCw size={24} className="animate-spin text-primary" />
                      <span>Cargando partidas contables...</span>
                    </div>
                  </td>
                </tr>
              ) : partidas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-muted">
                    No se encontraron partidas contables en este período.
                  </td>
                </tr>
              ) : (
                partidas.map((p) => {
                  const isAnulada = p.anulada_part === 1;
                  const fechaStr = formatFechaDDMMYYYY(p.fec_partida);

                  return (
                    <tr key={p.cod_part} className={isAnulada ? 'row-partida-anulada' : ''}>
                      <td style={{ textAlign: 'center' }}>
                        <span className="font-mono font-bold text-slate-800">
                          #{p.num_correl}
                        </span>
                      </td>
                      <td>
                        <span className="font-mono font-semibold text-primary">{p.cod_part}</span>
                        {isAnulada && (
                          <span className="badge-status-pill badge-pill-invalid ml-2 text-xs">
                            Anulada
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="text-slate-700">{fechaStr}</span>
                      </td>
                      <td>
                        <span className="badge-tipo-partida">
                          {p.nom_tp_partida || p.cod_tp_part}
                        </span>
                      </td>
                      <td>
                        <span className={`text-slate-900 ${isAnulada ? 'line-through text-muted' : ''}`}>
                          {p.concepto_part}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="font-mono font-bold text-emerald">
                          ${Number(p.cargo_part).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="font-mono font-bold text-primary">
                          ${Number(p.abono_part).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div className="table-row-actions">
                          <button
                            type="button"
                            className="btn-action-view"
                            onClick={() => abrirModalVistaPrevia(p.cod_part)}
                            title="Ver detalle / Imprimir"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            type="button"
                            className="btn-action-edit"
                            onClick={() => abrirModalEditar(p.cod_part)}
                            title={isAnulada ? 'No editable (Anulada)' : 'Editar partida'}
                            disabled={isAnulada}
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            type="button"
                            className={`btn-action-toggle ${isAnulada ? 'text-emerald' : 'text-amber'}`}
                            onClick={() => handleAlternarAnulacion(p)}
                            title={isAnulada ? 'Reactivar partida' : 'Anular partida'}
                          >
                            {isAnulada ? <CheckCircle2 size={15} /> : <Ban size={15} />}
                          </button>
                          <button
                            type="button"
                            className="btn-action-delete"
                            onClick={() => handleEliminarPartida(p)}
                            title="Eliminar permanentemente"
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
      </div>

      {/* MODAL: Partida Editor (Create / Edit) */}
      {isEditorOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsEditorOpen(false)}
          title={editingCodPart ? `Editar Partida Contable: ${editingCodPart}` : 'Nueva Partida Contable'}
          maxWidth="4xl"
        >
          <form onSubmit={handleGuardarPartida} onKeyDown={handleEnterNavigation} className="form-symmetrical">
            {/* Header Inputs Grid */}
            <div className="form-section-title">1. Datos del Comprobante</div>
            <div className="form-grid-symmetrical cols-4">
              <div className="form-group">
                <label className="form-label">Fecha de Partida *</label>
                <input
                  type="date"
                  className="form-input"
                  value={formPartida.fec_partida}
                  onChange={(e) =>
                    handleFechaOrTipoChange(e.target.value, formPartida.cod_tp_part)
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Tipo de Partida *</label>
                <select
                  className="form-input font-bold"
                  value={formPartida.cod_tp_part}
                  onChange={(e) =>
                    handleFechaOrTipoChange(formPartida.fec_partida, e.target.value)
                  }
                  required
                >
                  {tiposPartida.map((tp) => (
                    <option key={tp.cod_tp_partida} value={tp.cod_tp_partida}>
                      {tp.cod_tp_partida} - {tp.nom_tp_partida}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Número Correlativo (Auto)</label>
                <input
                  type="text"
                  className="form-input font-mono font-bold input-readonly"
                  value={formPartida.num_correl ? String(formPartida.num_correl) : '...'}
                  disabled
                  readOnly
                  title="Generado automáticamente según el tipo de partida y período"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Código Global</label>
                <input
                  type="text"
                  className="form-input font-mono input-readonly"
                  value={editingCodPart || 'Automático (PAR...)'}
                  disabled
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Concepto General de la Partida *</label>
              <input
                type="text"
                className="form-input input-uppercase"
                placeholder="Ej: REGISTRO DE VENTAS Y RECAUDACION MENSUAL..."
                value={formPartida.concepto_part}
                onChange={(e) =>
                  setFormPartida({ ...formPartida, concepto_part: e.target.value.toUpperCase() })
                }
                required
              />
            </div>

            {/* Quick Entry Form Card */}
            <div className="form-section-title">2. Ingreso de Renglones</div>

            <div className="partida-quick-entry-card">
              <div className="partida-quick-grid">
                <div className="input-field" style={{ position: 'relative' }}>
                  <label>
                    Cuenta Imputable (D) <span className="req">*</span>
                  </label>
                  <input
                    ref={quickCtaInputRef}
                    type="text"
                    className="font-mono text-sm"
                    placeholder="Escriba código o nombre..."
                    value={quickCtaSearch}
                    onFocus={() => setIsQuickCtaDropdownOpen(true)}
                    onChange={(e) => {
                      setQuickCtaSearch(e.target.value);
                      setIsQuickCtaDropdownOpen(true);
                      if (!e.target.value) setQuickCta(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (filteredQuickAccounts.length > 0) {
                          handleSelectQuickAccount(filteredQuickAccounts[0]);
                        } else {
                          quickConceptoInputRef.current?.focus();
                        }
                      }
                    }}
                  />

                  {isQuickCtaDropdownOpen && (
                    <div className="account-autocomplete-dropdown" style={{ zIndex: 100 }}>
                      <div className="dropdown-header">
                        <span>Cuentas Imputables (D):</span>
                        <button
                          type="button"
                          className="close-dropdown-btn"
                          onClick={() => setIsQuickCtaDropdownOpen(false)}
                        >
                          <X size={14} />
                        </button>
                      </div>
                      <div className="dropdown-items-list" style={{ maxHeight: '180px' }}>
                        {filteredQuickAccounts.length === 0 ? (
                          <div className="p-2 text-xs text-muted">
                            No se encontraron cuentas coincidentes
                          </div>
                        ) : (
                          filteredQuickAccounts.map((cta) => (
                            <div
                              key={cta.id_cta || cta.cod_cta}
                              className="autocomplete-item"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleSelectQuickAccount(cta);
                              }}
                            >
                              <span className="font-mono font-bold text-primary">
                                {cta.cod_cta}
                              </span>
                              <span className="cta-nom">{cta.nom_cta}</span>
                              <span className="cta-nature">
                                {cta.deudor === 1 ? 'Deudora' : 'Acreedora'}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="input-field">
                  <label>Concepto del Renglón</label>
                  <input
                    ref={quickConceptoInputRef}
                    type="text"
                    placeholder={formPartida.concepto_part || 'Concepto opcional...'}
                    value={quickConcepto}
                    onChange={(e) => setQuickConcepto(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        quickCargoInputRef.current?.focus();
                      }
                    }}
                  />
                </div>

                <div className="input-field">
                  <label>Cargo / Debe ($)</label>
                  <input
                    ref={quickCargoInputRef}
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="text-right font-mono font-bold"
                    value={quickCargo}
                    onChange={(e) => {
                      setQuickCargo(e.target.value);
                      if (parseFloat(e.target.value) > 0) {
                        setQuickAbono('');
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (parseFloat(quickCargo) > 0) {
                          handleAgregarRenglonRapido();
                        } else {
                          quickAbonoInputRef.current?.focus();
                        }
                      }
                    }}
                  />
                </div>

                <div className="input-field">
                  <label>Abono / Haber ($)</label>
                  <input
                    ref={quickAbonoInputRef}
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="text-right font-mono font-bold"
                    value={quickAbono}
                    onChange={(e) => {
                      setQuickAbono(e.target.value);
                      if (parseFloat(e.target.value) > 0) {
                        setQuickCargo('');
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAgregarRenglonRapido();
                      }
                    }}
                  />
                </div>

                <div className="btn-add-wrap">
                  <button
                    type="button"
                    className="btn-primario btn-sm"
                    style={{ height: '36px', whiteSpace: 'nowrap' }}
                    onClick={() => handleAgregarRenglonRapido()}
                  >
                    <Plus size={15} />
                    <span>Agregar</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Listado Compacto de Renglones Acumulados (Texto sin inputs pesados) */}
            <div className="tabla-contenedor" style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
              {formPartida.detalles.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '0.88rem' }}>
                  No has agregado renglones a esta partida. Ingresa los datos arriba y presiona <strong>Agregar</strong> o <strong>Enter</strong>.
                </div>
              ) : (
                <table className="tabla-registros tabla-renglones-compacta">
                  <thead>
                    <tr>
                      <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                      <th style={{ width: '320px' }}>Cuenta Contable</th>
                      <th>Concepto del Renglón</th>
                      <th style={{ width: '130px', textAlign: 'right' }}>Cargo / Debe ($)</th>
                      <th style={{ width: '130px', textAlign: 'right' }}>Abono / Haber ($)</th>
                      <th style={{ width: '50px', textAlign: 'center' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {formPartida.detalles.map((d, idx) => (
                      <tr key={idx}>
                        <td style={{ textAlign: 'center', color: '#64748b', fontWeight: 700 }}>
                          {idx + 1}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="font-mono font-bold text-primary">{d.cod_cta}</span>
                            <span style={{ color: '#94a3b8' }}>-</span>
                            <span style={{ fontSize: '0.85rem', color: '#1e293b' }}>{d.nom_cta}</span>
                          </div>
                        </td>
                        <td style={{ fontSize: '0.85rem', color: '#334155' }}>
                          {d.concepto || <span className="text-muted italic">(Concepto general)</span>}
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            color: d.cargo_part > 0 ? '#0f172a' : '#94a3b8',
                          }}
                        >
                          {d.cargo_part > 0
                            ? `$ ${d.cargo_part.toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}`
                            : '—'}
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            color: d.abono_part > 0 ? '#0f172a' : '#94a3b8',
                          }}
                        >
                          {d.abono_part > 0
                            ? `$ ${d.abono_part.toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}`
                            : '—'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="btn-action-delete"
                            onClick={() => eliminarRenglon(idx)}
                            title="Eliminar este renglón"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Clean, Light Real-time Balance Box */}
            <div className="partida-balance-footer">
              <div className="balance-grid">
                <div className="balance-box box-cargos">
                  <span className="bal-lbl">Total Cargos (Debe)</span>
                  <span className="bal-val font-mono">
                    ${totalCargosForm.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="balance-box box-abonos">
                  <span className="bal-lbl">Total Abonos (Haber)</span>
                  <span className="bal-val font-mono">
                    ${totalAbonosForm.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="balance-box box-diferencia">
                  <span className="bal-lbl">Diferencia</span>
                  <span
                    className={`bal-val font-mono ${
                      diferenciaForm > 0.009 ? 'text-danger' : 'text-slate-800'
                    }`}
                  >
                    ${diferenciaForm.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div>
                  {isCuadrada ? (
                    <div className="badge-balance-ok">
                      <CheckCircle2 size={16} />
                      <span>PARTIDA CUADRADA</span>
                    </div>
                  ) : (
                    <div className="badge-balance-error">
                      <AlertTriangle size={16} />
                      <span>DESCUADRADA (${diferenciaForm.toFixed(2)})</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn-secundario"
                onClick={() => setIsEditorOpen(false)}
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn-primario btn-icon-gap"
                disabled={saving || !isCuadrada}
              >
                {saving ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={18} />
                    <span>{editingCodPart ? 'Actualizar Partida' : 'Guardar Partida'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: View / Print Preview */}
      {isPreviewOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsPreviewOpen(false)}
          title="Comprobante de Partida Contable"
          maxWidth="4xl"
        >
          <div className="printable-voucher">
            <div className="flex justify-end mb-4 no-print">
              <button
                type="button"
                className="btn-primario btn-sm btn-icon-gap"
                onClick={() => window.print()}
              >
                <Printer size={16} />
                <span>Imprimir Comprobante</span>
              </button>
            </div>

            {loadingPreview || !previewPartida ? (
              <div className="text-center py-12">
                <RefreshCw size={28} className="animate-spin text-primary" />
                <p className="mt-2 text-sm text-muted">Cargando comprobante...</p>
              </div>
            ) : (
              <div className="voucher-sheet">
                {/* Voucher Header */}
                <div className="voucher-header">
                  <h2 className="voucher-empresa-nom">
                    {empresa?.nom_emp || `EMPRESA #${empresa?.cod_emp}`}
                  </h2>
                  <div className="voucher-empresa-nit">NIT: {empresa?.nit || '—'}</div>
                  <h3 className="voucher-tipo-title">
                    COMPROBANTE DE DIARIO ({previewPartida.nom_tp_partida || 'PARTIDA'})
                  </h3>
                </div>

                {/* Voucher Meta Grid */}
                <div className="voucher-meta-box">
                  <div className="meta-col">
                    <span className="meta-lbl">Número Correlativo:</span>
                    <span className="meta-val font-bold">#{previewPartida.num_correl}</span>
                  </div>
                  <div className="meta-col">
                    <span className="meta-lbl">Código Único:</span>
                    <span className="meta-val font-mono">{previewPartida.cod_part}</span>
                  </div>
                  <div className="meta-col">
                    <span className="meta-lbl">Fecha de Registro:</span>
                    <span className="meta-val">
                      {formatFechaDDMMYYYY(previewPartida.fec_partida)}
                    </span>
                  </div>
                  <div className="meta-col">
                    <span className="meta-lbl">Estado:</span>
                    <span className="meta-val">
                      {previewPartida.anulada_part === 1 ? 'ANULADA' : 'ACTIVA'}
                    </span>
                  </div>
                </div>

                {/* Concept */}
                <div className="voucher-concept-box">
                  <strong>Concepto:</strong> {previewPartida.concepto_part}
                </div>

                {/* Lines Table */}
                <table className="voucher-lines-table">
                  <thead>
                    <tr>
                      <th style={{ width: '130px' }}>CÓDIGO</th>
                      <th>CUENTA Y DETALLE</th>
                      <th style={{ width: '120px', textAlign: 'right' }}>DEBE ($)</th>
                      <th style={{ width: '120px', textAlign: 'right' }}>HABER ($)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewPartida.detalles?.map((d, idx) => (
                      <tr key={idx}>
                        <td className="font-mono font-bold">{d.cod_cta}</td>
                        <td>
                          <div className="font-bold text-slate-800">{d.nom_cta}</div>
                          {d.concepto && d.concepto !== previewPartida.concepto_part && (
                            <div className="text-xs text-muted">{d.concepto}</div>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }} className="font-mono">
                          {Number(d.cargo_part) > 0
                            ? `$${Number(d.cargo_part).toFixed(2)}`
                            : ''}
                        </td>
                        <td style={{ textAlign: 'right' }} className="font-mono">
                          {Number(d.abono_part) > 0
                            ? `$${Number(d.abono_part).toFixed(2)}`
                            : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th colSpan={2} style={{ textAlign: 'right' }}>
                        TOTALES ($):
                      </th>
                      <th style={{ textAlign: 'right' }} className="font-mono font-bold">
                        ${Number(previewPartida.cargo_part).toFixed(2)}
                      </th>
                      <th style={{ textAlign: 'right' }} className="font-mono font-bold">
                        ${Number(previewPartida.abono_part).toFixed(2)}
                      </th>
                    </tr>
                  </tfoot>
                </table>

                {/* Signatures Row */}
                <div className="voucher-signatures-row">
                  <div className="signature-box">
                    <div className="signature-line" />
                    <div className="signature-name">
                      {firmas.find((f) => f.id_firma === 1)?.nom_firma || 'Firma'}
                    </div>
                    <div className="signature-role">
                      {firmas.find((f) => f.id_firma === 1)?.puesto || 'Elaboró'}
                    </div>
                  </div>

                  <div className="signature-box">
                    <div className="signature-line" />
                    <div className="signature-name">
                      {firmas.find((f) => f.id_firma === 2)?.nom_firma || 'Firma'}
                    </div>
                    <div className="signature-role">
                      {firmas.find((f) => f.id_firma === 2)?.puesto || 'Revisó'}
                    </div>
                  </div>

                  <div className="signature-box">
                    <div className="signature-line" />
                    <div className="signature-name">
                      {firmas.find((f) => f.id_firma === 3)?.nom_firma || 'Firma'}
                    </div>
                    <div className="signature-role">
                      {firmas.find((f) => f.id_firma === 3)?.puesto || 'Autorizó / Contador'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
        </div>
      </ControlIvaLayout>
    );
}
