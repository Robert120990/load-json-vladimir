export interface Direccion {
  departamento?: string;
  municipio?: string;
  complemento?: string;
}

export interface Contribuyente {
  nit?: string;
  nrc?: string | null;
  nombre?: string;
  nombreComercial?: string | null;
  codActividad?: string;
  descActividad?: string;
  direccion?: Direccion;
  telefono?: string;
  correo?: string;
}

export interface Emisor extends Contribuyente {
  tipoEstablecimiento?: string;
  codPuntoVentaMH?: string;
  codPuntoVenta?: string;
  codEstableMH?: string;
  codEstable?: string;
}

export interface Identificacion {
  version?: number;
  ambiente?: string;
  tipoDte?: string;
  numeroControl?: string;
  codigoGeneracion?: string;
  tipoModelo?: number;
  tipoOperacion?: number;
  tipoContingencia?: string | null;
  motivoContin?: string | null;
  fecEmi?: string;
  horEmi?: string;
  tipoMoneda?: string;
}

export interface CuerpoItem {
  numItem?: number;
  tipoItem?: number;
  numeroDocumento?: string | null;
  codTributo?: string | null;
  descripcion?: string;
  cantidad?: number;
  uniMedida?: number;
  precioUni?: number;
  montoDescu?: number;
  ventaNoSuj?: number;
  ventaExenta?: number;
  ventaGravada?: number;
  tributos?: string[];
  psv?: number;
  noGravado?: number;
  codigo?: string;
  valorOperaciones?: number;
  montoSinPercepcion?: number;
  subTotal?: number;
  iva?: number;
  IVA?: number;
  montoSujetoPercepcion?: number;
  ivaPercibido?: number;
  IVApercibido?: number;
  liquidoApagar?: number;
}

export interface CuerpoLiquidacionContable {
  periodoLiquidacionFechaInicio?: string;
  periodoLiquidacionFechaFin?: string;
  codLiquidacion?: string | number | null;
  cantidadDoc?: number | null;
  valorOperaciones?: number;
  montoSinPercepcion?: number;
  descripSinPercepcion?: string | null;
  subTotal?: number;
  iva?: number;
  IVA?: number;
  montoSujetoPercepcion?: number;
  ivaPercibido?: number;
  IVApercibido?: number;
  comision?: number;
  porcentComision?: string | number | null;
  ivaComision?: number;
  IVAcomision?: number;
  liquidoApagar?: number;
  totalLetras?: string;
  observaciones?: string | null;
}

export interface TributoResumen {
  codigo?: string;
  descripcion?: string;
  valor?: number;
}

export interface Pago {
  codigo?: string;
  montoPago?: number;
  referencia?: string | null;
  periodo?: number | null;
  plazo?: string | null;
}

export interface Resumen {
  ivaPerci1?: number;
  ivaPerci?: number;
  ivaPercibido?: number;
  IVApercibido?: number;
  montoSujetoPercepcion?: number;
  valorOperaciones?: number;
  totalNoSuj?: number;
  totalExenta?: number;
  totalGravada?: number;
  subTotalVentas?: number;
  descuNoSuj?: number;
  descuExenta?: number;
  descuGravada?: number;
  porcentajeDescuento?: number;
  totalDescu?: number;
  tributos?: TributoResumen[];
  subTotal?: number;
  ivaRete1?: number;
  reteRenta?: number;
  montoTotalOperacion?: number;
  totalNoGravado?: number;
  totalPagar?: number;
  total?: number;
  liquidoApagar?: number;
  totalLetras?: string;
  saldoFavor?: number;
  condicionOperacion?: number;
  pagos?: Pago[];
  numPagoElectronico?: string | null;
}

export interface Extension {
  nombEntrega?: string | null;
  docuEntrega?: string | null;
  nombRecibe?: string | null;
  docuRecibe?: string | null;
  observaciones?: string | null;
  placaVehiculo?: string | null;
}

export interface RespuestaHacienda {
  version?: number;
  ambiente?: string;
  versionApp?: number;
  estado?: string;
  codigoGeneracion?: string;
  numeroControl?: string;
  selloRecibido?: string;
  fhProcesamiento?: string;
  clasificaMsg?: string;
  codigoMsg?: string;
  descripcionMsg?: string;
  observaciones?: unknown[];
}

export interface DteJson {
  identificacion: Identificacion;
  emisor?: Emisor;
  receptor?: Contribuyente;
  otrosDocumentos?: unknown;
  documentoRelacionado?: unknown;
  ventaTercero?: unknown;
  cuerpoDocumento?: CuerpoItem[] | CuerpoLiquidacionContable;
  resumen?: Resumen;
  extension?: Extension;
  apendice?: unknown;
  version?: number;
  ambiente?: string;
  versionApp?: number;
  estado?: string;
  codigoGeneracion?: string;
  selloRecibido?: string;
  selloRecepcion?: string;
  selloAutenticacion?: string;
  respuestaHacienda?: RespuestaHacienda;
  responseMH?: RespuestaHacienda;
  respuestaMH?: RespuestaHacienda;
  fhProcesamiento?: string;
  clasificaMsg?: string;
  codigoMsg?: string;
  descripcionMsg?: string;
  observaciones?: unknown[];
}
