export interface Client {
  corr?: number;
  cod_cliente: string;
  cod_emp?: number | null;
  nom_cliente: string;
  dir_cliente?: string | null;
  cod_dept?: number | null;
  cod_muni?: number | null;
  telefono?: string | null;
  registro?: string | null;
  nit_cliente?: string | null;
  giro?: string | null;
  exento?: number | null;
  exterior?: number | null;
  activo?: number;
  tama?: string;
  con_credito?: number;
  limite_credito?: number;
  excede_credito?: number;
  con_retencion?: number;
  con_percepcion?: number;
  cuenta_cxc?: string;
  cuenta_ac?: string;
  nom_dept?: string;
  nom_muni?: string;
}

export interface Supplier {
  corr?: number;
  cod_proveedor: string;
  cod_emp?: number;
  nom_proveedor: string;
  dir_proveedor?: string;
  cod_dept?: number;
  cod_muni?: number;
  telefono?: string;
  registro?: string;
  nit_proveedor?: string;
  giro?: string;
  exento?: number;
  exterior?: number;
  activo?: number;
  tama?: string;
  pais?: string;
  cuenta_contable?: string;
  nombre_cuenta?: string;
  con_credito?: number;
  excede_credito?: number;
  limite_credito?: number;
  con_retencion?: number;
  con_percepcion?: number;
  identificacion_excluidos?: string;
  deducible?: number;
  nom_dept?: string;
  nom_muni?: string;
}

export interface PurchaseIva {
  cod_emp: number;
  llave: string;
  fecha: string;
  id_tipo_documento: string;
  documento: string;
  cod_proveedor: string;
  periodo_ano: number;
  periodo_mes: number;
  exentas_locales: number;
  exentas_importaciones: number;
  exentas_internaciones: number;
  gravadas_locales: number;
  gravadas_importaciones: number;
  gravadas_internaciones: number;
  no_sujetas: number;
  credito_fiscal: number;
  anticipo_a_cuenta: number;
  iva_retenido: number;
  retencion_a_terceros: number;
  compras_a_excluidos: number;
  rebajas_y_devoluciones: number;
  iva_rebajas_y_devoluciones: number;
  corr_maquina_registradora?: string;
  iva_percibido: number;
  cod_sucursal?: string;
  cod_punto_venta?: string;
  num_control?: string;
  sello_recepcion?: string;
  nom_proveedor?: string;
  registro_proveedor?: string;
  nit_proveedor?: string;
  nom_tipo_documento?: string;
}

