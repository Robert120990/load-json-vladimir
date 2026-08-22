import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  fileName: string;
  content: string;
  onCerrar: () => void;
}

function formatearJson(content: string): string {
  try {
    return JSON.stringify(JSON.parse(content), null, 2);
  } catch {
    return content;
  }
}

export default function JsonModal({ fileName, content, onCerrar }: Props) {
  useEffect(() => {
    function manejarTecla(e: KeyboardEvent) {
      if (e.key === 'Escape') onCerrar();
    }
    window.addEventListener('keydown', manejarTecla);
    return () => window.removeEventListener('keydown', manejarTecla);
  }, [onCerrar]);

  const json = useMemo(() => formatearJson(content), [content]);

  return createPortal(
    <div
      className="modal-overlay json-modal-overlay"
      onClick={onCerrar}
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
        className="modal json-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#ffffff',
          borderRadius: 16,
          maxWidth: 820,
          width: '100%',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.3)',
        }}
      >
        <div className="json-modal-cabecera">
          <h3>{fileName}</h3>
        </div>
        <div className="json-modal-cuerpo">
          {json ? (
            <pre className="json-modal-pre">{json}</pre>
          ) : (
            <p className="json-modal-vacio">Sin contenido disponible</p>
          )}
        </div>
        <div className="json-modal-pie">
          <button className="btn-secundario" onClick={onCerrar}>
            Cerrar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
