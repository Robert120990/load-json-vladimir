import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import VersionNotification from './components/common/VersionNotification';
import ComprasPage from './pages/ComprasPage';
import ClientesPage from './pages/control-iva/ClientesPage';
import ComprasIvaPage from './pages/control-iva/ComprasIvaPage';
import DashboardPage from './pages/control-iva/DashboardPage';
import ProveedoresPage from './pages/control-iva/ProveedoresPage';
import ReportesLibrosPage from './pages/control-iva/ReportesLibrosPage';
import VentasIvaPage from './pages/control-iva/VentasIvaPage';
import Login from './pages/Login';
import VentasPage from './pages/VentasPage';

function RequireAuth({ children }: { children: JSX.Element }) {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <VersionNotification />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Navigate to="/dashboard" replace />
            </RequireAuth>
          }
        />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <DashboardPage />
            </RequireAuth>
          }
        />
        <Route
          path="/ventas"
          element={
            <RequireAuth>
              <VentasPage />
            </RequireAuth>
          }
        />
        <Route
          path="/compras"
          element={
            <RequireAuth>
              <ComprasPage />
            </RequireAuth>
          }
        />
        {/* Control IVA Routes */}
        <Route
          path="/control-iva"
          element={<Navigate to="/control-iva/clientes" replace />}
        />
        <Route
          path="/control-iva/clientes"
          element={
            <RequireAuth>
              <ClientesPage />
            </RequireAuth>
          }
        />
        <Route
          path="/control-iva/proveedores"
          element={
            <RequireAuth>
              <ProveedoresPage />
            </RequireAuth>
          }
        />
        <Route
          path="/control-iva/compras"
          element={
            <RequireAuth>
              <ComprasIvaPage />
            </RequireAuth>
          }
        />
        <Route
          path="/control-iva/ventas"
          element={
            <RequireAuth>
              <VentasIvaPage />
            </RequireAuth>
          }
        />
        <Route
          path="/control-iva/reportes"
          element={
            <RequireAuth>
              <ReportesLibrosPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      <Toaster
        position="top-right"
        gutter={10}
        containerStyle={{
          top: 20,
          right: 20,
        }}
        toastOptions={{
          duration: 4000,
          className: 'system-toast',
          style: {
            background: '#ffffff',
            color: '#0f172a',
            borderRadius: '12px',
            fontSize: '0.88rem',
            fontWeight: 500,
            padding: '12px 18px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.08)',
            maxWidth: '420px',
            lineHeight: 1.45,
          },
          success: {
            duration: 3500,
            style: {
              background: '#ffffff',
              color: '#0f172a',
              border: '1px solid #bbf7d0',
              borderLeft: '4px solid #10b981',
            },
            iconTheme: { primary: '#10b981', secondary: '#ffffff' },
          },
          error: {
            duration: 5000,
            style: {
              background: '#ffffff',
              color: '#0f172a',
              border: '1px solid #fecaca',
              borderLeft: '4px solid #ef4444',
            },
            iconTheme: { primary: '#ef4444', secondary: '#ffffff' },
          },
          loading: {
            style: {
              background: '#ffffff',
              color: '#0f172a',
              border: '1px solid #e2e8f0',
              borderLeft: '4px solid #3b82f6',
            },
            iconTheme: { primary: '#3b82f6', secondary: '#ffffff' },
          },
        }}
      />
    </BrowserRouter>
  );
}
