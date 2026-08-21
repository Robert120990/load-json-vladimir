import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export type VarianteModal = 'confirmar' | 'peligro';

interface Props {
  titulo: string;
  mensaje: string;
  textoConfirmar: string;
  textoCancelar: string;
  variante?: VarianteModal;
  onConfirmar: () => void;
  onCancelar: () => void;
}

const COLORES: Record<VarianteModal, { principal: string; claro: string }> = {
  confirmar: { principal: '#2563eb', claro: '#dbeafe' },
  peligro: { principal: '#dc2626', claro: '#fee2e2' },
};

export default function ConfirmModal({
  titulo,
  mensaje,
  textoConfirmar,
  textoCancelar,
  variante = 'confirmar',
  onConfirmar,
  onCancelar,
}: Props) {
  useEffect(() => {
    function manejarTecla(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancelar();
    }
    window.addEventListener('keydown', manejarTecla);
    return () => window.removeEventListener('keydown', manejarTecla);
  }, [onCancelar]);

  const colores = COLORES[variante];

  return createPortal(
    <div
      className="modal-overlay"
      onClick={onCancelar}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 16,
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#ffffff',
          borderRadius: 16,
          maxWidth: 420,
          width: '100%',
          padding: '32px 28px 24px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.3)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            margin: '0 auto 16px',
            borderRadius: '50%',
            background: colores.claro,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke={colores.principal}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4" />
            <path d="M12 16h.01" />
          </svg>
        </div>
        <h3 style={{ margin: '0 0 10px', fontSize: '1.25rem', color: '#111827' }}>{titulo}</h3>
        <p style={{ margin: '0 0 24px', color: '#6b7280', lineHeight: 1.55 }}>{mensaje}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            className="btn-secundario"
            onClick={onCancelar}
            style={{
              background: '#ffffff',
              border: '1.5px solid #d1d5db',
              color: '#374151',
              borderRadius: 10,
              padding: '10px 22px',
              cursor: 'pointer',
              fontSize: '0.95rem',
              minWidth: 120,
            }}
          >
            {textoCancelar}
          </button>
          <button
            className="btn-primario"
            onClick={onConfirmar}
            style={{
              background: colores.principal,
              color: '#ffffff',
              borderRadius: 10,
              padding: '10px 22px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.95rem',
              minWidth: 120,
            }}
          >
            {textoConfirmar}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