export interface SaleIva {
  cod_emp: number;
  llave: string;
  fecha: string;
  id_tipo_documento: string;
  documento: string;
  cod_cliente: string;
  gravadas_locales: number;
  gravadas_exportacion: number;
  ventas_exentas: number;
  ventas_no_sujetas: number;
  cuentas_a_terceros: number;
  rebajas_y_devoluciones: number;
  iva_retenido: number;
  iva_percibido: number;
  debito_fiscal: number;
  debito_fiscal_a_terceros: number;
  corr_maquina_registradora?: string;
  serie?: string;
  formulario_unico?: string;
  id_sucursal?: string;
  anulada?: number;
  es_rebajas_fac?: number;
  num_control?: string;
  nom_cliente?: string;
  registro_cliente?: string;
  nit_cliente?: string;
  nom_tipo_documento?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Department {
  cod_dept: number;
  nom_dept: string;
}

export interface Municipality {
  cod_muni: number;
  nom_muni: string;
  cod_dep: number;
}

export interface DocumentType {
  id_tipo_documento: string;
  nombre: string;
}

export interface AccountingSignature {
  id_firma: number;
  nom_firma: string;
  puesto: string;
}

export interface VatPurchaseBookRow {
  corr: number;
  fecha: string;
  codigoGeneracion: string;
  registro: string;
  nombreProveedor: string;
  comprasExentas: number;
  noSujetas: number;
  comprasGravadas: number;
  creditoFiscal: number;
  anticipoACta: number;
  ivaRetenido: number;
  ivaPercibido: number;
  totalCompras: number;
}

export interface VatFinalConsumerBookRow {
  fecha: string;
  codigoGeneracionInicial: string;
  codigoGeneracionFinal: string;
  numeroControlDel: string;
  numeroControlAl: string;
  ventasExentas: number;
  ventasNoSujetas: number;
  gravadasLocales: number;
  gravadasExportaciones: number;
  ivaPercibidoRetenido: number;
  totalVentas: number;
  ventasCuentasTerceros: number;
}

export interface VatTaxpayerBookRow {
  corr: number;
  fecha: string;
  codigoGeneracion: string;
  nombreCliente: string;
  registro: string;
  ventasExentas: number;
  ventasNoSujetas: number;
  gravadasVentas: number;
  gravadasDevoluciones: number;
  debitoFiscalVentas: number;
  debitoFiscalDevoluciones: number;
  ivaRetenidoPercibido: number;
  ventasTotales: number;
}

export interface FirmaIva {
  id_firma: number;
  nom_firma: string;
  puesto: string;
  cod_emp?: number;
}

export interface VatBookSummary {
  libro: 'compras' | 'consumidor_final' | 'contribuyentes';
  empresa: {
    cod_emp: number;
    nom_emp: string;
    nit: string;
    reg_fiscal: string;
  };
  periodo: {
    mes: number;
    anio: number;
    nombreMes: string;
  };
  sucursal: string;
  filas: VatPurchaseBookRow[] | VatFinalConsumerBookRow[] | VatTaxpayerBookRow[];
  totales: Record<string, number>;
  cuadroResumen: Record<string, any>;
  firmas: AccountingSignature[] | {
    elaboradoPor: string;
    revisadoPor: string;
  };
}

export interface TaxSettlementSummary {
  empresa: {
    cod_emp: number;
    nom_emp: string;
    nit: string;
    reg_fiscal: string;
  };
  periodo: {
    mes: number;
    anio: number;
    nombreMes: string;
  };
  iva: {
    debitos: {
      contribuyentes: number;
      consumidorFinal: number;
      totalDebito: number;
    };
    creditos: {
      comprasLocales: number;
      importaciones: number;
      internaciones: number;
      totalCredito: number;
    };
    liquidacion: {
      diferencia: number;
      esAPagar: boolean;
      impuestoDeterminado: number;
      remanenteCreditoMes: number;
      retencionesClientes: number;
      anticipoIva: number;
      percepcionesIva: number;
      totalDeducciones: number;
      totalIvaAPagar: number;
      remanenteCreditoProximoMes: number;
    };
  };
  pagoCuenta: {
    ingresosGravados: {
      contribuyentes: number;
      consumidorFinalNeto: number;
      exportaciones: number;
      totalBaseImponible: number;
    };
    tasa: number;
    pagoCuentaDeterminado: number;
    retencionesRenta: number;
    totalPagoCuentaAPagar: number;
  };
  resumenGeneral: {
    totalIvaAPagar: number;
    totalPagoCuentaAPagar: number;
    totalPagarFisco: number;
  };
  firmas: AccountingSignature[] | {
    elaboradoPor: string;
    revisadoPor: string;
  };
}

export interface DashboardData {
  periodo: {
    mes: number;
    anio: number;
  };
  empresa: {
    cod_emp: number;
    nom_emp: string;
    razon_social?: string;
    nit?: string;
    reg_fiscal?: string;
  };
  catalogos: {
    totalClientes: number;
    clientesActivos: number;
    totalProveedores: number;
    proveedoresActivos: number;
  };
  compras: {
    totalDocumentos: number;
    totalCompras: number;
    creditoFiscal: number;
    gravadasLocales: number;
    exentasLocales: number;
    ivaRetenido: number;
    ivaPercibido: number;
  };
  ventas: {
    totalDocumentos: number;
    totalVentas: number;
    debitoFiscal: number;
    ventasContribuyentes: number;
    ventasConsumidorFinal: number;
    gravadasLocales: number;
    ventasExentas: number;
    retencion: number;
  };
  liquidacionEstimada: {
    totalDebito: number;
    totalCredito: number;
    diferenciaIva: number;
    ivaAPagar: number;
    remanenteFavor: number;
    pagoCuentaEstimado: number;
    totalAPagarFisco: number;
  };
  tendenciaMensual: Array<{
    mes: number;
    anio: number;
    nombreMes: string;
    ventas: number;
    compras: number;
    debito: number;
    credito: number;
  }>;
  ultimasCompras: Array<{
    fecha: string;
    documento: string;
    num_control: string;
    nom_proveedor: string;
    total: number;
    credito_fiscal: number;
  }>;
  ultimasVentas: Array<{
    fecha: string;
    documento: string;
    num_control: string;
    nom_cliente: string;
    total: number;
    debito_fiscal: number;
  }>;
}

export interface QuickConsumerItem {
  id?: string;
  codigoGeneracion: string;
  numeroControl?: string;
  selloRecepcion?: string;
  monto: number;
}

export interface BatchConsumidorFinalPayload {
  fecha: string;
  items: Array<{
    codigoGeneracion: string;
    numeroControl?: string;
    selloRecepcion?: string;
    monto: number;
  }>;
}

export interface BatchConsumidorFinalResponse {
  totalGuardados: number;
  duplicadosOmitidos: number;
}
