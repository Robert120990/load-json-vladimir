import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { obtenerEmpresa } from '../api/auth';
import { obtenerError } from '../api/client';
import { VERSION_APP } from '../version';
import type { Empresa, Usuario } from '../types';

export default function Home() {
  const navigate = useNavigate();
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const usuario = JSON.parse(localStorage.getItem('usuario') ?? 'null') as Usuario | null;

  useEffect(() => {
    obtenerEmpresa()
      .then(setEmpresa)
      .catch((err) => setError(obtenerError(err)))
      .finally(() => setCargando(false));
  }, []);

  function cerrarSesion() {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    navigate('/login');
  }

  return (
    <div className="pagina">
      <header className="barra">
        <h1>Carga de DTE</h1>
        <div className="barra-info">
          {usuario && <span>{usuario.desc_usu ?? usuario.nom_usu}</span>}
          <button className="btn-secundario" onClick={cerrarSesion}>
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="contenido">
        <h2>¿Qué deseas hacer?</h2>

        {cargando && <p>Cargando información de la empresa…</p>}
        {error && <p className="error">{error}</p>}

        {empresa && (
          <p className="nota">
            Empresa: <strong>{empresa.nom_emp || `cod_emp ${empresa.cod_emp}`}</strong>
            <br />
            NIT <strong>{empresa.nit}</strong>
            {empresa.reg_fiscal ? ` · Reg. fiscal: ${empresa.reg_fiscal}` : ''}
          </p>
        )}

        <div className="tarjetas">
          <Link to="/control-iva/clientes" className="card tarjeta-enlace tarjeta-destacada">
            <div className="tarjeta-badge">Módulo Completo</div>
            <h3>Control IVA</h3>
            <p>Gestión de Clientes, Proveedores, Compras IVA, Ventas IVA y Reportes de Libros de IVA oficiales.</p>
          </Link>
          <Link to="/ventas" className="card tarjeta-enlace">
            <h3>Carga de Ventas</h3>
            <p>Cargar JSON de DTE emitidos (ventas_iva) por la empresa.</p>
          </Link>
          <Link to="/compras" className="card tarjeta-enlace">
            <h3>Carga de Compras</h3>
            <p>Cargar JSON de DTE recibidos (compras_iva) por la empresa.</p>
          </Link>
        </div>
      </main>

      <footer className="pie-version">
        <div className="pie-version-badge">
          <span className="version-pulse-dot" />
          <span>Carga DTE</span>
          <span className="pie-version-pill">{VERSION_APP}</span>
        </div>
      </footer>
    </div>
  );
}
