import { useEffect, useRef, useState } from 'react';
import {
  Building2,
  Check,
  ChevronDown,
  Loader2,
  RefreshCw,
  Search,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cambiarEmpresaActiva, obtenerMisEmpresas } from '../../api/auth';
import type { Empresa, EmpresaOpcion } from '../../types';
import { matchesSearchTokens } from '../../utils/searchUtils';
import './CompanySwitcher.css';

interface CompanySwitcherProps {
  currentEmpresa: Empresa | null;
}

export default function CompanySwitcher({ currentEmpresa }: CompanySwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [companies, setCompanies] = useState<EmpresaOpcion[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [switchingId, setSwitchingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Cargar las empresas activas asignadas al usuario
  async function loadAssignedCompanies() {
    setLoadingList(true);
    try {
      const data = await obtenerMisEmpresas();
      setCompanies(data);
    } catch (err) {
      console.error('Error al cargar empresas asignadas:', err);
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    loadAssignedCompanies();
  }, [currentEmpresa?.cod_emp]);

  // Manejar clic fuera para cerrar el menú
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Manejar teclado (Escape para cerrar)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  async function handleSwitchCompany(targetCompany: EmpresaOpcion) {
    if (targetCompany.cod_emp === currentEmpresa?.cod_emp) {
      setIsOpen(false);
      return;
    }

    setSwitchingId(targetCompany.cod_emp);
    try {
      const result = await cambiarEmpresaActiva(targetCompany.cod_emp);
      localStorage.setItem('token', result.token);
      localStorage.setItem('usuario', JSON.stringify(result.usuario));

      toast.success(`Cambiando a: ${targetCompany.nom_emp || `Empresa #${targetCompany.cod_emp}`}`, {
        duration: 2000,
      });

      // Recarga total controlada para reiniciar 100% el contexto de la aplicación
      setTimeout(() => {
        window.location.reload();
      }, 350);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err.message || 'Error al cambiar de empresa';
      toast.error(msg);
      setSwitchingId(null);
    }
  }

  const filteredCompanies = companies.filter((c) =>
    matchesSearchTokens([c.nom_emp, c.nit, c.reg_fiscal, String(c.cod_emp)], searchTerm)
  );

  return (
    <div className="company-switcher-wrapper" ref={dropdownRef}>
      {/* Botón Trigger de la Empresa Activa */}
      <button
        type="button"
        className={`company-switcher-trigger ${isOpen ? 'active' : ''}`}
        style={{
          display: 'inline-flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: '10px',
          height: '44px',
          padding: '4px 12px',
          boxSizing: 'border-box',
          textAlign: 'left',
        }}
        onClick={() => {
          if (!isOpen) loadAssignedCompanies();
          setIsOpen((prev) => !prev);
        }}
        title="Clic para cambiar de empresa rápidamente"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <div
          className="company-switcher-icon-wrap"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            minWidth: '32px',
            flexShrink: 0,
          }}
        >
          <Building2 size={18} className="text-blue-600" />
        </div>
        <div
          className="company-switcher-info"
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            minWidth: 0,
            flex: 1,
            textAlign: 'left',
          }}
        >
          <div
            className="company-switcher-name"
            style={{
              fontSize: '0.82rem',
              fontWeight: 700,
              color: '#0f172a',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineHeight: 1.25,
              textAlign: 'left',
            }}
          >
            {currentEmpresa ? (currentEmpresa.nom_emp || `Empresa #${currentEmpresa.cod_emp}`) : 'Cargando empresa…'}
          </div>
          <div
            className="company-switcher-meta"
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.72rem',
              fontWeight: 600,
              color: '#64748b',
              lineHeight: 1.2,
              marginTop: '1px',
              textAlign: 'left',
            }}
          >
            <span className="company-switcher-nit">
              {currentEmpresa?.nit ? `NIT: ${currentEmpresa.nit}` : 'Sin NIT'}
            </span>
            <span className="company-switcher-badge-tag">Cambiar</span>
          </div>
        </div>
        <ChevronDown size={16} className={`company-switcher-chevron ${isOpen ? 'open' : ''}`} style={{ flexShrink: 0 }} />
      </button>

      {/* Popover / Menú Desplegable */}
      {isOpen && (
        <div className="company-switcher-dropdown">
          <div className="company-switcher-header">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-xs text-slate-500 uppercase tracking-wider">
                Cambiar Empresa Activa
              </span>
              <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                {companies.length} asignadas
              </span>
            </div>

            {/* Buscador Rápido con AutoFocus */}
            <div className="company-switcher-search-box mt-2">
              <Search size={14} className="company-switcher-search-icon" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Buscar por nombre o NIT..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="company-switcher-search-input"
              />
              {searchTerm && (
                <button
                  type="button"
                  className="company-switcher-search-clear"
                  onClick={() => setSearchTerm('')}
                >
                  &times;
                </button>
              )}
            </div>
          </div>

          {/* Lista de Empresas Disponibles */}
          <div className="company-switcher-list" role="listbox">
            {loadingList && companies.length === 0 ? (
              <div className="company-switcher-empty">
                <Loader2 size={20} className="animate-spin text-blue-500 mb-1" />
                <span>Cargando empresas…</span>
              </div>
            ) : filteredCompanies.length === 0 ? (
              <div className="company-switcher-empty">
                <span>No se encontraron empresas con esa búsqueda</span>
              </div>
            ) : (
              filteredCompanies.map((c) => {
                const isActive = c.cod_emp === currentEmpresa?.cod_emp;
                const isSwitching = switchingId === c.cod_emp;

                return (
                  <button
                    key={c.cod_emp}
                    type="button"
                    className={`company-switcher-item ${isActive ? 'item-active' : ''}`}
                    onClick={() => handleSwitchCompany(c)}
                    disabled={isSwitching || switchingId !== null}
                    role="option"
                    aria-selected={isActive}
                  >
                    <div className="company-switcher-item-left">
                      <div className={`company-switcher-item-icon ${isActive ? 'icon-active' : ''}`}>
                        {isSwitching ? (
                          <Loader2 size={16} className="animate-spin text-blue-600" />
                        ) : isActive ? (
                          <Check size={16} className="text-blue-600 font-bold" />
                        ) : (
                          <Building2 size={16} className="text-slate-400" />
                        )}
                      </div>
                      <div className="company-switcher-item-details">
                        <div className="company-switcher-item-title font-medium text-slate-800">
                          {c.nom_emp || `Empresa #${c.cod_emp}`}
                        </div>
                        <div className="company-switcher-item-sub text-xs text-slate-500">
                          {c.nit ? `NIT: ${c.nit}` : 'NIT: —'}
                          {c.reg_fiscal ? ` · NRC: ${c.reg_fiscal}` : ''}
                        </div>
                      </div>
                    </div>

                    {isActive && (
                      <span className="company-switcher-item-badge">
                        Activa
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          <div className="company-switcher-footer">
            <button
              type="button"
              className="company-switcher-reload-btn"
              onClick={loadAssignedCompanies}
              disabled={loadingList}
            >
              <RefreshCw size={12} className={loadingList ? 'animate-spin' : ''} />
              <span>Actualizar lista</span>
            </button>
            <span className="text-[11px] text-slate-400">Esc para cerrar</span>
          </div>
        </div>
      )}
    </div>
  );
}
