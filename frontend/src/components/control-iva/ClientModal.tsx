import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { obtenerError } from '../../api/client';
import {
  createCliente,
  fetchDepartamentos,
  fetchMunicipios,
  updateCliente,
} from '../../api/controlIva';
import Modal from '../ui/Modal';
import { handleEnterNavigation } from '../../utils/formNavigation';
import type { Client, Department, Municipality } from '../../types/controlIva';

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientToEdit?: Client | null;
  onSuccess: (savedClient: Client) => void;
}

export default function ClientModal({
  isOpen,
  onClose,
  clientToEdit,
  onSuccess,
}: ClientModalProps) {
  const isEdit = Boolean(clientToEdit);
  const [formData, setFormData] = useState<Partial<Client>>({});
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

    if (clientToEdit) {
      setFormData({ ...clientToEdit });
      if (clientToEdit.cod_dept) {
        fetchMunicipios(clientToEdit.cod_dept)
          .then(setMunicipios)
          .catch(() => {});
      }
    } else {
      setFormData({
        cod_cliente: '',
        registro: '',
        nom_cliente: '',
        nit_cliente: '',
        telefono: '',
        giro: '',
        dir_cliente: '',
        cod_dept: 1,
        cod_muni: 1,
        activo: 1,
        exento: 0,
        con_retencion: 0,
      });
      fetchMunicipios(1)
        .then(setMunicipios)
        .catch(() => {});
    }
    setFormErrors({});
  }, [isOpen, clientToEdit]);

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
    if (!formData.nom_cliente?.trim()) {
      errors.nom_cliente = 'El nombre o razón social es obligatorio';
    }
    if (!isEdit && !formData.cod_cliente?.trim() && !formData.registro?.trim()) {
      errors.cod_cliente = 'El código o número de registro (NRC) es obligatorio';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validarFormulario()) return;

    const sanitizedData: Partial<Client> = {
      ...formData,
      cod_cliente: formData.cod_cliente?.trim().toUpperCase(),
      registro: formData.registro?.trim().toUpperCase(),
      nom_cliente: formData.nom_cliente?.trim().toUpperCase(),
      nit_cliente: formData.nit_cliente?.trim().toUpperCase(),
      telefono: formData.telefono?.trim().toUpperCase(),
      giro: formData.giro?.trim().toUpperCase(),
      dir_cliente: formData.dir_cliente?.trim().toUpperCase(),
    };

    try {
      setSubmitting(true);
      let saved: Client;
      if (isEdit && clientToEdit) {
        saved = await updateCliente(clientToEdit.cod_cliente, sanitizedData);
        toast.success(`Cliente '${saved.nom_cliente}' actualizado correctamente`);
      } else {
        saved = await createCliente(sanitizedData);
        toast.success(`Cliente '${saved.nom_cliente}' creado correctamente`);
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
      title={isEdit ? `Editar Cliente: ${clientToEdit?.nom_cliente}` : 'Agregar Nuevo Cliente'}
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} onKeyDown={handleEnterNavigation} className="form-symmetrical">
        <div className="form-grid-symmetrical cols-2">
          <div className="form-group">
            <label className="form-label">Código / NRC *</label>
            <input
              type="text"
              className={`form-input input-uppercase ${formErrors.cod_cliente ? 'input-error' : ''}`}
              value={formData.cod_cliente ?? ''}
              onChange={(e) => setFormData({ ...formData, cod_cliente: e.target.value.toUpperCase() })}
              placeholder="Ej: 59530-6"
              disabled={isEdit}
            />
            {formErrors.cod_cliente && (
              <span className="form-error-msg">{formErrors.cod_cliente}</span>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Número de Registro (NRC)</label>
            <input
              type="text"
              className="form-input input-uppercase"
              value={formData.registro ?? ''}
              onChange={(e) => setFormData({ ...formData, registro: e.target.value.toUpperCase() })}
              placeholder="Ej: 59530-6"
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Nombre o Razón Social *</label>
          <input
            type="text"
            className={`form-input input-uppercase ${formErrors.nom_cliente ? 'input-error' : ''}`}
            value={formData.nom_cliente ?? ''}
            onChange={(e) => setFormData({ ...formData, nom_cliente: e.target.value.toUpperCase() })}
            placeholder="Nombre completo o razón social del cliente"
          />
          {formErrors.nom_cliente && (
            <span className="form-error-msg">{formErrors.nom_cliente}</span>
          )}
        </div>

        <div className="form-grid-symmetrical cols-2">
          <div className="form-group">
            <label className="form-label">NIT</label>
            <input
              type="text"
              className="form-input input-uppercase"
              value={formData.nit_cliente ?? ''}
              onChange={(e) => setFormData({ ...formData, nit_cliente: e.target.value.toUpperCase() })}
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
            placeholder="Actividad comercial del cliente"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Dirección</label>
          <textarea
            className="form-input input-uppercase"
            rows={2}
            value={formData.dir_cliente ?? ''}
            onChange={(e) => setFormData({ ...formData, dir_cliente: e.target.value.toUpperCase() })}
            placeholder="Dirección completa del cliente"
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
            <span>Cliente Activo</span>
          </label>

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={Boolean(formData.exento)}
              onChange={(e) => setFormData({ ...formData, exento: e.target.checked ? 1 : 0 })}
            />
            <span>Exento de IVA</span>
          </label>

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={Boolean(formData.con_retencion)}
              onChange={(e) =>
                setFormData({ ...formData, con_retencion: e.target.checked ? 1 : 0 })
              }
            />
            <span>Aplica Retención 1%</span>
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
            {submitting ? 'Guardando…' : isEdit ? 'Guardar Cambios' : 'Crear Cliente'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
