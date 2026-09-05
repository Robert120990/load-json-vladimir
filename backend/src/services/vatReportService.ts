import { pool } from '../config/db';
import { getEmpresaPorCodEmp } from './companyService';
import { getFirmasConta } from './catalogsService';
import type { VatBookSummary, TaxSettlementSummary } from '../types/controlIva';

const MONTH_NAMES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
];

export async function getLibroCompras(
  codEmp: number,
  year: number,
  month: number,
): Promise<VatBookSummary> {
  const empresa = await getEmpresaPorCodEmp(codEmp);
  const firmas = await getFirmasConta(codEmp);

  const [rows] = await pool.query(
    `SELECT 
      c.llave, DATE_FORMAT(c.fecha, '%d/%m/%Y') as fecha, c.documento,
      c.exentas_locales, c.exentas_importaciones, c.exentas_internaciones,
      c.gravadas_locales, c.gravadas_importaciones, c.gravadas_internaciones,
      c.no_sujetas, c.credito_fiscal, c.anticipo_a_cuenta,
      c.iva_retenido, c.iva_percibido, c.retencion_a_terceros,
      c.compras_a_excluidos, c.rebajas_y_devoluciones,
      p.nom_proveedor, p.registro as registro_proveedor, p.nit_proveedor
    FROM compras_iva c
    LEFT JOIN proveedores p ON c.cod_proveedor = p.cod_proveedor
    WHERE c.cod_emp = ? AND c.periodo_ano = ? AND c.periodo_mes = ?
    ORDER BY c.fecha ASC, c.llave ASC`,
    [codEmp, year, month],
  );

  const purchaseRows = rows as Array<{
    llave: string;
    fecha: string;
    documento: string;
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
    iva_percibido: number;
    retencion_a_terceros: number;
    compras_a_excluidos: number;
    rebajas_y_devoluciones: number;
    nom_proveedor: string | null;
    registro_proveedor: string | null;
    nit_proveedor: string | null;
  }>;

  let totExentas = 0;
  let totNoSujetas = 0;
  let totGravadas = 0;
  let totCreditoFiscal = 0;
  let totAnticipo = 0;
  let totRetenido = 0;
  let totPercibido = 0;
  let totComprasTotal = 0;

  let sumExentasImportaciones = 0;
  let sumExentasInternaciones = 0;
  let sumGravadasImportaciones = 0;
  let sumGravadasInternaciones = 0;
  let sumRetencionTerceros = 0;
  let sumComprasExcluidos = 0;
  let sumRebajasDevoluciones = 0;

  const filas = purchaseRows.map((r, index) => {
    const exentas = Number(r.exentas_locales) || 0;
    const noSujetas = Number(r.no_sujetas) || 0;
    const gravadas = Number(r.gravadas_locales) || 0;
    const credito = Number(r.credito_fiscal) || 0;
    const anticipo = Number(r.anticipo_a_cuenta) || 0;
    const retenido = Number(r.iva_retenido) || 0;
    const percibido = Number(r.iva_percibido) || 0;

    const totalFila = Number((exentas + noSujetas + gravadas + credito + anticipo - retenido + percibido).toFixed(2));

    totExentas += exentas;
    totNoSujetas += noSujetas;
    totGravadas += gravadas;
    totCreditoFiscal += credito;
    totAnticipo += anticipo;
    totRetenido += retenido;
    totPercibido += percibido;
    totComprasTotal += totalFila;

    sumExentasImportaciones += Number(r.exentas_importaciones) || 0;
    sumExentasInternaciones += Number(r.exentas_internaciones) || 0;
    sumGravadasImportaciones += Number(r.gravadas_importaciones) || 0;
    sumGravadasInternaciones += Number(r.gravadas_internaciones) || 0;
    sumRetencionTerceros += Number(r.retencion_a_terceros) || 0;
    sumComprasExcluidos += Number(r.compras_a_excluidos) || 0;
    sumRebajasDevoluciones += Number(r.rebajas_y_devoluciones) || 0;

    return {
      corr: index + 1,
      fecha: r.fecha,
      codigoGeneracion: r.documento,
      registro: r.registro_proveedor || '',
      nombreProveedor: r.nom_proveedor || '',
      comprasExentas: exentas,
      noSujetas,
      comprasGravadas: gravadas,
      creditoFiscal: credito,
      anticipoACta: anticipo,
      ivaRetenido: retenido,
      ivaPercibido: percibido,
      totalCompras: totalFila,
    };
  });

  const cuadroResumen = {
    locales: {
      exentas: totExentas,
      gravadas: totGravadas,
      rebajas: sumRebajasDevoluciones,
      total: Number((totExentas + totGravadas - sumRebajasDevoluciones).toFixed(2)),
    },
    importaciones: {
      exentas: sumExentasImportaciones,
      gravadas: sumGravadasImportaciones,
      total: Number((sumExentasImportaciones + sumGravadasImportaciones).toFixed(2)),
    },
    internaciones: {
      exentas: sumExentasInternaciones,
      gravadas: sumGravadasInternaciones,
      total: Number((sumExentasInternaciones + sumGravadasInternaciones).toFixed(2)),
    },
    creditoFiscal: Number(totCreditoFiscal.toFixed(2)),
    anticipoACuenta: Number(totAnticipo.toFixed(2)),
    ivaPercibido: Number(totPercibido.toFixed(2)),
    ivaRetenido: Number(totRetenido.toFixed(2)),
    retencionTerceros: Number(sumRetencionTerceros.toFixed(2)),
    comprasExcluidos: Number(sumComprasExcluidos.toFixed(2)),
    totalConsolidado: Number(totComprasTotal.toFixed(2)),
  };

  return {
    libro: 'compras',
    empresa: {
      cod_emp: empresa.cod_emp,
      nom_emp: empresa.nom_emp || '',
      nit: empresa.nit || '',
      reg_fiscal: empresa.reg_fiscal || '',
    },
    periodo: {
      mes: month,
      anio: year,
      nombreMes: MONTH_NAMES[month - 1] || '',
    },
    sucursal: 'CASA MATRIZ',
    filas,
    totales: {
      comprasExentas: Number(totExentas.toFixed(2)),
      noSujetas: Number(totNoSujetas.toFixed(2)),
      comprasGravadas: Number(totGravadas.toFixed(2)),
      creditoFiscal: Number(totCreditoFiscal.toFixed(2)),
      anticipoACta: Number(totAnticipo.toFixed(2)),
      ivaRetenido: Number(totRetenido.toFixed(2)),
      ivaPercibido: Number(totPercibido.toFixed(2)),
      totalCompras: Number(totComprasTotal.toFixed(2)),
    },
    cuadroResumen,
    firmas: {
      elaboradoPor: firmas[0]?.nom_firma || 'Administrador del Sistema',
      revisadoPor: firmas[1]?.nom_firma || 'RAMIRO A. HENRIQUEZ',
    },
  };
}

