import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  BarChart2,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  GitCompare,
  HelpCircle,
  Layers,
  ListChecks,
  Play,
  Printer,
  RefreshCw,
  SlidersHorizontal,
  TrendingUp,
} from 'lucide-react';
import Modal from '../../components/ui/Modal';
import { ACCOUNTING_REPORT_GUIDES } from '../../data/accountingReportGuides';
import {
  ejecutarMayorizacion,
  listarCuentas,
  obtenerDatosReporteContable,
  obtenerTiposPartida,
} from '../../api/accounting';
import ControlIvaLayout from '../../components/layout/ControlIvaLayout';
import SearchableSelect, { SearchableOption } from '../../components/ui/SearchableSelect';
import { CuentaContable, ReporteContableResponse, TipoPartida } from '../../types/accounting';
import { exportAccountingReportToPdf, formatCurrency } from '../../utils/accountingPdfExport';
import { exportAccountingReportToExcel } from '../../utils/accountingExcelExport';

export interface ReportDefinition {
  id: string;
  name: string;
  category: 'diarios' | 'balances' | 'estados';
  categoryLabel: string;
  description: string;
  icon: React.ElementType;
  params: {
    requiresAno?: boolean;
    requiresMes?: boolean;
    requiresRangoFechas?: boolean;
    requiresTipoPartida?: boolean;
    requiresNivel?: boolean;
    requiresRangoCuentas?: boolean;
    requiresAnoComparativo?: boolean;
  };
}

const REPORT_DEFINITIONS: ReportDefinition[] = [
  // Libros Oficiales y Diarios
  {
    id: 'diario_mayor',
    name: 'Libro Diario Mayor',
    category: 'diarios',
    categoryLabel: 'Libros Oficiales y Diarios',
    description: 'Registro cronológico y mayorizado de transacciones mensuales por cuenta.',
    icon: FileText,
    params: { requiresAno: true, requiresMes: true },
  },
  {
    id: 'diario',
    name: 'Libro Diario',
    category: 'diarios',
    categoryLabel: 'Libros Oficiales y Diarios',
    description: 'Detalle de asientos contables clasificados por tipo de partida y período de fechas.',
    icon: BookOpen,
    params: { requiresRangoFechas: true, requiresTipoPartida: true },
  },
  {
    id: 'diario_mayor_consolidado',
    name: 'Libro Diario Mayor Consolidado',
    category: 'diarios',
    categoryLabel: 'Libros Oficiales y Diarios',
    description: 'Consolidación global de movimientos y saldos acumulados del período.',
    icon: Layers,
    params: { requiresAno: true, requiresMes: true },
  },
  {
    id: 'auxiliar_operaciones',
    name: 'Auxiliar de Operaciones',
    category: 'diarios',
    categoryLabel: 'Libros Oficiales y Diarios',
    description: 'Movimiento detallado partida por partida para un rango de cuentas específico.',
    icon: ListChecks,
    params: { requiresAno: true, requiresRangoFechas: true, requiresRangoCuentas: true },
  },

  // Balances y Comprobación
  {
    id: 'bal_comp_cargos_abonos',
    name: 'Balance de Comprobación (Cargos y Abonos)',
    category: 'balances',
    categoryLabel: 'Balances y Comprobación',
    description: 'Resumen de sumas de cargos y abonos con saldos resultantes por nivel.',
    icon: BarChart2,
    params: { requiresAno: true, requiresMes: true, requiresNivel: true },
  },
  {
    id: 'bal_comp_niveles',
    name: 'Balance de Comprobación por Niveles',
    category: 'balances',
    categoryLabel: 'Balances y Comprobación',
    description: 'Estructura jerárquica con saldos de apertura, movimientos y saldo final.',
    icon: SlidersHorizontal,
    params: { requiresAno: true, requiresMes: true, requiresNivel: true },
  },
  {
    id: 'balance_general_cuenta',
    name: 'Balance General - Cuenta',
    category: 'balances',
    categoryLabel: 'Balances y Comprobación',
    description: 'Estado de Situación Financiera clasificado en formato de cuenta contable.',
    icon: Layers,
    params: { requiresAno: true, requiresMes: true, requiresNivel: true },
  },
  {
    id: 'bal_comp_cuenta',
    name: 'Balance de Comprobación - Cuenta',
    category: 'balances',
    categoryLabel: 'Balances y Comprobación',
    description: 'Comprobación detallada ordenada por código y subcuentas asociadas.',
    icon: ListChecks,
    params: { requiresAno: true, requiresMes: true, requiresNivel: true },
  },
  {
    id: 'anexo_balance_general',
    name: 'Anexo al Balance General',
    category: 'balances',
    categoryLabel: 'Balances y Comprobación',
    description: 'Desglose complementario de las cuentas principales del balance de situación.',
    icon: FileText,
    params: { requiresAno: true, requiresMes: true, requiresNivel: true },
  },
  {
    id: 'balance_comparativo',
    name: 'Balance Comparativo',
    category: 'balances',
    categoryLabel: 'Balances y Comprobación',
    description: 'Análisis comparativo de saldos y variaciones absolutas y relativas entre dos ejercicios.',
    icon: GitCompare,
    params: { requiresAno: true, requiresAnoComparativo: true, requiresMes: true, requiresNivel: true },
  },

  // Estados Financieros y Rendimiento
  {
    id: 'estado_resultados',
    name: 'Estado de Resultados',
    category: 'estados',
    categoryLabel: 'Estados Financieros y Rendimiento',
    description: 'Informe económico de ingresos, costos, gastos y utilidad del ejercicio contable.',
    icon: TrendingUp,
    params: { requiresAno: true, requiresMes: true, requiresNivel: true },
  },
  {
    id: 'cuadro_ingresos_gastos',
    name: 'Cuadro de Ingresos y Gastos',
    category: 'estados',
    categoryLabel: 'Estados Financieros y Rendimiento',
    description: 'Cuadro analítico de flujos de rentabilidad y operaciones por rango de cuentas.',
    icon: BarChart2,
    params: { requiresAno: true, requiresMes: true, requiresNivel: true, requiresRangoCuentas: true },
  },
];

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

