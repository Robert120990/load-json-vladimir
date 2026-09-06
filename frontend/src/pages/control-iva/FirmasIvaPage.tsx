import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Building2,
  Copy,
  FileCheck2,
  PenTool,
  RefreshCw,
  Save,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import {
  copiarFirmasDesdeContabilidad,
  guardarFirmasIva,
  obtenerFirmasIva,
} from '../../api/controlIva';
import { obtenerEmpresa } from '../../api/auth';
import ControlIvaLayout from '../../components/layout/ControlIvaLayout';
import type { Empresa } from '../../types';
import type { FirmaIva } from '../../types/controlIva';
import { handleEnterNavigation } from '../../utils/formNavigation';

export default function FirmasIvaPage() {
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);

  const [firmas, setFirmas] = useState<FirmaIva[]>([
    { id_firma: 1, nom_firma: '', puesto: 'Representante Legal', cod_emp: 0 },
    { id_firma: 2, nom_firma: '', puesto: 'Auditor Externo', cod_emp: 0 },
    { id_firma: 3, nom_firma: '', puesto: 'Contador General', cod_emp: 0 },
  ]);

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    setLoading(true);
    try {
      const [emp, firmasData] = await Promise.all([
        obtenerEmpresa().catch(() => null),
        obtenerFirmasIva(),
      ]);
      setEmpresa(emp);
      if (firmasData && firmasData.length > 0) {
        setFirmas(firmasData);
      }
    } catch (err) {
      console.error(err);
      toast.error('Error al cargar las firmas de libros de IVA');
    } finally {
      setLoading(false);
    }
  }

  function handleFirmaChange(idFirma: number, field: 'nom_firma' | 'puesto', value: string) {
    setFirmas((prev) =>
      prev.map((f) => (f.id_firma === idFirma ? { ...f, [field]: value } : f))
    );
  }

  async function handleCopiarDesdeContabilidad() {
    setCopying(true);
    try {
      const contaFirmas = await copiarFirmasDesdeContabilidad();
      if (contaFirmas && contaFirmas.length > 0) {
        setFirmas(contaFirmas);
        toast.success('Firmas copiadas desde Contabilidad. Recuerda hacer clic en "Guardar Firmas" para aplicar.');
      } else {
        toast('No se encontraron firmas en Contabilidad para esta empresa.', { icon: 'ℹ️' });
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Error al copiar las firmas desde contabilidad');
    } finally {
      setCopying(false);
    }
  }

  async function handleGuardar(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await guardarFirmasIva(firmas);
      toast.success(res.message || 'Firmas de libros de IVA guardadas exitosamente');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al guardar las firmas de IVA');
    } finally {
      setSaving(false);
    }
  }

  const firmaIcons = [
    { id: 1, icon: UserCheck, color: 'text-primary', label: 'Firma 1 (Elaboró / Representante)' },
    { id: 2, icon: ShieldCheck, color: 'text-amber', label: 'Firma 2 (Revisó / Auditor)' },
    { id: 3, icon: PenTool, color: 'text-emerald', label: 'Firma 3 (Autorizó / Contador)' },
  ];

  // Filter out completely blank or dot-only signatures for preview
  const firmasParaVistaPrevia = firmas.filter(
    (f) => f.nom_firma && f.nom_firma.trim() !== '' && f.nom_firma.trim() !== '.'
  );
  const displayPreview =
    firmasParaVistaPrevia.length > 0
      ? firmasParaVistaPrevia
      : firmas.slice(0, 2).map((f, i) => ({
          ...f,
          nom_firma: '',
          puesto: f.puesto || (i === 0 ? 'Representante Legal' : 'Contador General'),
        }));

  return (
    <ControlIvaLayout>
      <div className="firmas-page">
        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Firmas Oficiales de Libros de IVA</h1>
            <p className="page-subtitle">
              Configuración de los profesionales y representantes que firman los libros de compras, ventas y liquidación tributaria
            </p>
          </div>

          <div className="header-actions">
            {empresa && (
              <div className="empresa-active-pill">
                <Building2 size={16} />
                <span className="font-bold">{empresa.nom_emp || `Empresa #${empresa.cod_emp}`}</span>
                <span className="text-xs text-muted font-mono">(NIT: {empresa.nit})</span>
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="card p-12 text-center">
            <RefreshCw size={32} className="animate-spin text-primary mx-auto mb-3" />
            <p className="text-slate-600">Cargando firmas de libros de IVA...</p>
          </div>
        ) : (
          <form onSubmit={handleGuardar} onKeyDown={handleEnterNavigation}>
            <div className="firmas-cards-grid">
              {firmas.map((f) => {
                const meta = firmaIcons.find((i) => i.id === f.id_firma) || firmaIcons[0];
                const Icon = meta.icon;

                return (
                  <div key={f.id_firma} className="firmas-card card">
                    <div className="firmas-card-header">
                      <div className="firmas-icon-wrap">
                        <Icon className={meta.color} size={22} />
                      </div>
                      <div>
                        <h3 className="firmas-card-title">{meta.label}</h3>
                        <span className="text-xs text-muted">ID de Firma: #{f.id_firma}</span>
                      </div>
                    </div>

                    <div className="firmas-card-body">
                      <div className="form-group mb-4">
                        <label className="form-label">
                          Nombre Completo {f.id_firma !== 2 && <span className="text-danger">*</span>}
                        </label>
                        <input
                          type="text"
                          className="form-control font-bold text-slate-800"
                          placeholder="Ej. Lic. Carlos Roberto Morales"
                          value={f.nom_firma}
                          onChange={(e) => handleFirmaChange(f.id_firma, 'nom_firma', e.target.value)}
                          required={f.id_firma === 1 || f.id_firma === 3}
                        />
                        {f.id_firma === 2 && (
                          <span className="text-xs text-muted mt-1 block">
                            (Opcional - Dejar en blanco si la empresa no nombra Auditor Externo)
                          </span>
                        )}
                      </div>

                      <div className="form-group">
                        <label className="form-label">
                          Cargo / Acreditación {f.id_firma !== 2 && <span className="text-danger">*</span>}
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Ej. Representante Legal / Contador General"
                          value={f.puesto}
                          onChange={(e) => handleFirmaChange(f.id_firma, 'puesto', e.target.value)}
                          required={f.id_firma === 1 || f.id_firma === 3}
                        />
                      </div>
                    </div>

                    {/* Preview of signature appearance on reports */}
                    <div className="firmas-preview-box">
                      <div className="signature-line" />
                      <div className="preview-name">{f.nom_firma || 'Nombre de la Persona'}</div>
                      <div className="preview-role">{f.puesto || 'Cargo o Función'}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Vista Previa Conjunta en Reportes Oficiales */}
            <div className="card p-6 mt-6">
              <div className="flex items-center gap-2 mb-4 border-b pb-3">
                <FileCheck2 size={20} className="text-primary" />
                <h3 className="font-bold text-slate-800 text-sm">
                  Vista Previa en Libros de IVA (Compras, Ventas y Liquidación)
                </h3>
              </div>
              <p className="text-xs text-muted mb-4">
                Así se estamparán las firmas al pie de página en los reportes oficiales y exportaciones:
              </p>

              <div className="report-signatures-box">
                {displayPreview.map((f, idx) => (
                  <div className="signature-col" key={f.id_firma || idx}>
                    <div className="signature-line"></div>
                    <div className="signature-name font-bold">
                      {f.nom_firma || '___________________________'}
                    </div>
                    <div className="signature-label">{f.puesto || 'Firma Autorizada'}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Acciones de pie de página */}
            <div className="firmas-footer-actions card p-4 mt-6 flex flex-wrap justify-between items-center gap-3">
              <button
                type="button"
                className="btn-secundario btn-icon-gap text-primary border-primary hover:bg-blue-50"
                onClick={handleCopiarDesdeContabilidad}
                disabled={copying || saving}
                title="Copia automáticamente los nombres y cargos de las firmas configuradas en el módulo de Contabilidad"
              >
                {copying ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Copiando...</span>
                  </>
                ) : (
                  <>
                    <Copy size={16} />
                    <span>Copiar desde Contabilidad</span>
                  </>
                )}
              </button>

              <div className="flex gap-3">
                <button
                  type="button"
                  className="btn-secundario btn-icon-gap"
                  onClick={cargarDatos}
                  disabled={saving || copying}
                >
                  <RefreshCw size={16} />
                  <span>Restablecer</span>
                </button>

                <button
                  type="submit"
                  className="btn-primario btn-icon-gap"
                  disabled={saving || copying}
                >
                  {saving ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      <span>Guardar Firmas de IVA</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </ControlIvaLayout>
  );
}
