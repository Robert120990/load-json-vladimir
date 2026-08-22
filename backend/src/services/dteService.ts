import { createHash } from 'node:crypto';
import { pool } from '../config/db';
import { ApiError } from '../middlewares/error';
import type { Empresa, UsuarioAutenticado } from '../types/entities';
import type { DteJson } from '../types/dte';

export type TipoDte = 'ventas' | 'compras';

export interface PeriodoCompras {
  mes: number;
  anio: number;
}

export interface DteSummary {
  id: number;
  fileName: string;
  pertenece: boolean;
  error?: string;
  tipoDte?: string;
  fecha?: string;
  codigoGeneracion?: string;
  numeroControl?: string;
  nitContraparte?: string;
  nrcContraparte?: string;
  nombreContraparte?: string;
  montoTotal?: number;
  sinSello?: boolean;
}

export interface ValidateItem {
  id: number;
  fileName: string;
  codigoGeneracion?: string;
  nitContraparte?: string;
  nrcContraparte?: string;
}

export type EstadoValidacion = 'valido' | 'duplicado' | 'cliente_no_existe' | 'proveedor_no_existe';

export interface ValidateResultado {
  id: number;
  estado: EstadoValidacion;
}

export interface SaveItem {
  fileName: string;
  content: string;
}

export interface SaveItemResultado {
  fileName: string;
  ok: boolean;
  error?: string;
}

export interface SaveResultado {
  insertados: number;
  errores: number;
  resultados: SaveItemResultado[];
}

const VENTAS_COLS = [
  'cod_emp', 'llave', 'fecha', 'id_tipo_documento', 'documento', 'cod_cliente',
  'gravadas_locales', 'gravadas_exportacion', 'ventas_exentas', 'ventas_no_sujetas',
  'cuentas_a_terceros', 'rebajas_y_devoluciones', 'iva_retenido', 'iva_percibido',
  'debito_fiscal', 'debito_fiscal_a_terceros', 'corr_maquina_registradora', 'serie',
  'id_sucursal',
];

const COMPRAS_COLS = [
  'cod_emp', 'llave', 'fecha', 'id_tipo_documento', 'documento', 'cod_proveedor',
  'exentas_locales', 'exentas_importaciones', 'exentas_internaciones',
  'gravadas_locales', 'gravadas_importaciones', 'gravadas_internaciones',
  'no_sujetas', 'credito_fiscal', 'anticipo_a_cuenta', 'iva_retenido',
  'iva_percibido', 'retencion_a_terceros', 'compras_a_excluidos',
  'rebajas_y_devoluciones', 'iva_rebajas_y_devoluciones',
  'corr_maquina_registradora', 'periodo_ano', 'periodo_mes', 'cod_sucursal',
  'cod_punto_venta',
];

const VENTAS_TABLA = 'ventas_iva';
const COMPRAS_TABLA = 'compras_iva';
const CODIGO_IVA = '20';

export function parseDte(raw: string): DteJson {
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || !(parsed as DteJson).identificacion) {
    throw new Error('Estructura de DTE inválida');
  }
  return parsed as DteJson;
}

export function normalizarIdentificador(valor: string | null | undefined): string {
  return (valor ?? '').replace(/[-\s]/g, '').toUpperCase();
}

function buscarValorInsensible(objeto: object | null | undefined, ...nombres: string[]): string {
  if (!objeto || typeof objeto !== 'object') return '';
  const mapa = new Map<string, unknown>(
    Object.entries(objeto).map(([clave, valor]) => [clave.toLowerCase(), valor]),
  );
  for (const nombre of nombres) {
    const valor = mapa.get(nombre.toLowerCase());
    if (typeof valor === 'string' && valor.trim()) return valor;
  }
  return '';
}

function obtenerSeccion(objeto: object | null | undefined, ...nombresSeccion: string[]): object | null {
  if (!objeto || typeof objeto !== 'object') return null;
  const mapa = new Map<string, unknown>(
    Object.entries(objeto).map(([clave, valor]) => [clave.toLowerCase(), valor]),
  );
  for (const nombre of nombresSeccion) {
    const valor = mapa.get(nombre.toLowerCase());
    if (valor && typeof valor === 'object' && !Array.isArray(valor)) return valor as object;
  }
  return null;
}