export default function ReportesContablesPage() {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  // Selected Report
  const [selectedReportId, setSelectedReportId] = useState<string>('diario_mayor');

  // Dynamic Parameters State
  const [paramAno, setParamAno] = useState<number>(currentYear);
  const [paramMes, setParamMes] = useState<number>(currentMonth);
  const [paramFecDesde, setParamFecDesde] = useState<string>(
    new Date(currentYear, currentMonth - 1, 1).toISOString().split('T')[0]
  );
  const [paramFecHasta, setParamFecHasta] = useState<string>(
    new Date(currentYear, currentMonth, 0).toISOString().split('T')[0]
  );
  const [paramTipoPartida, setParamTipoPartida] = useState<string>('TODAS');
  const [paramNivel, setParamNivel] = useState<number>(3);
  const [paramAnoComparativo, setParamAnoComparativo] = useState<number>(currentYear - 1);

  // Range Accounts
  const [cuentaDesde, setCuentaDesde] = useState<{ cod_cta: string; nom_cta: string }>({
    cod_cta: '',
    nom_cta: '',
  });
  const [cuentaHasta, setCuentaHasta] = useState<{ cod_cta: string; nom_cta: string }>({
    cod_cta: '',
    nom_cta: '',
  });

  // Aux Data
  const [catalogo, setCatalogo] = useState<CuentaContable[]>([]);
  const [tiposPartida, setTiposPartida] = useState<TipoPartida[]>([]);

  // Mayorización State
  const [ejecutandoMayorizacion, setEjecutandoMayorizacion] = useState(false);

  // Generated Report State
  const [reporteGenerado, setReporteGenerado] = useState<ReporteContableResponse | null>(null);
  const [cargandoReporte, setCargandoReporte] = useState(false);

  // Selected Report Object
  const activeReport = useMemo(() => {
    return REPORT_DEFINITIONS.find((r) => r.id === selectedReportId) || REPORT_DEFINITIONS[0];
  }, [selectedReportId]);

  // Info Modal State & Guide Data
  const [showInfoModal, setShowInfoModal] = useState(false);
  const currentGuide = useMemo(() => {
    return (
      ACCOUNTING_REPORT_GUIDES[selectedReportId] || {
        descripcionBreve: activeReport.description,
        enQueConsiste: activeReport.description,
        comoFunciona: ['Procesa y presenta los registros contables correspondientes.'],
        tablas: 'cat_cuentas, cuentas_saldos, firmas_conta',
        requiereMayorizacion: true,
        consejos: ['Mayoriza periódicamente para mantener los saldos actualizados.'],
      }
    );
  }, [selectedReportId, activeReport]);

  // Options for SearchableSelect accounts
  const accountOptions: SearchableOption[] = useMemo(() => {
    return catalogo.map((acc) => ({
      value: acc.cod_cta,
      label: `${acc.cod_cta} - ${acc.nom_cta}`,
      subLabel: `Nivel ${acc.nivel_cta} | ${acc.g_d_m === 'D' ? 'Imputable' : 'Mayor'}`,
    }));
  }, [catalogo]);

  // Load catalog accounts and partida types on mount & when year changes
  useEffect(() => {
    async function loadAuxData() {
      try {
        const [accs, types] = await Promise.all([
          listarCuentas({ ejercicio: String(paramAno), soloImputables: false }),
          obtenerTiposPartida(),
        ]);
        setCatalogo(accs);
        setTiposPartida(types);
      } catch (err: any) {
        console.error('Error cargando catálogo auxiliar:', err);
      }
    }
    loadAuxData();
  }, [paramAno]);

  // Execute Mayorización directly on selected year
  async function handleMayorizarDirecto() {
    try {
      setEjecutandoMayorizacion(true);
      const res = await ejecutarMayorizacion(paramAno);
      toast.success(
        `Mayorización completada para el año ${paramAno}: ${res.totalCuentas} cuentas procesadas (${res.totalPartidasProcesadas} partidas).`,
        { duration: 5000 }
      );
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Error al ejecutar la mayorización';
      toast.error(msg);
    } finally {
      setEjecutandoMayorizacion(false);
    }
  }

  // Invalidate generated report whenever parameters or active report change
  useEffect(() => {
    setReporteGenerado(null);
  }, [
    selectedReportId,
    paramAno,
    paramMes,
    paramFecDesde,
    paramFecHasta,
    paramTipoPartida,
    paramNivel,
    paramAnoComparativo,
    cuentaDesde.cod_cta,
    cuentaHasta.cod_cta,
  ]);

  // Handle Report Generation (Preview)
  async function handleGenerateReport() {
    try {
      setCargandoReporte(true);
      const res = await obtenerDatosReporteContable({
        reportId: selectedReportId,
        ano: paramAno,
        mes: paramMes,
        fecha_desde: paramFecDesde,
        fecha_hasta: paramFecHasta,
        cuenta_desde: cuentaDesde.cod_cta || undefined,
        cuenta_hasta: cuentaHasta.cod_cta || undefined,
        nivel_max: paramNivel,
        ano_comparativo: paramAnoComparativo,
        cod_tipo_partida: paramTipoPartida === 'TODAS' ? undefined : paramTipoPartida,
      });

      setReporteGenerado(res);
      toast.success(`Reporte ${res.titulo} generado exitosamente`);
    } catch (err: any) {
      console.error('Error al generar reporte:', err);
      const msg = err.response?.data?.error || err.message || 'Error al generar el reporte contable';
      toast.error(msg);
    } finally {
      setCargandoReporte(false);
    }
  }

  // Handle direct exports when report is already generated
  function handleExportDirect(actionType: 'pdf' | 'excel' | 'print') {
    if (!reporteGenerado) {
      toast.error('Primero debes generar el reporte.');
      return;
    }

    if (actionType === 'pdf') {
      exportAccountingReportToPdf(reporteGenerado);
      toast.success(`PDF generado: ${reporteGenerado.titulo}`);
    } else if (actionType === 'excel') {
      exportAccountingReportToExcel(reporteGenerado);
      toast.success(`Excel generado: ${reporteGenerado.titulo}`);
    } else if (actionType === 'print') {
      window.print();
    }
  }

  return (
    <ControlIvaLayout>
      <div className="page-header no-print" style={{ marginBottom: '14px', alignItems: 'center' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={22} color="#2563eb" />
            <span>Reportes Contables y Balances</span>
          </h1>
          <p className="page-subtitle">
            Libros contables oficiales, balances de comprobación, estados financieros y mayorización
          </p>
        </div>
      </div>

        {/* Unified 2-Column Layout */}
        <div className="reportes-layout-grid">
          {/* Left Column: Reports Catalog Selector */}
          <div className="reportes-sidebar-card no-print">
            <div className="reportes-sidebar-header">
              <div className="reportes-sidebar-title">
                <Filter size={16} className="text-blue-600" />
                <span>Catálogo de Reportes</span>
              </div>
              <span className="badge badge-info">{REPORT_DEFINITIONS.length} reportes</span>
            </div>

            {/* Control Año Contable y Botón Mayorizar */}
            <div className="mayorizar-sidebar-box">
              <div className="mayorizar-sidebar-row">
                <button
                  type="button"
                  className="btn-mayorizar-action"
                  onClick={handleMayorizarDirecto}
                  disabled={ejecutandoMayorizacion}
                  title={`Mayorizar Cuentas del Ejercicio ${paramAno}`}
                >
                  <RefreshCw size={15} className={ejecutandoMayorizacion ? 'animate-spin' : ''} />
                  <span>{ejecutandoMayorizacion ? 'Mayorizando...' : 'Mayorizar'}</span>
                </button>
                <div className="mayorizar-ano-input-wrap">
                  <span className="mayorizar-ano-label">Año:</span>
                  <input
                    type="number"
                    className="form-input mayorizar-ano-input font-mono font-bold"
                    value={paramAno}
                    onChange={(e) => setParamAno(Number(e.target.value))}
                    onFocus={(e) => e.target.select()}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    min={2000}
                    max={2099}
                    title="Año contable del ejercicio (fija el año de todos los reportes)"
                    disabled={ejecutandoMayorizacion}
                  />
                </div>
              </div>
            </div>

            {/* List of Reports */}
            <div className="reportes-sidebar-list">
              {['diarios', 'balances', 'estados'].map((catKey) => {
                const itemsInCat = REPORT_DEFINITIONS.filter((r) => r.category === catKey);
                if (itemsInCat.length === 0) return null;

                const catTitle =
                  catKey === 'diarios'
                    ? 'Libros Diarios y Oficiales'
                    : catKey === 'balances'
                    ? 'Balances y Comprobación'
                    : 'Estados Financieros y Rendimiento';

                return (
                  <div key={catKey} className="mb-2">
                    <div className="reportes-category-label">{catTitle}</div>
                    {itemsInCat.map((report) => {
                      const IconComponent = report.icon;
                      const isActive = selectedReportId === report.id;
                      return (
                        <button
                          key={report.id}
                          type="button"
                          className={`reporte-item-btn ${isActive ? 'active' : ''}`}
                          onClick={() => setSelectedReportId(report.id)}
                        >
                          <div className="reporte-item-main">
                            <div className="reporte-item-icon">
                              <IconComponent size={16} />
                            </div>
                            <div className="reporte-item-info">
                              <span className="reporte-item-name">{report.name}</span>
                              <span className="reporte-item-meta">{report.categoryLabel}</span>
                            </div>
                          </div>
                          {isActive && <ChevronRight size={16} className="text-blue-600 flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Parameters and Interactive Preview */}
          <div className="reportes-main-col">
            {/* Parameters Card */}
            <div className="reportes-params-card no-print">
              <div className="reportes-params-header">
                <div className="reportes-params-title-box">
                  <div className="flex items-center gap-2">
                    <span className="badge badge-info">{activeReport.categoryLabel}</span>
                  </div>
                  <div className="reportes-title-with-btn">
                    <h2 className="reportes-params-title">
                      <activeReport.icon size={22} className="text-blue-600" />
                      <span>{activeReport.name}</span>
                    </h2>
                    <button
                      type="button"
                      className="btn-report-info-trigger"
                      onClick={() => setShowInfoModal(true)}
                      title={`Ver explicación y funcionamiento de ${activeReport.name}`}
                    >
                      <HelpCircle size={15} />
                      <span>¿Cómo funciona este reporte?</span>
                    </button>
                  </div>
                  <p className="reportes-params-desc">{activeReport.description}</p>
                </div>
              </div>

              {/* Dynamic Parameters Grid */}
              <div className="reportes-params-grid cols-3">
                {/* Year Parameter (Read-only, synchronized with global year next to Mayorizar button) */}
                {(activeReport.params.requiresAno || !activeReport.params.requiresRangoFechas) && (
                  <div className="form-group">
                    <label className="form-label">
                      {activeReport.params.requiresAnoComparativo ? 'Año Base (Ejercicio)' : 'Año Fiscal'}
                    </label>
                    <input
                      type="number"
                      className="form-input font-bold input-readonly"
                      value={paramAno}
                      readOnly
                      disabled
                      title="Año contable fijado desde el selector principal junto al botón Mayorizar"
                    />
                  </div>
                )}

                {/* Comparative Year Parameter */}
                {activeReport.params.requiresAnoComparativo && (
                  <div className="form-group">
                    <label className="form-label">Año Comparativo *</label>
                    <input
                      type="number"
                      className="form-input font-bold"
                      value={paramAnoComparativo}
                      onChange={(e) => setParamAnoComparativo(Number(e.target.value))}
                      onFocus={(e) => e.target.select()}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      min={2000}
                      max={2099}
                    />
                  </div>
                )}

                {/* Month Parameter */}
                {activeReport.params.requiresMes && (
                  <div className="form-group">
                    <label className="form-label">Mes *</label>
                    <select
                      className="form-input font-semibold"
                      value={paramMes}
                      onChange={(e) => setParamMes(Number(e.target.value))}
                    >
                      {MONTHS.map((m) => (
                        <option key={m.val} value={m.val}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Account Level Parameter */}
                {activeReport.params.requiresNivel && (
                  <div className="form-group">
                    <label className="form-label">Nivel de Cuenta *</label>
                    <select
                      className="form-input font-semibold"
                      value={paramNivel}
                      onChange={(e) => setParamNivel(Number(e.target.value))}
                    >
                      <option value={1}>Nivel 1 - Clase / Mayor Principal</option>
                      <option value={2}>Nivel 2 - Grupo / Rubro</option>
                      <option value={3}>Nivel 3 - Cuenta de Mayor</option>
                      <option value={4}>Nivel 4 - Subcuenta</option>
                      <option value={5}>Nivel 5 - Auxiliar</option>
                      <option value={6}>Nivel 6 - Detalle Analítico</option>
                    </select>
                  </div>
                )}

                {/* Date Range Parameters */}
                {activeReport.params.requiresRangoFechas && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Del (Fecha Inicio) *</label>
                      <input
                        type="date"
                        className="form-input"
                        value={paramFecDesde}
                        onChange={(e) => setParamFecDesde(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Al (Fecha Fin) *</label>
                      <input
                        type="date"
                        className="form-input"
                        value={paramFecHasta}
                        onChange={(e) => setParamFecHasta(e.target.value)}
                      />
                    </div>
                  </>
                )}

                {/* Partida Type Parameter */}
                {activeReport.params.requiresTipoPartida && (
                  <div className="form-group">
                    <label className="form-label">Tipo de Partida</label>
                    <select
                      className="form-input font-semibold"
                      value={paramTipoPartida}
                      onChange={(e) => setParamTipoPartida(e.target.value)}
                    >
                      <option value="TODAS">TODAS LAS PARTIDAS</option>
                      {tiposPartida.map((tp) => (
                        <option key={tp.cod_tp_partida} value={tp.cod_tp_partida}>
                          {tp.cod_tp_partida} - {tp.nom_tp_partida}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Account Range Parameters (for Auxiliar and Cuadro Ingresos/Gastos) with SearchableSelect */}
              {activeReport.params.requiresRangoCuentas && (
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '10px' }}>
                    Filtro por Rango de Cuentas (Selector Buscable)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                    {/* Desde Cuenta */}
                    <div className="form-group">
                      <label className="form-label">Desde la Cuenta:</label>
                      <SearchableSelect
                        options={accountOptions}
                        value={cuentaDesde.cod_cta}
                        onChange={(val) => {
                          const acc = catalogo.find((c) => c.cod_cta === val);
                          setCuentaDesde({ cod_cta: val, nom_cta: acc?.nom_cta || '' });
                        }}
                        placeholder="Todas las cuentas iniciales..."
                        emptyText="No se encontró la cuenta en el catálogo"
                      />
                    </div>

                    {/* Hasta Cuenta */}
                    <div className="form-group">
                      <label className="form-label">Hasta la Cuenta:</label>
                      <SearchableSelect
                        options={accountOptions}
                        value={cuentaHasta.cod_cta}
                        onChange={(val) => {
                          const acc = catalogo.find((c) => c.cod_cta === val);
                          setCuentaHasta({ cod_cta: val, nom_cta: acc?.nom_cta || '' });
                        }}
                        placeholder="Todas las cuentas finales..."
                        emptyText="No se encontró la cuenta en el catálogo"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Action Bar */}
              <div className="reportes-actions-bar">
                <div className="reportes-actions-left">
                  <button
                    type="button"
                    className="btn-primario btn-icon-gap"
                    onClick={handleGenerateReport}
                    disabled={cargandoReporte}
                  >
                    <Play size={16} />
                    <span>{cargandoReporte ? 'Generando...' : 'Generar Reporte'}</span>
                  </button>
                </div>

                <div className="reportes-actions-right">
                  <button
                    type="button"
                    className="btn-export btn-pdf"
                    onClick={() => handleExportDirect('pdf')}
                    disabled={!reporteGenerado || cargandoReporte}
                    title={
                      !reporteGenerado
                        ? 'Primero haz clic en "Generar Reporte" para habilitar la descarga'
                        : 'Descargar reporte oficial en formato PDF'
                    }
                  >
                    <Download size={16} />
                    <span>Descargar PDF</span>
                  </button>
                  <button
                    type="button"
                    className="btn-export btn-excel"
                    onClick={() => handleExportDirect('excel')}
                    disabled={!reporteGenerado || cargandoReporte}
                    title={
                      !reporteGenerado
                        ? 'Primero haz clic en "Generar Reporte" para habilitar la exportación'
                        : 'Exportar datos a hoja de cálculo Excel'
                    }
                  >
                    <FileSpreadsheet size={16} />
                    <span>Exportar Excel</span>
                  </button>
                  <button
                    type="button"
                    className="btn-export btn-print"
                    onClick={() => handleExportDirect('print')}
                    disabled={!reporteGenerado || cargandoReporte}
                    title={
                      !reporteGenerado
                        ? 'Primero haz clic en "Generar Reporte" para habilitar la impresión'
                        : 'Imprimir documento oficial'
                    }
                  >
                    <Printer size={16} />
                    <span>Imprimir</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Preview Card */}
            <div className="reportes-preview-card">
              {cargandoReporte ? (
                <div className="reportes-loading-state no-print p-12 text-center">
                  <RefreshCw size={36} className="animate-spin text-blue-600 mx-auto mb-3" />
                  <p className="font-bold text-slate-800 text-base">Generando reporte contable oficial...</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Consultando movimientos contables, catálogo de cuentas y saldos mayorizados
                  </p>
                </div>
              ) : !reporteGenerado ? (
                <div className="reportes-empty-state no-print">
                  <div className="reportes-empty-icon">
                    <activeReport.icon size={28} />
                  </div>
                  <h3 className="reportes-empty-title">Parámetros configurados correctamente</h3>
                  <p className="reportes-empty-desc">
                    Haz clic en <strong>Generar Reporte</strong> para calcular y previsualizar la información contable en pantalla.
                  </p>

                  {/* Summary of Active Parameters */}
                  <div className="reportes-summary-pills-row">
                    {activeReport.params.requiresAno && (
                      <span className="reportes-param-pill">
                        Año: <strong>{paramAno}</strong>
                      </span>
                    )}
                    {activeReport.params.requiresAnoComparativo && (
                      <span className="reportes-param-pill">
                        Comparativo: <strong>{paramAnoComparativo}</strong>
                      </span>
                    )}
                    {activeReport.params.requiresMes && (
                      <span className="reportes-param-pill">
                        Mes: <strong>{MONTHS.find((m) => m.val === paramMes)?.name}</strong>
                      </span>
                    )}
                    {activeReport.params.requiresNivel && (
                      <span className="reportes-param-pill">
                        Nivel: <strong>{paramNivel}</strong>
                      </span>
                    )}
                    {activeReport.params.requiresRangoFechas && (
                      <span className="reportes-param-pill">
                        Fechas: <strong>{paramFecDesde}</strong> al <strong>{paramFecHasta}</strong>
                      </span>
                    )}
                    {activeReport.params.requiresTipoPartida && (
                      <span className="reportes-param-pill">
                        Tipo: <strong>{paramTipoPartida}</strong>
                      </span>
                    )}
                    {activeReport.params.requiresRangoCuentas && cuentaDesde.cod_cta && (
                      <span className="reportes-param-pill">
                        Desde: <strong>{cuentaDesde.cod_cta}</strong>
                      </span>
                    )}
                    {activeReport.params.requiresRangoCuentas && cuentaHasta.cod_cta && (
                      <span className="reportes-param-pill">
                        Hasta: <strong>{cuentaHasta.cod_cta}</strong>
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="official-report-document accounting-report-document">
                  {/* Standard Header matching Libros de IVA */}
                  <div className="report-header">
                    <h2 className="report-company-name">{reporteGenerado.empresa.nom_emp}</h2>
                    <h3 className="report-book-title">{reporteGenerado.titulo}</h3>
                    <div className="report-meta-info">
                      <span>NUMERO DE REGISTRO DE I.V.A. {reporteGenerado.empresa.reg_fiscal}</span>
                      <span>NIT # {reporteGenerado.empresa.nit}</span>
                    </div>
                    <div className="report-period-row">
                      <span className="period-tag">
                        PERIODO : <strong>{reporteGenerado.periodoTexto}</strong>
                      </span>
                      <span className="branch-tag">
                        MONEDA : <strong>USD ($)</strong>
                      </span>
                    </div>
                    <div style={{ textAlign: 'center', fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                      (CIFRAS EXPRESADAS EN DOLARES DE LOS ESTADOS UNIDOS DE AMERICA)
                    </div>
                  </div>

                  {/* 1. Auxiliar de Operaciones */}
                  {reporteGenerado.reportId === 'auxiliar_operaciones' && (
                    <div className="report-table-wrapper">
                      <table className="official-table">
                        <thead>
                          <tr>
                            <th className="th-center" style={{ width: '90px' }}>FECHA</th>
                            <th style={{ width: '130px' }}>TIPO PARTIDA</th>
                            <th>CONCEPTO</th>
                            <th className="th-right" style={{ width: '110px' }}>SALDO INICIAL</th>
                            <th className="th-right" style={{ width: '110px' }}>CARGOS</th>
                            <th className="th-right" style={{ width: '110px' }}>ABONOS</th>
                            <th className="th-right" style={{ width: '110px' }}>SALDOS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(reporteGenerado.data.cuentas || []).map((cta: any) => (
                            <React.Fragment key={cta.cod_cta}>
                              <tr className="tr-subtotal" style={{ background: '#f1f5f9' }}>
                                <td className="font-mono font-bold">{cta.cod_cta}</td>
                                <td colSpan={2} className="font-bold">{cta.nom_cta}</td>
                                <td className="text-right font-mono font-bold">{formatCurrency(cta.saldoInicial)}</td>
                                <td></td>
                                <td></td>
                                <td></td>
                              </tr>
                              {(cta.movimientos || []).map((m: any, mIdx: number) => (
                                <tr key={mIdx}>
                                  <td className="text-center font-mono">{m.fecha}</td>
                                  <td className="text-xs">{m.tipoPartida}</td>
                                  <td className="text-xs">{m.concepto}</td>
                                  <td></td>
                                  <td className="text-right font-mono">{formatCurrency(m.cargo)}</td>
                                  <td className="text-right font-mono">{formatCurrency(m.abono)}</td>
                                  <td className="text-right font-mono font-semibold">{formatCurrency(m.saldo)}</td>
                                </tr>
                              ))}
                              <tr style={{ background: '#f8fafc', fontWeight: 'bold' }}>
                                <td colSpan={4} className="text-left font-bold pl-3">TOTALES...</td>
                                <td className="text-right font-mono">{formatCurrency(cta.totalesCargos)}</td>
                                <td className="text-right font-mono">{formatCurrency(cta.totalesAbonos)}</td>
                                <td className="text-right font-mono">{formatCurrency(cta.saldoFinal)}</td>
                              </tr>
                            </React.Fragment>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="tr-totales">
                            <td colSpan={4} className="font-bold text-left">TOTALES GENERALES...</td>
                            <td className="text-right font-mono font-bold">{formatCurrency(reporteGenerado.data.totalCargos)}</td>
                            <td className="text-right font-mono font-bold">{formatCurrency(reporteGenerado.data.totalAbonos)}</td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                      <div className="mt-2 text-xs text-slate-600">
                        Número de Cuentas Impresas : <strong>{reporteGenerado.data.totalCuentasImpresas || 0}</strong> | FIN DEL REPORTE.
                      </div>
                    </div>
                  )}

                  {/* 2. Balance de Comprobación (Cargos y Abonos) */}
                  {reporteGenerado.reportId === 'bal_comp_cargos_abonos' && (
                    <div className="report-table-wrapper">
                      <table className="official-table">
                        <thead>
                          <tr>
                            <th style={{ width: '100px' }}>CUENTA</th>
                            <th>DESCRIPCION DE LA CUENTA</th>
                            <th className="th-right" style={{ width: '120px' }}>SALDO INICIAL</th>
                            <th className="th-right" style={{ width: '120px' }}>CARGO</th>
                            <th className="th-right" style={{ width: '120px' }}>ABONO</th>
                            <th className="th-right" style={{ width: '120px' }}>SALDO FINAL</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(reporteGenerado.data.filas || []).map((f: any) => (
                            <tr key={f.cod_cta} style={{ fontWeight: f.nivel_cta <= 2 ? 'bold' : 'normal' }}>
                              <td className="font-mono">{f.cod_cta}</td>
                              <td style={{ paddingLeft: `${Math.max(0, (f.nivel_cta - 1) * 12 + 8)}px` }}>{f.nom_cta}</td>
                              <td className="text-right font-mono">{formatCurrency(f.saldo_inicial)}</td>
                              <td className="text-right font-mono">{formatCurrency(f.cargo)}</td>
                              <td className="text-right font-mono">{formatCurrency(f.abono)}</td>
                              <td className="text-right font-mono">{formatCurrency(f.saldo_final)}</td>
                            </tr>
                          ))}
                          <tr className="tr-totales">
                            <td colSpan={3} className="font-bold text-left">TOTALES...</td>
                            <td className="text-right font-mono font-bold">{formatCurrency(reporteGenerado.data.totalCargos)}</td>
                            <td className="text-right font-mono font-bold">{formatCurrency(reporteGenerado.data.totalAbonos)}</td>
                            <td></td>
                          </tr>
                        </tbody>
                      </table>
                      <div className="mt-2 text-xs text-slate-600">
                        Número de Cuentas Impresas : <strong>{reporteGenerado.data.totalCuentasImpresas || 0}</strong> | FIN DEL REPORTE.
                      </div>
                    </div>
                  )}

                  {/* 3. Balance de Comprobación por Niveles */}
                  {reporteGenerado.reportId === 'bal_comp_niveles' && (
                    <div className="report-table-wrapper">
                      <table className="official-table">
                        <thead>
                          <tr>
                            <th style={{ width: '90px' }}>CUENTA</th>
                            <th>DESCRIPCION DE LA CUENTA</th>
                            <th className="th-right" style={{ width: '85px' }}>NIVEL ANT.</th>
                            <th className="th-right" style={{ width: '85px' }}>NIVEL 5</th>
                            <th className="th-right" style={{ width: '85px' }}>NIVEL 4</th>
                            <th className="th-right" style={{ width: '85px' }}>NIVEL 3</th>
                            <th className="th-right" style={{ width: '85px' }}>NIVEL 2</th>
                            <th className="th-right" style={{ width: '95px' }}>NIVEL 1</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(reporteGenerado.data.filas || []).map((f: any) => (
                            <tr key={f.cod_cta} style={{ fontWeight: f.nivel_cta <= 2 ? 'bold' : 'normal' }}>
                              <td className="font-mono">{f.cod_cta}</td>
                              <td style={{ paddingLeft: `${Math.max(0, (f.nivel_cta - 1) * 10 + 8)}px` }}>{f.nom_cta}</td>
                              <td className="text-right font-mono">{formatCurrency(f.nivelAnt)}</td>
                              <td className="text-right font-mono">{formatCurrency(f.nivel5)}</td>
                              <td className="text-right font-mono">{formatCurrency(f.nivel4)}</td>
                              <td className="text-right font-mono">{formatCurrency(f.nivel3)}</td>
                              <td className="text-right font-mono">{formatCurrency(f.nivel2)}</td>
                              <td className="text-right font-mono font-bold">{formatCurrency(f.nivel1)}</td>
                            </tr>
                          ))}
                          <tr className="tr-subtotal font-bold">
                            <td colSpan={7} className="text-right">TOTAL ACTIVO :</td>
                            <td className="text-right font-mono font-bold">{formatCurrency(reporteGenerado.data.totalActivo)}</td>
                          </tr>
                          <tr className="tr-subtotal font-bold">
                            <td colSpan={7} className="text-right">TOTAL PASIVO :</td>
                            <td className="text-right font-mono font-bold">{formatCurrency(reporteGenerado.data.totalPasivo)}</td>
                          </tr>
                          <tr className="tr-subtotal font-bold">
                            <td colSpan={7} className="text-right">TOTAL CAPITAL :</td>
                            <td className="text-right font-mono font-bold">{formatCurrency(reporteGenerado.data.totalCapital)}</td>
                          </tr>
                          <tr className="tr-subtotal font-bold">
                            <td colSpan={7} className="text-right">TOTAL ACREEDORAS :</td>
                            <td className="text-right font-mono font-bold">{formatCurrency(reporteGenerado.data.totalAcreedoras)}</td>
                          </tr>
                          <tr className="tr-subtotal font-bold">
                            <td colSpan={7} className="text-right">TOTAL DEUDORAS :</td>
                            <td className="text-right font-mono font-bold">{formatCurrency(reporteGenerado.data.totalDeudoras)}</td>
                          </tr>
                          <tr className="tr-totales font-bold text-primary">
                            <td colSpan={7} className="text-right">UTILIDAD O PERDIDA DEL EJERCICIO... :</td>
                            <td className="text-right font-mono font-bold">{formatCurrency(reporteGenerado.data.utilidadEjercicio)}</td>
                          </tr>
                        </tbody>
                      </table>
                      <div className="mt-2 text-xs text-slate-600">
                        Numero de Cuentas Impresas : <strong>{reporteGenerado.data.totalCuentasImpresas || 0}</strong> | FIN DEL INFORME...
                      </div>
                    </div>
                  )}

                  {/* 4. Balance General - Cuenta (2 Columns) */}
                  {reporteGenerado.reportId === 'balance_general_cuenta' && (
                    <div className="report-table-wrapper" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                      {/* Left: Activo */}
                      <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '12px' }}>
                        <h4 style={{ fontWeight: 'bold', fontSize: '0.95rem', borderBottom: '2px solid #0f172a', paddingBottom: '4px', marginBottom: '8px' }}>
                          ACTIVO
                        </h4>
                        <table className="official-table" style={{ border: 'none' }}>
                          <tbody>
                            {(reporteGenerado.data.activoRows || []).map((r: any) => (
                              <tr key={r.cod_cta} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ border: 'none', paddingLeft: `${Math.max(0, (r.nivel_cta - 1) * 12 + 4)}px`, fontWeight: r.nivel_cta <= 2 ? 'bold' : 'normal' }}>
                                  {r.nom_cta}
                                </td>
                                <td className="text-right font-mono" style={{ border: 'none', fontWeight: r.nivel_cta <= 2 ? 'bold' : 'normal', width: '100px' }}>
                                  {formatCurrency(r.saldo)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div style={{ marginTop: '20px', borderTop: '2px solid #0f172a', borderBottom: '3px double #0f172a', padding: '6px 4px', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                          <span>TOTAL ACTIVO</span>
                          <span className="font-mono">{formatCurrency(reporteGenerado.data.totalActivo)}</span>
                        </div>
                      </div>

                      {/* Right: Pasivo y Patrimonio */}
                      <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '12px' }}>
                        <h4 style={{ fontWeight: 'bold', fontSize: '0.95rem', borderBottom: '2px solid #0f172a', paddingBottom: '4px', marginBottom: '8px' }}>
                          PASIVO
                        </h4>
                        <table className="official-table" style={{ border: 'none', marginBottom: '16px' }}>
                          <tbody>
                            {(reporteGenerado.data.pasivoRows || []).map((r: any) => (
                              <tr key={r.cod_cta} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ border: 'none', paddingLeft: `${Math.max(0, (r.nivel_cta - 1) * 12 + 4)}px`, fontWeight: r.nivel_cta <= 2 ? 'bold' : 'normal' }}>
                                  {r.nom_cta}
                                </td>
                                <td className="text-right font-mono" style={{ border: 'none', fontWeight: r.nivel_cta <= 2 ? 'bold' : 'normal', width: '100px' }}>
                                  {formatCurrency(r.saldo)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        <h4 style={{ fontWeight: 'bold', fontSize: '0.95rem', borderBottom: '2px solid #0f172a', paddingBottom: '4px', marginBottom: '8px' }}>
                          PATRIMONIO
                        </h4>
                        <table className="official-table" style={{ border: 'none' }}>
                          <tbody>
                            {(reporteGenerado.data.patrimonioRows || []).map((r: any) => (
                              <tr key={r.cod_cta} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ border: 'none', paddingLeft: `${Math.max(0, (r.nivel_cta - 1) * 12 + 4)}px`, fontWeight: r.nivel_cta <= 2 ? 'bold' : 'normal' }}>
                                  {r.nom_cta}
                                </td>
                                <td className="text-right font-mono" style={{ border: 'none', fontWeight: r.nivel_cta <= 2 ? 'bold' : 'normal', width: '100px' }}>
                                  {formatCurrency(r.saldo)}
                                </td>
                              </tr>
                            ))}
                            <tr style={{ borderBottom: '1px solid #f1f5f9', fontWeight: 'bold' }}>
                              <td style={{ border: 'none', paddingLeft: '8px' }}>UTILIDAD DEL EJERCICIO</td>
                              <td className="text-right font-mono" style={{ border: 'none' }}>
                                {formatCurrency(reporteGenerado.data.utilidadEjercicio)}
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        <div style={{ marginTop: '20px', borderTop: '2px solid #0f172a', borderBottom: '3px double #0f172a', padding: '6px 4px', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                          <span>TOTAL PASIVO Y PATRIMONIO</span>
                          <span className="font-mono">{formatCurrency(reporteGenerado.data.totalPasivoPatrimonio)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 5. Balance de Comprobación - Cuenta */}
                  {reporteGenerado.reportId === 'bal_comp_cuenta' && (
                    <div className="report-table-wrapper" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                      <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '12px' }}>
                        <h4 style={{ fontWeight: 'bold', fontSize: '0.95rem', borderBottom: '2px solid #0f172a', paddingBottom: '4px', marginBottom: '8px' }}>
                          DEUDORAS Y ACTIVOS
                        </h4>
                        <table className="official-table" style={{ border: 'none' }}>
                          <tbody>
                            {(reporteGenerado.data.leftRows || []).map((r: any) => (
                              <tr key={r.cod_cta} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ border: 'none', paddingLeft: `${Math.max(0, (r.nivel_cta - 1) * 12 + 4)}px`, fontWeight: r.nivel_cta <= 2 ? 'bold' : 'normal' }}>
                                  {r.nom_cta}
                                </td>
                                <td className="text-right font-mono" style={{ border: 'none', width: '100px' }}>
                                  {formatCurrency(r.saldo)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div style={{ marginTop: '20px', borderTop: '2px solid #0f172a', borderBottom: '3px double #0f172a', padding: '6px 4px', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                          <span>TOTAL ACTIVO</span>
                          <span className="font-mono">{formatCurrency(reporteGenerado.data.totalIzquierda)}</span>
                        </div>
                      </div>

                      <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '12px' }}>
                        <h4 style={{ fontWeight: 'bold', fontSize: '0.95rem', borderBottom: '2px solid #0f172a', paddingBottom: '4px', marginBottom: '8px' }}>
                          ACREEDORAS, PASIVO Y PATRIMONIO
                        </h4>
                        <table className="official-table" style={{ border: 'none' }}>
                          <tbody>
                            {(reporteGenerado.data.rightRows || []).map((r: any) => (
                              <tr key={r.cod_cta} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ border: 'none', paddingLeft: `${Math.max(0, (r.nivel_cta - 1) * 12 + 4)}px`, fontWeight: r.nivel_cta <= 2 ? 'bold' : 'normal' }}>
                                  {r.nom_cta}
                                </td>
                                <td className="text-right font-mono" style={{ border: 'none', width: '100px' }}>
                                  {formatCurrency(r.saldo)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div style={{ marginTop: '20px', borderTop: '2px solid #0f172a', borderBottom: '3px double #0f172a', padding: '6px 4px', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                          <span>TOTAL PASIVO Y PATRIMONIO</span>
                          <span className="font-mono">{formatCurrency(reporteGenerado.data.totalDerecha)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 6. Anexo al Balance General */}
                  {reporteGenerado.reportId === 'anexo_balance_general' && (
                    <div className="report-table-wrapper">
                      <table className="official-table">
                        <thead>
                          <tr>
                            <th>CUENTA CONTABLE</th>
                            <th className="th-right" style={{ width: '85px' }}>NIVEL ANT.</th>
                            <th className="th-right" style={{ width: '85px' }}>NIVEL 5</th>
                            <th className="th-right" style={{ width: '85px' }}>NIVEL 4</th>
                            <th className="th-right" style={{ width: '85px' }}>NIVEL 3</th>
                            <th className="th-right" style={{ width: '85px' }}>NIVEL 2</th>
                            <th className="th-right" style={{ width: '95px' }}>NIVEL 1</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(reporteGenerado.data.filas || []).map((f: any) => (
                            <tr key={f.cod_cta} style={{ fontWeight: f.nivel_cta <= 2 ? 'bold' : 'normal' }}>
                              <td><span className="font-mono mr-2">{f.cod_cta}</span>{f.nom_cta}</td>
                              <td className="text-right font-mono">{formatCurrency(f.nivelAnt)}</td>
                              <td className="text-right font-mono">{formatCurrency(f.nivel5)}</td>
                              <td className="text-right font-mono">{formatCurrency(f.nivel4)}</td>
                              <td className="text-right font-mono">{formatCurrency(f.nivel3)}</td>
                              <td className="text-right font-mono">{formatCurrency(f.nivel2)}</td>
                              <td className="text-right font-mono font-bold">{formatCurrency(f.nivel1)}</td>
                            </tr>
                          ))}
                          <tr className="tr-subtotal font-bold">
                            <td colSpan={6} className="text-right">TOTAL ACTIVO :</td>
                            <td className="text-right font-mono font-bold">{formatCurrency(reporteGenerado.data.totalActivo)}</td>
                          </tr>
                          <tr className="tr-subtotal font-bold">
                            <td colSpan={6} className="text-right">TOTAL PASIVO :</td>
                            <td className="text-right font-mono font-bold">{formatCurrency(reporteGenerado.data.totalPasivo)}</td>
                          </tr>
                          <tr className="tr-subtotal font-bold">
                            <td colSpan={6} className="text-right">TOTAL CAPITAL :</td>
                            <td className="text-right font-mono font-bold">{formatCurrency(reporteGenerado.data.totalCapital)}</td>
                          </tr>
                          <tr className="tr-totales font-bold text-primary">
                            <td colSpan={6} className="text-right">UTILIDAD O PERDIDA DEL EJERCICIO... :</td>
                            <td className="text-right font-mono font-bold">{formatCurrency(reporteGenerado.data.utilidadEjercicio)}</td>
                          </tr>
                        </tbody>
                      </table>
                      <div className="mt-2 text-xs text-slate-600">
                        Numero de Cuentas Impresas : <strong>{reporteGenerado.data.totalCuentasImpresas || 0}</strong> | FIN DEL INFORME...
                      </div>
                    </div>
                  )}

                  {/* 7. Libro Diario Mayor */}
                  {reporteGenerado.reportId === 'diario_mayor' && (
                    <div className="report-table-wrapper">
                      <table className="official-table">
                        <thead>
                          <tr>
                            <th className="th-center" style={{ width: '90px' }}>FECHA</th>
                            <th style={{ width: '120px' }}>PARTIDA</th>
                            <th>CONCEPTO</th>
                            <th className="th-right" style={{ width: '110px' }}>DEBITO</th>
                            <th className="th-right" style={{ width: '110px' }}>CREDITO</th>
                            <th className="th-right" style={{ width: '120px' }}>SALDO MAYORIZADO</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(reporteGenerado.data.cuentas || []).map((cta: any) => (
                            <React.Fragment key={cta.cod_cta}>
                              <tr className="tr-subtotal" style={{ background: '#f1f5f9' }}>
                                <td colSpan={6} className="font-bold">
                                  <span className="font-mono mr-2">{cta.cod_cta}</span> - {cta.nom_cta}
                                </td>
                              </tr>
                              {(cta.movimientos || []).map((m: any, mIdx: number) => (
                                <tr key={mIdx}>
                                  <td className="text-center font-mono">{m.fecha}</td>
                                  <td className="text-xs">Partida #{m.corr_part}</td>
                                  <td className="text-xs">{m.concepto}</td>
                                  <td className="text-right font-mono">{formatCurrency(m.cargo)}</td>
                                  <td className="text-right font-mono">{formatCurrency(m.abono)}</td>
                                  <td className="text-right font-mono font-semibold">{formatCurrency(m.saldo)}</td>
                                </tr>
                              ))}
                              <tr style={{ background: '#f8fafc', fontWeight: 'bold' }}>
                                <td colSpan={3} className="text-right font-bold pr-3">SUBTOTAL CUENTA</td>
                                <td className="text-right font-mono">{formatCurrency(cta.totalCargos)}</td>
                                <td className="text-right font-mono">{formatCurrency(cta.totalAbonos)}</td>
                                <td className="text-right font-mono">{formatCurrency(cta.saldoFinal)}</td>
                              </tr>
                            </React.Fragment>
                          ))}
                          <tr className="tr-totales">
                            <td colSpan={3} className="font-bold text-right pr-3">TOTALES GENERALES</td>
                            <td className="text-right font-mono font-bold">{formatCurrency(reporteGenerado.data.grandTotalCargos)}</td>
                            <td className="text-right font-mono font-bold">{formatCurrency(reporteGenerado.data.grandTotalAbonos)}</td>
                            <td></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* 8. Libro Diario */}
                  {reporteGenerado.reportId === 'diario' && (
                    <div className="report-table-wrapper">
                      <table className="official-table">
                        <thead>
                          <tr>
                            <th style={{ width: '120px' }}>CODIGO</th>
                            <th>NOMBRE DE LA CUENTA</th>
                            <th>CONCEPTO ESPECIFICO</th>
                            <th className="th-right" style={{ width: '110px' }}>DEBE</th>
                            <th className="th-right" style={{ width: '110px' }}>HABER</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(reporteGenerado.data.partidas || []).map((p: any) => (
                            <React.Fragment key={p.cod_part}>
                              <tr style={{ background: '#f1f5f9', fontWeight: 'bold' }}>
                                <td colSpan={5}>
                                  Partida No. <span className="font-mono">{p.corr_part}</span> | Fecha: {p.fecha} | Tipo: {p.tipo}
                                  <div className="font-normal text-xs text-slate-600 mt-1">Concepto: {p.concepto}</div>
                                </td>
                              </tr>
                              {(p.lineas || []).map((l: any, lIdx: number) => (
                                <tr key={lIdx}>
                                  <td className="font-mono">{l.cod_cta}</td>
                                  <td>{l.nom_cta}</td>
                                  <td className="text-xs text-slate-600">{l.concepto}</td>
                                  <td className="text-right font-mono">{formatCurrency(l.debe)}</td>
                                  <td className="text-right font-mono">{formatCurrency(l.haber)}</td>
                                </tr>
                              ))}
                              <tr style={{ background: '#f8fafc', fontWeight: 'bold' }}>
                                <td colSpan={3} className="text-right pr-3">TOTAL PARTIDA</td>
                                <td className="text-right font-mono">{formatCurrency(p.totalDebe)}</td>
                                <td className="text-right font-mono">{formatCurrency(p.totalHaber)}</td>
                              </tr>
                            </React.Fragment>
                          ))}
                          <tr className="tr-totales">
                            <td colSpan={3} className="font-bold text-right pr-3">TOTALES GENERALES</td>
                            <td className="text-right font-mono font-bold">{formatCurrency(reporteGenerado.data.grandTotalDebe)}</td>
                            <td className="text-right font-mono font-bold">{formatCurrency(reporteGenerado.data.grandTotalHaber)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* 9. Libro Diario Mayor Consolidado */}
                  {reporteGenerado.reportId === 'diario_mayor_consolidado' && (
                    <div className="report-table-wrapper">
                      <table className="official-table">
                        <thead>
                          <tr>
                            <th style={{ width: '100px' }}>CODIGO</th>
                            <th>NOMBRE DE LA CUENTA</th>
                            <th className="th-right" style={{ width: '120px' }}>SALDO ANTERIOR</th>
                            <th className="th-right" style={{ width: '120px' }}>DEBITOS</th>
                            <th className="th-right" style={{ width: '120px' }}>CREDITOS</th>
                            <th className="th-right" style={{ width: '120px' }}>SALDO ACTUAL</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(reporteGenerado.data.filas || []).map((f: any) => (
                            <tr key={f.cod_cta} style={{ fontWeight: f.nivel_cta <= 2 ? 'bold' : 'normal' }}>
                              <td className="font-mono">{f.cod_cta}</td>
                              <td style={{ paddingLeft: `${Math.max(0, (f.nivel_cta - 1) * 12 + 8)}px` }}>{f.nom_cta}</td>
                              <td className="text-right font-mono">{formatCurrency(f.saldo_ant)}</td>
                              <td className="text-right font-mono">{formatCurrency(f.debito)}</td>
                              <td className="text-right font-mono">{formatCurrency(f.credito)}</td>
                              <td className="text-right font-mono">{formatCurrency(f.saldo_act)}</td>
                            </tr>
                          ))}
                          <tr className="tr-totales">
                            <td colSpan={3} className="font-bold text-right pr-3">TOTALES CONSOLIDADOS</td>
                            <td className="text-right font-mono font-bold">{formatCurrency(reporteGenerado.data.totalDebitos)}</td>
                            <td className="text-right font-mono font-bold">{formatCurrency(reporteGenerado.data.totalCreditos)}</td>
                            <td></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* 10. Estado de Resultados */}
                  {reporteGenerado.reportId === 'estado_resultados' && (
                    <div className="report-table-wrapper" style={{ maxWidth: '720px', margin: '0 auto' }}>
                      <table className="official-table">
                        <thead>
                          <tr>
                            <th>CONCEPTO FINANCIERO</th>
                            <th className="th-right" style={{ width: '140px' }}>MONTO EN USD</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr style={{ background: '#f8fafc', fontWeight: 'bold' }}>
                            <td colSpan={2}>INGRESOS DE OPERACIÓN</td>
                          </tr>
                          <tr>
                            <td style={{ paddingLeft: '24px' }}>Ingresos por Actividades Ordinarias / Servicios</td>
                            <td className="text-right font-mono">{formatCurrency(reporteGenerado.data.ingresosOrdinarios)}</td>
                          </tr>
                          <tr style={{ background: '#f8fafc', fontWeight: 'bold' }}>
                            <td colSpan={2}>COSTOS DE OPERACIÓN</td>
                          </tr>
                          <tr>
                            <td style={{ paddingLeft: '24px' }}>Costos por Actividades Ordinarias / Servicios</td>
                            <td className="text-right font-mono">{formatCurrency(reporteGenerado.data.costosOrdinarios)}</td>
                          </tr>
                          <tr className="tr-subtotal font-bold" style={{ background: '#f1f5f9' }}>
                            <td>UTILIDAD BRUTA</td>
                            <td className="text-right font-mono text-primary font-bold">{formatCurrency(reporteGenerado.data.utilidadBruta)}</td>
                          </tr>
                          <tr style={{ background: '#f8fafc', fontWeight: 'bold' }}>
                            <td colSpan={2}>GASTOS DE OPERACIÓN</td>
                          </tr>
                          <tr>
                            <td style={{ paddingLeft: '24px' }}>Gastos de Administración</td>
                            <td className="text-right font-mono">{formatCurrency(reporteGenerado.data.gastosAdmin)}</td>
                          </tr>
                          <tr>
                            <td style={{ paddingLeft: '24px' }}>Gastos de Venta</td>
                            <td className="text-right font-mono">{formatCurrency(reporteGenerado.data.gastosVenta)}</td>
                          </tr>
                          <tr className="tr-subtotal font-bold" style={{ background: '#f1f5f9' }}>
                            <td>UTILIDAD DE OPERACIÓN</td>
                            <td className="text-right font-mono text-primary font-bold">{formatCurrency(reporteGenerado.data.utilidadOperacion)}</td>
                          </tr>
                          <tr>
                            <td style={{ paddingLeft: '24px' }}>(-) Gastos Financieros y No Ordinarios</td>
                            <td className="text-right font-mono">{formatCurrency(reporteGenerado.data.gastosFinancieros)}</td>
                          </tr>
                          <tr>
                            <td style={{ paddingLeft: '24px' }}>(+) Otros Ingresos No Ordinarios</td>
                            <td className="text-right font-mono">{formatCurrency(reporteGenerado.data.otrosIngresos)}</td>
                          </tr>
                          <tr className="tr-subtotal font-bold">
                            <td>UTILIDAD ANTES DE RESERVA E IMPUESTOS</td>
                            <td className="text-right font-mono font-bold">{formatCurrency(reporteGenerado.data.utilidadAntesImpuestos)}</td>
                          </tr>
                          <tr>
                            <td style={{ paddingLeft: '24px' }}>(-) Reserva Legal (7%)</td>
                            <td className="text-right font-mono">{formatCurrency(reporteGenerado.data.reservaLegal)}</td>
                          </tr>
                          <tr>
                            <td style={{ paddingLeft: '24px' }}>(-) Provisión Impuesto Sobre la Renta (ISR)</td>
                            <td className="text-right font-mono">{formatCurrency(reporteGenerado.data.impuestoRenta)}</td>
                          </tr>
                          <tr className="tr-totales font-bold" style={{ background: '#e0e7ff', fontSize: '0.9rem' }}>
                            <td>UTILIDAD NETA DEL EJERCICIO</td>
                            <td className="text-right font-mono font-bold text-blue-700">{formatCurrency(reporteGenerado.data.utilidadNeta)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* 11. Cuadro de Ingresos y Gastos */}
                  {reporteGenerado.reportId === 'cuadro_ingresos_gastos' && (
                    <div className="report-table-wrapper">
                      <table className="official-table">
                        <thead>
                          <tr>
                            <th style={{ width: '100px' }}>CODIGO</th>
                            <th>DESCRIPCION DE LA CUENTA</th>
                            <th className="th-right" style={{ width: '110px' }}>SALDO ANTERIOR</th>
                            <th className="th-right" style={{ width: '110px' }}>CARGOS MES</th>
                            <th className="th-right" style={{ width: '110px' }}>ABONOS MES</th>
                            <th className="th-right" style={{ width: '120px' }}>SALDO ACUMULADO</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(reporteGenerado.data.filas || []).map((f: any) => (
                            <tr key={f.cod_cta} style={{ fontWeight: f.nivel_cta <= 2 ? 'bold' : 'normal' }}>
                              <td className="font-mono">{f.cod_cta}</td>
                              <td style={{ paddingLeft: `${Math.max(0, (f.nivel_cta - 1) * 12 + 8)}px` }}>{f.nom_cta}</td>
                              <td className="text-right font-mono">{formatCurrency(f.saldo_ant)}</td>
                              <td className="text-right font-mono">{formatCurrency(f.cargos)}</td>
                              <td className="text-right font-mono">{formatCurrency(f.abonos)}</td>
                              <td className="text-right font-mono">{formatCurrency(f.saldo_act)}</td>
                            </tr>
                          ))}
                          <tr className="tr-subtotal font-bold">
                            <td colSpan={5} className="text-right">TOTAL INGRESOS (GRUPO 5) :</td>
                            <td className="text-right font-mono font-bold">{formatCurrency(reporteGenerado.data.totalIngresos)}</td>
                          </tr>
                          <tr className="tr-subtotal font-bold">
                            <td colSpan={5} className="text-right">TOTAL GASTOS Y COSTOS (GRUPO 4) :</td>
                            <td className="text-right font-mono font-bold">{formatCurrency(reporteGenerado.data.totalGastos)}</td>
                          </tr>
                          <tr className="tr-totales font-bold text-primary">
                            <td colSpan={5} className="text-right">RESULTADO NETO DEL PERIODO :</td>
                            <td className="text-right font-mono font-bold">{formatCurrency(reporteGenerado.data.resultadoNeto)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* 12. Balance Comparativo */}
                  {reporteGenerado.reportId === 'balance_comparativo' && (
                    <div className="report-table-wrapper">
                      <table className="official-table">
                        <thead>
                          <tr>
                            <th style={{ width: '100px' }}>CODIGO</th>
                            <th>NOMBRE DE LA CUENTA</th>
                            <th className="th-right" style={{ width: '120px' }}>SALDO {reporteGenerado.data.anoBase}</th>
                            <th className="th-right" style={{ width: '120px' }}>SALDO {reporteGenerado.data.anoComp}</th>
                            <th className="th-right" style={{ width: '120px' }}>VARIACION ($)</th>
                            <th className="th-right" style={{ width: '110px' }}>VARIACION (%)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(reporteGenerado.data.filas || []).map((f: any) => (
                            <tr key={f.cod_cta} style={{ fontWeight: f.nivel_cta <= 2 ? 'bold' : 'normal' }}>
                              <td className="font-mono">{f.cod_cta}</td>
                              <td style={{ paddingLeft: `${Math.max(0, (f.nivel_cta - 1) * 12 + 8)}px` }}>{f.nom_cta}</td>
                              <td className="text-right font-mono">{formatCurrency(f.saldoBase)}</td>
                              <td className="text-right font-mono">{formatCurrency(f.saldoComp)}</td>
                              <td className="text-right font-mono font-semibold" style={{ color: f.variacionAbs >= 0 ? '#16a34a' : '#dc2626' }}>
                                {formatCurrency(f.variacionAbs)}
                              </td>
                              <td className="text-right font-mono" style={{ color: f.variacionPorc >= 0 ? '#16a34a' : '#dc2626' }}>
                                {f.variacionPorc >= 0 ? '+' : ''}{f.variacionPorc.toFixed(1)}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Signatures Block on All Reports */}
                  <div className="report-signatures-box">
                    {(reporteGenerado.firmas || []).slice(0, 3).map((f: any, idx: number) => (
                      <div className="signature-col" key={idx}>
                        <div className="signature-line"></div>
                        <div className="signature-name font-bold">{f.nom_firma || '___________________________'}</div>
                        <div className="signature-label">{f.puesto || 'Firma Autorizada'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

      {/* Modal Informativo del Reporte */}
      <Modal
        isOpen={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        title={`Guía e Información: ${activeReport.name}`}
        maxWidth="2xl"
      >
        <div className="report-info-modal-content">
          {/* Banner Superior */}
          <div className="report-info-banner">
            <div className="report-info-icon-wrap">
              <activeReport.icon size={24} />
            </div>
            <div>
              <h4 className="report-info-banner-title">{activeReport.name}</h4>
              <p className="report-info-banner-desc">{currentGuide.descripcionBreve}</p>
            </div>
          </div>

          {/* Sección 1: ¿En qué consiste? */}
          <div className="report-info-section">
            <h5 className="report-info-section-title">
              <BookOpen size={16} className="text-blue-600" />
              <span>¿En qué consiste este reporte?</span>
            </h5>
            <p className="report-info-text">{currentGuide.enQueConsiste}</p>
            {currentGuide.baseLegal && (
              <div className="report-info-legal-box">
                <strong>Base Legal y Normativa:</strong> {currentGuide.baseLegal}
              </div>
            )}
          </div>

          {/* Sección 2: ¿Cómo funciona de acuerdo al sistema? */}
          <div className="report-info-section">
            <h5 className="report-info-section-title">
              <SlidersHorizontal size={16} className="text-blue-600" />
              <span>¿Cómo funciona de acuerdo al sistema?</span>
            </h5>
            <ul className="report-info-list">
              {currentGuide.comoFunciona.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>

          {/* Sección 3: Datos técnicos y mayorización */}
          <div className="report-info-section">
            <h5 className="report-info-section-title">
              <Layers size={16} className="text-blue-600" />
              <span>Tablas y origen de datos</span>
            </h5>
            <div className="report-info-chips-row">
              <div className="report-info-chip">
                <span className="chip-label">Tablas del Sistema:</span>
                <code className="chip-code">{currentGuide.tablas}</code>
              </div>
              <div className="report-info-chip">
                <span className="chip-label">Mayorización Previa:</span>
                <span className={`chip-badge ${currentGuide.requiereMayorizacion ? 'req-yes' : 'req-no'}`}>
                  {currentGuide.requiereMayorizacion ? 'Requerida (cuentas_saldos)' : 'Directa (en tiempo real)'}
                </span>
              </div>
            </div>
          </div>

          {/* Sección 4: Consejos y Recomendaciones */}
          <div className="report-info-section">
            <h5 className="report-info-section-title">
              <CheckCircle2 size={16} className="text-emerald-600" />
              <span>Recomendaciones y mejores prácticas</span>
            </h5>
            <ul className="report-info-tips-list">
              {currentGuide.consejos.map((tip, idx) => (
                <li key={idx}>{tip}</li>
              ))}
            </ul>
          </div>

          {/* Pie del Modal */}
          <div className="report-info-modal-footer">
            <button
              type="button"
              className="btn-primario"
              onClick={() => setShowInfoModal(false)}
            >
              Entendido
            </button>
          </div>
        </div>
      </Modal>

    </ControlIvaLayout>
  );
}
