import { api } from './client';
import type {
  AccountingSignature,
  Client,
  Department,
  DocumentType,
  FirmaIva,
  Municipality,
  PaginatedResult,
  PurchaseIva,
  SaleIva,
  Supplier,
  TaxSettlementSummary,
  VatBookSummary,
  DashboardData,
  BatchConsumidorFinalPayload,
  BatchConsumidorFinalResponse,
} from '../types/controlIva';

// Catalogs
export async function fetchDepartamentos(): Promise<Department[]> {
  const { data } = await api.get<Department[]>('/control-iva/catalogos/departamentos');
  return data;
}

export async function fetchMunicipios(codDept?: number): Promise<Municipality[]> {
  const { data } = await api.get<Municipality[]>('/control-iva/catalogos/municipios', {
    params: { codDept },
  });
  return data;
}

export async function fetchTiposDocumentoCompras(): Promise<DocumentType[]> {
  const { data } = await api.get<DocumentType[]>('/control-iva/catalogos/tipos-documento-compras');
  return data;
}

export async function fetchTiposDocumentoVentas(): Promise<DocumentType[]> {
  const { data } = await api.get<DocumentType[]>('/control-iva/catalogos/tipos-documento-ventas');
  return data;
}

export async function fetchFirmasConta(): Promise<AccountingSignature[]> {
  const { data } = await api.get<AccountingSignature[]>('/control-iva/catalogos/firmas');
  return data;
}

export async function fetchPeriodoCompras(): Promise<{ mes: number; anio: number } | null> {
  const { data } = await api.get<{ mes: number; anio: number } | null>('/control-iva/periodo-compras');
  return data;
}

export async function updatePeriodoCompras(mes: number, anio: number): Promise<{ mes: number; anio: number }> {
  const { data } = await api.put<{ mes: number; anio: number }>('/control-iva/periodo-compras', { mes, anio });
  return data;
}