const SECCIONES_SOBRE = ['respuestaHacienda', 'responseMH'];

export function obtenerCodigoGeneracion(dte: DteJson): string {
  return buscarValorInsensible(dte, 'codigoGeneracion')
    || buscarValorInsensible(dte.identificacion, 'codigoGeneracion')
    || buscarValorInsensible(obtenerSeccion(dte, ...SECCIONES_SOBRE), 'codigoGeneracion')
    || '';
}

export function obtenerSelloRecibido(dte: DteJson): string {
  return buscarValorInsensible(dte, 'selloRecibido', 'selloRecepcion', 'sello')
    || buscarValorInsensible(
        obtenerSeccion(dte, ...SECCIONES_SOBRE),
        'selloRecibido',
        'selloRecepcion',
        'sello',
      )
    || '';
}

function coincide(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return normalizarIdentificador(a) === normalizarIdentificador(b);
}

export function perteneceEmpresa(dte: DteJson, empresa: Empresa, tipo: TipoDte): boolean {
  if (tipo === 'ventas') {
    return coincide(dte.emisor?.nit, empresa.nit) || coincide(dte.emisor?.nrc, empresa.reg_fiscal);
  }
  return coincide(dte.receptor?.nit, empresa.nit) || coincide(dte.receptor?.nrc, empresa.reg_fiscal);
}

export function extraerIva(dte: DteJson): number {
  const tributos = dte.resumen?.tributos ?? [];
  const iva = tributos.find((t) => String(t.codigo ?? '').trim() === CODIGO_IVA);
  return iva?.valor ?? 0;
}

function generarLlave(dte: DteJson): string {
  const base = obtenerCodigoGeneracion(dte).replace(/[^a-zA-Z0-9]/g, '');
  const origen = base.length >= 20
    ? base
    : `${obtenerCodigoGeneracion(dte)}${dte.identificacion.numeroControl ?? ''}${dte.identificacion.fecEmi ?? ''}`;
  const hash = createHash('sha1').update(origen).digest('hex').toUpperCase();
  return (base + hash).slice(0, 20).toUpperCase();
}

function obtenerContraparte(dte: DteJson, tipo: TipoDte) {
  return tipo === 'ventas' ? dte.receptor : dte.emisor;
}

export function construirResumen(dte: DteJson, fileName: string, id: number, tipo: TipoDte): DteSummary {
  const contraparte = obtenerContraparte(dte, tipo);
  return {
    id,
    fileName,
    pertenece: true,
    tipoDte: dte.identificacion.tipoDte,
    fecha: dte.identificacion.fecEmi,
    codigoGeneracion: obtenerCodigoGeneracion(dte),
    numeroControl: dte.identificacion.numeroControl
      ?? buscarValorInsensible(obtenerSeccion(dte, ...SECCIONES_SOBRE), 'numeroControl'),
    nitContraparte: contraparte?.nit,
    nrcContraparte: contraparte?.nrc ?? undefined,
    nombreContraparte: contraparte?.nombre,
    montoTotal: dte.resumen?.montoTotalOperacion ?? dte.resumen?.totalPagar ?? 0,
    sinSello: !obtenerSelloRecibido(dte),
  };
}

export function construirErrorResumen(fileName: string, id: number, error: string): DteSummary {
  return { id, fileName, pertenece: false, error };
}

export function normalizarFecha(valor: string | null | undefined): string {
  const texto = (valor ?? '').trim();
  if (!texto) return '';

  let coincidencia = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (coincidencia) {
    return `${coincidencia[1]}-${coincidencia[2]}-${coincidencia[3]}`;
  }

  coincidencia = texto.match(/^(\d{2})[/-](\d{2})[/-](\d{4})/);
  if (coincidencia) {
    return `${coincidencia[3]}-${coincidencia[2]}-${coincidencia[1]}`;
  }

  const fecha = new Date(texto);
  return Number.isNaN(fecha.getTime()) ? '' : fecha.toISOString().slice(0, 10);
}

