import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  AlertCircle,
  Calendar,
  CalendarPlus,
  CheckCircle2,
  Info,
  Layers,
  RefreshCw,
  RotateCw,
  Save,
} from 'lucide-react';
import {
  guardarCorrelativosContables,
  inicializarAnoCorrelativos,
  obtenerCorrelativosContables,
  reenumerarPartidas,
} from '../../api/accounting';
import ControlIvaLayout from '../../components/layout/ControlIvaLayout';
import Modal from '../../components/ui/Modal';
import type { CorrelativoContabilidad, ReenumerarParams, ReenumerarResponse } from '../../types/accounting';

const MONTH_KEYS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'] as const;
const MONTH_NAMES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];
const FULL_MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export default function CorrelativosContablesPage() {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState<number[]>([new Date().getFullYear()]);
  const [correlativos, setCorrelativos] = useState<CorrelativoContabilidad[]>([]);
  const [originalCorrelativos, setOriginalCorrelativos] = useState<CorrelativoContabilidad[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modal: Reenumerar
  const [isReenumerarOpen, setIsReenumerarOpen] = useState(false);
  const [reenumerarForm, setReenumerarForm] = useState<ReenumerarParams>({
    ano: new Date().getFullYear(),
    mes: 'ALL',
    cod_tp_partida: 'ALL',
    criterio: 'FECHA',
    numeroInicial: 1,
    actualizarTablaCorrelativos: true,
  });
  const [reenumerarLoading, setReenumerarLoading] = useState(false);
  const [reenumerarResult, setReenumerarResult] = useState<ReenumerarResponse | null>(null);

  // Modal: Inicializar Año
  const [isInitYearOpen, setIsInitYearOpen] = useState(false);
  const [newYearInput, setNewYearInput] = useState<number>(new Date().getFullYear() + 1);
  const [initYearLoading, setInitYearLoading] = useState(false);

  // Modal: Confirmación Reenumerar
  const [isConfirmReenumerarOpen, setIsConfirmReenumerarOpen] = useState(false);

  useEffect(() => {
    cargarCorrelativos(selectedYear);
  }, [selectedYear]);

  async function cargarCorrelativos(ano: number) {
    setLoading(true);
    try {
      const data = await obtenerCorrelativosContables(ano);
      setCorrelativos(data.correlativos);
      setOriginalCorrelativos(JSON.parse(JSON.stringify(data.correlativos)));
      setAvailableYears(data.availableYears);
    } catch (error: any) {
      console.error('Error cargando correlativos:', error);
      toast.error(error.response?.data?.error || 'Error al cargar los correlativos contables');
    } finally {
      setLoading(false);
    }
  }

  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(correlativos) !== JSON.stringify(originalCorrelativos);
  }, [correlativos, originalCorrelativos]);

  function handleCellChange(cod_tp_partida: string, field: typeof MONTH_KEYS[number] | 'unico', value: string) {
    const numericValue = parseInt(value, 10);
    const validVal = isNaN(numericValue) || numericValue < 0 ? 0 : numericValue;

    setCorrelativos((prev) =>
      prev.map((row) => {
        if (row.cod_tp_partida === cod_tp_partida) {
          return {
            ...row,
            [field]: validVal,
          };
        }
        return row;
      })
    );
  }

  async function handleGuardarCambios() {
    setSaving(true);
    try {
      const res = await guardarCorrelativosContables({
        ano: selectedYear,
        rows: correlativos,
      });
      toast.success(res.message || 'Correlativos guardados correctamente');
      setOriginalCorrelativos(JSON.parse(JSON.stringify(correlativos)));
    } catch (error: any) {
      console.error('Error guardando correlativos:', error);
      toast.error(error.response?.data?.error || 'Error al guardar correlativos contables');
    } finally {
      setSaving(false);
    }
  }

  async function handleInicializarAno() {
    if (!newYearInput || newYearInput < 2000 || newYearInput > 2100) {
      toast.error('Por favor ingresa un año válido');
      return;
    }

    setInitYearLoading(true);
    try {
      const res = await inicializarAnoCorrelativos(newYearInput);
      toast.success(res.message || `Año ${newYearInput} inicializado`);
      setIsInitYearOpen(false);
      setSelectedYear(newYearInput);
    } catch (error: any) {
      console.error('Error inicializando año:', error);
      toast.error(error.response?.data?.error || 'Error al inicializar el año');
    } finally {
      setInitYearLoading(false);
    }
  }

  function handleOpenReenumerar() {
    setReenumerarForm({
      ano: selectedYear,
      mes: 'ALL',
      cod_tp_partida: 'ALL',
      criterio: 'FECHA',
      numeroInicial: 1,
      actualizarTablaCorrelativos: true,
    });
    setReenumerarResult(null);
    setIsReenumerarOpen(true);
  }

  function handleConfirmReenumerar() {
    setIsConfirmReenumerarOpen(true);
  }

  async function handleExecuteReenumerar() {
    setIsConfirmReenumerarOpen(false);
    setReenumerarLoading(true);
    try {
      const res = await reenumerarPartidas(reenumerarForm);
      setReenumerarResult(res);
      toast.success(res.message || 'Reenumeración completada con éxito');
      await cargarCorrelativos(selectedYear);
    } catch (error: any) {
      console.error('Error reenumerando partidas:', error);
      toast.error(error.response?.data?.error || 'Error al reenumerar las partidas contables');
    } finally {
      setReenumerarLoading(false);
    }
  }

  return (
    <ControlIvaLayout>
      <div className="correlativos-page animate-fade-in pb-16">
        {/* Top Header & Actions */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Correlativos Contables</h1>
            <p className="page-subtitle">
              Control de correlativos mensuales por tipo de partida y reenumeración secuencial de asientos
            </p>
          </div>

          <div className="header-actions">
            <button
              type="button"
              onClick={() => {
                setNewYearInput(selectedYear + 1);
                setIsInitYearOpen(true);
              }}
              className="btn-secundario btn-icon-gap"
              title="Crear correlativos para un nuevo ejercicio fiscal"
            >
              <CalendarPlus size={16} />
              <span>Inicializar Año</span>
            </button>

            <button
              type="button"
              onClick={handleOpenReenumerar}
              className="btn-secundario btn-icon-gap bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200"
              title="Reorganizar números correlativos de partidas"
            >
              <RotateCw size={16} className="text-amber-700" />
              <span>Reenumerar Partidas</span>
            </button>

            <button
              type="button"
              onClick={handleGuardarCambios}
              disabled={!hasUnsavedChanges || saving}
              className={`btn-primario btn-icon-gap ${
                hasUnsavedChanges
                  ? 'bg-blue-600 hover:bg-blue-700 ring-2 ring-blue-400 ring-offset-1'
                  : 'opacity-50 cursor-not-allowed'
              }`}
            >
              <Save size={16} />
              <span>{saving ? 'Guardando...' : 'Guardar Cambios'}</span>
            </button>
          </div>
        </div>

        {/* Dedicated Clean Year Selector Bar with Informative Changes Notice */}
        <div
          className="card"
          style={{
            padding: '10px 18px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={18} className="text-blue-600" />
              <span
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: '#475569',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Año Fiscal:
              </span>
            </div>
            <select
              value={selectedYear}
              onChange={(e) => {
                const ano = parseInt(e.target.value, 10);
                if (hasUnsavedChanges) {
                  if (window.confirm('Tienes cambios sin guardar. ¿Deseas descartarlos para cambiar de año?')) {
                    setSelectedYear(ano);
                  }
                } else {
                  setSelectedYear(ano);
                }
              }}
              style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '6px 14px',
                fontSize: '0.92rem',
                fontWeight: 700,
                color: '#0f172a',
                cursor: 'pointer',
                minWidth: '120px',
                outline: 'none',
              }}
            >
              {availableYears.map((ano) => (
                <option key={ano} value={ano}>
                  {ano}
                </option>
              ))}
            </select>
          </div>

          {/* Purely informative notice when changes exist (without duplicate buttons) */}
          {hasUnsavedChanges && (
            <div
              className="animate-fade-in"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: '#fffbeb',
                border: '1px solid #fde68a',
                color: '#92400e',
                fontSize: '0.78rem',
                fontWeight: 600,
                padding: '5px 12px',
                borderRadius: '6px',
              }}
            >
              <Info size={15} className="text-amber-600 shrink-0" />
              <span>Modificaciones pendientes de guardar en el ejercicio {selectedYear}</span>
            </div>
          )}
        </div>

        {/* Tabla de Correlativos (Compacta y Fija) */}
        <div className="tabla-correlativos-card">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
              <RefreshCw size={32} className="animate-spin text-blue-600" />
              <p className="text-sm font-medium">Cargando correlativos del ejercicio {selectedYear}...</p>
            </div>
          ) : correlativos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
              <Layers size={36} className="text-slate-300" />
              <p className="text-sm font-semibold text-slate-600">No se encontraron correlativos</p>
              <p className="text-xs text-slate-400">
                No hay tipos de partida inicializados para {selectedYear}. Haz clic en "Inicializar Año" para crearlos.
              </p>
            </div>
          ) : (
            <table className="tabla-correlativos">
              <thead>
                <tr>
                  <th className="col-corr-cod">Cód.</th>
                  <th className="col-corr-nombre">Tipo de Partida</th>
                  <th className="col-corr-tipo">Tipo</th>
                  {MONTH_NAMES.map((m) => (
                    <th key={m} className="col-corr-mes">
                      {m}
                    </th>
                  ))}
                  <th className="col-corr-unico">Único</th>
                  <th className="col-corr-total">Total</th>
                </tr>
              </thead>
              <tbody>
                {correlativos.map((row) => {
                  const isAnnual = row.tipo === 'A';
                  const sumMonths = MONTH_KEYS.reduce((acc, k) => acc + (Number(row[k]) || 0), 0);
                  const totalDisplay = isAnnual ? Number(row.unico || 0) : sumMonths;

                  return (
                    <tr key={row.cod_tp_partida}>
                      {/* Código */}
                      <td className="col-corr-cod">
                        {row.cod_tp_partida}
                      </td>

                      {/* Nombre Tipo de Partida (Amplio, sin truncar ni romper) */}
                      <td className="col-corr-nombre">
                        {row.nom_tp_partida || `TIPO ${row.cod_tp_partida}`}
                      </td>

                      {/* Modalidad Badge */}
                      <td className="col-corr-tipo">
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            background: isAnnual ? '#f3e8ff' : '#ecfdf5',
                            color: isAnnual ? '#7e22ce' : '#065f46',
                            border: `1px solid ${isAnnual ? '#d8b4fe' : '#a7f3d0'}`,
                          }}
                        >
                          {isAnnual ? 'Anual' : 'Mensual'}
                        </span>
                      </td>

                      {/* 12 Meses con Inputs Compactos de 34px */}
                      {MONTH_KEYS.map((k) => {
                        const originalVal = originalCorrelativos.find((o) => o.cod_tp_partida === row.cod_tp_partida)?.[k] ?? 0;
                        const currentVal = row[k] ?? 0;
                        const isModified = currentVal !== originalVal;

                        return (
                          <td key={k} className="col-corr-mes">
                            <input
                              type="number"
                              min="0"
                              disabled={isAnnual}
                              value={isAnnual ? '' : currentVal}
                              placeholder={isAnnual ? '-' : '0'}
                              onChange={(e) => handleCellChange(row.cod_tp_partida, k, e.target.value)}
                              className={`input-corr-mes ${
                                isModified ? 'modificado' : currentVal > 0 ? 'activo' : 'cero'
                              }`}
                              title={
                                isAnnual
                                  ? 'Tipo de partida con correlativo anual'
                                  : `${FULL_MONTH_NAMES[parseInt(k, 10) - 1]}: ${currentVal}`
                              }
                            />
                          </td>
                        );
                      })}

                      {/* Único / Anual */}
                      <td className="col-corr-unico">
                        {isAnnual ? (
                          <input
                            type="number"
                            min="0"
                            value={row.unico ?? 0}
                            onChange={(e) => handleCellChange(row.cod_tp_partida, 'unico', e.target.value)}
                            className={`input-corr-unico ${
                              (row.unico ?? 0) !== (originalCorrelativos.find((o) => o.cod_tp_partida === row.cod_tp_partida)?.unico ?? 0)
                                ? 'modificado'
                                : ''
                            }`}
                          />
                        ) : (
                          <span style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>-</span>
                        )}
                      </td>

                      {/* Total Año */}
                      <td className="col-corr-total">
                        {totalDisplay}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* MODAL: REENUMERAR PARTIDAS */}
        <Modal
          isOpen={isReenumerarOpen}
          onClose={() => setIsReenumerarOpen(false)}
          title="Reenumerar Partidas Contables"
          maxWidth="2xl"
        >
          <div className="space-y-4">
            {/* Info Banner */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-3 text-xs text-amber-900">
              <RotateCw size={20} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold mb-1 text-amber-950">¿En qué consiste la reenumeración?</p>
                <p className="text-amber-800 leading-relaxed">
                  Esta función reasigna consecutivamente los números de partida (<code>num_correl</code>)
                  partiendo del <strong>número inicial especificado</strong> y ordenando las partidas según su
                  fecha cronológica. Es ideal para corregir saltos o correlativos desordenados tras eliminar o mover partidas.
                </p>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleConfirmReenumerar();
              }}
              className="form-symmetrical"
            >
              <div className="form-section-title">1. Parámetros del Filtro a Reenumerar</div>

              <div className="form-grid-symmetrical cols-2">
                {/* Año */}
                <div className="form-group">
                  <label className="form-label">Año Contable *</label>
                  <select
                    value={reenumerarForm.ano}
                    onChange={(e) =>
                      setReenumerarForm((prev) => ({ ...prev, ano: parseInt(e.target.value, 10) }))
                    }
                    className="form-input font-bold"
                  >
                    {availableYears.map((ano) => (
                      <option key={ano} value={ano}>
                        {ano}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Mes */}
                <div className="form-group">
                  <label className="form-label">Mes a Reenumerar *</label>
                  <select
                    value={reenumerarForm.mes}
                    onChange={(e) =>
                      setReenumerarForm((prev) => ({ ...prev, mes: e.target.value }))
                    }
                    className="form-input"
                  >
                    <option value="ALL">★ Todos los Meses (Año Completo)</option>
                    {MONTH_KEYS.map((k, idx) => (
                      <option key={k} value={k}>
                        {k} - {FULL_MONTH_NAMES[idx]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-grid-symmetrical cols-2">
                {/* Tipo de Partida */}
                <div className="form-group">
                  <label className="form-label">Tipo de Partida *</label>
                  <select
                    value={reenumerarForm.cod_tp_partida}
                    onChange={(e) =>
                      setReenumerarForm((prev) => ({ ...prev, cod_tp_partida: e.target.value }))
                    }
                    className="form-input"
                  >
                    <option value="ALL">★ Todos los Tipos de Partida</option>
                    {correlativos.map((tp) => (
                      <option key={tp.cod_tp_partida} value={tp.cod_tp_partida}>
                        {tp.cod_tp_partida} - {tp.nom_tp_partida || `TIPO ${tp.cod_tp_partida}`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Número Inicial */}
                <div className="form-group">
                  <label className="form-label">Número Inicial Correlativo *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={reenumerarForm.numeroInicial}
                    onChange={(e) =>
                      setReenumerarForm((prev) => ({
                        ...prev,
                        numeroInicial: parseInt(e.target.value, 10) || 1,
                      }))
                    }
                    className="form-input font-mono font-bold"
                  />
                </div>
              </div>

              <div className="form-section-title">2. Criterio y Actualización</div>

              <div className="form-grid-symmetrical cols-1">
                <div className="form-group">
                  <label className="form-label">Criterio de Ordenación Cronológica</label>
                  <select
                    value={reenumerarForm.criterio}
                    onChange={(e) =>
                      setReenumerarForm((prev) => ({
                        ...prev,
                        criterio: e.target.value as 'FECHA' | 'COD_PART',
                      }))
                    }
                    className="form-input"
                  >
                    <option value="FECHA">
                      Por Fecha de la Partida y Número Actual (Recomendado)
                    </option>
                    <option value="COD_PART">
                      Por Código Interno del Documento (PAR0000001...)
                    </option>
                  </select>
                </div>

                <div className="mt-2 bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-blue-600 shrink-0" />
                    <span className="text-xs text-slate-700 font-medium">
                      Actualizar tabla de correlativos con los nuevos números máximos generados
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={reenumerarForm.actualizarTablaCorrelativos}
                    onChange={(e) =>
                      setReenumerarForm((prev) => ({
                        ...prev,
                        actualizarTablaCorrelativos: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Resumen del Resultado si ya se ejecutó */}
              {reenumerarResult && (
                <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-4 animate-fade-in">
                  <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs mb-2">
                    <CheckCircle2 size={16} className="text-emerald-600" />
                    <span>{reenumerarResult.message}</span>
                  </div>
                  {reenumerarResult.detalles && reenumerarResult.detalles.length > 0 && (
                    <div className="max-h-40 overflow-y-auto mt-2 text-xs border border-emerald-100 rounded-lg bg-white p-2">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b text-[11px] text-slate-400 font-bold uppercase">
                            <th className="py-1">Tipo</th>
                            <th className="py-1">Período</th>
                            <th className="py-1 text-center">Partidas</th>
                            <th className="py-1 text-right">Rango Asignado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reenumerarResult.detalles.map((d, i) => (
                            <tr key={i} className="border-b border-slate-50">
                              <td className="py-1 font-semibold text-slate-700">{d.nom_tp_partida}</td>
                              <td className="py-1 text-slate-600">{d.mes}</td>
                              <td className="py-1 text-center font-mono font-bold text-emerald-700">
                                {d.total}
                              </td>
                              <td className="py-1 text-right font-mono text-slate-800">{d.rango}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Acciones del Modal */}
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secundario"
                  onClick={() => setIsReenumerarOpen(false)}
                >
                  {reenumerarResult ? 'Cerrar' : 'Cancelar'}
                </button>
                <button
                  type="submit"
                  disabled={reenumerarLoading}
                  className="btn-primario btn-icon-gap bg-amber-600 hover:bg-amber-700 text-white"
                >
                  <RotateCw size={16} className={reenumerarLoading ? 'animate-spin' : ''} />
                  <span>{reenumerarLoading ? 'Reenumerando...' : 'Reenumerar Asientos'}</span>
                </button>
              </div>
            </form>
          </div>
        </Modal>

        {/* MODAL: CONFIRMACIÓN DE REENUMERAR */}
        <Modal
          isOpen={isConfirmReenumerarOpen}
          onClose={() => setIsConfirmReenumerarOpen(false)}
          title="Confirmar Reenumeración"
          maxWidth="md"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-amber-800 bg-amber-50 p-3.5 rounded-xl border border-amber-200">
              <AlertCircle size={24} className="text-amber-600 shrink-0" />
              <div className="text-xs">
                <p className="font-bold text-amber-950">¿Estás seguro de reenumerar las partidas?</p>
                <p className="text-amber-800 mt-1">
                  Año: <strong>{reenumerarForm.ano}</strong> | Mes:{' '}
                  <strong>{reenumerarForm.mes === 'ALL' ? 'Todos los Meses' : reenumerarForm.mes}</strong> |
                  Tipo:{' '}
                  <strong>
                    {reenumerarForm.cod_tp_partida === 'ALL'
                      ? 'Todos los Tipos'
                      : reenumerarForm.cod_tp_partida}
                  </strong>
                </p>
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn-secundario"
                onClick={() => setIsConfirmReenumerarOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecuteReenumerar}
                className="btn-primario bg-amber-600 hover:bg-amber-700 text-white"
              >
                Sí, Reenumerar Ahora
              </button>
            </div>
          </div>
        </Modal>

        {/* MODAL: INICIALIZAR AÑO */}
        <Modal
          isOpen={isInitYearOpen}
          onClose={() => setIsInitYearOpen(false)}
          title="Inicializar Ejercicio en Correlativos"
          maxWidth="md"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleInicializarAno();
            }}
            className="form-symmetrical space-y-4"
          >
            <p className="text-xs text-slate-500 leading-relaxed">
              Esta acción creará los registros iniciales en la tabla de correlativos para todos los tipos de
              partida activos de la empresa en el nuevo año contable.
            </p>

            <div className="form-group">
              <label className="form-label">Año a Inicializar *</label>
              <input
                type="number"
                min="2000"
                max="2100"
                required
                value={newYearInput}
                onChange={(e) => setNewYearInput(parseInt(e.target.value, 10))}
                className="form-input font-bold text-center text-lg"
              />
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn-secundario"
                onClick={() => setIsInitYearOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={initYearLoading}
                className="btn-primario btn-icon-gap"
              >
                <CalendarPlus size={16} />
                <span>{initYearLoading ? 'Inicializando...' : 'Inicializar Año'}</span>
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </ControlIvaLayout>
  );
}
