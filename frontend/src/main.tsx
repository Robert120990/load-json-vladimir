import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Desactivar el cambio de valor por scroll de la rueda del ratón en todos los inputs numéricos
document.addEventListener(
  'wheel',
  () => {
    const active = document.activeElement as HTMLElement | null;
    if (active && active.tagName === 'INPUT' && (active as HTMLInputElement).type === 'number') {
      active.blur();
    }
  },
  { passive: true },
);

document.addEventListener('focusin', (e) => {
  const target = e.target as HTMLInputElement | null;
  if (target && target.tagName === 'INPUT' && target.type === 'number') {
    target.addEventListener(
      'wheel',
      (event) => {
        event.preventDefault();
      },
      { passive: false },
    );
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