export async function getLibroConsumidorFinal(
  codEmp: number,
  year: number,
  month: number,
): Promise<VatBookSummary> {
  const empresa = await getEmpresaPorCodEmp(codEmp);
  const firmas = await getFirmasConta(codEmp);

  // Consumidor final sales: id_tipo_documento IN ('01', '02', '04')
  const [rows] = await pool.query(
    `SELECT 
      DATE_FORMAT(v.fecha, '%d/%m/%Y') as fecha_fmt,
      v.fecha,
      v.documento,
      v.num_control,
      v.ventas_exentas,
      v.ventas_no_sujetas,
      v.gravadas_locales,
      v.gravadas_exportacion,
      v.rebajas_y_devoluciones,
      v.iva_retenido,
      v.iva_percibido,
      v.cuentas_a_terceros
    FROM ventas_iva v
    WHERE v.cod_emp = ? 
      AND YEAR(v.fecha) = ? 
      AND MONTH(v.fecha) = ?
      AND v.id_tipo_documento IN ('01', '02', '04')
      AND v.anulada = 0
    ORDER BY v.fecha ASC, v.documento ASC`,
    [codEmp, year, month],
  );

  const rawRows = rows as Array<{
    fecha_fmt: string;
    fecha: string;
    documento: string;
    num_control: string;
    ventas_exentas: number;
    ventas_no_sujetas: number;
    gravadas_locales: number;
    gravadas_exportacion: number;
    rebajas_y_devoluciones: number;
    iva_retenido: number;
    iva_percibido: number;
    cuentas_a_terceros: number;
  }>;

  // Group by date to produce rows identical to consumidor final.pdf
  const groupsByDate = new Map<string, typeof rawRows>();
  for (const r of rawRows) {
    const list = groupsByDate.get(r.fecha_fmt) ?? [];
    list.push(r);
    groupsByDate.set(r.fecha_fmt, list);
  }

  let totExentas = 0;
  let totNoSujetas = 0;
  let totLocales = 0;
  let totExportaciones = 0;
  let totIvaRetPer = 0;
  let totVentas = 0;
  let totTerceros = 0;
  let totRebajas = 0;

  const filas = Array.from(groupsByDate.entries()).map(([fechaFmt, items]) => {
    const primerItem = items[0];
    const ultimoItem = items[items.length - 1];

    const sumExentas = items.reduce((acc, i) => acc + (Number(i.ventas_exentas) || 0), 0);
    const sumNoSujetas = items.reduce((acc, i) => acc + (Number(i.ventas_no_sujetas) || 0), 0);
    const sumLocales = items.reduce((acc, i) => acc + (Number(i.gravadas_locales) || 0), 0);
    const sumExport = items.reduce((acc, i) => acc + (Number(i.gravadas_exportacion) || 0), 0);
    const sumRetPer = items.reduce((acc, i) => acc + (Number(i.iva_retenido) || 0) + (Number(i.iva_percibido) || 0), 0);
    const sumTerceros = items.reduce((acc, i) => acc + (Number(i.cuentas_a_terceros) || 0), 0);
    const sumReb = items.reduce((acc, i) => acc + (Number(i.rebajas_y_devoluciones) || 0), 0);

    const totalRow = Number((sumExentas + sumNoSujetas + sumLocales + sumExport).toFixed(2));

    totExentas += sumExentas;
    totNoSujetas += sumNoSujetas;
    totLocales += sumLocales;
    totExportaciones += sumExport;
    totIvaRetPer += sumRetPer;
    totVentas += totalRow;
    totTerceros += sumTerceros;
    totRebajas += sumReb;

    return {
      fecha: fechaFmt,
      codigoGeneracionInicial: primerItem.documento,
      codigoGeneracionFinal: ultimoItem.documento,
      numeroControlDel: primerItem.num_control || primerItem.documento,
      numeroControlAl: ultimoItem.num_control || ultimoItem.documento,
      ventasExentas: Number(sumExentas.toFixed(2)),
      ventasNoSujetas: Number(sumNoSujetas.toFixed(2)),
      gravadasLocales: Number(sumLocales.toFixed(2)),
      gravadasExportaciones: Number(sumExport.toFixed(2)),
      ivaPercibidoRetenido: Number(sumRetPer.toFixed(2)),
      totalVentas: totalRow,
      ventasCuentasTerceros: Number(sumTerceros.toFixed(2)),
    };
  });

  // Calculate taxes: in Consumer Final, gross local sales include IVA. Net = Gross / 1.13, IVA = Gross - Net
  const ventaGravadaNeta = Number(((totLocales - totRebajas) / 1.13).toFixed(2));
  const impuestoIva = Number(((totLocales - totRebajas) - ventaGravadaNeta).toFixed(2));

  const cuadroResumen = {
    calculoDebitoFiscal: {
      ventasGravadas: Number(totLocales.toFixed(2)),
      divisor: 1.13,
      rebajasDevoluciones: Number(totRebajas.toFixed(2)),
      ventaGravada: ventaGravadaNeta,
      impuestoIva,
      ivaRetenido: 0,
      ivaPercibido: Number(totIvaRetPer.toFixed(2)),
    },
    resumenGeneral: {
      ventaBruta: Number(totLocales.toFixed(2)),
      exportaciones: Number(totExportaciones.toFixed(2)),
      rebajasExport: 0,
      exportacionesNetas: Number(totExportaciones.toFixed(2)),
      exentas: Number(totExentas.toFixed(2)),
      noSujetas: Number(totNoSujetas.toFixed(2)),
      totalVentas: Number(totVentas.toFixed(2)),
    },
  };

  return {
    libro: 'consumidor_final',
    empresa: {
      cod_emp: empresa.cod_emp,
      nom_emp: empresa.nom_emp || '',
      nit: empresa.nit || '',
      reg_fiscal: empresa.reg_fiscal || '',
    },
    periodo: {
      mes: month,
      anio: year,
      nombreMes: MONTH_NAMES[month - 1] || '',
    },
    sucursal: 'CASA MATRIZ',
    filas,
    totales: {
      ventasExentas: Number(totExentas.toFixed(2)),
      ventasNoSujetas: Number(totNoSujetas.toFixed(2)),
      gravadasLocales: Number(totLocales.toFixed(2)),
      gravadasExportaciones: Number(totExportaciones.toFixed(2)),
      ivaPercibidoRetenido: Number(totIvaRetPer.toFixed(2)),
      totalVentas: Number(totVentas.toFixed(2)),
      ventasCuentasTerceros: Number(totTerceros.toFixed(2)),
    },
    cuadroResumen,
    firmas: {
      elaboradoPor: firmas[0]?.nom_firma || 'Administrador del Sistema',
      revisadoPor: firmas[1]?.nom_firma || 'RAMIRO A. HENRIQUEZ',
    },
  };
}

