import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Building2,
  Calendar,
  CheckCircle2,
  DollarSign,
  FileSpreadsheet,
  LayoutDashboard,
  Receipt,
  RotateCw,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  UploadCloud,
  Users,
  Wallet,
} from 'lucide-react';
import { fetchDashboardData } from '../../api/controlIva';
import { obtenerError } from '../../api/client';
import ControlIvaLayout from '../../components/layout/ControlIvaLayout';
import type { DashboardData } from '../../types/controlIva';

const MESES = [
  { id: 1, nombre: 'Enero' },
  { id: 2, nombre: 'Febrero' },
  { id: 3, nombre: 'Marzo' },
  { id: 4, nombre: 'Abril' },
  { id: 5, nombre: 'Mayo' },
  { id: 6, nombre: 'Junio' },
  { id: 7, nombre: 'Julio' },
  { id: 8, nombre: 'Agosto' },
  { id: 9, nombre: 'Septiembre' },
  { id: 10, nombre: 'Octubre' },
  { id: 11, nombre: 'Noviembre' },
  { id: 12, nombre: 'Diciembre' },
];

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('es-SV', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount || 0);
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  // Filter state
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);

  async function cargarDashboard(anio = year, mes = month) {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetchDashboardData({ year: anio, month: mes });
      setData(res);
      setYear(res.periodo.anio);
      setMonth(res.periodo.mes);
    } catch (err) {
      const msg = obtenerError(err);
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  }

  useEffect(() => {
    cargarDashboard();
  }, []);

  const aniosDisponibles = Array.from(
    { length: 6 },
    (_, i) => new Date().getFullYear() - i,
  );

  const maxTendenciaVentas = Math.max(
    ...(data?.tendenciaMensual.map((t) => Math.max(t.ventas, t.compras)) || [1]),
    1,
  );

  return (
    <ControlIvaLayout>
      <div className="dashboard-container">
        {/* Cabecera del Dashboard */}
        <div className="dashboard-header-card">
          <div className="dashboard-welcome">
            <div className="dashboard-title-wrap">
              <div className="dashboard-icon-badge">
                <LayoutDashboard size={24} />
              </div>
              <div>
                <h1 className="dashboard-title">Panel de Control Tributario</h1>
                <p className="dashboard-subtitle">
                  {data?.empresa?.nom_emp || 'Empresa'} · Resumen General de IVA y Operaciones DTE
                </p>
              </div>
            </div>

            {data?.empresa && (
              <div className="dashboard-empresa-meta">
                {data.empresa.nit && (
                  <span className="meta-tag">
                    <strong>NIT:</strong> {data.empresa.nit}
                  </span>
                )}
                {data.empresa.reg_fiscal && (
                  <span className="meta-tag">
                    <strong>NRC:</strong> {data.empresa.reg_fiscal}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Filtro de Período */}
          <div className="dashboard-filter-bar">
            <div className="filter-group">
              <Calendar size={16} className="text-muted" />
              <span className="filter-label">Período:</span>
              <select
                value={month}
                onChange={(e) => {
                  const m = Number(e.target.value);
                  setMonth(m);
                  cargarDashboard(year, m);
                }}
                className="filter-select"
              >
                {MESES.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
              </select>

              <select
                value={year}
                onChange={(e) => {
                  const y = Number(e.target.value);
                  setYear(y);
                  cargarDashboard(y, month);
                }}
                className="filter-select"
              >
                {aniosDisponibles.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="btn-actualizar"
              onClick={() => cargarDashboard(year, month)}
              disabled={loading}
              title="Actualizar datos"
            >
              <RotateCw size={15} className={loading ? 'animate-spin' : ''} />
              <span>{loading ? 'Cargando…' : 'Refrescar'}</span>
            </button>
          </div>
        </div>

        {errorMsg && !data && !loading && (
          <div className="dashboard-error-banner" style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            borderRadius: 12,
            padding: '20px 24px',
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap'
          }}>
            <div>
              <strong style={{ fontSize: '1rem', display: 'block', marginBottom: 4 }}>No se pudo conectar con la base de datos remota</strong>
              <span style={{ fontSize: '0.88rem', color: '#b91c1c' }}>{errorMsg}</span>
            </div>
            <button
              type="button"
              className="btn-primario"
              style={{ margin: 0, width: 'auto', padding: '8px 18px' }}
              onClick={() => cargarDashboard(year, month)}
            >
              Reintentar conexión
            </button>
          </div>
        )}

        {/* Tarjetas KPI Superiores */}
        <div className="dashboard-kpi-grid">
          {/* KPI Ventas */}
          <div className="kpi-card kpi-ventas">
            <div className="kpi-header">
              <span className="kpi-title">Ventas del Período</span>
              <div className="kpi-icon-wrap icon-ventas">
                <TrendingUp size={20} />
              </div>
            </div>
            <div className="kpi-value">{formatMoney(data?.ventas?.totalVentas || 0)}</div>
            <div className="kpi-detail">
              <span className="kpi-subitem">
                <strong>Débito Fiscal:</strong> {formatMoney(data?.ventas?.debitoFiscal || 0)}
              </span>
              <span className="kpi-badge-count">
                {data?.ventas?.totalDocumentos || 0} DTEs emitidos
              </span>
            </div>
            <div className="kpi-progress-bar">
              <div
                className="kpi-progress-fill fill-ventas"
                style={{
                  width: `${Math.min(
                    100,
                    data?.ventas?.totalVentas && data?.compras?.totalCompras
                      ? (data.ventas.totalVentas /
                          (data.ventas.totalVentas + data.compras.totalCompras)) *
                          100
                      : 50,
                  )}%`,
                }}
              />
            </div>
          </div>

          {/* KPI Compras */}
          <div className="kpi-card kpi-compras">
            <div className="kpi-header">
              <span className="kpi-title">Compras del Período</span>
              <div className="kpi-icon-wrap icon-compras">
                <TrendingDown size={20} />
              </div>
            </div>
            <div className="kpi-value">{formatMoney(data?.compras?.totalCompras || 0)}</div>
            <div className="kpi-detail">
              <span className="kpi-subitem">
                <strong>Crédito Fiscal:</strong> {formatMoney(data?.compras?.creditoFiscal || 0)}
              </span>
              <span className="kpi-badge-count">
                {data?.compras?.totalDocumentos || 0} DTEs recibidos
              </span>
            </div>
            <div className="kpi-progress-bar">
              <div
                className="kpi-progress-fill fill-compras"
                style={{
                  width: `${Math.min(
                    100,
                    data?.ventas?.totalVentas && data?.compras?.totalCompras
                      ? (data.compras.totalCompras /
                          (data.ventas.totalVentas + data.compras.totalCompras)) *
                          100
                      : 50,
                  )}%`,
                }}
              />
            </div>
          </div>

          {/* KPI Liquidación IVA Estimada */}
          <div
            className={`kpi-card kpi-impuestos ${
              (data?.liquidacionEstimada?.diferenciaIva || 0) > 0 ? 'kpi-alerta' : 'kpi-favor'
            }`}
          >
            <div className="kpi-header">
              <span className="kpi-title">Resultado IVA Estimado</span>
              <div className="kpi-icon-wrap icon-impuestos">
                <DollarSign size={20} />
              </div>
            </div>
            {(data?.liquidacionEstimada?.diferenciaIva || 0) > 0 ? (
              <>
                <div className="kpi-value text-danger">
                  {formatMoney(data?.liquidacionEstimada?.ivaAPagar || 0)}
                </div>
                <div className="kpi-status-badge badge-pagar">
                  <ArrowUpRight size={14} /> IVA a Pagar
                </div>
              </>
            ) : (
              <>
                <div className="kpi-value text-success">
                  {formatMoney(data?.liquidacionEstimada?.remanenteFavor || 0)}
                </div>
                <div className="kpi-status-badge badge-favor">
                  <CheckCircle2 size={14} /> Saldo Remanente a Favor
                </div>
              </>
            )}
            <div className="kpi-detail-footer">
              <span>
                <strong>Pago a Cuenta (1.75%):</strong>{' '}
                {formatMoney(data?.liquidacionEstimada?.pagoCuentaEstimado || 0)}
              </span>
            </div>
          </div>

          {/* KPI Catálogos */}
          <div className="kpi-card kpi-catalogos">
            <div className="kpi-header">
              <span className="kpi-title">Base de Contribuyentes</span>
              <div className="kpi-icon-wrap icon-catalogos">
                <Users size={20} />
              </div>
            </div>
            <div className="kpi-catalogos-body">
              <div className="kpi-catalogo-item">
                <div className="catalogo-icon-circle">
                  <Users size={16} />
                </div>
                <div>
                  <div className="catalogo-count">{data?.catalogos?.totalClientes || 0}</div>
                  <div className="catalogo-name">
                    Clientes ({data?.catalogos?.clientesActivos || 0} activos)
                  </div>
                </div>
              </div>
              <div className="kpi-catalogo-divider" />
              <div className="kpi-catalogo-item">
                <div className="catalogo-icon-circle prov">
                  <Building2 size={16} />
                </div>
                <div>
                  <div className="catalogo-count">{data?.catalogos?.totalProveedores || 0}</div>
                  <div className="catalogo-name">
                    Proveedores ({data?.catalogos?.proveedoresActivos || 0} activos)
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sección Principal: Gráfico de Tendencia + Resumen de Impuestos */}
        <div className="dashboard-main-grid">
          {/* Gráfico de Barras / Tendencia Mensual */}
          <div className="dashboard-panel panel-tendencia">
            <div className="panel-header">
              <div>
                <h3 className="panel-title">Tendencia Semestral (Ventas vs Compras)</h3>
                <p className="panel-subtitle">
                  Histórico de operaciones registradas para la empresa activa
                </p>
              </div>
              <div className="legend-pills">
                <span className="legend-pill pill-ventas">
                  <span className="pill-dot dot-ventas" /> Ventas
                </span>
                <span className="legend-pill pill-compras">
                  <span className="pill-dot dot-compras" /> Compras
                </span>
              </div>
            </div>

            <div className="chart-bars-container">
              {data?.tendenciaMensual && data.tendenciaMensual.length > 0 ? (
                data.tendenciaMensual.map((item, idx) => {
                  const alturaVenta = Math.round((item.ventas / maxTendenciaVentas) * 100);
                  const alturaCompra = Math.round((item.compras / maxTendenciaVentas) * 100);
                  const esMesActual = item.mes === month && item.anio === year;

                  return (
                    <div
                      key={idx}
                      className={`chart-bar-column ${esMesActual ? 'col-current' : ''}`}
                    >
                      <div className="bars-track">
                        {/* Barra Ventas */}
                        <div
                          className="bar-item bar-venta"
                          style={{ height: `${Math.max(4, alturaVenta)}%` }}
                          title={`Ventas ${item.nombreMes}: ${formatMoney(item.ventas)}`}
                        >
                          {item.ventas > 0 && (
                            <span className="bar-tooltip">{formatMoney(item.ventas)}</span>
                          )}
                        </div>
                        {/* Barra Compras */}
                        <div
                          className="bar-item bar-compra"
                          style={{ height: `${Math.max(4, alturaCompra)}%` }}
                          title={`Compras ${item.nombreMes}: ${formatMoney(item.compras)}`}
                        >
                          {item.compras > 0 && (
                            <span className="bar-tooltip">{formatMoney(item.compras)}</span>
                          )}
                        </div>
                      </div>
                      <div className="bar-label">{item.nombreMes}</div>
                    </div>
                  );
                })
              ) : (
                <div className="empty-state-text">No hay datos históricos disponibles</div>
              )}
            </div>

            <div className="panel-footer-stats">
              <div className="fstat">
                <span className="fstat-label">Débito Fiscal Acumulado:</span>
                <span className="fstat-val text-primary">
                  {formatMoney(
                    data?.tendenciaMensual.reduce((acc, t) => acc + t.debito, 0) || 0,
                  )}
                </span>
              </div>
              <div className="fstat">
                <span className="fstat-label">Crédito Fiscal Acumulado:</span>
                <span className="fstat-val text-info">
                  {formatMoney(
                    data?.tendenciaMensual.reduce((acc, t) => acc + t.credito, 0) || 0,
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Cuadro Resumen de Declaración */}
          <div className="dashboard-panel panel-liquidacion">
            <div className="panel-header">
              <div>
                <h3 className="panel-title">Liquidación Fiscal del Período</h3>
                <p className="panel-subtitle">Estimación según libros oficiales de IVA</p>
              </div>
              <Link to="/control-iva/reportes" className="link-action-sm">
                Ver Libros <ArrowRight size={14} />
              </Link>
            </div>

            <div className="liquidacion-table">
              <div className="liq-row">
                <span className="liq-concept">Débito Fiscal (Ventas Contribuyentes)</span>
                <span className="liq-amount font-mono">
                  {formatMoney(data?.ventas?.debitoFiscal || 0)}
                </span>
              </div>

              <div className="liq-row">
                <span className="liq-concept">Débito Fiscal (Consumidor Final)</span>
                <span className="liq-amount font-mono">
                  {formatMoney(
                    Math.max(
                      0,
                      (data?.liquidacionEstimada?.totalDebito || 0) -
                        (data?.ventas?.debitoFiscal || 0),
                    ),
                  )}
                </span>
              </div>

              <div className="liq-row highlight-subtotal">
                <span className="liq-concept">Total Débito Fiscal Determinado</span>
                <span className="liq-amount font-mono text-primary font-bold">
                  {formatMoney(data?.liquidacionEstimada?.totalDebito || 0)}
                </span>
              </div>

              <div className="liq-row">
                <span className="liq-concept">Crédito Fiscal (Compras Locales/Imp.)</span>
                <span className="liq-amount font-mono text-info">
                  - {formatMoney(data?.liquidacionEstimada?.totalCredito || 0)}
                </span>
              </div>

              <div className="liq-divider" />

              <div className="liq-row highlight-total">
                <span className="liq-concept">
                  {(data?.liquidacionEstimada?.diferenciaIva || 0) >= 0
                    ? 'Impuesto IVA a Pagar'
                    : 'Remanente a Favor del Período'}
                </span>
                <span
                  className={`liq-amount font-mono font-bold ${
                    (data?.liquidacionEstimada?.diferenciaIva || 0) >= 0
                      ? 'text-danger'
                      : 'text-success'
                  }`}
                >
                  {(data?.liquidacionEstimada?.diferenciaIva || 0) >= 0
                    ? formatMoney(data?.liquidacionEstimada?.ivaAPagar || 0)
                    : formatMoney(data?.liquidacionEstimada?.remanenteFavor || 0)}
                </span>
              </div>

              <div className="liq-row">
                <span className="liq-concept">Pago a Cuenta ISR (1.75% Art. 151 C.T.)</span>
                <span className="liq-amount font-mono">
                  {formatMoney(data?.liquidacionEstimada?.pagoCuentaEstimado || 0)}
                </span>
              </div>

              <div className="liq-row total-fisco-box">
                <div className="fisco-title">
                  <Wallet size={16} /> Total Estimado a Declarar:
                </div>
                <div className="fisco-val">
                  {formatMoney(data?.liquidacionEstimada?.totalAPagarFisco || 0)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Accesos Rápidos */}
        <div className="dashboard-shortcuts-section">
          <h3 className="section-title">Accesos Directos del Sistema</h3>
          <div className="shortcuts-grid">
            <Link to="/control-iva/clientes" className="shortcut-card">
              <div className="shortcut-icon icon-blue">
                <Users size={22} />
              </div>
              <div className="shortcut-info">
                <div className="shortcut-title">Clientes</div>
                <div className="shortcut-desc">Catálogo de clientes y contribuyentes</div>
              </div>
              <ArrowRight size={16} className="shortcut-arrow" />
            </Link>

            <Link to="/control-iva/proveedores" className="shortcut-card">
              <div className="shortcut-icon icon-cyan">
                <Building2 size={22} />
              </div>
              <div className="shortcut-info">
                <div className="shortcut-title">Proveedores</div>
                <div className="shortcut-desc">Registro y clasificación de proveedores</div>
              </div>
              <ArrowRight size={16} className="shortcut-arrow" />
            </Link>

            <Link to="/control-iva/compras" className="shortcut-card">
              <div className="shortcut-icon icon-indigo">
                <ShoppingCart size={22} />
              </div>
              <div className="shortcut-info">
                <div className="shortcut-title">Compras IVA</div>
                <div className="shortcut-desc">Gestión y registro de compras tributarias</div>
              </div>
              <ArrowRight size={16} className="shortcut-arrow" />
            </Link>

            <Link to="/control-iva/ventas" className="shortcut-card">
              <div className="shortcut-icon icon-emerald">
                <Receipt size={22} />
              </div>
              <div className="shortcut-info">
                <div className="shortcut-title">Ventas IVA</div>
                <div className="shortcut-desc">Consumidor final y contribuyentes</div>
              </div>
              <ArrowRight size={16} className="shortcut-arrow" />
            </Link>

            <Link to="/control-iva/reportes" className="shortcut-card">
              <div className="shortcut-icon icon-amber">
                <BookOpen size={22} />
              </div>
              <div className="shortcut-info">
                <div className="shortcut-title">Libros de IVA y Anexos</div>
                <div className="shortcut-desc">Libros oficiales, liquidación y F-07</div>
              </div>
              <ArrowRight size={16} className="shortcut-arrow" />
            </Link>

            <Link to="/ventas" className="shortcut-card">
              <div className="shortcut-icon icon-violet">
                <UploadCloud size={22} />
              </div>
              <div className="shortcut-info">
                <div className="shortcut-title">Cargar Json-DTE Ventas</div>
                <div className="shortcut-desc">Procesar archivos JSON emitidos</div>
              </div>
              <ArrowRight size={16} className="shortcut-arrow" />
            </Link>

            <Link to="/compras" className="shortcut-card">
              <div className="shortcut-icon icon-rose">
                <FileSpreadsheet size={22} />
              </div>
              <div className="shortcut-info">
                <div className="shortcut-title">Cargar Json-DTE Compras</div>
                <div className="shortcut-desc">Procesar archivos JSON recibidos</div>
              </div>
              <ArrowRight size={16} className="shortcut-arrow" />
            </Link>
          </div>
        </div>

        {/* Tablas de Últimas Operaciones */}
        <div className="dashboard-tables-grid">
          {/* Últimas Ventas */}
          <div className="dashboard-panel">
            <div className="panel-header">
              <div>
                <h3 className="panel-title">Últimas Ventas Registradas</h3>
                <p className="panel-subtitle">Comprobantes recientes en ventas_iva</p>
              </div>
              <Link to="/control-iva/ventas" className="link-action-sm">
                Ver Todas <ArrowRight size={14} />
              </Link>
            </div>

            <div className="table-responsive">
              <table className="mini-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Documento</th>
                    <th>Cliente</th>
                    <th className="text-right">Total</th>
                    <th className="text-right">Débito</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.ultimasVentas && data.ultimasVentas.length > 0 ? (
                    data.ultimasVentas.map((v, i) => (
                      <tr key={i}>
                        <td className="text-xs text-muted whitespace-nowrap">{v.fecha}</td>
                        <td className="font-semibold text-xs whitespace-nowrap">
                          {v.num_control || v.documento}
                        </td>
                        <td className="truncate max-w-[180px] text-xs" title={v.nom_cliente}>
                          {v.nom_cliente}
                        </td>
                        <td className="text-right font-mono font-semibold text-xs">
                          {formatMoney(v.total)}
                        </td>
                        <td className="text-right font-mono text-xs text-primary">
                          {formatMoney(v.debito_fiscal)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="text-center py-4 text-muted">
                        No hay ventas recientes
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Últimas Compras */}
          <div className="dashboard-panel">
            <div className="panel-header">
              <div>
                <h3 className="panel-title">Últimas Compras Registradas</h3>
                <p className="panel-subtitle">Comprobantes recientes en compras_iva</p>
              </div>
              <Link to="/control-iva/compras" className="link-action-sm">
                Ver Todas <ArrowRight size={14} />
              </Link>
            </div>

            <div className="table-responsive">
              <table className="mini-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Documento</th>
                    <th>Proveedor</th>
                    <th className="text-right">Total</th>
                    <th className="text-right">Crédito</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.ultimasCompras && data.ultimasCompras.length > 0 ? (
                    data.ultimasCompras.map((c, i) => (
                      <tr key={i}>
                        <td className="text-xs text-muted whitespace-nowrap">{c.fecha}</td>
                        <td className="font-semibold text-xs whitespace-nowrap">
                          {c.num_control || c.documento}
                        </td>
                        <td className="truncate max-w-[180px] text-xs" title={c.nom_proveedor}>
                          {c.nom_proveedor}
                        </td>
                        <td className="text-right font-mono font-semibold text-xs">
                          {formatMoney(c.total)}
                        </td>
                        <td className="text-right font-mono text-xs text-info">
                          {formatMoney(c.credito_fiscal)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="text-center py-4 text-muted">
                        No hay compras recientes
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </ControlIvaLayout>
  );
}
