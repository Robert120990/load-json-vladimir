import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  BookOpen,
  Calculator,
  Calendar,
  Download,
  FileSpreadsheet,
  FileText,
  HelpCircle,
  Printer,
  RefreshCw,
} from 'lucide-react';
import {
  fetchAnexoHacienda,
  fetchLibroCompras,
  fetchLibroConsumidorFinal,
  fetchLibroContribuyentes,
  fetchLiquidacionImpuestos,
  fetchPlantillaAnexo,
} from '../../api/controlIva';
import { obtenerError } from '../../api/client';
import ControlIvaLayout from '../../components/layout/ControlIvaLayout';
import {
  exportBlankMhTemplate,
  exportMhAnexoToCsv,
  exportMhAnexoToExcel,
  exportTaxSettlementToExcel,
  exportVatBookToExcel,
} from '../../utils/excelExport';
import { exportTaxSettlementToPdf, exportVatBookToPdf } from '../../utils/pdfExport';
import type { VatBookSummary, TaxSettlementSummary } from '../../types/controlIva';

type TipoReporte = 'compras' | 'consumidor_final' | 'contribuyentes' | 'anexos_mh' | 'pago_impuestos';

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

const MONEY_COLUMNS = new Set([
  'compras_exentas',
  'internaciones_exentas',
  'importaciones_exentas',
  'compras_gravadas',
  'internaciones_gravadas',
  'importaciones_gravadas',
  'credito_fiscal',
  'total_compra',
  'ventas_exentas',
  'ventas_no_sujetas',
  'gravadas_locales',
  'exportaciones',
  'debito_fiscal',
  'cuentas_a_terceros',
  'debito_fiscal_a_terceros',
  'total_ventas',
]);

function formatAnexoCell(key: string, val: any): React.ReactNode {
  if (val === null || val === undefined || val === '') {
    return <span className="text-muted">-</span>;
  }

  if (key === 'clase_documento') {
    const num = Number(val);
    if (num === 4) return <span className="badge badge-info text-xs">4 - DTE</span>;
    if (num === 1) return <span className="badge badge-neutral text-xs">1 - Impreso</span>;
    if (num === 2) return <span className="badge badge-neutral text-xs">2 - Tique</span>;
    if (num === 3) return <span className="badge badge-neutral text-xs">3 - Computarizado</span>;
    return String(val);
  }

  if (key === 'tipo_documento') {
    return <span className="badge badge-primary font-bold text-xs whitespace-nowrap">{String(val)}</span>;
  }

  if (key === 'id_tipo_documento') {
    return <span className="badge badge-neutral text-xs">{String(val).padStart(2, '0')}</span>;
  }

  if (MONEY_COLUMNS.has(key)) {
    const n = typeof val === 'number' ? val : parseFloat(val) || 0;
    return <span className="font-semibold text-right block">$ {n.toFixed(2)}</span>;
  }

  if (
    key === 'numero_documento' ||
    key === 'numero_control' ||
    key === 'sello_recepcion' ||
    key === 'numero_resolucion' ||
    key === 'control_interno' ||
    key === 'documento_del' ||
    key === 'documento_al'
  ) {
    return <span className="font-mono text-xs text-primary">{String(val)}</span>;
  }

  if (key === 'nit_o_nrc') {
    return <span className="font-mono text-xs">{String(val)}</span>;
  }

  return <span>{String(val)}</span>;
}