export async function getLibroContribuyentes(
  codEmp: number,
  year: number,
  month: number,
): Promise<VatBookSummary> {
  const empresa = await getEmpresaPorCodEmp(codEmp);
  const firmas = await getFirmasConta(codEmp);

  // Contribuyentes: id_tipo_documento IN ('03', '05', '07') (Crédito Fiscal, Comprobante de Liquidación Contribuyente, Nota de Crédito)
  const [rows] = await pool.query(
    `SELECT 
      DATE_FORMAT(v.fecha, '%d/%m/%Y') as fecha_fmt,
      v.fecha,
      v.documento,
      v.num_control,
      v.ventas_exentas,
      v.ventas_no_sujetas,
      v.gravadas_locales,
      v.gravadas_exportacion,
      v.rebajas_y_devoluciones,
      v.debito_fiscal,
      v.iva_retenido,
      v.iva_percibido,
      c.nom_cliente,
      c.registro as registro_cliente
    FROM ventas_iva v
    LEFT JOIN clientes c ON v.cod_cliente = c.cod_cliente
    WHERE v.cod_emp = ? 
      AND YEAR(v.fecha) = ? 
      AND MONTH(v.fecha) = ?
      AND v.id_tipo_documento IN ('03', '05', '07')
      AND v.anulada = 0
    ORDER BY v.fecha ASC, v.documento ASC`,
    [codEmp, year, month],
  );

  const taxpayerRows = rows as Array<{
    fecha_fmt: string;
    fecha: string;
    documento: string;
    num_control: string;
    ventas_exentas: number;
    ventas_no_sujetas: number;
    gravadas_locales: number;
    gravadas_exportacion: number;
    rebajas_y_devoluciones: number;
    debito_fiscal: number;
    iva_retenido: number;
    iva_percibido: number;
    nom_cliente: string | null;
    registro_cliente: string | null;
  }>;

  let totExentas = 0;
  let totNoSujetas = 0;
  let totGravadasVentas = 0;
  let totGravadasDevoluc = 0;
  let totDebitoVentas = 0;
  let totDebitoDevoluc = 0;
  let totIvaRetPer = 0;
  let totVentasTotales = 0;

  const filas = taxpayerRows.map((r, index) => {
    const exentas = Number(r.ventas_exentas) || 0;
    const noSujetas = Number(r.ventas_no_sujetas) || 0;
    const gravadas = Number(r.gravadas_locales) || 0;
    const devoluc = Number(r.rebajas_y_devoluciones) || 0;
    const debito = Number(r.debito_fiscal) || 0;
    const retPer = (Number(r.iva_retenido) || 0) + (Number(r.iva_percibido) || 0);

    const totalFila = Number((gravadas + debito + exentas + noSujetas - devoluc).toFixed(2));

    totExentas += exentas;
    totNoSujetas += noSujetas;
    totGravadasVentas += gravadas;
    totGravadasDevoluc += devoluc;
    totDebitoVentas += debito;
    totIvaRetPer += retPer;
    totVentasTotales += totalFila;

    return {
      corr: index + 1,
      fecha: r.fecha_fmt,
      codigoGeneracion: r.documento,
      nombreCliente: r.nom_cliente || '',
      registro: r.registro_cliente || '',
      ventasExentas: exentas,
      ventasNoSujetas: noSujetas,
      gravadasVentas: gravadas,
      gravadasDevoluciones: devoluc,
      debitoFiscalVentas: debito,
      debitoFiscalDevoluciones: 0,
      ivaRetenidoPercibido: retPer,
      ventasTotales: totalFila,
    };
  });

  // Also query Consumer Final summary numbers for the combined Cuadro Resumen (as shown in contribuyentes.pdf)
  const consumidorFinalReport = await getLibroConsumidorFinal(codEmp, year, month);
  const cfTotales = consumidorFinalReport.totales;
  const cfGravadaNeta = Number(((Number(cfTotales.gravadasLocales) || 0) / 1.13).toFixed(2));
  const cfDebitoFiscal = Number(((Number(cfTotales.gravadasLocales) || 0) - cfGravadaNeta).toFixed(2));

  const totalGravadasConsolidado = Number((cfGravadaNeta + totGravadasVentas - totGravadasDevoluc).toFixed(2));
  const totalDebitoConsolidado = Number((cfDebitoFiscal + totDebitoVentas).toFixed(2));

  const cuadroResumen = {
    consumidoresFinales: {
      ventasExentas: Number(cfTotales.ventasExentas) || 0,
      ventasGravadas: cfGravadaNeta,
      exportaciones: Number(cfTotales.gravadasExportaciones) || 0,
      rebajasExportaciones: 0,
      rebajasVentas: 0,
      debitoFiscalPropias: cfDebitoFiscal,
      debitoFiscalRebajas: 0,
      ventasCuentasTerceros: Number(cfTotales.ventasCuentasTerceros) || 0,
      debitoFiscalTerceros: 0,
    },
    contribuyentes: {
      ventasExentas: Number(totExentas.toFixed(2)),
      ventasGravadas: Number(totGravadasVentas.toFixed(2)),
      exportaciones: 0,
      rebajasExportaciones: 0,
      rebajasVentas: Number(totGravadasDevoluc.toFixed(2)),
      debitoFiscalPropias: Number(totDebitoVentas.toFixed(2)),
      debitoFiscalRebajas: 0,
      ventasCuentasTerceros: 0,
      debitoFiscalTerceros: 0,
    },
    subTotal: {
      ventasExentas: Number((Number(cfTotales.ventasExentas || 0) + totExentas).toFixed(2)),
      ventasGravadas: totalGravadasConsolidado,
      exportaciones: Number(cfTotales.gravadasExportaciones) || 0,
      rebajasExportaciones: 0,
      rebajasVentas: Number(totGravadasDevoluc.toFixed(2)),
      debitoFiscalPropias: totalDebitoConsolidado,
      debitoFiscalRebajas: 0,
      ventasCuentasTerceros: Number(cfTotales.ventasCuentasTerceros) || 0,
      debitoFiscalTerceros: 0,
    },
    totalVentasGravadasMenosRev: totalGravadasConsolidado,
    totalDebitosGravMenosRev: totalDebitoConsolidado,
  };

  return {
    libro: 'contribuyentes',
    empresa: {
      cod_emp: empresa.cod_emp,
      nom_emp: empresa.nom_emp || '',
      nit: empresa.nit || '',
      reg_fiscal: empresa.reg_fiscal || '',
    },
    periodo: {
      mes: month,
      anio: year,
      nombreMes: MONTH_NAMES[month - 1] || '',
    },
    sucursal: 'CASA MATRIZ',
    filas,
    totales: {
      ventasExentas: Number(totExentas.toFixed(2)),
      ventasNoSujetas: Number(totNoSujetas.toFixed(2)),
      gravadasVentas: Number(totGravadasVentas.toFixed(2)),
      gravadasDevoluciones: Number(totGravadasDevoluc.toFixed(2)),
      debitoFiscalVentas: Number(totDebitoVentas.toFixed(2)),
      debitoFiscalDevoluciones: Number(totDebitoDevoluc.toFixed(2)),
      ivaRetenidoPercibido: Number(totIvaRetPer.toFixed(2)),
      ventasTotales: Number(totVentasTotales.toFixed(2)),
    },
    cuadroResumen,
    firmas: {
      elaboradoPor: firmas[0]?.nom_firma || 'Administrador del Sistema',
      revisadoPor: firmas[1]?.nom_firma || 'RAMIRO A. HENRIQUEZ',
    },
  };
}