// Clients
export async function fetchClientes(params: {
  search?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedResult<Client>> {
  const { data } = await api.get<PaginatedResult<Client>>('/control-iva/clientes', { params });
  return data;
}

export async function fetchCliente(codCliente: string): Promise<Client> {
  const { data } = await api.get<Client>(`/control-iva/clientes/${encodeURIComponent(codCliente)}`);
  return data;
}

export async function createCliente(clienteData: Partial<Client>): Promise<Client> {
  const { data } = await api.post<Client>('/control-iva/clientes', clienteData);
  return data;
}

export async function updateCliente(
  codCliente: string,
  clienteData: Partial<Client>,
): Promise<Client> {
  const { data } = await api.put<Client>(
    `/control-iva/clientes/${encodeURIComponent(codCliente)}`,
    clienteData,
  );
  return data;
}

export async function deleteCliente(codCliente: string): Promise<void> {
  await api.delete(`/control-iva/clientes/${encodeURIComponent(codCliente)}`);
}

// Suppliers
export async function fetchProveedores(params: {
  search?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedResult<Supplier>> {
  const { data } = await api.get<PaginatedResult<Supplier>>('/control-iva/proveedores', { params });
  return data;
}

export async function fetchProveedor(codProveedor: string): Promise<Supplier> {
  const { data } = await api.get<Supplier>(
    `/control-iva/proveedores/${encodeURIComponent(codProveedor)}`,
  );
  return data;
}

export async function createProveedor(proveedorData: Partial<Supplier>): Promise<Supplier> {
  const { data } = await api.post<Supplier>('/control-iva/proveedores', proveedorData);
  return data;
}

export async function updateProveedor(
  codProveedor: string,
  proveedorData: Partial<Supplier>,
): Promise<Supplier> {
  const { data } = await api.put<Supplier>(
    `/control-iva/proveedores/${encodeURIComponent(codProveedor)}`,
    proveedorData,
  );
  return data;
}

export async function deleteProveedor(codProveedor: string): Promise<void> {
  await api.delete(`/control-iva/proveedores/${encodeURIComponent(codProveedor)}`);
}

// Purchases (compras_iva)
export async function fetchCompras(params: {
  search?: string;
  year?: number;
  month?: number;
  page?: number;
  limit?: number;
}): Promise<PaginatedResult<PurchaseIva>> {
  const { data } = await api.get<PaginatedResult<PurchaseIva>>('/control-iva/compras', { params });
  return data;
}

export async function fetchCompra(llave: string): Promise<PurchaseIva> {
  const { data } = await api.get<PurchaseIva>(`/control-iva/compras/${encodeURIComponent(llave)}`);
  return data;
}

export async function createCompra(compraData: Partial<PurchaseIva>): Promise<PurchaseIva> {
  const { data } = await api.post<PurchaseIva>('/control-iva/compras', compraData);
  return data;
}

export async function updateCompra(
  llave: string,
  compraData: Partial<PurchaseIva>,
): Promise<PurchaseIva> {
  const { data } = await api.put<PurchaseIva>(
    `/control-iva/compras/${encodeURIComponent(llave)}`,
    compraData,
  );
  return data;
}

export async function deleteCompra(llave: string): Promise<void> {
  await api.delete(`/control-iva/compras/${encodeURIComponent(llave)}`);
}

// Sales (ventas_iva)
export async function fetchVentas(params: {
  search?: string;
  year?: number;
  month?: number;
  id_tipo_documento?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedResult<SaleIva>> {
  const { data } = await api.get<PaginatedResult<SaleIva>>('/control-iva/ventas', { params });
  return data;
}

export async function fetchVenta(llave: string): Promise<SaleIva> {
  const { data } = await api.get<SaleIva>(`/control-iva/ventas/${encodeURIComponent(llave)}`);
  return data;
}

export async function createVenta(ventaData: Partial<SaleIva>): Promise<SaleIva> {
  const { data } = await api.post<SaleIva>('/control-iva/ventas', ventaData);
  return data;
}

export async function createBatchConsumidorFinal(
  payload: BatchConsumidorFinalPayload,
): Promise<BatchConsumidorFinalResponse> {
  const { data } = await api.post<BatchConsumidorFinalResponse>(
    '/control-iva/ventas/batch-consumidor-final',
    payload,
  );
  return data;
}

export async function updateVenta(
  llave: string,
  ventaData: Partial<SaleIva>,
): Promise<SaleIva> {
  const { data } = await api.put<SaleIva>(
    `/control-iva/ventas/${encodeURIComponent(llave)}`,
    ventaData,
  );
  return data;
}

export async function deleteVenta(llave: string): Promise<void> {
  await api.delete(`/control-iva/ventas/${encodeURIComponent(llave)}`);
}

// Reports & MH Annexes
export async function fetchLibroCompras(year: number, month: number): Promise<VatBookSummary> {
  const { data } = await api.get<VatBookSummary>('/control-iva/reportes/libro-compras', {
    params: { year, month },
  });
  return data;
}

export async function fetchLibroConsumidorFinal(
  year: number,
  month: number,
): Promise<VatBookSummary> {
  const { data } = await api.get<VatBookSummary>('/control-iva/reportes/libro-consumidor-final', {
    params: { year, month },
  });
  return data;
}

export async function fetchLibroContribuyentes(
  year: number,
  month: number,
): Promise<VatBookSummary> {
  const { data } = await api.get<VatBookSummary>('/control-iva/reportes/libro-contribuyentes', {
    params: { year, month },
  });
  return data;
}

export async function fetchAnexoHacienda(
  tipo: 'compras' | 'contribuyentes' | 'consumidor_final',
  year: number,
  month: number,
): Promise<any[]> {
  const { data } = await api.get<any[]>('/control-iva/reportes/anexo-hacienda', {
    params: { tipo, year, month },
  });
  return data;
}

export async function fetchPlantillaAnexo(
  tipo: 'compras' | 'contribuyentes' | 'consumidor_final',
): Promise<{ tipo: string; titulo: string; columnas: string[]; ejemplo: any[] }> {
  const { data } = await api.get('/control-iva/reportes/plantilla-anexo', {
    params: { tipo },
  });
  return data;
}

export async function fetchLiquidacionImpuestos(
  year: number,
  month: number,
): Promise<TaxSettlementSummary> {
  const { data } = await api.get<TaxSettlementSummary>('/control-iva/reportes/pago-impuestos', {
    params: { year, month },
  });
  return data;
}

export async function fetchDashboardData(params?: {
  year?: number;
  month?: number;
}): Promise<DashboardData> {
  const { data } = await api.get<DashboardData>('/control-iva/dashboard', {
    params,
  });
  return data;
}

// Firmas Libros de IVA
export async function obtenerFirmasIva(): Promise<FirmaIva[]> {
  const { data } = await api.get<FirmaIva[]>('/control-iva/firmas');
  return data;
}

export async function guardarFirmasIva(firmas: FirmaIva[]): Promise<{ message: string }> {
  const { data } = await api.post<{ message: string }>('/control-iva/firmas', { firmas });
  return data;
}

export async function copiarFirmasDesdeContabilidad(): Promise<FirmaIva[]> {
  const { data } = await api.get<FirmaIva[]>('/control-iva/firmas/copiar-contabilidad');
  return data;
}

