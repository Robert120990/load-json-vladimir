import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, seleccionarEmpresa } from '../api/auth';
import { obtenerError } from '../api/client';
import type { EmpresaOpcion } from '../types';
import systemLogo from '../assets/logo.png';
import { VERSION_APP } from '../version';
import { handleEnterNavigation } from '../utils/formNavigation';

export default function Login() {
  const navigate = useNavigate();
  const [nomUsu, setNomUsu] = useState('');
  const [password, setPassword] = useState('');
  const [empresas, setEmpresas] = useState<EmpresaOpcion[]>([]);
  const [tokenTemporal, setTokenTemporal] = useState('');
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function manejarCredenciales(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      const resultado = await login(nomUsu, password);
      setTokenTemporal(resultado.tokenTemporal);
      setEmpresas(resultado.empresas);
      setEmpresaSeleccionada(resultado.empresas[0]?.cod_emp ?? null);
    } catch (err) {
      setError(obtenerError(err));
    } finally {
      setCargando(false);
    }
  }

  async function manejarIngreso() {
    if (empresaSeleccionada === null) return;
    setError(null);
    setCargando(true);
    try {
      const resultado = await seleccionarEmpresa(tokenTemporal, empresaSeleccionada);
      localStorage.setItem('token', resultado.token);
      localStorage.setItem('usuario', JSON.stringify(resultado.usuario));
      navigate('/dashboard');
    } catch (err) {
      setError(obtenerError(err));
    } finally {
      setCargando(false);
    }
  }

  function volverACredenciales() {
    setEmpresas([]);
    setTokenTemporal('');
    setEmpresaSeleccionada(null);
    setError(null);
  }

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <div className="login-header-branding">
          <img src={systemLogo} alt="Administración Tributaria Logo" className="login-logo-img" />
          <h1>Administración Tributaria</h1>
          <div className="login-version-badge">
            <span className="version-pulse-dot" />
            <span className="version-badge-label">Módulo Tributario</span>
            <span className="version-badge-pill">{VERSION_APP}</span>
          </div>
        </div>

        {empresas.length === 0 ? (
          <form onSubmit={manejarCredenciales} onKeyDown={handleEnterNavigation}>
            <label>
              Usuario
              <input
                value={nomUsu}
                onChange={(e) => setNomUsu(e.target.value)}
                autoFocus
                required
              />
            </label>
            <label>
              Contraseña
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            {error && <p className="error">{error}</p>}
            <button type="submit" disabled={cargando}>
              {cargando ? 'Verificando…' : 'Ingresar'}
            </button>
          </form>
        ) : (
          <>
            <p className="nota">
              Credenciales correctas. Selecciona la empresa a la que deseas acceder:
            </p>
            <div className="lista-empresas">
              {empresas.map((empresa) => (
                <label key={empresa.cod_emp} className="opcion-empresa">
                  <input
                    type="radio"
                    name="empresa"
                    value={empresa.cod_emp}
                    checked={empresaSeleccionada === empresa.cod_emp}
                    onChange={() => setEmpresaSeleccionada(empresa.cod_emp)}
                  />
                  <span>
                    <strong>{empresa.nom_emp || `Empresa ${empresa.cod_emp}`}</strong>
                    <br />
                    <small>
                      NIT: {empresa.nit ?? '—'}
                      {empresa.reg_fiscal ? ` · Reg. fiscal: ${empresa.reg_fiscal}` : ''}
                    </small>
                  </span>
                </label>
              ))}
            </div>
            {error && <p className="error">{error}</p>}
            <button
              className="btn-primario"
              onClick={manejarIngreso}
              disabled={cargando || empresaSeleccionada === null}
            >
              {cargando ? 'Ingresando…' : 'Ingresar a esta empresa'}
            </button>
            <button className="btn-secundario" onClick={volverACredenciales} disabled={cargando}>
              Volver
            </button>
          </>
        )}
      </div>
    </div>
  );
}