export async function getPeriodoCompras(codEmp: number): Promise<PeriodoCompras | null> {
  const [rows] = await pool.query(
    'SELECT mes, anio FROM periodo_compras WHERE cod_emp = ? LIMIT 1',
    [codEmp],
  );
  const fila = (rows as Array<{ mes: number; anio: number }>)[0];
  return fila ? { mes: fila.mes, anio: fila.anio } : null;
}

export function mapearTipoDocumento(tipoDte: string | undefined, tipo: TipoDte): string {
  const original = tipoDte ?? '';
  const mapa = tipo === 'ventas'
    ? { '03': '03', '01': '01', '05': '07' }
    : { '03': '02', '01': '01', '05': '09' };
  return mapa[original as keyof typeof mapa] ?? original;
}

function mapearFila(
  dte: DteJson,
  usuario: UsuarioAutenticado,
  tipo: TipoDte,
  codContraparte: string,
  periodoCompras: PeriodoCompras | null,
): Array<string | number | null> {
  const codEmp = usuario.cod_emp ?? null;
  const fecha = normalizarFecha(dte.identificacion.fecEmi);
  const tipoDocumento = mapearTipoDocumento(dte.identificacion.tipoDte, tipo);
  const documento = obtenerCodigoGeneracion(dte);
  const resumen = dte.resumen ?? {};
  const llave = generarLlave(dte);

  if (tipo === 'ventas') {
    return [
      codEmp, llave, fecha, tipoDocumento, documento, codContraparte,
      resumen.totalGravada ?? 0, 0, resumen.totalExenta ?? 0, resumen.totalNoSuj ?? 0,
      0, resumen.totalDescu ?? 0, resumen.ivaRete1 ?? 0, resumen.ivaPerci1 ?? 0,
      extraerIva(dte), 0, 0, obtenerSelloRecibido(dte), '01',
    ];
  }

  const periodoAno = periodoCompras?.anio ?? null;
  const periodoMes = periodoCompras?.mes ?? null;

  return [
    codEmp, llave, fecha, tipoDocumento, documento, codContraparte,
    resumen.totalExenta ?? 0, 0, 0, resumen.totalGravada ?? 0, 0, 0,
    resumen.totalNoSuj ?? 0, extraerIva(dte), 0, resumen.ivaRete1 ?? 0,
    resumen.ivaPerci1 ?? 0, 0, 0, resumen.totalDescu ?? 0, 0, 0,
    periodoAno, periodoMes, '01', dte.emisor?.codPuntoVenta ?? '',
  ];
}

async function existeDuplicado(tipo: TipoDte, codEmp: number, documento: string): Promise<boolean> {
  if (!documento) return false;
  const tabla = tipo === 'ventas' ? VENTAS_TABLA : COMPRAS_TABLA;
  const [rows] = await pool.query(
    `SELECT 1 FROM ${tabla} WHERE cod_emp = ? AND documento = ? LIMIT 1`,
    [codEmp, documento],
  );
  return (rows as unknown[]).length > 0;
}

async function obtenerCodContraparte(
  tipo: TipoDte,
  nit: string | null | undefined,
  nrc: string | null | undefined,
): Promise<string | null> {
  const nitNormalizado = normalizarIdentificador(nit);
  const nrcNormalizado = normalizarIdentificador(nrc);

  if (!nitNormalizado && !nrcNormalizado) return null;

  const tabla = tipo === 'ventas' ? 'clientes' : 'proveedores';
  const columnaNit = tipo === 'ventas' ? 'nit_cliente' : 'nit_proveedor';
  const columnaCod = tipo === 'ventas' ? 'cod_cliente' : 'cod_proveedor';

  const condiciones: string[] = [];
  const parametros: string[] = [];
  if (nitNormalizado) {
    condiciones.push(`REPLACE(REPLACE(${columnaNit}, '-', ''), ' ', '') = ?`);
    parametros.push(nitNormalizado);
  }
  if (nrcNormalizado) {
    condiciones.push(`REPLACE(REPLACE(registro, '-', ''), ' ', '') = ?`);
    parametros.push(nrcNormalizado);
  }
  if (condiciones.length === 0) return null;

  const [rows] = await pool.query(
    `SELECT ${columnaCod} AS cod FROM ${tabla} WHERE ${condiciones.join(' OR ')} LIMIT 1`,
    parametros,
  );
  const fila = (rows as Array<{ cod: string | null }>)[0];
  return fila?.cod ?? null;
}