export default function ReportesLibrosPage() {
  const now = new Date();
  const [tipoReporte, setTipoReporte] = useState<TipoReporte>('compras');
  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number>(now.getMonth() + 1);

  const [reporte, setReporte] = useState<VatBookSummary | null>(null);
  const [loading, setLoading] = useState(false);

  // MH Annexes Sub-tab
  const [tipoAnexoMh, setTipoAnexoMh] = useState<'compras' | 'contribuyentes' | 'consumidor_final'>(
    'compras',
  );
  const [anexoMhData, setAnexoMhData] = useState<any[]>([]);
  const [loadingAnexo, setLoadingAnexo] = useState(false);

  // Tax Settlement (Pago de IVA y Pago a Cuenta)
  const [liquidacion, setLiquidacion] = useState<TaxSettlementSummary | null>(null);
  const [loadingLiquidacion, setLoadingLiquidacion] = useState(false);

  useEffect(() => {
    if (tipoReporte === 'anexos_mh') {
      cargarAnexoMh();
    } else if (tipoReporte === 'pago_impuestos') {
      cargarLiquidacion();
    } else {
      cargarReporte();
    }
  }, [tipoReporte, year, month, tipoAnexoMh]);

  async function cargarReporte() {
    try {
      setLoading(true);
      let data: VatBookSummary;
      if (tipoReporte === 'compras') {
        data = await fetchLibroCompras(year, month);
      } else if (tipoReporte === 'consumidor_final') {
        data = await fetchLibroConsumidorFinal(year, month);
      } else {
        data = await fetchLibroContribuyentes(year, month);
      }
      setReporte(data);
    } catch (err) {
      toast.error(obtenerError(err));
    } finally {
      setLoading(false);
    }
  }

  async function cargarAnexoMh() {
    try {
      setLoadingAnexo(true);
      const data = await fetchAnexoHacienda(tipoAnexoMh, year, month);
      setAnexoMhData(data);
    } catch (err) {
      toast.error(obtenerError(err));
    } finally {
      setLoadingAnexo(false);
    }
  }

  async function cargarLiquidacion() {
    try {
      setLoadingLiquidacion(true);
      const data = await fetchLiquidacionImpuestos(year, month);
      setLiquidacion(data);
    } catch (err) {
      toast.error(obtenerError(err));
    } finally {
      setLoadingLiquidacion(false);
    }
  }

  function handleExportPdf() {
    if (tipoReporte === 'pago_impuestos') {
      if (!liquidacion) return;
      try {
        exportTaxSettlementToPdf(liquidacion);
        toast.success('Liquidación de Impuestos descargada en PDF');
      } catch (err) {
        toast.error('Error al generar PDF: ' + (err as Error).message);
      }
      return;
    }
    if (!reporte) return;
    try {
      exportVatBookToPdf(reporte);
      toast.success('Archivo PDF generado correctamente');
    } catch (err) {
      toast.error('Error al generar PDF: ' + (err as Error).message);
    }
  }

  function handleExportExcel() {
    if (tipoReporte === 'pago_impuestos') {
      if (!liquidacion) return;
      try {
        exportTaxSettlementToExcel(liquidacion);
        toast.success('Liquidación de Impuestos exportada a Excel');
      } catch (err) {
        toast.error('Error al exportar a Excel: ' + (err as Error).message);
      }
      return;
    }
    if (!reporte) return;
    try {
      exportVatBookToExcel(reporte);
      toast.success('Libro de IVA exportado a Excel correctamente');
    } catch (err) {
      toast.error('Error al exportar a Excel: ' + (err as Error).message);
    }
  }

  function handlePrint() {
    window.print();
  }

  function handleDownloadAnexoCsv() {
    const periodo = `${MONTHS.find((m) => m.val === month)?.name || month}_${year}`;
    exportMhAnexoToCsv(anexoMhData, tipoAnexoMh, periodo);
    toast.success('Archivo de Anexo MH (CSV) descargado');
  }

  function handleDownloadAnexoExcel() {
    const periodo = `${MONTHS.find((m) => m.val === month)?.name || month}_${year}`;
    exportMhAnexoToExcel(anexoMhData, tipoAnexoMh, periodo);
    toast.success('Archivo Excel del Anexo descargado');
  }

  async function handleDownloadPlantillaOficial() {
    try {
      const template = await fetchPlantillaAnexo(tipoAnexoMh);
      exportBlankMhTemplate(template.columnas, template.ejemplo, tipoAnexoMh);
      toast.success('Plantilla oficial de Hacienda descargada');
    } catch (err) {
      toast.error(obtenerError(err));
    }
  }

  const formatMoney = (val: number | undefined) =>
    val && val !== 0 ? `$ ${Number(val).toFixed(2)}` : '$ -';

  return (
    <ControlIvaLayout>
      <div className="page-header no-print">
        <div>
          <h1 className="page-title">Libros de IVA y Anexos Oficiales</h1>
          <p className="page-subtitle">
            Generación de Libros de Compras, Ventas y Archivos para el Ministerio de Hacienda (MH)
          </p>
        </div>
      </div>

      {/* Control Navigation Tabs */}
      <div className="reportes-tabs-bar no-print">
        <div className="reportes-nav-pills">
          <button
            type="button"
            className={`pill-btn ${tipoReporte === 'compras' ? 'active' : ''}`}
            onClick={() => setTipoReporte('compras')}
          >
            <BookOpen size={16} />
            Libro de Compras
          </button>
          <button
            type="button"
            className={`pill-btn ${tipoReporte === 'consumidor_final' ? 'active' : ''}`}
            onClick={() => setTipoReporte('consumidor_final')}
          >
            <FileText size={16} />
            Libro Ventas Consumidor Final
          </button>
          <button
            type="button"
            className={`pill-btn ${tipoReporte === 'contribuyentes' ? 'active' : ''}`}
            onClick={() => setTipoReporte('contribuyentes')}
          >
            <FileSpreadsheet size={16} />
            Libro Ventas Contribuyentes
          </button>
          <button
            type="button"
            className={`pill-btn pill-btn-mh ${tipoReporte === 'anexos_mh' ? 'active' : ''}`}
            onClick={() => setTipoReporte('anexos_mh')}
          >
            <Download size={16} />
            Anexos de IVA (Hacienda)
          </button>
          <button
            type="button"
            className={`pill-btn pill-btn-tax ${tipoReporte === 'pago_impuestos' ? 'active' : ''}`}
            onClick={() => setTipoReporte('pago_impuestos')}
          >
            <Calculator size={16} />
            Pago de IVA y Pago a Cuenta
          </button>
        </div>
      </div>

      {/* Period Selector & Export Actions */}
      <div className="card card-periodo no-print">
        <div className="periodo-toolbar">
          <div className="periodo-inputs-wrapper">
            <div className="periodo-icon">
              <Calendar size={18} />
              <span>Período:</span>
            </div>
            <select
              className="select-periodo"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
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
              onChange={(e) => setYear(Number(e.target.value))}
              min={2000}
              max={2099}
            />
            <button
              type="button"
              className="btn-secundario btn-sm"
              onClick={() => {
                if (tipoReporte === 'pago_impuestos') cargarLiquidacion();
                else if (tipoReporte !== 'anexos_mh') cargarReporte();
                else cargarAnexoMh();
              }}
              title="Actualizar datos"
            >
              <RefreshCw size={14} className={(loading || loadingAnexo || loadingLiquidacion) ? 'animate-spin' : ''} />
              Refrescar
            </button>
          </div>

          {/* Action Export Buttons */}
          <div className="export-buttons-group">
            {tipoReporte === 'pago_impuestos' ? (
              <>
                <button
                  type="button"
                  className="btn-export btn-pdf"
                  onClick={handleExportPdf}
                  disabled={loadingLiquidacion || !liquidacion}
                >
                  <Download size={16} />
                  Descargar Liquidación (PDF)
                </button>
                <button
                  type="button"
                  className="btn-export btn-excel"
                  onClick={handleExportExcel}
                  disabled={loadingLiquidacion || !liquidacion}
                >
                  <FileSpreadsheet size={16} />
                  Descargar Liquidación (Excel)
                </button>
                <button
                  type="button"
                  className="btn-export btn-print"
                  onClick={handlePrint}
                  disabled={loadingLiquidacion || !liquidacion}
                >
                  <Printer size={16} />
                  Imprimir
                </button>
              </>
            ) : tipoReporte !== 'anexos_mh' ? (
              <>
                <button
                  type="button"
                  className="btn-export btn-pdf"
                  onClick={handleExportPdf}
                  disabled={loading || !reporte}
                >
                  <Download size={16} />
                  Descargar PDF
                </button>
                <button
                  type="button"
                  className="btn-export btn-excel"
                  onClick={handleExportExcel}
                  disabled={loading || !reporte}
                >
                  <FileSpreadsheet size={16} />
                  Descargar Excel
                </button>
                <button
                  type="button"
                  className="btn-export btn-print"
                  onClick={handlePrint}
                  disabled={loading || !reporte}
                >
                  <Printer size={16} />
                  Imprimir
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="btn-export btn-excel"
                  onClick={handleDownloadAnexoExcel}
                  disabled={loadingAnexo || anexoMhData.length === 0}
                >
                  <FileSpreadsheet size={16} />
                  Descargar Anexo (Excel)
                </button>
                <button
                  type="button"
                  className="btn-export btn-pdf"
                  onClick={handleDownloadAnexoCsv}
                  disabled={loadingAnexo || anexoMhData.length === 0}
                >
                  <Download size={16} />
                  Descargar Anexo MH (CSV)
                </button>
                <button
                  type="button"
                  className="btn-export btn-plantilla"
                  onClick={handleDownloadPlantillaOficial}
                >
                  <HelpCircle size={16} />
                  Descargar Plantilla Oficial
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* SECTION: LIQUIDACIÓN DE IVA Y PAGO A CUENTA */}
      {tipoReporte === 'pago_impuestos' ? (
        <div className="card report-paper-card">
          {loadingLiquidacion ? (
            <div className="report-loading">
              <div className="spinner"></div>
              <p>Calculando liquidación de IVA y Pago a Cuenta…</p>
            </div>
          ) : !liquidacion ? (
            <div className="td-vacio">No hay datos de liquidación para el período seleccionado</div>
          ) : (
            <div className="official-report-document tax-settlement-document">
              {/* Official Header */}
              <div className="report-header">
                <h2 className="report-company-name">{liquidacion.empresa.nom_emp}</h2>
                <h3 className="report-book-title">
                  LIQUIDACIÓN MENSUAL DE IVA Y PAGO A CUENTA DE RENTA
                </h3>
                <div className="report-meta-info">
                  <span>NUMERO DE REGISTRO DE I.V.A. {liquidacion.empresa.reg_fiscal}</span>
                  <span>NIT # {liquidacion.empresa.nit}</span>
                </div>
                <div className="report-period-row">
                  <span className="period-tag">
                    PERIODO TRIBUTARIO : <strong>{liquidacion.periodo.nombreMes} {liquidacion.periodo.anio}</strong>
                  </span>
                  <span className="branch-tag">
                    DECLARACIONES : <strong>F-07 (IVA) &amp; F-14 (Pago a Cuenta)</strong>
                  </span>
                </div>
              </div>

              {/* KPI Cards Overview */}
              <div className="tax-kpis-grid no-print">
                <div className="tax-kpi-card">
                  <span className="kpi-label">Total Débito Fiscal</span>
                  <span className="kpi-value text-blue">
                    ${liquidacion.iva.debitos.totalDebito.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="kpi-sub">Contribuyentes + Facturas</span>
                </div>
                <div className="tax-kpi-card">
                  <span className="kpi-label">Total Crédito Fiscal</span>
                  <span className="kpi-value text-green">
                    ${liquidacion.iva.creditos.totalCredito.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="kpi-sub">Compras locales + Importaciones</span>
                </div>
                <div className="tax-kpi-card">
                  <span className="kpi-label">IVA a Pagar (F-07)</span>
                  <span className={`kpi-value ${liquidacion.iva.liquidacion.totalIvaAPagar > 0 ? 'text-amber' : 'text-slate'}`}>
                    ${liquidacion.iva.liquidacion.totalIvaAPagar.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="kpi-sub">
                    {liquidacion.iva.liquidacion.remanenteCreditoProximoMes > 0 
                      ? `Remanente favor: $${liquidacion.iva.liquidacion.remanenteCreditoProximoMes.toFixed(2)}` 
                      : 'Impuesto neto a enterar'}
                  </span>
                </div>
                <div className="tax-kpi-card">
                  <span className="kpi-label">Pago a Cuenta (1.75%)</span>
                  <span className="kpi-value text-purple">
                    ${liquidacion.pagoCuenta.totalPagoCuentaAPagar.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="kpi-sub">
                    Base: ${liquidacion.pagoCuenta.ingresosGravados.totalBaseImponible.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Detail Sections: IVA F-07 and Pago a Cuenta F-14 */}
              <div className="tax-sections-grid">
                {/* Section 1: IVA Settlement */}
                <div className="tax-section-card">
                  <div className="tax-section-header">
                    <h4>1. Liquidación de Impuesto a la Transferencia de Bienes y Servicios (IVA - F-07)</h4>
                  </div>
                  <table className="tax-table">
                    <tbody>
                      <tr className="section-title-row">
                        <td colSpan={2}>A. DÉBITOS FISCALES DEL MES</td>
                      </tr>
                      <tr>
                        <td>Ventas a Contribuyentes (CCF) Débito 13%</td>
                        <td className="text-right">${liquidacion.iva.debitos.contribuyentes.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td>Ventas a Consumidor Final Débito 13%</td>
                        <td className="text-right">${liquidacion.iva.debitos.consumidorFinal.toFixed(2)}</td>
                      </tr>
                      <tr className="subtotal-row">
                        <td><strong>TOTAL DÉBITO FISCAL</strong></td>
                        <td className="text-right font-bold">${liquidacion.iva.debitos.totalDebito.toFixed(2)}</td>
                      </tr>

                      <tr className="section-title-row">
                        <td colSpan={2}>B. CRÉDITOS FISCALES DEL MES</td>
                      </tr>
                      <tr>
                        <td>Compras Internas Gravadas Crédito 13%</td>
                        <td className="text-right">${liquidacion.iva.creditos.comprasLocales.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td>Importaciones e Internaciones Crédito 13%</td>
                        <td className="text-right">${(liquidacion.iva.creditos.importaciones + liquidacion.iva.creditos.internaciones).toFixed(2)}</td>
                      </tr>
                      <tr className="subtotal-row">
                        <td><strong>TOTAL CRÉDITO FISCAL</strong></td>
                        <td className="text-right font-bold">${liquidacion.iva.creditos.totalCredito.toFixed(2)}</td>
                      </tr>

                      <tr className="section-title-row">
                        <td colSpan={2}>C. DETERMINACIÓN DEL IMPUESTO NETO</td>
                      </tr>
                      <tr>
                        <td>Excedente de Débito Fiscal (Impuesto Determinado)</td>
                        <td className="text-right">${liquidacion.iva.liquidacion.impuestoDeterminado.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td>Excedente de Crédito Fiscal (Remanente del Mes)</td>
                        <td className="text-right font-semibold" style={{ color: '#059669' }}>
                          ${liquidacion.iva.liquidacion.remanenteCreditoMes.toFixed(2)}
                        </td>
                      </tr>

                      <tr className="section-title-row">
                        <td colSpan={2}>D. DEDUCCIONES Y PERCEPCIONES DEL MES</td>
                      </tr>
                      <tr>
                        <td>(-) Retenciones de IVA 1% efectuadas por clientes</td>
                        <td className="text-right" style={{ color: '#e11d48' }}>-${liquidacion.iva.liquidacion.retencionesClientes.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td>(-) Anticipo a cuenta de IVA 2%</td>
                        <td className="text-right" style={{ color: '#e11d48' }}>-${liquidacion.iva.liquidacion.anticipoIva.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td>(+) Percepciones de IVA recibidas</td>
                        <td className="text-right">+${liquidacion.iva.liquidacion.percepcionesIva.toFixed(2)}</td>
                      </tr>

                      <tr className="total-row-highlight">
                        <td><strong>TOTAL IVA A PAGAR (F-07)</strong></td>
                        <td className="text-right font-bold" style={{ fontSize: '1.1rem' }}>
                          ${liquidacion.iva.liquidacion.totalIvaAPagar.toFixed(2)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Section 2: Pago a Cuenta Art. 151 C.T. */}
                <div className="tax-section-card">
                  <div className="tax-section-header">
                    <h4>2. Pago a Cuenta del Impuesto sobre la Renta (Art. 151 C.T. - F-14)</h4>
                  </div>
                  <table className="tax-table">
                    <tbody>
                      <tr className="section-title-row">
                        <td colSpan={2}>A. BASE DE INGRESOS GRAVADOS</td>
                      </tr>
                      <tr>
                        <td>Ventas Gravadas a Contribuyentes (Neto sin IVA)</td>
                        <td className="text-right">${liquidacion.pagoCuenta.ingresosGravados.contribuyentes.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td>Ventas a Consumidor Final (Neto sin IVA)</td>
                        <td className="text-right">${liquidacion.pagoCuenta.ingresosGravados.consumidorFinalNeto.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td>Exportaciones Gravadas del Mes</td>
                        <td className="text-right">${liquidacion.pagoCuenta.ingresosGravados.exportaciones.toFixed(2)}</td>
                      </tr>
                      <tr className="subtotal-row">
                        <td><strong>TOTAL INGRESOS BRUTOS GRAVADOS</strong></td>
                        <td className="text-right font-bold">${liquidacion.pagoCuenta.ingresosGravados.totalBaseImponible.toFixed(2)}</td>
                      </tr>

                      <tr className="section-title-row">
                        <td colSpan={2}>B. APLICACIÓN DE LA TASA LEGAL</td>
                      </tr>
                      <tr>
                        <td>Porcentaje Legal de Pago a Cuenta</td>
                        <td className="text-right font-bold">{(liquidacion.pagoCuenta.tasa * 100).toFixed(2)}%</td>
                      </tr>
                      <tr>
                        <td>Pago a Cuenta Determinado</td>
                        <td className="text-right">${liquidacion.pagoCuenta.pagoCuentaDeterminado.toFixed(2)}</td>
                      </tr>
                      {liquidacion.pagoCuenta.retencionesRenta > 0 && (
                        <tr>
                          <td>(-) Retenciones de Renta Sufridas</td>
                          <td className="text-right" style={{ color: '#e11d48' }}>-${liquidacion.pagoCuenta.retencionesRenta.toFixed(2)}</td>
                        </tr>
                      )}
                      <tr className="total-row-highlight">
                        <td><strong>PAGO A CUENTA A PAGAR (F-14)</strong></td>
                        <td className="text-right font-bold" style={{ fontSize: '1.1rem' }}>
                          ${liquidacion.pagoCuenta.totalPagoCuentaAPagar.toFixed(2)}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Grand Total Banner */}
                  <div className="tax-banner-grand-total">
                    <div className="grand-total-label">
                      <span>TOTAL GENERAL A PAGAR AL FISCO (MH)</span>
                      <small>Suma de Liquidación de IVA F-07 y Pago a Cuenta F-14</small>
                    </div>
                    <div className="grand-total-amount">
                      ${liquidacion.resumenGeneral.totalPagarFisco.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Signatures */}
              <div className="report-signatures">
                <div className="sig-block">
                  <div className="sig-line"></div>
                  <div className="sig-name">{liquidacion.firmas.elaboradoPor || 'CONTADOR GENERAL'}</div>
                  <div className="sig-role">Firma y Sello</div>
                </div>
                <div className="sig-block">
                  <div className="sig-line"></div>
                  <div className="sig-name">{liquidacion.firmas.revisadoPor || 'REPRESENTANTE LEGAL / AUDITOR'}</div>
                  <div className="sig-role">Firma y Sello</div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : tipoReporte === 'anexos_mh' ? (
        <div className="card">
          <div className="anexo-mh-subnav">
            <button
              type="button"
              className={`subnav-btn ${tipoAnexoMh === 'compras' ? 'active' : ''}`}
              onClick={() => setTipoAnexoMh('compras')}
            >
              Anexo 3 - Compras
            </button>
            <button
              type="button"
              className={`subnav-btn ${tipoAnexoMh === 'contribuyentes' ? 'active' : ''}`}
              onClick={() => setTipoAnexoMh('contribuyentes')}
            >
              Anexo 1 - Ventas Contribuyentes
            </button>
            <button
              type="button"
              className={`subnav-btn ${tipoAnexoMh === 'consumidor_final' ? 'active' : ''}`}
              onClick={() => setTipoAnexoMh('consumidor_final')}
            >
              Anexo 2 - Ventas Consumidor Final
            </button>
          </div>

          <div className="anexo-info-banner">
            <div>
              <strong>Formato Oficial de Carga Masiva (F-07 / DET):</strong> Estructura técnica
              oficial emitida por la Dirección General de Impuestos Internos del Ministerio de
              Hacienda de El Salvador.
            </div>
            <div className="text-muted text-xs mt-1">
              {anexoMhData.length} registros listos para exportar en el período seleccionado.
            </div>
          </div>

          <div className="tabla-contenedor mt-4">
            <table className="tabla-registros tabla-compacta tabla-anexo-mh">
              <thead>
                <tr>
                  {anexoMhData[0] ? (
                    Object.keys(anexoMhData[0]).map((k) => (
                      <th
                        key={k}
                        className={`text-xs uppercase whitespace-nowrap ${
                          MONEY_COLUMNS.has(k) ? 'text-right' : ''
                        }`}
                      >
                        {k.replace(/_/g, ' ')}
                      </th>
                    ))
                  ) : (
                    <th>No hay datos en este período</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {loadingAnexo ? (
                  <tr>
                    <td
                      colSpan={anexoMhData[0] ? Object.keys(anexoMhData[0]).length : 10}
                      className="td-cargando"
                    >
                      Cargando anexo…
                    </td>
                  </tr>
                ) : anexoMhData.length === 0 ? (
                  <tr>
                    <td
                      colSpan={anexoMhData[0] ? Object.keys(anexoMhData[0]).length : 10}
                      className="td-vacio"
                    >
                      No se encontraron registros para este anexo en el período seleccionado.
                    </td>
                  </tr>
                ) : (
                  anexoMhData.map((row, idx) => (
                    <tr key={idx}>
                      {Object.entries(row).map(([k, val], i) => (
                        <td
                          key={i}
                          className={`text-xs whitespace-nowrap ${
                            MONEY_COLUMNS.has(k) ? 'text-right' : ''
                          }`}
                        >
                          {formatAnexoCell(k, val)}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* SECTION: VAT BOOK PREVIEW MATCHING THE PDF TEMPLATES */
        <div className="card report-paper-card">
          {loading ? (
            <div className="report-loading">
              <div className="spinner"></div>
              <p>Generando libro de IVA…</p>
            </div>
          ) : !reporte ? (
            <div className="td-vacio">No hay datos para mostrar</div>
          ) : (
            <div className="official-report-document">
              {/* Official Header */}
              <div className="report-header">
                <h2 className="report-company-name">{reporte.empresa.nom_emp}</h2>
                <h3 className="report-book-title">
                  {reporte.libro === 'compras'
                    ? 'LIBRO DE COMPRAS'
                    : reporte.libro === 'consumidor_final'
                    ? 'LIBRO DE VENTAS AL CONSUMIDOR'
                    : 'LIBRO DE VENTAS A CONTRIBUYENTES'}
                </h3>
                <div className="report-meta-info">
                  <span>NUMERO DE REGISTRO DE I.V.A. {reporte.empresa.reg_fiscal}</span>
                  <span>NIT # {reporte.empresa.nit}</span>
                </div>
                <div className="report-period-row">
                  <span className="period-tag">
                    PERIODO : <strong>{reporte.periodo.nombreMes} {reporte.periodo.anio}</strong>
                  </span>
                  <span className="branch-tag">
                    SUCURSAL : <strong>{reporte.sucursal}</strong>
                  </span>
                </div>
              </div>

              {/* Table Data */}
              <div className="report-table-wrapper">
                {reporte.libro === 'compras' ? (
                  <table className="official-table">
                    <thead>
                      <tr>
                        <th className="th-center">No.<br />CORR</th>
                        <th className="th-center">FECHA</th>
                        <th>CODIGO<br />GENERACION</th>
                        <th className="th-center">No.<br />REGISTRO</th>
                        <th>NOMBRE DEL PROVEEDOR</th>
                        <th className="th-right">COMPRAS<br />EXENTAS</th>
                        <th className="th-right">NO<br />SUJETAS</th>
                        <th className="th-right">COMPRAS<br />GRAVADAS</th>
                        <th className="th-right">CREDITO<br />FISCAL</th>
                        <th className="th-right">ANTICIPO<br />A CTA.</th>
                        <th className="th-right">IVA<br />RETENIDO</th>
                        <th className="th-right">TOTAL<br />COMPRAS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(reporte.filas as any[]).map((f) => (
                        <tr key={f.corr}>
                          <td className="text-center">{f.corr}</td>
                          <td className="text-center">{f.fecha}</td>
                          <td className="font-mono text-xs">{f.codigoGeneracion}</td>
                          <td className="text-center font-mono">{f.registro}</td>
                          <td>{f.nombreProveedor}</td>
                          <td className="text-right">{formatMoney(f.comprasExentas)}</td>
                          <td className="text-right">{formatMoney(f.noSujetas)}</td>
                          <td className="text-right">{formatMoney(f.comprasGravadas)}</td>
                          <td className="text-right">{formatMoney(f.creditoFiscal)}</td>
                          <td className="text-right">{formatMoney(f.anticipoACta)}</td>
                          <td className="text-right">{formatMoney(f.ivaRetenido)}</td>
                          <td className="text-right font-bold">{formatMoney(f.totalCompras)}</td>
                        </tr>
                      ))}
                      <tr className="tr-totales">
                        <td colSpan={5} className="font-bold text-center">TOTALES</td>
                        <td className="text-right font-bold">{formatMoney(reporte.totales.comprasExentas)}</td>
                        <td className="text-right font-bold">{formatMoney(reporte.totales.noSujetas)}</td>
                        <td className="text-right font-bold">{formatMoney(reporte.totales.comprasGravadas)}</td>
                        <td className="text-right font-bold">{formatMoney(reporte.totales.creditoFiscal)}</td>
                        <td className="text-right font-bold">{formatMoney(reporte.totales.anticipoACta)}</td>
                        <td className="text-right font-bold">{formatMoney(reporte.totales.ivaRetenido)}</td>
                        <td className="text-right font-bold">{formatMoney(reporte.totales.totalCompras)}</td>
                      </tr>
                    </tbody>
                  </table>
                ) : reporte.libro === 'consumidor_final' ? (
                  <table className="official-table">
                    <thead>
                      <tr>
                        <th className="th-center">FECHA</th>
                        <th>CODIGO GENERACION<br />INICIAL</th>
                        <th>CODIGO GENERACION<br />FINAL</th>
                        <th>NUMERO DE CONTROL<br />DEL</th>
                        <th>NUMERO DE CONTROL<br />AL</th>
                        <th className="th-right">VENTAS<br />EXENTAS</th>
                        <th className="th-right">VENTAS NO<br />SUJETAS</th>
                        <th className="th-right">VENTAS GRAVADAS<br />LOCALES</th>
                        <th className="th-right">TOTAL<br />VENTAS</th>
                        <th className="th-right">VENTAS A<br />TERCEROS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(reporte.filas as any[]).map((f, i) => (
                        <tr key={i}>
                          <td className="text-center">{f.fecha}</td>
                          <td className="font-mono text-xs">{f.codigoGeneracionInicial}</td>
                          <td className="font-mono text-xs">{f.codigoGeneracionFinal}</td>
                          <td className="font-mono text-xs">{f.numeroControlDel}</td>
                          <td className="font-mono text-xs">{f.numeroControlAl}</td>
                          <td className="text-right">{formatMoney(f.ventasExentas)}</td>
                          <td className="text-right">{formatMoney(f.ventasNoSujetas)}</td>
                          <td className="text-right">{formatMoney(f.gravadasLocales)}</td>
                          <td className="text-right font-bold">{formatMoney(f.totalVentas)}</td>
                          <td className="text-right">{formatMoney(f.ventasCuentasTerceros)}</td>
                        </tr>
                      ))}
                      <tr className="tr-totales">
                        <td colSpan={5} className="font-bold text-center">TOTALES.</td>
                        <td className="text-right font-bold">{formatMoney(reporte.totales.ventasExentas)}</td>
                        <td className="text-right font-bold">{formatMoney(reporte.totales.ventasNoSujetas)}</td>
                        <td className="text-right font-bold">{formatMoney(reporte.totales.gravadasLocales)}</td>
                        <td className="text-right font-bold">{formatMoney(reporte.totales.totalVentas)}</td>
                        <td className="text-right font-bold">{formatMoney(reporte.totales.ventasCuentasTerceros)}</td>
                      </tr>
                    </tbody>
                  </table>
                ) : (
                  /* Contribuyentes */
                  <table className="official-table">
                    <thead>
                      <tr>
                        <th className="th-center">No.<br />CORR</th>
                        <th className="th-center">FECHA</th>
                        <th>CODIGO DE<br />GENERACION</th>
                        <th>NOMBRE DE CLIENTE</th>
                        <th className="th-center">No.<br />REGISTRO</th>
                        <th className="th-right">VENTAS<br />EXENTAS</th>
                        <th className="th-right">VTAS NO<br />SUJETAS</th>
                        <th className="th-right">GRAVADAS<br />VENTAS</th>
                        <th className="th-right">DEBITO<br />FISCAL</th>
                        <th className="th-right">IVA<br />RET/PER.</th>
                        <th className="th-right">VENTAS<br />TOTALES</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(reporte.filas as any[]).map((f) => (
                        <tr key={f.corr}>
                          <td className="text-center">{f.corr}</td>
                          <td className="text-center">{f.fecha}</td>
                          <td className="font-mono text-xs">{f.codigoGeneracion}</td>
                          <td>{f.nombreCliente}</td>
                          <td className="text-center font-mono">{f.registro}</td>
                          <td className="text-right">{formatMoney(f.ventasExentas)}</td>
                          <td className="text-right">{formatMoney(f.ventasNoSujetas)}</td>
                          <td className="text-right">{formatMoney(f.gravadasVentas)}</td>
                          <td className="text-right">{formatMoney(f.debitoFiscalVentas)}</td>
                          <td className="text-right">{formatMoney(f.ivaRetenidoPercibido)}</td>
                          <td className="text-right font-bold">{formatMoney(f.ventasTotales)}</td>
                        </tr>
                      ))}
                      <tr className="tr-totales">
                        <td colSpan={5} className="font-bold text-center">TOTALES</td>
                        <td className="text-right font-bold">{formatMoney(reporte.totales.ventasExentas)}</td>
                        <td className="text-right font-bold">{formatMoney(reporte.totales.ventasNoSujetas)}</td>
                        <td className="text-right font-bold">{formatMoney(reporte.totales.gravadasVentas)}</td>
                        <td className="text-right font-bold">{formatMoney(reporte.totales.debitoFiscalVentas)}</td>
                        <td className="text-right font-bold">{formatMoney(reporte.totales.ivaRetenidoPercibido)}</td>
                        <td className="text-right font-bold">{formatMoney(reporte.totales.ventasTotales)}</td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </div>

              {/* Cuadro Resumen (Exact to PDF templates) */}
              <div className="report-summary-box-wrapper">
                <div className="summary-box-title">CUADRO RESUMEN</div>

                {reporte.libro === 'compras' && (
                  <div className="summary-table-container">
                    <table className="summary-table">
                      <thead>
                        <tr>
                          <th></th>
                          <th className="th-right">COMPRAS EXENTAS</th>
                          <th className="th-right">COMPRAS GRAVADAS</th>
                          <th className="th-right">REB. Y DEV. S/COMPRAS</th>
                          <th className="th-right">TOTAL</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="font-bold">LOCALES</td>
                          <td className="text-right">{formatMoney(reporte.cuadroResumen.locales?.exentas)}</td>
                          <td className="text-right">{formatMoney(reporte.cuadroResumen.locales?.gravadas)}</td>
                          <td className="text-right">{formatMoney(reporte.cuadroResumen.locales?.rebajas)}</td>
                          <td className="text-right font-bold">{formatMoney(reporte.cuadroResumen.locales?.total)}</td>
                        </tr>
                        <tr>
                          <td className="font-bold">IMPORTACIONES</td>
                          <td className="text-right">{formatMoney(reporte.cuadroResumen.importaciones?.exentas)}</td>
                          <td className="text-right">{formatMoney(reporte.cuadroResumen.importaciones?.gravadas)}</td>
                          <td className="text-right">$ -</td>
                          <td className="text-right font-bold">{formatMoney(reporte.cuadroResumen.importaciones?.total)}</td>
                        </tr>
                        <tr>
                          <td className="font-bold">INTERNACIONES</td>
                          <td className="text-right">{formatMoney(reporte.cuadroResumen.internaciones?.exentas)}</td>
                          <td className="text-right">{formatMoney(reporte.cuadroResumen.internaciones?.gravadas)}</td>
                          <td className="text-right">$ -</td>
                          <td className="text-right font-bold">{formatMoney(reporte.cuadroResumen.internaciones?.total)}</td>
                        </tr>
                        <tr>
                          <td className="font-bold">CREDITO FISCAL</td>
                          <td></td>
                          <td className="text-right font-bold">{formatMoney(reporte.cuadroResumen.creditoFiscal)}</td>
                          <td></td>
                          <td className="text-right font-bold">{formatMoney(reporte.cuadroResumen.creditoFiscal)}</td>
                        </tr>
                      </tbody>
                    </table>

                    <table className="summary-table mt-2">
                      <thead>
                        <tr>
                          <th className="th-center">ANTICIPO A CUENTA</th>
                          <th className="th-center">I.V.A. PERCIBIDO</th>
                          <th className="th-center">I.V.A. RETENIDO</th>
                          <th className="th-center">RETENCION A TERCEROS</th>
                          <th className="th-center">COMPRAS A EXCLUIDOS</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="text-center">{formatMoney(reporte.cuadroResumen.anticipoACuenta)}</td>
                          <td className="text-center">{formatMoney(reporte.cuadroResumen.ivaPercibido)}</td>
                          <td className="text-center">{formatMoney(reporte.cuadroResumen.ivaRetenido)}</td>
                          <td className="text-center">{formatMoney(reporte.cuadroResumen.retencionTerceros)}</td>
                          <td className="text-center">{formatMoney(reporte.cuadroResumen.comprasExcluidos)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {reporte.libro === 'consumidor_final' && (
                  <div className="summary-table-container">
                    <div className="grid-resumen-cf">
                      <div className="resumen-cf-col">
                        <div className="font-bold text-xs uppercase mb-1">CALCULO DEL DEBITO FISCAL</div>
                        <div className="row-calc">
                          <span>VENTAS GRAVADAS:</span>
                          <strong>{formatMoney(reporte.cuadroResumen.calculoDebitoFiscal?.ventasGravadas)}</strong>
                        </div>
                        <div className="row-calc">
                          <span>/ 1.13 VENTA GRAVADA NETA:</span>
                          <strong>{formatMoney(reporte.cuadroResumen.calculoDebitoFiscal?.ventaGravada)}</strong>
                        </div>
                        <div className="row-calc">
                          <span>IMPUESTO IVA LIQUIDADO:</span>
                          <strong className="text-primary">
                            {formatMoney(reporte.cuadroResumen.calculoDebitoFiscal?.impuestoIva)}
                          </strong>
                        </div>
                      </div>

                      <div className="resumen-cf-col">
                        <div className="font-bold text-xs uppercase mb-1">RESUMEN GENERAL</div>
                        <div className="row-calc">
                          <span>VENTA BRUTA:</span>
                          <span>{formatMoney(reporte.cuadroResumen.resumenGeneral?.ventaBruta)}</span>
                        </div>
                        <div className="row-calc">
                          <span>EXPORTACIONES:</span>
                          <span>{formatMoney(reporte.cuadroResumen.resumenGeneral?.exportaciones)}</span>
                        </div>
                        <div className="row-calc">
                          <span>TOTAL VENTAS:</span>
                          <strong className="text-success">
                            {formatMoney(reporte.cuadroResumen.resumenGeneral?.totalVentas)}
                          </strong>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {reporte.libro === 'contribuyentes' && (
                  <div className="summary-table-container">
                    <table className="summary-table">
                      <thead>
                        <tr>
                          <th></th>
                          <th className="th-right">VENTAS EXENTAS</th>
                          <th className="th-right">VENTAS GRAVADAS</th>
                          <th className="th-right">EXPORTACIONES</th>
                          <th className="th-right">REBAJAS S/VENTAS</th>
                          <th className="th-right">DEBITO FISCAL PROPIAS</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="font-bold">CONSUMIDORES FINALES</td>
                          <td className="text-right">{formatMoney(reporte.cuadroResumen.consumidoresFinales?.ventasExentas)}</td>
                          <td className="text-right">{formatMoney(reporte.cuadroResumen.consumidoresFinales?.ventasGravadas)}</td>
                          <td className="text-right">{formatMoney(reporte.cuadroResumen.consumidoresFinales?.exportaciones)}</td>
                          <td className="text-right">$ -</td>
                          <td className="text-right">{formatMoney(reporte.cuadroResumen.consumidoresFinales?.debitoFiscalPropias)}</td>
                        </tr>
                        <tr>
                          <td className="font-bold">CONTRIBUYENTES</td>
                          <td className="text-right">{formatMoney(reporte.cuadroResumen.contribuyentes?.ventasExentas)}</td>
                          <td className="text-right">{formatMoney(reporte.cuadroResumen.contribuyentes?.ventasGravadas)}</td>
                          <td className="text-right">$ -</td>
                          <td className="text-right">{formatMoney(reporte.cuadroResumen.contribuyentes?.rebajasVentas)}</td>
                          <td className="text-right">{formatMoney(reporte.cuadroResumen.contribuyentes?.debitoFiscalPropias)}</td>
                        </tr>
                        <tr className="font-bold tr-subtotal">
                          <td>SUB TOTAL</td>
                          <td className="text-right">{formatMoney(reporte.cuadroResumen.subTotal?.ventasExentas)}</td>
                          <td className="text-right">{formatMoney(reporte.cuadroResumen.subTotal?.ventasGravadas)}</td>
                          <td className="text-right">{formatMoney(reporte.cuadroResumen.subTotal?.exportaciones)}</td>
                          <td className="text-right">{formatMoney(reporte.cuadroResumen.subTotal?.rebajasVentas)}</td>
                          <td className="text-right text-primary">
                            {formatMoney(reporte.cuadroResumen.subTotal?.debitoFiscalPropias)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Signatures Box (Elaborado por / Revisado por) */}
              <div className="report-signatures-box">
                <div className="signature-col">
                  <div className="signature-line"></div>
                  <div className="signature-label">ELABORADO POR</div>
                  <div className="signature-name">{reporte.firmas.elaboradoPor}</div>
                </div>
                <div className="signature-col">
                  <div className="signature-line"></div>
                  <div className="signature-label">REVISADO POR</div>
                  <div className="signature-name">{reporte.firmas.revisadoPor}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </ControlIvaLayout>
  );
}
