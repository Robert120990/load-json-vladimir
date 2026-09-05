import { AlertTriangle, Trash2 } from 'lucide-react';
import Modal from './Modal';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  itemName?: string;
  itemCode?: string;
  isDeleting?: boolean;
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  itemName,
  itemCode,
  isDeleting = false,
}: ConfirmModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="md">
      <div className="confirm-modal-content">
        <div className="confirm-icon-wrapper">
          <AlertTriangle className="confirm-icon" size={32} />
        </div>

        <p className="confirm-message">{message}</p>

        {(itemName || itemCode) && (
          <div className="confirm-item-card">
            {itemName && (
              <div className="confirm-item-name">
                <strong>Nombre:</strong> {itemName}
              </div>
            )}
            {itemCode && (
              <div className="confirm-item-code">
                <strong>Código / Documento:</strong> <code>{itemCode}</code>
              </div>
            )}
          </div>
        )}

        <p className="confirm-warning">
          Esta acción no se puede deshacer. ¿Deseas continuar?
        </p>

        <div className="confirm-actions">
          <button
            type="button"
            className="btn-secundario"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn-peligro"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? (
              'Eliminando…'
            ) : (
              <>
                <Trash2 size={16} />
                Eliminar definitivamente
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