async function evaluarContraparte(
  tipo: TipoDte,
  nit: string | null | undefined,
  nrc: string | null | undefined,
): Promise<boolean> {
  if (!nit && !nrc) return true;
  return (await obtenerCodContraparte(tipo, nit, nrc)) !== null;
}

export async function validarItems(
  tipo: TipoDte,
  items: ValidateItem[],
  codEmp: number,
): Promise<ValidateResultado[]> {
  const resultados: ValidateResultado[] = [];

  for (const item of items) {
    let estado: EstadoValidacion = 'valido';

    if (await existeDuplicado(tipo, codEmp, item.codigoGeneracion ?? '')) {
      estado = 'duplicado';
    } else if (!(await evaluarContraparte(tipo, item.nitContraparte, item.nrcContraparte))) {
      estado = tipo === 'ventas' ? 'cliente_no_existe' : 'proveedor_no_existe';
    }

    resultados.push({ id: item.id, estado });
  }

  return resultados;
}

export async function guardarItems(
  tipo: TipoDte,
  items: SaveItem[],
  usuario: UsuarioAutenticado,
  empresa: Empresa,
): Promise<SaveResultado> {
  const tabla = tipo === 'ventas' ? VENTAS_TABLA : COMPRAS_TABLA;
  const columnas = tipo === 'ventas' ? VENTAS_COLS : COMPRAS_COLS;
  const placeholders = columnas.map(() => '?').join(', ');
  const codEmp = usuario.cod_emp;

  if (codEmp === null) {
    throw new Error('El usuario no tiene cod_emp asignado');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    let periodoCompras: PeriodoCompras | null = null;
    if (tipo === 'compras') {
      periodoCompras = await getPeriodoCompras(codEmp);
      if (!periodoCompras) {
        throw new ApiError(400, 'No hay periodo de compras configurado para la empresa');
      }
    }

    const resultados: SaveItemResultado[] = [];

    for (const item of items) {
      try {
        const dte = parseDte(item.content);

        if (!perteneceEmpresa(dte, empresa, tipo)) {
          throw new Error('El documento no pertenece a la empresa configurada');
        }
        if (!obtenerSelloRecibido(dte)) {
          throw new Error('El documento no incluye sello de recepción');
        }
        if (await existeDuplicado(tipo, codEmp, obtenerCodigoGeneracion(dte))) {
          throw new Error('El documento ya existe (duplicado)');
        }

        const contraparte = obtenerContraparte(dte, tipo);
        const codContraparte = await obtenerCodContraparte(tipo, contraparte?.nit, contraparte?.nrc);
        if (!codContraparte) {
          throw new Error(
            tipo === 'ventas'
              ? 'El cliente no existe en la tabla clientes'
              : 'El proveedor no existe en la tabla proveedores',
          );
        }

        const valores = mapearFila(dte, usuario, tipo, codContraparte, periodoCompras);
        await connection.query(
          `INSERT INTO ${tabla} (${columnas.join(', ')}) VALUES (${placeholders})`,
          valores,
        );
        resultados.push({ fileName: item.fileName, ok: true });
      } catch (err) {
        resultados.push({
          fileName: item.fileName,
          ok: false,
          error: err instanceof Error ? err.message : 'Error desconocido',
        });
      }
    }

    await connection.commit();

    const insertados = resultados.filter((r) => r.ok).length;
    return { insertados, errores: resultados.length - insertados, resultados };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}
