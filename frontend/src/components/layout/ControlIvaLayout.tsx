import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Building2,
  FileSpreadsheet,
  FileText,
  FolderTree,
  Hash,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  PenTool,
  Receipt,
  ShieldCheck,
  ShoppingCart,
  UploadCloud,
  Users,
  X,
} from 'lucide-react';
import { obtenerEmpresa } from '../../api/auth';
import { VERSION_APP } from '../../version';
import type { Empresa, Usuario } from '../../types';
import systemLogo from '../../assets/logo.png';
import CompanySwitcher from './CompanySwitcher';

interface ControlIvaLayoutProps {
  children: React.ReactNode;
}

export default function ControlIvaLayout({ children }: ControlIvaLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });

  const usuario = JSON.parse(localStorage.getItem('usuario') ?? 'null') as Usuario | null;
  const isAdmin = usuario?.isAdmin ?? (usuario?.nom_usu?.trim().toUpperCase() === 'ADMIN');

  useEffect(() => {
    obtenerEmpresa()
      .then(setEmpresa)
      .catch(() => {});
  }, []);

  function toggleSidebarCollapsed() {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', String(next));
      return next;
    });
  }

  function cerrarSesion() {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    navigate('/login');
  }

  const navItems = [
    {
      group: 'Principal',
      items: [
        { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      ],
    },
    ...(isAdmin
      ? [
          {
            group: 'Administración',
            items: [
              {
                path: '/admin/empresas',
                label: 'Gestión de Empresas',
                icon: Building2,
              },
              {
                path: '/admin/usuarios',
                label: 'Gestión de Usuarios',
                icon: Users,
              },
              {
                path: '/admin/asignacion-empresas',
                label: 'Asignación de Empresas',
                icon: ShieldCheck,
              },
            ],
          },
        ]
      : []),
    {
      group: 'Contabilidad',
      items: [
        { path: '/contabilidad/partidas', label: 'Partidas Contables', icon: FileText },
        { path: '/contabilidad/catalogo', label: 'Catálogo de Cuentas', icon: FolderTree },
        { path: '/contabilidad/correlativos', label: 'Correlativos', icon: Hash },
        { path: '/contabilidad/firmas', label: 'Firmas Contables', icon: PenTool },
        { path: '/contabilidad/reportes', label: 'Reportes y Balances', icon: BookOpen },
      ],
    },
    {
      group: 'Gestión IVA',
      items: [
        { path: '/control-iva/clientes', label: 'Clientes', icon: Users },
        { path: '/control-iva/proveedores', label: 'Proveedores', icon: Building2 },
        { path: '/control-iva/compras', label: 'Compras IVA', icon: ShoppingCart },
        { path: '/control-iva/ventas', label: 'Ventas IVA', icon: Receipt },
      ],
    },
    {
      group: 'Reportes Oficiales',
      items: [
        {
          path: '/control-iva/reportes',
          label: 'Libros de IVA y Anexos',
          icon: BookOpen,
        },
        {
          path: '/control-iva/firmas',
          label: 'Firmas de Libros de IVA',
          icon: PenTool,
        },
      ],
    },
    {
      group: 'Carga Electrónica DTE',
      items: [
        { path: '/ventas', label: 'Cargar Json-DTE Ventas', icon: UploadCloud },
        { path: '/compras', label: 'Cargar Json-DTE Compras', icon: FileSpreadsheet },
      ],
    },
  ];

  return (
    <div className="layout-control-iva">
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <Link
            to="/dashboard"
            className="sidebar-logo"
            style={{ textDecoration: 'none', color: 'inherit' }}
            onClick={() => setSidebarOpen(false)}
            title={sidebarCollapsed ? 'Administración Tributaria' : undefined}
          >
            <img src={systemLogo} alt="Logo" className="sidebar-logo-img" />
            <div className="logo-text">
              <span className="logo-title">Administración Tributaria</span>
              <span className="logo-subtitle">Módulo Tributario</span>
            </div>
          </Link>
          <button
            type="button"
            className="sidebar-close-btn"
            onClick={() => setSidebarOpen(false)}
            aria-label="Cerrar menú"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((group) => (
            <div key={group.group} className="nav-group">
              <div className="nav-group-title">{group.group}</div>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname.startsWith(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`nav-item ${isActive ? 'active' : ''}`}
                    onClick={() => setSidebarOpen(false)}
                    title={sidebarCollapsed ? item.label : undefined}
                  >
                    <Icon size={16} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="usuario-row">
            <div className="usuario-info">
              <span className="usuario-name">{usuario?.desc_usu ?? usuario?.nom_usu ?? 'Usuario'}</span>
              <div className="version-pill-badge" title={`Versión del Sistema: ${VERSION_APP}`}>
                <span className="version-pulse-dot" />
                <span className="version-tag-text">VER</span>
                <span className="version-number-highlight">{VERSION_APP}</span>
              </div>
            </div>
            <button
              type="button"
              className="btn-logout"
              onClick={cerrarSesion}
              title="Cerrar sesión"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={`main-wrapper ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="mobile-menu-btn"
              onClick={() => setSidebarOpen(true)}
              aria-label="Abrir menú"
            >
              <Menu size={22} />
            </button>

            <button
              type="button"
              className="desktop-sidebar-toggle-btn"
              onClick={toggleSidebarCollapsed}
              title={sidebarCollapsed ? 'Expandir menú lateral' : 'Contraer menú lateral'}
              aria-label={sidebarCollapsed ? 'Expandir menú lateral' : 'Contraer menú lateral'}
            >
              {sidebarCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
            </button>

            <div className="topbar-title">
              <span className="breadcrumb-module">
                {location.pathname.startsWith('/admin')
                  ? 'Administración'
                  : location.pathname.startsWith('/contabilidad')
                  ? 'Contabilidad'
                  : 'Control IVA'}
              </span>
              <span className="breadcrumb-separator">/</span>
              <span className="breadcrumb-page">
                {location.pathname === '/dashboard'
                  ? 'Dashboard'
                  : location.pathname.includes('/admin/empresas')
                  ? 'Gestión de Empresas'
                  : location.pathname.includes('/admin/usuarios')
                  ? 'Gestión de Usuarios'
                  : location.pathname.includes('/admin/asignacion-empresas')
                  ? 'Asignación de Empresas'
                  : location.pathname.includes('/contabilidad/partidas')
                  ? 'Partidas Contables'
                  : location.pathname.includes('/contabilidad/catalogo')
                  ? 'Catálogo de Cuentas'
                  : location.pathname.includes('/contabilidad/correlativos')
                  ? 'Correlativos'
                  : location.pathname.includes('/contabilidad/firmas')
                  ? 'Firmas Contables'
                  : location.pathname.includes('/contabilidad/reportes')
                  ? 'Reportes Contables y Balances'
                  : location.pathname.includes('/clientes')
                  ? 'Clientes'
                  : location.pathname.includes('/proveedores')
                  ? 'Proveedores'
                  : location.pathname === '/compras'
                  ? 'Cargar Json-DTE Compras'
                  : location.pathname.includes('/compras')
                  ? 'Compras IVA'
                  : location.pathname === '/ventas'
                  ? 'Cargar Json-DTE Ventas'
                  : location.pathname.includes('/ventas')
                  ? 'Ventas IVA'
                  : location.pathname.includes('/reportes')
                  ? 'Libros de IVA y Anexos MH'
                  : 'Gestión'}
              </span>
            </div>
          </div>

          <div className="topbar-actions">
            <CompanySwitcher currentEmpresa={empresa} />
            <button type="button" className="btn-secundario btn-sm" onClick={cerrarSesion}>
              Cerrar sesión
            </button>
          </div>
        </header>

        <main className="layout-content">{children}</main>
      </div>
    </div>
  );
}
