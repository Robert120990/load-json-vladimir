import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  ArrowRight,
  CheckCircle2,
  Copy,
  Download,
  Edit2,
  FileSpreadsheet,
  FileText,
  Filter,
  Layers,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  actualizarCuenta,
  copiarCatalogoEjercicio,
  crearCuenta,
  eliminarCuenta,
  guardarImportacionCatalogo,
  listarCuentas,
  obtenerEjerciciosCatalogo,
  obtenerTiposCuenta,
  verificarImportacionCatalogo,
} from '../../api/accounting';
import ControlIvaLayout from '../../components/layout/ControlIvaLayout';
import Modal from '../../components/ui/Modal';
import {
  AccountImportRow,
  CuentaContable,
  ImportVerificationResult,
  TipoCuenta,
} from '../../types/accounting';
import { handleEnterNavigation } from '../../utils/formNavigation';
import { matchesSearchTokens } from '../../utils/searchUtils';

export default function CatalogoCuentasPage() {
  const currentYearStr = String(new Date().getFullYear());
  const [ejercicios, setEjercicios] = useState<string[]>([]);
  const [selectedEjercicio, setSelectedEjercicio] = useState<string>(currentYearStr);
  const [cuentas, setCuentas] = useState<CuentaContable[]>([]);
  const [tiposCuenta, setTiposCuenta] = useState<TipoCuenta[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [filterNivel, setFilterNivel] = useState('');
  const [filterGDM, setFilterGDM] = useState('');

  // Modal State - Create / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formCuenta, setFormCuenta] = useState<{
    cod_cta: string;
    nom_cta: string;
    cod_tp_cta: string;
    dep_cta: string;
    nivel_cta: string;
    g_d_m: string;
    deudor: number;
    acreedor: number;
    ejercicio: string;
  }>({
    cod_cta: '',
    nom_cta: '',
    cod_tp_cta: '01',
    dep_cta: '',
    nivel_cta: '1',
    g_d_m: 'M',
    deudor: 1,
    acreedor: 0,
    ejercicio: currentYearStr,
  });

  // Modal State - Copy Catalog
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [copySourceYear, setCopySourceYear] = useState('');
  const [copyTargetYear, setCopyTargetYear] = useState('');
  const [copying, setCopying] = useState(false);

  // Modal State - Import Catalog
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importTab, setImportTab] = useState<'upload' | 'verify'>('upload');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importEjercicio, setImportEjercicio] = useState(currentYearStr);
  const [importMode, setImportMode] = useState<'ALL' | 'ONLY_NEW'>('ALL');
  const [verificationResult, setVerificationResult] = useState<ImportVerificationResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    cargarEjerciciosYTipos();
  }, []);

  useEffect(() => {
    if (selectedEjercicio) {
      cargarCuentas(selectedEjercicio);
    }
  }, [selectedEjercicio]);

  async function cargarEjerciciosYTipos() {
    try {
      const [years, tipos] = await Promise.all([
        obtenerEjerciciosCatalogo(),
        obtenerTiposCuenta(),
      ]);
      setTiposCuenta(tipos);
      if (years.length > 0) {
        setEjercicios(years);
        if (!years.includes(selectedEjercicio)) {
          setSelectedEjercicio(years[0]);
        }
      } else {
        setEjercicios([currentYearStr]);
      }
    } catch (err) {
      console.error(err);
      toast.error('Error al cargar configuración del catálogo');
    }
  }

  async function cargarCuentas(ejercicio: string) {
    setLoading(true);
    try {
      const data = await listarCuentas({ ejercicio });
      setCuentas(data);
    } catch (err) {
      console.error(err);
      toast.error('Error al cargar las cuentas contables');
    } finally {
      setLoading(false);
    }
  }

  // Auto-derivation logic for form input
  function handleCodeChange(code: string) {
    const clean = code.trim();
    const len = clean.length;

    // Auto level
    let level = '1';
    if (len === 2) level = '2';
    else if (len <= 4 && len > 2) level = '3';
    else if (len <= 6 && len > 4) level = '4';
    else if (len <= 8 && len > 6) level = '5';
    else if (len > 8) level = '6';

    // Auto parent
    let parent = '';
    if (len === 2) parent = clean.substring(0, 1);
    else if (len <= 4 && len > 2) parent = clean.substring(0, 2);
    else if (len <= 6 && len > 4) parent = clean.substring(0, 4);
    else if (len <= 8 && len > 6) parent = clean.substring(0, 6);
    else if (len > 8) parent = clean.substring(0, len - 2);

    // Auto type from first digit
    let type = formCuenta.cod_tp_cta;
    if (clean.length > 0) {
      const first = clean.charAt(0);
      type = `0${first}`.slice(-2);
    }

    // Auto nature
    const isDeudora = type === '01' || type === '04' || type === '08';
    const deudor = isDeudora ? 1 : 0;
    const acreedor = isDeudora ? 0 : 1;

    // Auto G_D_M
    const gdm = parseInt(level, 10) <= 3 ? 'M' : 'D';

    setFormCuenta((prev) => ({
      ...prev,
      cod_cta: code,
      nivel_cta: level,
      dep_cta: parent,
      cod_tp_cta: type,
      g_d_m: gdm,
      deudor,
      acreedor,
    }));
  }

  function abrirModalNueva() {
    setEditingId(null);
    setFormCuenta({
      cod_cta: '',
      nom_cta: '',
      cod_tp_cta: '01',
      dep_cta: '',
      nivel_cta: '1',
      g_d_m: 'M',
      deudor: 1,
      acreedor: 0,
      ejercicio: selectedEjercicio,
    });
    setIsModalOpen(true);
  }

  function abrirModalEditar(cta: CuentaContable) {
    if (!cta.id_cta) return;
    setEditingId(cta.id_cta);
    setFormCuenta({
      cod_cta: cta.cod_cta,
      nom_cta: cta.nom_cta,
      cod_tp_cta: cta.cod_tp_cta || '01',
      dep_cta: cta.dep_cta || '',
      nivel_cta: cta.nivel_cta || '1',
      g_d_m: cta.g_d_m || 'M',
      deudor: cta.deudor ?? 1,
      acreedor: cta.acreedor ?? 0,
      ejercicio: cta.ejercicio || selectedEjercicio,
    });
    setIsModalOpen(true);
  }

  async function handleGuardarCuenta(e: React.FormEvent) {
    e.preventDefault();
    if (!formCuenta.cod_cta.trim() || !formCuenta.nom_cta.trim()) {
      toast.error('Código y nombre de la cuenta son requeridos');
      return;
    }

    try {
      if (editingId) {
        await actualizarCuenta(editingId, formCuenta);
        toast.success('Cuenta contable actualizada correctamente');
      } else {
        await crearCuenta(formCuenta);
        toast.success('Cuenta contable creada correctamente');
      }
      setIsModalOpen(false);
      cargarCuentas(selectedEjercicio);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al guardar la cuenta');
    }
  }

  async function handleEliminarCuenta(cta: CuentaContable) {
    if (!cta.id_cta) return;
    if (!window.confirm(`¿Está seguro de eliminar la cuenta ${cta.cod_cta} - ${cta.nom_cta}?`)) {
      return;
    }

    try {
      await eliminarCuenta(cta.id_cta);
      toast.success('Cuenta eliminada con éxito');
      cargarCuentas(selectedEjercicio);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al eliminar la cuenta');
    }
  }

  async function handleCopiarCatalogo(e: React.FormEvent) {
    e.preventDefault();
    if (!copySourceYear || !copyTargetYear) {
      toast.error('Seleccione el año de origen y el año de destino');
      return;
    }
    if (copySourceYear === copyTargetYear) {
      toast.error('El año de origen y destino deben ser diferentes');
      return;
    }

    setCopying(true);
    try {
      const res = await copiarCatalogoEjercicio(copySourceYear, copyTargetYear);
      toast.success(res.message);
      setIsCopyModalOpen(false);
      await cargarEjerciciosYTipos();
      setSelectedEjercicio(copyTargetYear);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al copiar catálogo');
    } finally {
      setCopying(false);
    }
  }

  // --- IMPORT CSV LOGIC & VERIFICATION ---

  function parseCSV(text: string): AccountImportRow[] {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) return [];

    const rows: AccountImportRow[] = [];
    // Check if line 0 is header
    const firstLine = lines[0].toLowerCase();
    const startIndex = firstLine.includes('cod') || firstLine.includes('cuenta') || firstLine.includes('nombre') ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      // Support comma or semicolon delimiter
      const delimiter = line.includes(';') ? ';' : ',';
      const parts = line.split(delimiter).map((p) => p.trim().replace(/^["']|["']$/g, ''));

      if (parts.length >= 2) {
        const cod = parts[0];
        const nom = parts[1];
        if (cod && nom) {
          rows.push({
            cod_cta: cod,
            nom_cta: nom,
            dep_cta: parts[2] || undefined,
            nivel_cta: parts[3] || undefined,
            g_d_m: parts[4] || undefined,
            cod_tp_cta: parts[5] || undefined,
          });
        }
      }
    }
    return rows;
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
      setVerificationResult(null);
    }
  }

  async function handleVerificarArchivo() {
    if (!importFile) {
      toast.error('Seleccione un archivo CSV para importar');
      return;
    }

    setVerifying(true);
    try {
      const content = await importFile.text();
      const parsedRows = parseCSV(content);

      if (parsedRows.length === 0) {
        toast.error('El archivo no contiene filas válidas para procesar');
        setVerifying(false);
        return;
      }

      const result = await verificarImportacionCatalogo(parsedRows, importEjercicio);
      setVerificationResult(result);
      setImportTab('verify');
      toast.success(`Archivo analizado: ${result.totalRows} cuentas verificadas`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al procesar el archivo');
    } finally {
      setVerifying(false);
    }
  }

  async function handleGuardarImportacion() {
    if (!verificationResult || verificationResult.rows.length === 0) {
      toast.error('No hay datos verificados para importar');
      return;
    }

    setImporting(true);
    try {
      const res = await guardarImportacionCatalogo(verificationResult.rows, importEjercicio, importMode);
      toast.success(res.message);
      setIsImportModalOpen(false);
      setVerificationResult(null);
      setImportFile(null);
      await cargarEjerciciosYTipos();
      setSelectedEjercicio(importEjercicio);
      cargarCuentas(importEjercicio);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al guardar la importación');
    } finally {
      setImporting(false);
    }
  }

  function descargarPlantillaCSV() {
    const csvContent =
      'codigo,nombre,cuenta_padre,nivel,clasificacion,tipo_cuenta\n' +
      '1,ACTIVO,,1,M,01\n' +
      '11,ACTIVO CORRIENTE,1,2,M,01\n' +
      '1101,EFECTIVO Y EQUIVALENTES DE EFECTIVO,11,3,M,01\n' +
      '110101,Caja General,1101,4,D,01\n' +
      '110102,Bancos Nacionales,1101,4,D,01\n' +
      '2,PASIVO,,1,M,02\n' +
      '21,PASIVO CORRIENTE,2,2,M,02\n' +
      '2101,CUENTAS POR PAGAR,21,3,M,02\n' +
      '210101,Proveedores Locales,2101,4,D,02\n' +
      '3,PATRIMONIO,,1,M,03\n' +
      '31,CAPITAL SOCIAL,3,2,M,03\n' +
      '4,COSTOS Y GASTOS,,1,M,04\n' +
      '41,GASTOS DE OPERACION,4,2,M,04\n' +
      '4101,GASTOS DE ADMINISTRACION,41,3,M,04\n' +
      '410101,Sueldos y Salarios,4101,4,D,04\n' +
      '5,INGRESOS,,1,M,05\n' +
      '51,INGRESOS DE OPERACION,5,2,M,05\n' +
      '5101,VENTAS,51,3,M,05\n' +
      '510101,Ventas al por mayor,5101,4,D,05\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `plantilla_catalogo_cuentas.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Filtered Cuentas
  const filteredCuentas = useMemo(() => {
    return cuentas.filter((c) => {
      const matchSearch = matchesSearchTokens([c.cod_cta, c.nom_cta], searchTerm);
      const matchTipo = filterTipo === '' || c.cod_tp_cta === filterTipo;
      const matchNivel = filterNivel === '' || c.nivel_cta === filterNivel;
      const matchGDM = filterGDM === '' || c.g_d_m === filterGDM;

      return matchSearch && matchTipo && matchNivel && matchGDM;
    });
  }, [cuentas, searchTerm, filterTipo, filterNivel, filterGDM]);

  // Statistics
  const stats = useMemo(() => {
    const total = cuentas.length;
    const mayor = cuentas.filter((c) => c.g_d_m === 'M' || c.g_d_m === 'G').length;
    const detalle = cuentas.filter((c) => c.g_d_m === 'D').length;
    const deudoras = cuentas.filter((c) => c.deudor === 1).length;
    const acreedoras = cuentas.filter((c) => c.acreedor === 1).length;
    return { total, mayor, detalle, deudoras, acreedoras };
  }, [cuentas]);

  return (
    <ControlIvaLayout>
      <div className="catalogo-page">
        {/* Top Header & Actions */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Catálogo de Cuentas</h1>
          <p className="page-subtitle">
            Estructura contable oficial, jerarquías y cuentas imputables por ejercicio fiscal
          </p>
        </div>
        <div className="header-actions">
          {/* Year selector */}
          <div className="ejercicio-selector-wrap">
            <span className="ejercicio-label">Ejercicio:</span>
            <select
              className="ejercicio-select font-bold"
              value={selectedEjercicio}
              onChange={(e) => setSelectedEjercicio(e.target.value)}
            >
              {ejercicios.map((yr) => (
                <option key={yr} value={yr}>
                  Año {yr}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="btn-secundario"
            onClick={() => {
              setCopySourceYear(selectedEjercicio);
              setCopyTargetYear(String(Number(selectedEjercicio) + 1));
              setIsCopyModalOpen(true);
            }}
            title="Copiar catálogo a un nuevo año"
          >
            <Copy size={16} />
            <span>Copiar Ejercicio</span>
          </button>

          <button
            type="button"
            className="btn-secundario"
            onClick={() => {
              setImportTab('upload');
              setImportFile(null);
              setVerificationResult(null);
              setImportEjercicio(selectedEjercicio);
              setIsImportModalOpen(true);
            }}
            title="Importar catálogo desde archivo CSV con previsualización"
          >
            <Upload size={16} />
            <span>Importar Catálogo</span>
          </button>

          <button
            type="button"
            className="btn-primario"
            onClick={abrirModalNueva}
          >
            <Plus size={18} />
            <span>Nueva Cuenta</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="catalogo-stats-grid">
        <div className="catalogo-stat-card">
          <div className="stat-label">Total Cuentas</div>
          <div className="stat-val text-primary">{stats.total}</div>
          <div className="stat-desc">En ejercicio {selectedEjercicio}</div>
        </div>
        <div className="catalogo-stat-card">
          <div className="stat-label">Cuentas de Mayor</div>
          <div className="stat-val text-amber">{stats.mayor}</div>
          <div className="stat-desc">Agrupadoras (M)</div>
        </div>
        <div className="catalogo-stat-card">
          <div className="stat-label">Cuentas de Detalle</div>
          <div className="stat-val text-emerald">{stats.detalle}</div>
          <div className="stat-desc">Imputables en Partidas (D)</div>
        </div>
        <div className="catalogo-stat-card">
          <div className="stat-label">Naturaleza Deudora</div>
          <div className="stat-val">{stats.deudoras}</div>
          <div className="stat-desc">Activos / Gastos</div>
        </div>
        <div className="catalogo-stat-card">
          <div className="stat-label">Naturaleza Acreedora</div>
          <div className="stat-val">{stats.acreedoras}</div>
          <div className="stat-desc">Pasivo / Patrimonio / Ingresos</div>
        </div>
      </div>

      {/* Accounts Card with Topbar and Table */}
      <div className="card">
        <div className="datatable-topbar" style={{ flexWrap: 'wrap', gap: '10px' }}>
          <div className="datatable-search">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              className="input-busqueda"
              placeholder="Buscar por código o nombre de cuenta..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => setSearchTerm('')}
              >
                ×
              </button>
            )}
          </div>

          <div className="datatable-controls" style={{ flexWrap: 'wrap', gap: '8px' }}>
            <div className="filter-item">
              <Filter size={15} className="filter-icon" />
              <select
                className="filter-select"
                value={filterTipo}
                onChange={(e) => setFilterTipo(e.target.value)}
              >
                <option value="">Todos los Tipos</option>
                {tiposCuenta.map((t) => (
                  <option key={t.cod_tp_cta} value={t.cod_tp_cta}>
                    {t.cod_tp_cta} - {t.nom_cta}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-item">
              <Layers size={15} className="filter-icon" />
              <select
                className="filter-select"
                value={filterNivel}
                onChange={(e) => setFilterNivel(e.target.value)}
              >
                <option value="">Todos los Niveles</option>
                <option value="1">Nivel 1 (Rubro)</option>
                <option value="2">Nivel 2 (Grupo)</option>
                <option value="3">Nivel 3 (Mayor)</option>
                <option value="4">Nivel 4 (Subcuenta)</option>
                <option value="5">Nivel 5 (Auxiliar)</option>
                <option value="6">Nivel 6 (Detalle)</option>
              </select>
            </div>

            <div className="filter-item">
              <select
                className="filter-select"
                value={filterGDM}
                onChange={(e) => setFilterGDM(e.target.value)}
              >
                <option value="">Mayor y Detalle</option>
                <option value="M">Solo Mayor (M)</option>
                <option value="D">Solo Detalle / Imputables (D)</option>
              </select>
            </div>

            <button
              type="button"
              className="btn-secundario btn-sm"
              onClick={() => cargarCuentas(selectedEjercicio)}
              title="Recargar catálogo"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        <div className="tabla-contenedor">
          <table className="tabla-registros">
            <thead>
              <tr>
                <th style={{ width: '160px' }}>Código</th>
                <th>Nombre de la Cuenta</th>
                <th style={{ width: '110px', textAlign: 'center' }}>Nivel</th>
                <th style={{ width: '110px', textAlign: 'center' }}>Padre</th>
                <th style={{ width: '130px', textAlign: 'center' }}>Clasificación</th>
                <th style={{ width: '120px', textAlign: 'center' }}>Naturaleza</th>
                <th className="text-center th-acciones">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="td-cargando">
                    <div className="spinner-wrapper">
                      <div className="spinner"></div>
                      <span>Cargando catálogo contable…</span>
                    </div>
                  </td>
                </tr>
              ) : filteredCuentas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="td-vacio">
                    No se encontraron cuentas contables con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredCuentas.map((cta) => {
                  const nivelNum = parseInt(cta.nivel_cta || '1', 10);
                  const isMayor = cta.g_d_m === 'M' || cta.g_d_m === 'G' || nivelNum <= 3;
                  const indentPx = Math.max(0, (nivelNum - 1) * 16);

                  return (
                    <tr
                      key={cta.id_cta || cta.cod_cta}
                      className={isMayor ? 'row-cuenta-mayor' : 'row-cuenta-detalle'}
                    >
                      <td>
                        <span
                          className={`badge-code font-mono ${
                            isMayor ? 'font-bold text-primary' : 'text-slate-800'
                          }`}
                        >
                          {cta.cod_cta}
                        </span>
                      </td>
                      <td>
                        <div style={{ paddingLeft: `${indentPx}px` }}>
                          <span
                            className={
                              isMayor
                                ? 'font-bold text-slate-900 tracking-wide'
                                : 'text-slate-700'
                            }
                          >
                            {cta.nom_cta}
                          </span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge-nivel badge-nivel-${cta.nivel_cta || '1'}`}>
                          Nivel {cta.nivel_cta || '1'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="text-muted font-mono text-xs">
                          {cta.dep_cta || '—'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span
                          className={`badge-gdm ${
                            cta.g_d_m === 'D' ? 'badge-gdm-detalle' : 'badge-gdm-mayor'
                          }`}
                        >
                          {cta.g_d_m === 'D' ? 'Detalle (D)' : 'Mayor (M)'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {cta.deudor === 1 ? (
                          <span className="badge-nature badge-deudor" title="Saldo Deudor">
                            Deudora
                          </span>
                        ) : (
                          <span className="badge-nature badge-acreedor" title="Saldo Acreedor">
                            Acreedora
                          </span>
                        )}
                      </td>
                      <td className="text-center td-acciones">
                        <div className="table-row-actions">
                          <button
                            type="button"
                            className="btn-action-edit"
                            onClick={() => abrirModalEditar(cta)}
                            title="Editar cuenta"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            type="button"
                            className="btn-action-delete"
                            onClick={() => handleEliminarCuenta(cta)}
                            title="Eliminar cuenta"
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

      {/* MODAL: Create / Edit Account */}
      {isModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsModalOpen(false)}
          title={editingId ? 'Editar Cuenta Contable' : 'Nueva Cuenta Contable'}
          maxWidth="xl"
        >
          <form onSubmit={handleGuardarCuenta} onKeyDown={handleEnterNavigation} className="form-symmetrical">
            <div className="form-grid-symmetrical cols-2">
              <div className="form-group">
                <label className="form-label">Código de Cuenta *</label>
                <input
                  type="text"
                  className="form-input font-mono font-bold"
                  placeholder="Ej: 110101"
                  value={formCuenta.cod_cta}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  required
                  autoFocus
                />
                <span className="text-muted text-xs">
                  Al ingresar el código se autocalculan el nivel, cuenta padre y naturaleza.
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Ejercicio / Año *</label>
                <input
                  type="text"
                  className="form-input input-readonly font-bold"
                  value={formCuenta.ejercicio}
                  disabled
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Nombre de la Cuenta *</label>
              <input
                type="text"
                className="form-input input-uppercase"
                placeholder="Ej: CAJA GENERAL O BANCOS LOCALES"
                value={formCuenta.nom_cta}
                onChange={(e) => setFormCuenta({ ...formCuenta, nom_cta: e.target.value.toUpperCase() })}
                required
              />
            </div>

            <div className="form-grid-symmetrical cols-3">
              <div className="form-group">
                <label className="form-label">Tipo de Cuenta (Auto)</label>
                <select
                  className="form-input"
                  value={formCuenta.cod_tp_cta}
                  onChange={(e) => {
                    const val = e.target.value;
                    const isDeudora = val === '01' || val === '04' || val === '08';
                    setFormCuenta({
                      ...formCuenta,
                      cod_tp_cta: val,
                      deudor: isDeudora ? 1 : 0,
                      acreedor: isDeudora ? 0 : 1,
                    });
                  }}
                >
                  {tiposCuenta.map((t) => (
                    <option key={t.cod_tp_cta} value={t.cod_tp_cta}>
                      {t.cod_tp_cta} - {t.nom_cta}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Cuenta Padre (Auto)</label>
                <input
                  type="text"
                  className="form-input font-mono"
                  placeholder="Ej: 1101"
                  value={formCuenta.dep_cta}
                  onChange={(e) => setFormCuenta({ ...formCuenta, dep_cta: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Nivel (Auto)</label>
                <select
                  className="form-input"
                  value={formCuenta.nivel_cta}
                  onChange={(e) => setFormCuenta({ ...formCuenta, nivel_cta: e.target.value })}
                >
                  <option value="1">1 (Rubro)</option>
                  <option value="2">2 (Grupo)</option>
                  <option value="3">3 (Mayor)</option>
                  <option value="4">4 (Subcuenta)</option>
                  <option value="5">5 (Auxiliar)</option>
                  <option value="6">6 (Detalle)</option>
                </select>
              </div>
            </div>

            <div className="form-grid-symmetrical cols-2">
              <div className="form-group">
                <label className="form-label">Clasificación Contable</label>
                <div className="radio-group-horizontal">
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="gdm"
                      checked={formCuenta.g_d_m === 'M'}
                      onChange={() => setFormCuenta({ ...formCuenta, g_d_m: 'M' })}
                    />
                    <span>Mayor (M)</span>
                  </label>
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="gdm"
                      checked={formCuenta.g_d_m === 'D'}
                      onChange={() => setFormCuenta({ ...formCuenta, g_d_m: 'D' })}
                    />
                    <span>Detalle / Imputable (D)</span>
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Naturaleza de Saldo</label>
                <div className="radio-group-horizontal">
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="nature"
                      checked={formCuenta.deudor === 1}
                      onChange={() => setFormCuenta({ ...formCuenta, deudor: 1, acreedor: 0 })}
                    />
                    <span>Deudora</span>
                  </label>
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="nature"
                      checked={formCuenta.acreedor === 1}
                      onChange={() => setFormCuenta({ ...formCuenta, deudor: 0, acreedor: 1 })}
                    />
                    <span>Acreedora</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn-secundario"
                onClick={() => setIsModalOpen(false)}
              >
                Cancelar
              </button>
              <button type="submit" className="btn-primario">
                {editingId ? 'Guardar Cambios' : 'Crear Cuenta'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: Copy Catalog between years */}
      {isCopyModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsCopyModalOpen(false)}
          title="Copiar Catálogo a Nuevo Ejercicio"
          maxWidth="md"
        >
          <form onSubmit={handleCopiarCatalogo} onKeyDown={handleEnterNavigation} className="form-symmetrical">
            <p className="text-sm text-slate-600 mb-2">
              Esta herramienta duplicará todas las cuentas contables del año de origen hacia el nuevo año fiscal especificado.
            </p>

            <div className="form-group">
              <label className="form-label">Año de Origen *</label>
              <select
                className="form-input font-bold"
                value={copySourceYear}
                onChange={(e) => setCopySourceYear(e.target.value)}
                required
              >
                {ejercicios.map((yr) => (
                  <option key={yr} value={yr}>
                    Año {yr} ({cuentas.length} cuentas)
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Año de Destino *</label>
              <input
                type="number"
                min="2000"
                max="2100"
                className="form-input font-bold"
                placeholder="Ej. 2027"
                value={copyTargetYear}
                onChange={(e) => setCopyTargetYear(e.target.value)}
                required
              />
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn-secundario"
                onClick={() => setIsCopyModalOpen(false)}
                disabled={copying}
              >
                Cancelar
              </button>
              <button type="submit" className="btn-primario" disabled={copying}>
                {copying ? 'Copiando...' : 'Copiar Catálogo'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: Import Catalog with Instructions & Pre-Save Verification Screen */}
      {isImportModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsImportModalOpen(false)}
          title="Importación Masiva de Catálogo Contable"
          maxWidth="4xl"
        >
          {/* Stepper Tabs */}
          <div className="import-stepper-bar mb-4">
            <button
              type="button"
              className={`stepper-step ${importTab === 'upload' ? 'active' : ''}`}
              onClick={() => setImportTab('upload')}
            >
              <span className="step-num">1</span>
              <span>Formato y Carga de Archivo</span>
            </button>
            <div className="step-arrow">
              <ArrowRight size={16} />
            </div>
            <button
              type="button"
              className={`stepper-step ${importTab === 'verify' ? 'active' : ''}`}
              onClick={() => {
                if (verificationResult) setImportTab('verify');
              }}
              disabled={!verificationResult}
            >
              <span className="step-num">2</span>
              <span>Pantalla de Verificación Previa</span>
            </button>
          </div>

          <div>
            {importTab === 'upload' ? (
              <div className="import-upload-container">
                {/* Format Guidelines Card */}
                <div className="format-guide-card">
                  <div className="format-guide-header">
                    <FileText size={20} className="text-primary" />
                    <h4 className="format-guide-title">Estructura del Formato Adecuado (CSV / Excel)</h4>
                  </div>
                  <p className="text-xs text-slate-600 mb-3">
                    El archivo CSV debe contener encabezados en la primera fila con las siguientes columnas recomendadas:
                  </p>

                  <div className="format-columns-table">
                    <div className="col-spec-item">
                      <span className="col-name font-mono">cod_cta</span>
                      <span className="col-req">Obligatorio</span>
                      <span className="col-desc">Código contable único (Ej. 1101, 110101, 21010101).</span>
                    </div>
                    <div className="col-spec-item">
                      <span className="col-name font-mono">nom_cta</span>
                      <span className="col-req">Obligatorio</span>
                      <span className="col-desc">Nombre descriptivo de la cuenta contable.</span>
                    </div>
                    <div className="col-spec-item">
                      <span className="col-name font-mono">nivel_cta</span>
                      <span className="col-opt">Opcional</span>
                      <span className="col-desc">Nivel jerárquico 1 a 6 (Si se omite, se autocalcula por longitud).</span>
                    </div>
                    <div className="col-spec-item">
                      <span className="col-name font-mono">dep_cta</span>
                      <span className="col-opt">Opcional</span>
                      <span className="col-desc">Código de la cuenta padre (Si se omite, se autocalcula).</span>
                    </div>
                    <div className="col-spec-item">
                      <span className="col-name font-mono">g_d_m</span>
                      <span className="col-opt">Opcional</span>
                      <span className="col-desc">Mayor (M) o Detalle (D) (Si se omite, se asigna según longitud).</span>
                    </div>
                    <div className="col-spec-item">
                      <span className="col-name font-mono">deudor / acreedor</span>
                      <span className="col-opt">Opcional</span>
                      <span className="col-desc">Naturaleza 1/0 (Si se omite, se asigna por el tipo de cuenta).</span>
                    </div>
                  </div>

                  <div className="download-template-row">
                    <button
                      type="button"
                      className="btn-secundario btn-sm btn-icon-gap"
                      onClick={descargarPlantillaCSV}
                    >
                      <Download size={15} />
                      <span>Descargar Plantilla de Ejemplo (CSV)</span>
                    </button>
                  </div>
                </div>

                {/* Import Target Year */}
                <div className="import-settings-grid">
                  <div className="form-group">
                    <label className="form-label">Ejercicio Fiscal Destino *</label>
                    <select
                      className="form-input font-bold"
                      value={importEjercicio}
                      onChange={(e) => setImportEjercicio(e.target.value)}
                    >
                      {ejercicios.map((yr) => (
                        <option key={yr} value={yr}>
                          Año {yr}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Archivo Seleccionado</label>
                    <div className="selected-file-pill">
                      {importFile ? (
                        <>
                          <FileSpreadsheet size={16} className="text-emerald" />
                          <span className="font-semibold text-slate-800">{importFile.name}</span>
                          <span className="text-xs text-muted">
                            ({(importFile.size / 1024).toFixed(1)} KB)
                          </span>
                        </>
                      ) : (
                        <span className="text-muted text-xs">Ningún archivo seleccionado todavía</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Drag and Drop Zone */}
                <div className="file-dropzone">
                  <Upload size={32} className="text-primary mb-2" />
                  <div className="dropzone-text">
                    Arrastra aquí tu archivo CSV o haz clic para seleccionarlo
                  </div>
                  <div className="dropzone-sub">Formato .CSV delimitado por comas o punto y coma</div>
                  <input
                    type="file"
                    accept=".csv,text/csv,application/vnd.ms-excel"
                    className="dropzone-input"
                    onChange={handleFileSelected}
                  />
                </div>
              </div>
            ) : (
              /* TAB 2: Verification Preview Screen */
              <div className="verification-preview-container">
                {verificationResult && (
                  <>
                    <div className="verify-summary-bar">
                      <div className="verify-stat-item">
                        <span className="verify-stat-lbl">Total Leídas:</span>
                        <span className="verify-stat-num">{verificationResult.totalRows}</span>
                      </div>
                      <div className="verify-stat-item text-emerald">
                        <span className="verify-stat-lbl">Nuevas a Insertar:</span>
                        <span className="verify-stat-num text-emerald">
                          {verificationResult.newAccounts}
                        </span>
                      </div>
                      <div className="verify-stat-item text-amber">
                        <span className="verify-stat-lbl">Existentes a Actualizar:</span>
                        <span className="verify-stat-num text-amber">
                          {verificationResult.existingAccounts}
                        </span>
                      </div>
                      {verificationResult.invalidAccounts > 0 && (
                        <div className="verify-stat-item text-danger">
                          <span className="verify-stat-lbl">Con Error / Inválidas:</span>
                          <span className="verify-stat-num text-danger">
                            {verificationResult.invalidAccounts}
                          </span>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '12px 0 16px 0', padding: '10px 16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155' }}>Modo de Importación:</span>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer', color: '#1e293b' }}>
                        <input
                          type="radio"
                          name="importModeRadio"
                          checked={importMode === 'ALL'}
                          onChange={() => setImportMode('ALL')}
                          style={{ accentColor: '#2563eb' }}
                        />
                        Insertar nuevas y actualizar existentes
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer', color: '#1e293b' }}>
                        <input
                          type="radio"
                          name="importModeRadio"
                          checked={importMode === 'ONLY_NEW'}
                          onChange={() => setImportMode('ONLY_NEW')}
                          style={{ accentColor: '#2563eb' }}
                        />
                        Solo insertar nuevas cuentas
                      </label>
                    </div>

                    {/* Verification Table */}
                    <div className="tabla-contenedor verify-table-wrap">
                      <table className="tabla-registros">
                        <thead>
                          <tr>
                            <th style={{ width: '110px' }}>Estado</th>
                            <th style={{ width: '140px' }}>Código</th>
                            <th>Nombre de Cuenta</th>
                            <th style={{ width: '90px', textAlign: 'center' }}>Nivel</th>
                            <th style={{ width: '90px', textAlign: 'center' }}>Padre</th>
                            <th style={{ width: '90px', textAlign: 'center' }}>Clasif.</th>
                            <th style={{ width: '110px', textAlign: 'center' }}>Naturaleza</th>
                            <th>Detalle Validación</th>
                          </tr>
                        </thead>
                        <tbody>
                          {verificationResult.rows.map((row, idx) => (
                            <tr
                              key={idx}
                              className={
                                row.status === 'INVALID'
                                  ? 'row-invalid'
                                  : row.status === 'UPDATE'
                                  ? 'row-update'
                                  : 'row-new'
                              }
                            >
                              <td>
                                {row.status === 'NEW' && (
                                  <span className="badge-status-pill badge-pill-new">
                                    Nueva
                                  </span>
                                )}
                                {row.status === 'UPDATE' && (
                                  <span className="badge-status-pill badge-pill-update">
                                    Existente
                                  </span>
                                )}
                                {row.status === 'INVALID' && (
                                  <span className="badge-status-pill badge-pill-invalid">
                                    Error
                                  </span>
                                )}
                              </td>
                              <td>
                                <span className="font-mono font-bold text-primary">
                                  {row.cod_cta}
                                </span>
                              </td>
                              <td>{row.nom_cta}</td>
                              <td style={{ textAlign: 'center' }}>
                                <span className="badge-nivel">Nivel {row.nivel_cta || '—'}</span>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <span className="font-mono text-xs text-muted">
                                  {row.dep_cta || '—'}
                                </span>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <span
                                  className={`badge-gdm ${
                                    row.g_d_m === 'D' ? 'badge-gdm-detalle' : 'badge-gdm-mayor'
                                  }`}
                                >
                                  {row.g_d_m || 'M'}
                                </span>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <span
                                  className={`badge-nature ${
                                    row.deudor === 1 ? 'badge-deudor' : 'badge-acreedor'
                                  }`}
                                >
                                  {row.deudor === 1 ? 'Deudora' : 'Acreedora'}
                                </span>
                              </td>
                              <td>
                                <span
                                  className={`text-xs ${
                                    row.status === 'INVALID'
                                      ? 'text-danger font-medium'
                                      : 'text-slate-600'
                                  }`}
                                >
                                  {row.message}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="modal-actions">
            {importTab === 'upload' ? (
              <>
                <button
                  type="button"
                  className="btn-secundario"
                  onClick={() => setIsImportModalOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn-primario btn-icon-gap"
                  onClick={handleVerificarArchivo}
                  disabled={!importFile || verifying}
                >
                  {verifying ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>Analizando archivo...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      <span>Verificar Archivo</span>
                    </>
                  )}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="btn-secundario"
                  onClick={() => setImportTab('upload')}
                  disabled={importing}
                >
                  Volver a Cargar
                </button>
                <button
                  type="button"
                  className="btn-primario btn-icon-gap"
                  onClick={handleGuardarImportacion}
                  disabled={importing || !verificationResult || verificationResult.totalRows === 0}
                >
                  {importing ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>Guardando en BD...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      <span>Confirmar e Importar ({verificationResult?.totalRows} Cuentas)</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </Modal>
      )}
      </div>
    </ControlIvaLayout>
  );
}
