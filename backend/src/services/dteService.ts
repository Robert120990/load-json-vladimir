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
  fueraPeriodo?: boolean;
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
  'id_sucursal', 'num_control',
];

const COMPRAS_COLS = [
  'cod_emp', 'llave', 'fecha', 'id_tipo_documento', 'documento', 'cod_proveedor',
  'exentas_locales', 'exentas_importaciones', 'exentas_internaciones',
  'gravadas_locales', 'gravadas_importaciones', 'gravadas_internaciones',
  'no_sujetas', 'credito_fiscal', 'anticipo_a_cuenta', 'iva_retenido',
  'iva_percibido', 'retencion_a_terceros', 'compras_a_excluidos',
  'rebajas_y_devoluciones', 'iva_rebajas_y_devoluciones',
  'corr_maquina_registradora', 'periodo_ano', 'periodo_mes', 'cod_sucursal',
  'cod_punto_venta', 'num_control', 'sello_recepcion',
];

const VENTAS_TABLA = 'ventas_iva';
const COMPRAS_TABLA = 'compras_iva';
const CODIGO_IVA = '20';
const CODIGO_FOVIAL = 'D1';
const CODIGO_COTRANS = 'C8';

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

const SECCIONES_SOBRE = [
  'respuestaHacienda',
  'responseMH',
  'respuestaMH',
  'acuseMH',
  'acuseHacienda',
  'recepcionMH',
  'mhResponse',
];

export function obtenerCodigoGeneracion(dte: DteJson): string {
  return buscarValorInsensible(dte, 'codigoGeneracion')
    || buscarValorInsensible(dte.identificacion, 'codigoGeneracion')
    || buscarValorInsensible(obtenerSeccion(dte, ...SECCIONES_SOBRE), 'codigoGeneracion')
    || '';
}

export function obtenerSelloRecibido(dte: DteJson): string {
  const directo = buscarValorInsensible(dte, 'selloRecibido', 'selloRecepcion', 'sello', 'selloAutenticacion')
    || buscarValorInsensible(
        obtenerSeccion(dte, ...SECCIONES_SOBRE),
        'selloRecibido',
        'selloRecepcion',
        'sello',
        'selloAutenticacion',
      );
  if (directo) return directo;

  for (const valor of Object.values(dte)) {
    if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
      const encontrado = buscarValorInsensible(
        valor as object,
        'selloRecibido',
        'selloRecepcion',
        'sello',
        'selloAutenticacion',
      );
      if (encontrado) return encontrado;
    }
  }

  return '';
}

