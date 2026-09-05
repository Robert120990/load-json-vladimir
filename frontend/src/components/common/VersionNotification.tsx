import { useEffect, useState } from 'react';
import { RefreshCw, Sparkles, X } from 'lucide-react';
import { api } from '../../api/client';
import { VERSION_APP } from '../../version';

interface VersionResponse {
  version: string;
  timestamp: number;
}

function parseVersionNumbers(ver: string): number[] {
  return ver
    .replace(/^v/i, '')
    .split(/[.-]/)
    .map((part) => parseInt(part, 10))
    .filter((n) => !isNaN(n));
}

function isNewerVersion(remote: string, current: string): boolean {
  if (!remote || !current) return false;
  if (remote === current) return false;

  const remoteParts = parseVersionNumbers(remote);
  const currentParts = parseVersionNumbers(current);

  const maxLength = Math.max(remoteParts.length, currentParts.length);
  for (let i = 0; i < maxLength; i++) {
    const r = remoteParts[i] || 0;
    const c = currentParts[i] || 0;
    if (r > c) return true;
    if (r < c) return false;
  }
  return false;
}

const CHECK_INTERVAL_MS = 60 * 1000; // Cada 60 segundos
const SNOOZE_DURATION_MS = 10 * 60 * 1000; // 10 minutos de posposición

export default function VersionNotification() {
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [snoozedUntil, setSnoozedUntil] = useState<number>(0);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function checkVersion() {
      try {
        const { data } = await api.get<VersionResponse>('/version', {
          params: { _t: Date.now() },
        });

        if (isMounted) {
          if (data?.version && isNewerVersion(data.version, VERSION_APP)) {
            setLatestVersion(data.version);
          } else {
            setLatestVersion(null);
          }
        }
      } catch {
        // Silencioso ante fallos de red
      }
    }

    // Comprobación inicial al montar
    checkVersion();

    // Comprobación periódica cada 60s
    const interval = setInterval(checkVersion, CHECK_INTERVAL_MS);

    // Comprobación al volver a enfocar la pestaña
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        checkVersion();
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', checkVersion);

    return () => {
      isMounted = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', checkVersion);
    };
  }, []);

  function handleReload() {
    setIsUpdating(true);
    // Limpieza de caché local y recarga forzada
    try {
      if ('caches' in window) {
        caches.keys().then((names) => {
          names.forEach((name) => caches.delete(name));
        });
      }
    } catch {
      // Ignorar errores de caché
    }
    setTimeout(() => {
      window.location.reload();
    }, 150);
  }

  function handleSnooze() {
    setSnoozedUntil(Date.now() + SNOOZE_DURATION_MS);
  }

  const isSnoozed = Date.now() < snoozedUntil;

  if (!latestVersion || isSnoozed) {
    return null;
  }

  return (
    <aside
      className="deploy-version-banner"
      role="alert"
      aria-live="polite"
      aria-label="Nueva versión disponible"
    >
      <div className="deploy-banner-glow" />
      
      <div className="deploy-banner-content">
        <div className="deploy-banner-icon-wrap">
          <Sparkles size={20} className="deploy-icon-sparkle" />
          <span className="deploy-pulse-ring" />
        </div>

        <div className="deploy-banner-text">
          <div className="deploy-banner-title">
            <strong>¡Nueva versión disponible!</strong>
            <span className="deploy-badge-new">{latestVersion}</span>
          </div>
          <p className="deploy-banner-desc">
            Se ha publicado una actualización ({VERSION_APP} &rarr; {latestVersion}). Actualiza para disfrutar de las mejoras.
          </p>
        </div>

        <div className="deploy-banner-actions">
          <button
            type="button"
            className="btn-deploy-reload"
            onClick={handleReload}
            disabled={isUpdating}
          >
            <RefreshCw size={15} className={isUpdating ? 'animate-spin' : ''} />
            <span>{isUpdating ? 'Actualizando…' : 'Actualizar ahora'}</span>
          </button>
          <button
            type="button"
            className="btn-deploy-snooze"
            onClick={handleSnooze}
            title="Recordar en 10 minutos"
            aria-label="Cerrar aviso de actualización"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