export async function getAnexoHacienda(
  codEmp: number,
  tipo: 'compras' | 'contribuyentes' | 'consumidor_final',
  year: number,
  month: number,
) {
  if (tipo === 'compras') {
    const [rows] = await pool.query(
      `SELECT 
        DATE_FORMAT(c.fecha, '%d/%m/%Y') as fecha_emision,
        IF(c.sello_recepcion != '' OR c.num_control != '' OR LENGTH(TRIM(c.documento)) = 36 OR c.documento LIKE '%-%', 4, 1) as clase_documento,
        COALESCE(tdc.nombre, c.id_tipo_documento) as tipo_documento,
        c.documento as numero_documento,
        COALESCE(c.num_control, '') as numero_control,
        COALESCE(c.sello_recepcion, '') as sello_recepcion,
        IF(REPLACE(REPLACE(IFNULL(p.nit_proveedor, ''), '-', ''), ' ', '') != '', p.nit_proveedor, IFNULL(NULLIF(p.registro, ''), c.cod_proveedor)) as nit_o_nrc,
        COALESCE(p.nom_proveedor, 'PROVEEDOR VARIOS') as nombre,
        c.exentas_locales as compras_exentas,
        c.exentas_internaciones as internaciones_exentas,
        c.exentas_importaciones as importaciones_exentas,
        c.gravadas_locales as compras_gravadas,
        c.gravadas_internaciones as internaciones_gravadas,
        c.gravadas_importaciones as importaciones_gravadas,
        c.credito_fiscal,
        (c.exentas_locales + c.exentas_internaciones + c.exentas_importaciones + c.gravadas_locales + c.gravadas_internaciones + c.gravadas_importaciones + c.credito_fiscal) as total_compra
      FROM compras_iva c
      LEFT JOIN proveedores p ON c.cod_proveedor = p.cod_proveedor
      LEFT JOIN tipos_documento_compras tdc ON c.id_tipo_documento = tdc.id_tipo_documento
      WHERE c.cod_emp = ? AND c.periodo_ano = ? AND c.periodo_mes = ?
      ORDER BY c.fecha ASC`,
      [codEmp, year, month],
    );
    return rows;
  }

  if (tipo === 'contribuyentes') {
    const [rows] = await pool.query(
      `SELECT 
        DATE_FORMAT(v.fecha, '%d/%m/%Y') as fecha_emision,
        IF(v.num_control != '' OR LENGTH(TRIM(v.documento)) = 36 OR v.documento LIKE '%-%', 4, 1) as clase_documento,
        COALESCE(tdv.nombre, v.id_tipo_documento) as tipo_documento,
        IF(v.num_control != '' OR LENGTH(TRIM(v.documento)) = 36 OR v.documento LIKE '%-%', 'N/A', IFNULL(NULLIF(v.formulario_unico, ''), 'N/A')) as numero_resolucion,
        COALESCE(NULLIF(v.serie, ''), 'N/A') as serie,
        v.documento as numero_documento,
        IF(v.num_control != '', v.num_control, v.llave) as numero_control,
        IF(REPLACE(REPLACE(IFNULL(c.nit_cliente, ''), '-', ''), ' ', '') != '', c.nit_cliente, IFNULL(NULLIF(c.registro, ''), v.cod_cliente)) as nit_o_nrc,
        COALESCE(c.nom_cliente, 'CLIENTE GENERAL') as nombre,
        v.ventas_exentas,
        v.ventas_no_sujetas,
        v.gravadas_locales,
        v.debito_fiscal,
        v.cuentas_a_terceros,
        v.debito_fiscal_a_terceros,
        (v.gravadas_locales + v.debito_fiscal + v.ventas_exentas + v.ventas_no_sujetas + v.cuentas_a_terceros + v.debito_fiscal_a_terceros) as total_ventas
      FROM ventas_iva v
      LEFT JOIN clientes c ON v.cod_cliente = c.cod_cliente
      LEFT JOIN tipos_documento_ventas tdv ON v.id_tipo_documento = tdv.id_tipo_documento
      WHERE v.cod_emp = ? 
        AND YEAR(v.fecha) = ? 
        AND MONTH(v.fecha) = ?
        AND v.id_tipo_documento IN ('03', '05', '07')
        AND v.anulada = 0
      ORDER BY v.fecha ASC`,
      [codEmp, year, month],
    );
    return rows;
  }

  // consumidor_final
  const [rows] = await pool.query(
    `SELECT 
      DATE_FORMAT(v.fecha, '%d/%m/%Y') as fecha_emision,
      IF(v.num_control != '' OR LENGTH(TRIM(v.documento)) = 36 OR v.documento LIKE '%-%', 4, 1) as clase_documento,
      COALESCE(tdv.nombre, v.id_tipo_documento) as tipo_documento,
      IFNULL(NULLIF(v.num_control, ''), 'N/A') as numero_resolucion,
      IFNULL(NULLIF(v.serie, ''), '1') as serie,
      MIN(v.documento) as documento_del,
      MAX(v.documento) as documento_al,
      SUM(v.ventas_exentas) as ventas_exentas,
      SUM(v.ventas_no_sujetas) as ventas_no_sujetas,
      SUM(v.gravadas_locales) as gravadas_locales,
      SUM(v.gravadas_exportacion) as exportaciones,
      SUM(v.ventas_exentas + v.ventas_no_sujetas + v.gravadas_locales + v.gravadas_exportacion) as total_ventas
    FROM ventas_iva v
    LEFT JOIN tipos_documento_ventas tdv ON v.id_tipo_documento = tdv.id_tipo_documento
    WHERE v.cod_emp = ? 
      AND YEAR(v.fecha) = ? 
      AND MONTH(v.fecha) = ?
      AND v.id_tipo_documento IN ('01', '02', '04')
      AND v.anulada = 0
    GROUP BY DATE_FORMAT(v.fecha, '%d/%m/%Y'), v.id_tipo_documento, tdv.nombre, v.serie, v.num_control, IF(v.num_control != '' OR LENGTH(TRIM(v.documento)) = 36 OR v.documento LIKE '%-%', 4, 1)
    ORDER BY v.fecha ASC`,
    [codEmp, year, month],
  );
  return rows;
}

