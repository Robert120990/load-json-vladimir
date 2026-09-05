import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { obtenerError } from '../../api/client';
import {
  createProveedor,
  fetchDepartamentos,
  fetchMunicipios,
  updateProveedor,
} from '../../api/controlIva';
import Modal from '../ui/Modal';
import { handleEnterNavigation } from '../../utils/formNavigation';
import type { Department, Municipality, Supplier } from '../../types/controlIva';

interface SupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplierToEdit?: Supplier | null;
  onSuccess: (savedSupplier: Supplier) => void;
}

export default function SupplierModal({
  isOpen,
  onClose,
  supplierToEdit,
  onSuccess,
}: SupplierModalProps) {
  const isEdit = Boolean(supplierToEdit);
  const [formData, setFormData] = useState<Partial<Supplier>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Catalogs
  const [departamentos, setDepartamentos] = useState<Department[]>([]);
  const [municipios, setMunicipios] = useState<Municipality[]>([]);

  useEffect(() => {
    fetchDepartamentos()
      .then(setDepartamentos)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    if (supplierToEdit) {
      setFormData({ ...supplierToEdit });
      if (supplierToEdit.cod_dept) {
        fetchMunicipios(supplierToEdit.cod_dept)
          .then(setMunicipios)
          .catch(() => {});
      }
    } else {
      setFormData({
        cod_proveedor: '',
        registro: '',
        nom_proveedor: '',
        nit_proveedor: '',
        telefono: '',
        giro: '',
        dir_proveedor: '',
        cod_dept: 1,
        cod_muni: 1,
        activo: 1,
        con_retencion: 0,
        con_percepcion: 0,
      });
      fetchMunicipios(1)
        .then(setMunicipios)
        .catch(() => {});
    }
    setFormErrors({});
  }, [isOpen, supplierToEdit]);

  async function handleDeptChange(deptId: number) {
    setFormData((prev) => ({ ...prev, cod_dept: deptId, cod_muni: 1 }));
    try {
      const res = await fetchMunicipios(deptId);
      setMunicipios(res);
      if (res.length > 0) {
        setFormData((prev) => ({ ...prev, cod_muni: res[0].cod_muni }));
      }
    } catch {
      setMunicipios([]);
    }
  }

  function validarFormulario(): boolean {
    const errors: Record<string, string> = {};
    if (!formData.nom_proveedor?.trim()) {
      errors.nom_proveedor = 'El nombre o razón social es obligatorio';
    }
    if (!isEdit && !formData.cod_proveedor?.trim() && !formData.registro?.trim()) {
      errors.cod_proveedor = 'El código o número de registro (NRC) es obligatorio';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validarFormulario()) return;

    const sanitizedData: Partial<Supplier> = {
      ...formData,
      cod_proveedor: formData.cod_proveedor?.trim().toUpperCase(),
      registro: formData.registro?.trim().toUpperCase(),
      nom_proveedor: formData.nom_proveedor?.trim().toUpperCase(),
      nit_proveedor: formData.nit_proveedor?.trim().toUpperCase(),
      telefono: formData.telefono?.trim().toUpperCase(),
      giro: formData.giro?.trim().toUpperCase(),
      dir_proveedor: formData.dir_proveedor?.trim().toUpperCase(),
    };

    try {
      setSubmitting(true);
      let saved: Supplier;
      if (isEdit && supplierToEdit) {
        saved = await updateProveedor(supplierToEdit.cod_proveedor, sanitizedData);
        toast.success(`Proveedor '${saved.nom_proveedor}' actualizado correctamente`);
      } else {
        saved = await createProveedor(sanitizedData);
        toast.success(`Proveedor '${saved.nom_proveedor}' creado correctamente`);
      }
      onSuccess(saved);
      onClose();
    } catch (err) {
      toast.error(obtenerError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        isEdit
          ? `Editar Proveedor: ${supplierToEdit?.nom_proveedor}`
          : 'Agregar Nuevo Proveedor'
      }
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} onKeyDown={handleEnterNavigation} className="form-symmetrical">
        <div className="form-grid-symmetrical cols-2">
          <div className="form-group">
            <label className="form-label">Código / NRC *</label>
            <input
              type="text"
              className={`form-input input-uppercase ${formErrors.cod_proveedor ? 'input-error' : ''}`}
              value={formData.cod_proveedor ?? ''}
              onChange={(e) => setFormData({ ...formData, cod_proveedor: e.target.value.toUpperCase() })}
              placeholder="Ej: 11111-1"
              disabled={isEdit}
            />
            {formErrors.cod_proveedor && (
              <span className="form-error-msg">{formErrors.cod_proveedor}</span>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Número de Registro (NRC)</label>
            <input
              type="text"
              className="form-input input-uppercase"
              value={formData.registro ?? ''}
              onChange={(e) => setFormData({ ...formData, registro: e.target.value.toUpperCase() })}
              placeholder="Ej: 11111-1"
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Nombre o Razón Social *</label>
          <input
            type="text"
            className={`form-input input-uppercase ${formErrors.nom_proveedor ? 'input-error' : ''}`}
            value={formData.nom_proveedor ?? ''}
            onChange={(e) => setFormData({ ...formData, nom_proveedor: e.target.value.toUpperCase() })}
            placeholder="Nombre completo o razón social del proveedor"
          />
          {formErrors.nom_proveedor && (
            <span className="form-error-msg">{formErrors.nom_proveedor}</span>
          )}
        </div>

        <div className="form-grid-symmetrical cols-2">
          <div className="form-group">
            <label className="form-label">NIT</label>
            <input
              type="text"
              className="form-input input-uppercase"
              value={formData.nit_proveedor ?? ''}
              onChange={(e) => setFormData({ ...formData, nit_proveedor: e.target.value.toUpperCase() })}
              placeholder="0614-000000-000-0"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Teléfono</label>
            <input
              type="text"
              className="form-input input-uppercase"
              value={formData.telefono ?? ''}
              onChange={(e) => setFormData({ ...formData, telefono: e.target.value.toUpperCase() })}
              placeholder="2222-0000"
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Giro o Actividad Económica</label>
          <input
            type="text"
            className="form-input input-uppercase"
            value={formData.giro ?? ''}
            onChange={(e) => setFormData({ ...formData, giro: e.target.value.toUpperCase() })}
            placeholder="Actividad comercial del proveedor"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Dirección</label>
          <textarea
            className="form-input input-uppercase"
            rows={2}
            value={formData.dir_proveedor ?? ''}
            onChange={(e) => setFormData({ ...formData, dir_proveedor: e.target.value.toUpperCase() })}
            placeholder="Dirección completa del proveedor"
          />
        </div>

        <div className="form-grid-symmetrical cols-2">
          <div className="form-group">
            <label className="form-label">Departamento</label>
            <select
              className="form-input"
              value={formData.cod_dept ?? 1}
              onChange={(e) => handleDeptChange(Number(e.target.value))}
            >
              {departamentos.map((d) => (
                <option key={d.cod_dept} value={d.cod_dept}>
                  {d.nom_dept}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Municipio</label>
            <select
              className="form-input"
              value={formData.cod_muni ?? 1}
              onChange={(e) => setFormData({ ...formData, cod_muni: Number(e.target.value) })}
            >
              {municipios.map((m) => (
                <option key={m.cod_muni} value={m.cod_muni}>
                  {m.nom_muni}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-grid-symmetrical cols-3">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={Boolean(formData.activo)}
              onChange={(e) => setFormData({ ...formData, activo: e.target.checked ? 1 : 0 })}
            />
            <span>Proveedor Activo</span>
          </label>

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={Boolean(formData.con_retencion)}
              onChange={(e) =>
                setFormData({ ...formData, con_retencion: e.target.checked ? 1 : 0 })
              }
            />
            <span>Agente de Retención</span>
          </label>

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={Boolean(formData.con_percepcion)}
              onChange={(e) =>
                setFormData({ ...formData, con_percepcion: e.target.checked ? 1 : 0 })
              }
            />
            <span>Agente de Percepción</span>
          </label>
        </div>

        <div className="modal-actions">
          <button
            type="button"
            className="btn-secundario"
            onClick={onClose}
            disabled={submitting}
          >
            Cancelar
          </button>
          <button type="submit" className="btn-primario" disabled={submitting}>
            {submitting ? 'Guardando…' : isEdit ? 'Guardar Cambios' : 'Crear Proveedor'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
