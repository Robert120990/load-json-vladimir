import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Building2,
  PenTool,
  RefreshCw,
  Save,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { guardarFirmasContables, obtenerFirmasContables } from '../../api/accounting';
import { obtenerEmpresa } from '../../api/auth';
import ControlIvaLayout from '../../components/layout/ControlIvaLayout';
import type { Empresa } from '../../types';
import { FirmaContable } from '../../types/accounting';
import { handleEnterNavigation } from '../../utils/formNavigation';

export default function FirmasContablesPage() {
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [firmas, setFirmas] = useState<FirmaContable[]>([
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
        obtenerFirmasContables(),
      ]);
      setEmpresa(emp);
      if (firmasData && firmasData.length > 0) {
        setFirmas(firmasData);
      }
    } catch (err) {
      console.error(err);
      toast.error('Error al cargar las firmas contables');
    } finally {
      setLoading(false);
    }
  }

  function handleFirmaChange(idFirma: number, field: 'nom_firma' | 'puesto', value: string) {
    setFirmas((prev) =>
      prev.map((f) => (f.id_firma === idFirma ? { ...f, [field]: value } : f))
    );
  }

  async function handleGuardar(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await guardarFirmasContables(firmas);
      toast.success(res.message || 'Firmas contables guardadas exitosamente');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al guardar las firmas contables');
    } finally {
      setSaving(false);
    }
  }

  const firmaIcons = [
    { id: 1, icon: UserCheck, color: 'text-primary', label: 'Firma 1 (Elaboró / Representante)' },
    { id: 2, icon: ShieldCheck, color: 'text-amber', label: 'Firma 2 (Revisó / Auditor)' },
    { id: 3, icon: PenTool, color: 'text-emerald', label: 'Firma 3 (Autorizó / Contador)' },
  ];

  return (
    <ControlIvaLayout>
      <div className="firmas-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Firmas Contables Oficiales</h1>
          <p className="page-subtitle">
            Configuración de los profesionales y representantes que firman comprobantes y reportes contables
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
          <p className="text-slate-600">Cargando firmas contables...</p>
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
                      <label className="form-label required">Nombre Completo</label>
                      <input
                        type="text"
                        className="form-control font-bold text-slate-800"
                        placeholder="Ej. Lic. Carlos Roberto Morales"
                        value={f.nom_firma}
                        onChange={(e) => handleFirmaChange(f.id_firma, 'nom_firma', e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label required">Cargo / Acreditación</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Ej. Contador General Insc. 1245 / Representante Legal"
                        value={f.puesto}
                        onChange={(e) => handleFirmaChange(f.id_firma, 'puesto', e.target.value)}
                        required
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

          <div className="firmas-footer-actions card p-4 mt-6 flex justify-end gap-3">
            <button
              type="button"
              className="btn-secundario btn-icon-gap"
              onClick={cargarDatos}
              disabled={saving}
            >
              <RefreshCw size={16} />
              <span>Restablecer</span>
            </button>

            <button
              type="submit"
              className="btn-primario btn-icon-gap"
              disabled={saving}
            >
              {saving ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Save size={16} />
                  <span>Guardar Firmas Contables</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
        </div>
      </ControlIvaLayout>
    );
}
