import { pool } from '../config/db';
import { getPeriodoCompras } from './catalogsService';

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

const NOMBRES_MESES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

export async function getDashboardData(
  codEmp: number,
  yearParam?: number,
  monthParam?: number,
): Promise<DashboardData> {
  // 1. Determine period
  let year = yearParam;
  let month = monthParam;

  if (!year || !month) {
    try {
      const configPeriod = await getPeriodoCompras(codEmp);
      if (configPeriod) {
        year = year || configPeriod.anio;
        month = month || configPeriod.mes;
      }
    } catch {
      // Ignorar y usar fallback
    }
  }

  if (!year || !month) {
    const now = new Date();
    year = year || now.getFullYear();
    month = month || (now.getMonth() + 1);
  }

  // 2. Pre-calcular los 6 meses de tendencia histórica
  const targetMonths: Array<{ y: number; m: number; label: string; periodKey: number }> = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(year, month - 1 - i, 1);
    const m = d.getMonth() + 1;
    const y = d.getFullYear();
    targetMonths.push({
      y,
      m,
      label: `${NOMBRES_MESES[m - 1]} ${y}`,
      periodKey: y * 100 + m,
    });
  }

  const oldest = targetMonths[0];
  const newest = targetMonths[targetMonths.length - 1];
  const minPeriod = oldest.periodKey;
  const maxPeriod = newest.periodKey;
  const startDateStr = `${oldest.y}-${String(oldest.m).padStart(2, '0')}-01`;
  const endLastDay = new Date(newest.y, newest.m, 0).getDate();
  const endDateStr = `${newest.y}-${String(newest.m).padStart(2, '0')}-${String(endLastDay).padStart(2, '0')} 23:59:59`;

  // 3. Ejecutar todas las consultas en paralelo con tolerancia a fallos
  const [
    empResult,
    cliResult,
    provResult,
    compResult,
    ventResult,
    comp6mResult,
    vent6mResult,
    recentComprasResult,
    recentVentasResult,
  ] = await Promise.all([
    // Empresa
    pool.query(
      'SELECT cod_emp, nom_emp, razon_social, nit, reg_fiscal FROM empresas WHERE cod_emp = ? LIMIT 1',
      [codEmp],
    ).catch((err) => {
      console.warn('[Dashboard] Error al consultar empresa:', err.message);
      return [[]];
    }),

    // Clientes
    pool.query(
      'SELECT COUNT(*) as total, COALESCE(SUM(activo = 1), 0) as activos FROM clientes',
    ).catch((err) => {
      console.warn('[Dashboard] Error al consultar clientes:', err.message);
      return [[]];
    }),

    // Proveedores
    pool.query(
      'SELECT COUNT(*) as total, COALESCE(SUM(activo = 1), 0) as activos FROM proveedores',
    ).catch((err) => {
      console.warn('[Dashboard] Error al consultar proveedores:', err.message);
      return [[]];
    }),

    // Compras del periodo seleccionado
    pool.query(
      `SELECT 
        COUNT(*) as totalDocumentos,
        COALESCE(SUM(
          COALESCE(exentas_locales, 0) + COALESCE(exentas_importaciones, 0) + COALESCE(exentas_internaciones, 0) +
          (COALESCE(gravadas_locales, 0) - COALESCE(rebajas_y_devoluciones, 0)) + COALESCE(gravadas_importaciones, 0) + COALESCE(gravadas_internaciones, 0) +
          COALESCE(no_sujetas, 0) + COALESCE(credito_fiscal, 0) + COALESCE(anticipo_a_cuenta, 0) -
          COALESCE(iva_retenido, 0) + COALESCE(iva_percibido, 0)
        ), 0) as totalCompras,
        COALESCE(SUM(credito_fiscal), 0) as creditoFiscal,
        COALESCE(SUM(COALESCE(gravadas_locales, 0) - COALESCE(rebajas_y_devoluciones, 0)), 0) as gravadasLocales,
        COALESCE(SUM(exentas_locales), 0) as exentasLocales,
        COALESCE(SUM(iva_retenido), 0) as ivaRetenido,
        COALESCE(SUM(iva_percibido), 0) as ivaPercibido
      FROM compras_iva
      WHERE cod_emp = ? AND periodo_ano = ? AND periodo_mes = ?`,
      [codEmp, year, month],
    ).catch((err) => {
      console.warn('[Dashboard] Error al consultar compras periodo:', err.message);
      return [[]];
    }),

    // Ventas del periodo seleccionado
    pool.query(
      `SELECT 
        COUNT(*) as totalDocumentos,
        COALESCE(SUM(
          COALESCE(gravadas_locales, 0) + COALESCE(gravadas_exportacion, 0) +
          COALESCE(ventas_exentas, 0) + COALESCE(ventas_no_sujetas, 0) +
          COALESCE(debito_fiscal, 0) - COALESCE(rebajas_y_devoluciones, 0)
        ), 0) as totalVentas,
        COALESCE(SUM(debito_fiscal), 0) as debitoFiscal,
        COALESCE(SUM(gravadas_locales), 0) as gravadasLocales,
        COALESCE(SUM(ventas_exentas), 0) as ventasExentas,
        COALESCE(SUM(iva_retenido), 0) as retencion,
        COALESCE(SUM(CASE WHEN id_tipo_documento = '01' THEN 
          COALESCE(gravadas_locales, 0) + COALESCE(gravadas_exportacion, 0) + COALESCE(ventas_exentas, 0) + COALESCE(ventas_no_sujetas, 0)
          ELSE 0 END), 0) as ventasCF,
        COALESCE(SUM(CASE WHEN id_tipo_documento != '01' THEN 
          COALESCE(gravadas_locales, 0) + COALESCE(gravadas_exportacion, 0) + COALESCE(ventas_exentas, 0) + COALESCE(ventas_no_sujetas, 0) + COALESCE(debito_fiscal, 0) - COALESCE(rebajas_y_devoluciones, 0)
          ELSE 0 END), 0) as ventasContribuyentes
      FROM ventas_iva
      WHERE cod_emp = ? AND YEAR(fecha) = ? AND MONTH(fecha) = ?`,
      [codEmp, year, month],
    ).catch((err) => {
      console.warn('[Dashboard] Error al consultar ventas periodo:', err.message);
      return [[]];
    }),

    // Tendencia compras últimos 6 meses (1 sola consulta agrupada)
    pool.query(
      `SELECT 
        periodo_ano,
        periodo_mes,
        COALESCE(SUM(
          COALESCE(exentas_locales, 0) + COALESCE(exentas_importaciones, 0) + COALESCE(exentas_internaciones, 0) +
          (COALESCE(gravadas_locales, 0) - COALESCE(rebajas_y_devoluciones, 0)) + COALESCE(gravadas_importaciones, 0) + COALESCE(gravadas_internaciones, 0) +
          COALESCE(no_sujetas, 0) + COALESCE(credito_fiscal, 0) + COALESCE(anticipo_a_cuenta, 0) -
          COALESCE(iva_retenido, 0) + COALESCE(iva_percibido, 0)
        ), 0) as compras,
        COALESCE(SUM(credito_fiscal), 0) as credito
      FROM compras_iva
      WHERE cod_emp = ? AND (periodo_ano * 100 + periodo_mes) BETWEEN ? AND ?
      GROUP BY periodo_ano, periodo_mes`,
      [codEmp, minPeriod, maxPeriod],
    ).catch((err) => {
      console.warn('[Dashboard] Error al consultar tendencia compras 6m:', err.message);
      return [[]];
    }),

    // Tendencia ventas últimos 6 meses (1 sola consulta agrupada)
    pool.query(
      `SELECT 
        YEAR(fecha) as anio,
        MONTH(fecha) as mes,
        COALESCE(SUM(
          COALESCE(gravadas_locales, 0) + COALESCE(gravadas_exportacion, 0) +
          COALESCE(ventas_exentas, 0) + COALESCE(ventas_no_sujetas, 0) +
          COALESCE(debito_fiscal, 0) - COALESCE(rebajas_y_devoluciones, 0)
        ), 0) as ventas,
        COALESCE(SUM(debito_fiscal), 0) as debito,
        COALESCE(SUM(CASE WHEN id_tipo_documento = '01' THEN 
          COALESCE(gravadas_locales, 0) + COALESCE(gravadas_exportacion, 0) + COALESCE(ventas_exentas, 0) + COALESCE(ventas_no_sujetas, 0)
          ELSE 0 END), 0) as ventasCF
      FROM ventas_iva
      WHERE cod_emp = ? AND fecha >= ? AND fecha <= ?
      GROUP BY YEAR(fecha), MONTH(fecha)`,
      [codEmp, startDateStr, endDateStr],
    ).catch((err) => {
      console.warn('[Dashboard] Error al consultar tendencia ventas 6m:', err.message);
      return [[]];
    }),

    // Últimas 5 compras
    pool.query(
      `SELECT 
        DATE_FORMAT(c.fecha, '%Y-%m-%d') as fecha,
        c.documento,
        c.num_control,
        COALESCE(p.nom_proveedor, c.cod_proveedor) as nom_proveedor,
        ROUND(
          COALESCE(c.exentas_locales, 0) + (COALESCE(c.gravadas_locales, 0) - COALESCE(c.rebajas_y_devoluciones, 0)) + COALESCE(c.credito_fiscal, 0) -
          COALESCE(c.iva_retenido, 0) + COALESCE(c.iva_percibido, 0)
        , 2) as total,
        c.credito_fiscal
      FROM compras_iva c
      LEFT JOIN proveedores p ON c.cod_proveedor = p.cod_proveedor
      WHERE c.cod_emp = ?
      ORDER BY c.fecha DESC, c.llave DESC
      LIMIT 5`,
      [codEmp],
    ).catch((err) => {
      console.warn('[Dashboard] Error al consultar ultimas compras:', err.message);
      return [[]];
    }),

    // Últimas 5 ventas
    pool.query(
      `SELECT 
        DATE_FORMAT(v.fecha, '%Y-%m-%d') as fecha,
        v.documento,
        v.num_control,
        COALESCE(cl.nom_cliente, v.cod_cliente) as nom_cliente,
        ROUND(
          COALESCE(v.gravadas_locales, 0) + COALESCE(v.ventas_exentas, 0) + COALESCE(v.debito_fiscal, 0) -
          COALESCE(v.rebajas_y_devoluciones, 0)
        , 2) as total,
        v.debito_fiscal
      FROM ventas_iva v
      LEFT JOIN clientes cl ON v.cod_cliente = cl.cod_cliente
      WHERE v.cod_emp = ?
      ORDER BY v.fecha DESC, v.llave DESC
      LIMIT 5`,
      [codEmp],
    ).catch((err) => {
      console.warn('[Dashboard] Error al consultar ultimas ventas:', err.message);
      return [[]];
    }),
  ]);

  // Extraer filas
  const empRows = (empResult as any[])[0] || [];
  const cliRows = (cliResult as any[])[0] || [];
  const provRows = (provResult as any[])[0] || [];
  const comprasRows = (compResult as any[])[0] || [];
  const ventasRows = (ventResult as any[])[0] || [];
  const comp6mRows = (comp6mResult as any[])[0] || [];
  const vent6mRows = (vent6mResult as any[])[0] || [];
  const recentCompras = (recentComprasResult as any[])[0] || [];
  const recentVentas = (recentVentasResult as any[])[0] || [];

  const empresaRaw = empRows[0] || {
    cod_emp: codEmp,
    nom_emp: `Empresa #${codEmp}`,
  };

  const cliStats = cliRows[0] || { total: 0, activos: 0 };
  const provStats = provRows[0] || { total: 0, activos: 0 };

  const compStats = comprasRows[0] || {
    totalDocumentos: 0,
    totalCompras: 0,
    creditoFiscal: 0,
    gravadasLocales: 0,
    exentasLocales: 0,
    ivaRetenido: 0,
    ivaPercibido: 0,
  };

  const ventStats = ventasRows[0] || {
    totalDocumentos: 0,
    totalVentas: 0,
    debitoFiscal: 0,
    gravadasLocales: 0,
    ventasExentas: 0,
    retencion: 0,
    ventasCF: 0,
    ventasContribuyentes: 0,
  };

  // Cálculo de Débito Fiscal:
  // Para Consumidor Final ('01'), total incluye IVA: CF_net = CF / 1.13, CF_debito = CF - CF_net
  const cfTotal = Number(ventStats.ventasCF) || 0;
  const cfNet = Number((cfTotal / 1.13).toFixed(2));
  const cfDebito = Number((cfTotal - cfNet).toFixed(2));
  const debitoContribuyentes = Number(ventStats.debitoFiscal) || 0;
  const totalDebito = Number((debitoContribuyentes + cfDebito).toFixed(2));

  // Crédito fiscal de compras
  const totalCredito = Number(Number(compStats.creditoFiscal).toFixed(2)) || 0;

  // Liquidación estimada
  const diferenciaIva = Number((totalDebito - totalCredito).toFixed(2));
  const ivaAPagar = diferenciaIva > 0 ? diferenciaIva : 0;
  const remanenteFavor = diferenciaIva < 0 ? Math.abs(diferenciaIva) : 0;

  // Pago a cuenta (1.75% sobre base imponible de ventas)
  const baseImponibleVentas = Number((Number(ventStats.ventasContribuyentes) + cfNet).toFixed(2));
  const pagoCuentaEstimado = Number((baseImponibleVentas * 0.0175).toFixed(2));
  const totalAPagarFisco = Number((ivaAPagar + pagoCuentaEstimado).toFixed(2));

  // Indexar histórico compras por periodoKey
  const compMap = new Map<number, { compras: number; credito: number }>();
  for (const r of comp6mRows as Array<{ periodo_ano: number; periodo_mes: number; compras: number; credito: number }>) {
    compMap.set(r.periodo_ano * 100 + r.periodo_mes, {
      compras: Number(r.compras) || 0,
      credito: Number(r.credito) || 0,
    });
  }

  // Indexar histórico ventas por periodoKey
  const ventMap = new Map<number, { ventas: number; debito: number; ventasCF: number }>();
  for (const r of vent6mRows as Array<{ anio: number; mes: number; ventas: number; debito: number; ventasCF: number }>) {
    ventMap.set(r.anio * 100 + r.mes, {
      ventas: Number(r.ventas) || 0,
      debito: Number(r.debito) || 0,
      ventasCF: Number(r.ventasCF) || 0,
    });
  }

  // Construir serie mensual en memoria
  const tendenciaMensual: DashboardData['tendenciaMensual'] = targetMonths.map((tm) => {
    const cData = compMap.get(tm.periodKey) || { compras: 0, credito: 0 };
    const vData = ventMap.get(tm.periodKey) || { ventas: 0, debito: 0, ventasCF: 0 };
    const vCF = Number(vData.ventasCF) || 0;
    const debitoMes = Number((Number(vData.debito) + (vCF - vCF / 1.13)).toFixed(2));

    return {
      mes: tm.m,
      anio: tm.y,
      nombreMes: tm.label,
      ventas: Number(Number(vData.ventas).toFixed(2)),
      compras: Number(Number(cData.compras).toFixed(2)),
      debito: debitoMes,
      credito: Number(Number(cData.credito).toFixed(2)),
    };
  });

  return {
    periodo: { mes: month, anio: year },
    empresa: empresaRaw,
    catalogos: {
      totalClientes: Number(cliStats.total) || 0,
      clientesActivos: Number(cliStats.activos) || 0,
      totalProveedores: Number(provStats.total) || 0,
      proveedoresActivos: Number(provStats.activos) || 0,
    },
    compras: {
      totalDocumentos: Number(compStats.totalDocumentos) || 0,
      totalCompras: Number(Number(compStats.totalCompras).toFixed(2)) || 0,
      creditoFiscal: totalCredito,
      gravadasLocales: Number(Number(compStats.gravadasLocales).toFixed(2)) || 0,
      exentasLocales: Number(Number(compStats.exentasLocales).toFixed(2)) || 0,
      ivaRetenido: Number(Number(compStats.ivaRetenido).toFixed(2)) || 0,
      ivaPercibido: Number(Number(compStats.ivaPercibido).toFixed(2)) || 0,
    },
    ventas: {
      totalDocumentos: Number(ventStats.totalDocumentos) || 0,
      totalVentas: Number(Number(ventStats.totalVentas).toFixed(2)) || 0,
      debitoFiscal: totalDebito,
      ventasContribuyentes: Number(Number(ventStats.ventasContribuyentes).toFixed(2)) || 0,
      ventasConsumidorFinal: Number(Number(ventStats.ventasCF).toFixed(2)) || 0,
      gravadasLocales: Number(Number(ventStats.gravadasLocales).toFixed(2)) || 0,
      ventasExentas: Number(Number(ventStats.ventasExentas).toFixed(2)) || 0,
      retencion: Number(Number(ventStats.retencion).toFixed(2)) || 0,
    },
    liquidacionEstimada: {
      totalDebito,
      totalCredito,
      diferenciaIva,
      ivaAPagar,
      remanenteFavor,
      pagoCuentaEstimado,
      totalAPagarFisco,
    },
    tendenciaMensual,
    ultimasCompras: (recentCompras as Array<{
      fecha: string;
      documento: string;
      num_control: string;
      nom_proveedor: string;
      total: number;
      credito_fiscal: number;
    }>) || [],
    ultimasVentas: (recentVentas as Array<{
      fecha: string;
      documento: string;
      num_control: string;
      nom_cliente: string;
      total: number;
      debito_fiscal: number;
    }>) || [],
  };
}