export function obtenerNumeroControl(dte: DteJson): string {
  return dte.identificacion.numeroControl
    ?? buscarValorInsensible(obtenerSeccion(dte, ...SECCIONES_SOBRE), 'numeroControl')
    ?? '';
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

/**
 * Extracts FOVIAL (D1) and COTRANS (C8) fuel tax values from DTE summary tributes.
 */
export function extraerFovialCotrans(dte: DteJson): number {
  const tributos = dte.resumen?.tributos ?? [];
  return tributos
    .filter((t) => {
      const codigo = String(t.codigo ?? '').trim().toUpperCase();
      const descripcion = String(t.descripcion ?? '').trim().toUpperCase();
      return (
        codigo === CODIGO_FOVIAL ||
        codigo === CODIGO_COTRANS ||
        descripcion.includes('FOVIAL') ||
        descripcion.includes('COTRANS')
      );
    })
    .reduce((sum, t) => sum + (Number(t.valor) || 0), 0);
}

/**
 * Extracts total purchase discounts to record gross taxable purchases.
 */
export function extraerDescuentoCompras(dte: DteJson): number {
  const resumen = dte.resumen;
  if ((Number(resumen?.totalDescu) || 0) > 0) {
    return Number((Number(resumen?.totalDescu) || 0).toFixed(2));
  }

  if (Array.isArray(dte.cuerpoDocumento)) {
    const suma = dte.cuerpoDocumento.reduce((acc, item) => acc + (Number(item.montoDescu) || 0), 0);
    if (suma > 0) {
      return Number(suma.toFixed(2));
    }
  }

  return 0;
}

export async function obtenerLlave(codEmp: number): Promise<string> {
  const [rows] = await pool.query('CALL devolver_correlativo_compra(@out)');
  const conjuntos = rows as Array<Array<{ corr_compra: number }>>;
  const correlativo = Number(conjuntos[0]?.[0]?.corr_compra ?? 0);
  return `${codEmp}WCP${String(correlativo).padStart(7, '0')}`;
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
    numeroControl: obtenerNumeroControl(dte),
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

export function fechaFueraDePeriodo(
  fechaNormalizada: string | null | undefined,
  periodo: PeriodoCompras,
): string | null {
  const coincidencia = (fechaNormalizada ?? '').trim().match(/^(\d{4})-(\d{2})-\d{2}$/);
  if (!coincidencia) {
    return 'El documento no tiene una fecha de emisión válida';
  }

  const mesesAtras = 2;
  const mesBruto = periodo.mes - mesesAtras;
  const anioMinimo = mesBruto <= 0 ? periodo.anio - 1 : periodo.anio;
  const mesMinimo = mesBruto <= 0 ? mesBruto + 12 : mesBruto;

  const anioFecha = Number(coincidencia[1]);
  const mesFecha = Number(coincidencia[2]);

  const antesDelRango =
    anioFecha < anioMinimo || (anioFecha === anioMinimo && mesFecha < mesMinimo);
  const despuesDelPeriodo =
    anioFecha > periodo.anio || (anioFecha === periodo.anio && mesFecha > periodo.mes);

  if (!antesDelRango && !despuesDelPeriodo) return null;

  const rango =
    `${String(mesMinimo).padStart(2, '0')}/${anioMinimo}` +
    ` a ${String(periodo.mes).padStart(2, '0')}/${periodo.anio}`;
  return `La fecha de emisión ${fechaNormalizada} está fuera del rango del periodo de compras (${rango})`;
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
  llave: string,
): Array<string | number | null> {
  const codEmp = usuario.cod_emp ?? null;
  const fecha = normalizarFecha(dte.identificacion.fecEmi);
  const tipoDocumento = mapearTipoDocumento(dte.identificacion.tipoDte, tipo);
  const documento = obtenerCodigoGeneracion(dte);
  const resumen = dte.resumen ?? {};

  if (tipo === 'ventas') {
    return [
      codEmp, llave, fecha, tipoDocumento, documento, codContraparte,
      resumen.totalGravada ?? 0, 0, resumen.totalExenta ?? 0, resumen.totalNoSuj ?? 0,
      0, resumen.totalDescu ?? 0, resumen.ivaRete1 ?? 0, resumen.ivaPerci1 ?? 0,
      extraerIva(dte), 0, 0, obtenerSelloRecibido(dte), '01',
      obtenerNumeroControl(dte),
    ];
  }

  const periodoAno = periodoCompras?.anio ?? null;
  const periodoMes = periodoCompras?.mes ?? null;

  // Add FOVIAL and COTRANS fuel taxes to local exempt purchases (exentas_locales)
  const fovialCotrans = extraerFovialCotrans(dte);
  const exentasLocales = Number(((resumen.totalExenta ?? 0) + fovialCotrans).toFixed(2));

  // Store gross taxable purchases so that: Net Taxable = gravadas_locales - rebajas_y_devoluciones
  const descuento = extraerDescuentoCompras(dte);
  const gravadasLocales = Number(((resumen.totalGravada ?? 0) + descuento).toFixed(2));

  return [
    codEmp, llave, fecha, tipoDocumento, documento, codContraparte,
    exentasLocales, 0, 0, gravadasLocales, 0, 0,
    resumen.totalNoSuj ?? 0, extraerIva(dte), 0, resumen.ivaRete1 ?? 0,
    resumen.ivaPerci1 ?? 0, 0, 0, descuento, 0, 0,
    periodoAno, periodoMes, '01', dte.emisor?.codPuntoVenta ?? '',
    obtenerNumeroControl(dte),
    obtenerSelloRecibido(dte),
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
): Promise<string | null> {  const nitNormalizado = normalizarIdentificador(nit);
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

const NOMBRE_CLIENTE_GENERICO = 'CONSUMIDOR FINAL';

export async function obtenerClienteGenerico(): Promise<string | null> {
  const [rows] = await pool.query(
    'SELECT cod_cliente FROM clientes WHERE UPPER(TRIM(nom_cliente)) = ? LIMIT 1',
    [NOMBRE_CLIENTE_GENERICO],
  );
  const fila = (rows as Array<{ cod_cliente: string }>)[0];
  return fila?.cod_cliente ?? null;
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
    let clienteGenericoCache: string | null | undefined;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        const dte = parseDte(item.content);

        if (!perteneceEmpresa(dte, empresa, tipo)) {
          throw new Error('El documento no pertenece a la empresa configurada');
        }
        if (!obtenerSelloRecibido(dte)) {
          throw new Error('El documento no incluye sello de recepción');
        }
        if (tipo === 'compras' && periodoCompras) {
          const errorFecha = fechaFueraDePeriodo(
            normalizarFecha(dte.identificacion.fecEmi),
            periodoCompras,
          );
          if (errorFecha) throw new Error(errorFecha);
        }
        if (await existeDuplicado(tipo, codEmp, obtenerCodigoGeneracion(dte))) {
          throw new Error('El documento ya existe (duplicado)');
        }

        const contraparte = obtenerContraparte(dte, tipo);
        let codContraparte = await obtenerCodContraparte(tipo, contraparte?.nit, contraparte?.nrc);
        if (!codContraparte) {
          if (tipo === 'ventas' && !contraparte?.nit && !contraparte?.nrc) {
            if (clienteGenericoCache === undefined) {
              clienteGenericoCache = await obtenerClienteGenerico();
            }
            codContraparte = clienteGenericoCache ?? '';
            if (!codContraparte) {
              throw new Error(
                `Debe crear el cliente ${NOMBRE_CLIENTE_GENERICO} para esta empresa`,
              );
            }
          } else {
            throw new Error(
              tipo === 'ventas'
                ? 'El cliente no existe en la tabla clientes'
                : 'El proveedor no existe en la tabla proveedores',
            );
          }
        }

        const llave = await obtenerLlave(codEmp);
        const valores = mapearFila(dte, usuario, tipo, codContraparte, periodoCompras, llave);
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
