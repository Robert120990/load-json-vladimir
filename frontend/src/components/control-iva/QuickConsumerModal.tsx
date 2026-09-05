import React, { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  FileSpreadsheet,
  Plus,
  Receipt,
  Trash2,
  Zap,
} from 'lucide-react';
import Modal from '../ui/Modal';
import { createBatchConsumidorFinal } from '../../api/controlIva';
import { obtenerError } from '../../api/client';
import type { QuickConsumerItem } from '../../types/controlIva';

interface QuickConsumerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultYear?: number;
  defaultMonth?: number;
}

export default function QuickConsumerModal({
  isOpen,
  onClose,
  onSuccess,
  defaultYear,
  defaultMonth,
}: QuickConsumerModalProps) {
  const getInitialDate = () => {
    const now = new Date();
    if (defaultYear && defaultMonth) {
      const padM = String(defaultMonth).padStart(2, '0');
      const padD = String(Math.min(now.getDate(), 28)).padStart(2, '0');
      return `${defaultYear}-${padM}-${padD}`;
    }
    return now.toISOString().split('T')[0];
  };

  const [fecha, setFecha] = useState<string>(getInitialDate());
  const [items, setItems] = useState<QuickConsumerItem[]>([]);

  // Item Form State
  const [codigoGeneracion, setCodigoGeneracion] = useState('');
  const [numeroControl, setNumeroControl] = useState('');
  const [selloRecepcion, setSelloRecepcion] = useState('');
  const [monto, setMonto] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);
  const codGenInputRef = useRef<HTMLInputElement>(null);
  const numCtrlInputRef = useRef<HTMLInputElement>(null);
  const selloInputRef = useRef<HTMLInputElement>(null);
  const montoInputRef = useRef<HTMLInputElement>(null);

  // Form errors
  const [itemError, setItemError] = useState<string | null>(null);

  function handleAddItem(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setItemError(null);

    const codGenClean = codigoGeneracion.trim().toUpperCase();
    const numCtrlClean = numeroControl.trim().toUpperCase();
    const selloClean = selloRecepcion.trim().toUpperCase();
    const montoNum = parseFloat(monto);

    if (!codGenClean) {
      setItemError('El código de generación es obligatorio');
      codGenInputRef.current?.focus();
      return;
    }

    if (isNaN(montoNum) || montoNum <= 0) {
      setItemError('Ingresa un monto válido mayor a 0');
      return;
    }

    // Verificar si ya está en la lista actual
    const yaExiste = items.some(
      (it) => it.codigoGeneracion.toUpperCase() === codGenClean,
    );
    if (yaExiste) {
      setItemError('Este código de generación ya fue agregado a la lista');
      return;
    }

    const newItem: QuickConsumerItem = {
      id: Math.random().toString(36).substring(2, 9),
      codigoGeneracion: codGenClean,
      numeroControl: numCtrlClean || undefined,
      selloRecepcion: selloClean || undefined,
      monto: Number(montoNum.toFixed(2)),
    };

    setItems((prev) => [newItem, ...prev]);

    // Limpiar campos y dar foco al primer input para captura fluida
    setCodigoGeneracion('');
    setNumeroControl('');
    setSelloRecepcion('');
    setMonto('');
    setItemError(null);

    setTimeout(() => {
      codGenInputRef.current?.focus();
    }, 50);
  }

  function handleRemoveItem(idToRemove?: string) {
    setItems((prev) => prev.filter((it) => it.id !== idToRemove));
  }

  function handleClearAll() {
    if (items.length === 0) return;
    if (window.confirm('¿Deseas vaciar toda la lista de comprobantes ingresados?')) {
      setItems([]);
      setItemError(null);
    }
  }

  // Cálculos de Resumen
  const totalMonto = items.reduce((acc, it) => acc + (it.monto || 0), 0);
  const baseGravadaEstimada = Number((totalMonto / 1.13).toFixed(2));
  const debitoFiscalEstimado = Number((totalMonto - baseGravadaEstimada).toFixed(2));

  async function handleSaveBatch() {
    if (items.length === 0) {
      toast.error('Agrega al menos una factura a la lista antes de guardar');
      return;
    }

    if (!fecha) {
      toast.error('Debes especificar la fecha de emisión del lote');
      return;
    }

    try {
      setSubmitting(true);
      const res = await createBatchConsumidorFinal({
        fecha,
        items: items.map((it) => ({
          codigoGeneracion: it.codigoGeneracion,
          numeroControl: it.numeroControl,
          selloRecepcion: it.selloRecepcion,
          monto: it.monto,
        })),
      });

      if (res.duplicadosOmitidos > 0) {
        toast.success(
          `Se registraron ${res.totalGuardados} ventas. Se omitieron ${res.duplicadosOmitidos} documentos ya existentes.`,
          { duration: 5000 },
        );
      } else {
        toast.success(`¡Éxito! Se registraron ${res.totalGuardados} ventas a Consumidor Final.`);
      }

      setItems([]);
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(obtenerError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Ingreso Rápido de Consumidores Finales (DTE-01)"
      maxWidth="2xl"
    >
      <div className="quick-consumer-modal-wrap">
        {/* Cabecera Informativa y Fecha */}
        <div className="quick-consumer-header-bar">
          <div className="quick-header-left">
            <div className="quick-badge">
              <Zap size={15} />
              <span>Modo Ágil DTE-01</span>
            </div>
            <p className="quick-desc">
              Registra facturas a Consumidor Final de forma continua. El tipo de documento (01) y el cliente genérico se asignan automáticamente.
            </p>
          </div>

          <div className="quick-fecha-control">
            <label htmlFor="quick-fecha" className="label-fecha">
              <Calendar size={15} />
              <span>Fecha de Emisión:</span>
            </label>
            <input
              id="quick-fecha"
              type="date"
              className="input-fecha-lote"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              required
            />
          </div>
        </div>

        {/* Formulario de Entrada Rápida */}
        <form onSubmit={handleAddItem} className="quick-entry-form-card">
          <div className="quick-form-title">
            <Receipt size={16} />
            <span>Agregar Documento al Lote</span>
          </div>

          <div className="quick-inputs-grid">
            <div className="input-field">
              <label htmlFor="qc-cod-gen">
                Código de Generación <span className="req">*</span>
              </label>
              <input
                id="qc-cod-gen"
                ref={codGenInputRef}
                type="text"
                placeholder="Ej. 4D94FE63-0EB1-4198-9C21-..."
                className="input-uppercase"
                value={codigoGeneracion}
                onChange={(e) => setCodigoGeneracion(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    numCtrlInputRef.current?.focus();
                  }
                }}
                autoFocus
              />
            </div>

            <div className="input-field">
              <label htmlFor="qc-num-ctrl">Número de Control</label>
              <input
                id="qc-num-ctrl"
                ref={numCtrlInputRef}
                type="text"
                placeholder="Ej. DTE-01-M001P001-..."
                className="input-uppercase"
                value={numeroControl}
                onChange={(e) => setNumeroControl(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    selloInputRef.current?.focus();
                  }
                }}
              />
            </div>

            <div className="input-field">
              <label htmlFor="qc-sello">Sello de Recepción</label>
              <input
                id="qc-sello"
                ref={selloInputRef}
                type="text"
                placeholder="Ej. 2024E627FE5..."
                className="input-uppercase"
                value={selloRecepcion}
                onChange={(e) => setSelloRecepcion(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    montoInputRef.current?.focus();
                  }
                }}
              />
            </div>

            <div className="input-field field-monto">
              <label htmlFor="qc-monto">
                Monto Total ($) <span className="req">*</span>
              </label>
              <input
                id="qc-monto"
                ref={montoInputRef}
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddItem();
                  }
                }}
              />
            </div>

            <div className="btn-add-wrap">
              <button type="button" className="btn-add-item" onClick={() => handleAddItem()}>
                <Plus size={16} />
                <span>Agregar</span>
              </button>
            </div>
          </div>

          {itemError && (
            <div className="quick-item-error">
              <AlertCircle size={15} />
              <span>{itemError}</span>
            </div>
          )}
        </form>

        {/* Tabla Acumulativa de Facturas */}
        <div className="quick-items-list-container">
          <div className="quick-list-header">
            <div className="list-title">
              <FileSpreadsheet size={16} />
              <span>Comprobantes Acumulados en este Lote ({items.length})</span>
            </div>
            {items.length > 0 && (
              <button type="button" className="btn-limpiar-lista" onClick={handleClearAll}>
                <Trash2 size={13} />
                <span>Limpiar Lista</span>
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="quick-empty-state">
              <Receipt size={36} className="empty-icon" />
              <p className="empty-text">No has agregado comprobantes a este lote.</p>
              <span className="empty-subtext">
                Ingresa los datos arriba y presiona <strong>Agregar</strong> o <strong>Enter</strong>.
              </span>
            </div>
          ) : (
            <div className="quick-table-scroll">
              <table className="quick-items-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>#</th>
                    <th>Código de Generación</th>
                    <th>Número de Control</th>
                    <th>Sello de Recepción</th>
                    <th style={{ textAlign: 'right', width: '120px' }}>Monto ($)</th>
                    <th style={{ textAlign: 'center', width: '50px' }}>Quitar</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={item.id || index}>
                      <td className="row-index">{items.length - index}</td>
                      <td className="font-mono">{item.codigoGeneracion}</td>
                      <td className="font-mono text-muted">{item.numeroControl || '—'}</td>
                      <td className="font-mono text-muted truncate-sello" title={item.selloRecepcion}>
                        {item.selloRecepcion ? `${item.selloRecepcion.slice(0, 18)}…` : '—'}
                      </td>
                      <td className="row-monto font-bold">
                        $ {item.monto.toFixed(2)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn-delete-row"
                          onClick={() => handleRemoveItem(item.id)}
                          title="Eliminar este comprobante"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Resumen de Operación */}
        <div className="quick-summary-box">
          <div className="summary-col">
            <span className="summary-label">Total Documentos</span>
            <span className="summary-val">{items.length} facturas</span>
          </div>
          <div className="summary-col">
            <span className="summary-label">Base Imponible Estimada (sin IVA)</span>
            <span className="summary-val">$ {baseGravadaEstimada.toFixed(2)}</span>
          </div>
          <div className="summary-col">
            <span className="summary-label">Débito Fiscal Estimado (13%)</span>
            <span className="summary-val">$ {debitoFiscalEstimado.toFixed(2)}</span>
          </div>
          <div className="summary-col summary-highlight">
            <span className="summary-label">Monto Total del Lote</span>
            <span className="summary-val-total">$ {totalMonto.toFixed(2)}</span>
          </div>
        </div>

        {/* Botones de Acción */}
        <div className="modal-footer quick-modal-footer">
          <button
            type="button"
            className="btn-secundario"
            onClick={onClose}
            disabled={submitting}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn-primario btn-guardar-lote"
            onClick={handleSaveBatch}
            disabled={submitting || items.length === 0}
          >
            {submitting ? (
              <span>Guardando lote…</span>
            ) : (
              <>
                <CheckCircle2 size={18} />
                <span>Guardar {items.length} {items.length === 1 ? 'Factura' : 'Facturas'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