export async function getLiquidacionImpuestos(
  codEmp: number,
  year: number,
  month: number,
): Promise<TaxSettlementSummary> {
  const empresa = await getEmpresaPorCodEmp(codEmp);
  const firmas = await getFirmasConta(codEmp);

  const compras = await getLibroCompras(codEmp, year, month);
  const contribuyentes = await getLibroContribuyentes(codEmp, year, month);
  const consumidorFinal = await getLibroConsumidorFinal(codEmp, year, month);

  // Débito Fiscal Ventas
  const debitoContribuyentes = Number(contribuyentes.totales.debitoFiscalVentas) || 0;
  const cfVentasGravadas = Number(consumidorFinal.totales.gravadasLocales) || 0;
  const cfGravadaNeta = Number((cfVentasGravadas / 1.13).toFixed(2));
  const debitoConsumidorFinal = Number((cfVentasGravadas - cfGravadaNeta).toFixed(2));
  const totalDebito = Number((debitoContribuyentes + debitoConsumidorFinal).toFixed(2));

  // Crédito Fiscal Compras
  const crCompras = compras.cuadroResumen;
  const comprasLocalesCredito = Number(compras.totales?.creditoFiscal || 0);
  const importacionesCredito = Number((Number(crCompras.importaciones?.gravadas || 0) * 0.13).toFixed(2));
  const internacionesCredito = Number((Number(crCompras.internaciones?.gravadas || 0) * 0.13).toFixed(2));
  const totalCredito = Number(crCompras.creditoFiscal) || 0;

  // Liquidación de IVA
  const diferenciaIva = Number((totalDebito - totalCredito).toFixed(2));
  const esAPagar = diferenciaIva > 0;
  const impuestoDeterminado = esAPagar ? diferenciaIva : 0;
  const remanenteCreditoMes = !esAPagar ? Math.abs(diferenciaIva) : 0;

  const retencionesClientes = Number(contribuyentes.totales.ivaRetenidoPercibido) || 0;
  const anticipoIva = Number(crCompras.anticipoACuenta) || 0;
  const percepcionesIva = Number(crCompras.ivaPercibido) || 0;
  const totalDeducciones = Number((retencionesClientes + anticipoIva).toFixed(2));

  const totalIvaAPagar = esAPagar
    ? Math.max(0, Number((impuestoDeterminado - totalDeducciones + percepcionesIva).toFixed(2)))
    : 0;

  const remanenteCreditoProximoMes = !esAPagar
    ? Number((remanenteCreditoMes + totalDeducciones).toFixed(2))
    : impuestoDeterminado < totalDeducciones
    ? Number((totalDeducciones - impuestoDeterminado).toFixed(2))
    : 0;

  // Pago a Cuenta (Renta - Art. 151 C.T.)
  const ingGravadosContribuyentes = Number(contribuyentes.totales.gravadasVentas) || 0;
  const exportaciones = Number(consumidorFinal.totales.gravadasExportaciones) || 0;
  const totalBaseImponible = Number((ingGravadosContribuyentes + cfGravadaNeta + exportaciones).toFixed(2));
  const tasa = 0.0175; // 1.75%
  const pagoCuentaDeterminado = Number((totalBaseImponible * tasa).toFixed(2));
  const retencionesRenta = 0;
  const totalPagoCuentaAPagar = pagoCuentaDeterminado;

  const totalPagarFisco = Number((totalIvaAPagar + totalPagoCuentaAPagar).toFixed(2));

  return {
    empresa: {
      cod_emp: empresa.cod_emp,
      nom_emp: empresa.nom_emp || '',
      nit: empresa.nit || '',
      reg_fiscal: empresa.reg_fiscal || '',
    },
    periodo: {
      mes: month,
      anio: year,
      nombreMes: MONTH_NAMES[month - 1] || '',
    },
    iva: {
      debitos: {
        contribuyentes: debitoContribuyentes,
        consumidorFinal: debitoConsumidorFinal,
        totalDebito,
      },
      creditos: {
        comprasLocales: Number((totalCredito - importacionesCredito - internacionesCredito).toFixed(2)),
        importaciones: importacionesCredito,
        internaciones: internacionesCredito,
        totalCredito,
      },
      liquidacion: {
        diferencia: diferenciaIva,
        esAPagar,
        impuestoDeterminado,
        remanenteCreditoMes,
        retencionesClientes,
        anticipoIva,
        percepcionesIva,
        totalDeducciones,
        totalIvaAPagar,
        remanenteCreditoProximoMes,
      },
    },
    pagoCuenta: {
      ingresosGravados: {
        contribuyentes: ingGravadosContribuyentes,
        consumidorFinalNeto: cfGravadaNeta,
        exportaciones,
        totalBaseImponible,
      },
      tasa,
      pagoCuentaDeterminado,
      retencionesRenta,
      totalPagoCuentaAPagar,
    },
    resumenGeneral: {
      totalIvaAPagar,
      totalPagoCuentaAPagar,
      totalPagarFisco,
    },
    firmas: {
      elaboradoPor: firmas[0]?.nom_firma || 'Administrador del Sistema',
      revisadoPor: firmas[1]?.nom_firma || 'RAMIRO A. HENRIQUEZ',
    },
  };
}
