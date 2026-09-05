import React from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading: boolean;
  total: number;
  page: number;
  limit: number;
  onPageChange: (newPage: number) => void;
  onLimitChange: (newLimit: number) => void;
  searchTerm: string;
  onSearchChange: (search: string) => void;
  searchPlaceholder?: string;
  actions?: (row: T) => React.ReactNode;
  actionsHeader?: string;
  emptyMessage?: string;
}

export default function DataTable<T extends { [key: string]: any }>({
  columns,
  data,
  loading,
  total,
  page,
  limit,
  onPageChange,
  onLimitChange,
  searchTerm,
  onSearchChange,
  searchPlaceholder = 'Buscar...',
  actions,
  actionsHeader = 'Acciones',
  emptyMessage = 'No se encontraron registros.',
}: DataTableProps<T>) {
  const totalPages = Math.ceil(total / limit) || 1;
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="datatable-wrapper">
      {/* Top Bar: Search & Page Size */}
      <div className="datatable-topbar">
        <div className="datatable-search">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="input-busqueda"
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => {
              onSearchChange(e.target.value);
            }}
          />
          {searchTerm && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => onSearchChange('')}
              title="Limpiar búsqueda"
            >
              ×
            </button>
          )}
        </div>

        <div className="datatable-controls">
          <span className="control-label">Mostrar:</span>
          <select
            className="select-limit"
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span className="control-label">por pág.</span>
        </div>
      </div>

      {/* Table Body */}
      <div className="tabla-contenedor">
        <table className="tabla-registros">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`text-${col.align ?? 'left'} ${col.className ?? ''}`}
                >
                  {col.header}
                </th>
              ))}
              {actions && (
                <th className="text-center th-acciones">{actionsHeader}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={columns.length + (actions ? 1 : 0)}
                  className="td-cargando"
                >
                  <div className="spinner-wrapper">
                    <div className="spinner"></div>
                    <span>Cargando datos…</span>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (actions ? 1 : 0)}
                  className="td-vacio"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, idx) => (
                <tr key={row.llave || row.cod_cliente || row.cod_proveedor || row.corr || idx}>
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`text-${col.align ?? 'left'} ${col.className ?? ''}`}
                    >
                      {col.render ? col.render(row) : (row[col.key] ?? '-')}
                    </td>
                  ))}
                  {actions && (
                    <td className="text-center td-acciones">{actions(row)}</td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="datatable-footer">
        <div className="datatable-info">
          Mostrando <strong>{from}</strong> a <strong>{to}</strong> de{' '}
          <strong>{total}</strong> registros
        </div>

        <div className="datatable-pagination">
          <button
            type="button"
            className="btn-paginacion"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1 || loading}
            aria-label="Página anterior"
          >
            <ChevronLeft size={16} />
            Anterior
          </button>

          <span className="pagina-actual">
            Página <strong>{page}</strong> de <strong>{totalPages}</strong>
          </span>

          <button
            type="button"
            className="btn-paginacion"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages || loading}
            aria-label="Página siguiente"
          >
            Siguiente
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
