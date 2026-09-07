import * as XLSX from 'xlsx';
import type { VatBookSummary, TaxSettlementSummary } from '../types/controlIva';

function getValidVatSignaturesForExcel(firmasRaw: any): Array<{ id_firma?: number; nom_firma: string; puesto: string }> {
  if (Array.isArray(firmasRaw) && firmasRaw.length > 0) {
    const valid = firmasRaw.filter(
      (f: any) => f && f.nom_firma && f.nom_firma.trim() !== '' && f.nom_firma.trim() !== '.'
    );
    if (valid.length > 0) {
      return valid;
    }
    return firmasRaw.slice(0, 3).map((f: any, idx: number) => ({
      id_firma: f.id_firma || idx + 1,
      nom_firma: '',
      puesto: f.puesto || (idx === 0 ? 'Representante Legal' : idx === 1 ? 'Auditor Externo' : 'Contador General'),
    }));
  }
  if (firmasRaw && typeof firmasRaw === 'object') {
    const res = [];
    if (firmasRaw.revisadoPor) {
      res.push({ id_firma: 1, nom_firma: firmasRaw.revisadoPor, puesto: 'Representante Legal' });
    }
    if (firmasRaw.elaboradoPor) {
      res.push({ id_firma: 3, nom_firma: firmasRaw.elaboradoPor, puesto: 'Contador General' });
    }
    if (res.length > 0) return res;
  }
  return [
    { id_firma: 1, nom_firma: '', puesto: 'Representante Legal' },
    { id_firma: 3, nom_firma: '', puesto: 'Contador General' },
  ];
}

export function exportVatBookToExcel(report: VatBookSummary) {
  const wb = XLSX.utils.book_new();

  const titleBook =
    report.libro === 'compras'
      ? 'LIBRO DE COMPRAS'
      : report.libro === 'consumidor_final'
      ? 'LIBRO DE VENTAS AL CONSUMIDOR'
      : 'LIBRO DE VENTAS A CONTRIBUYENTES';

  // Build header lines
  const headerData: any[][] = [
    [report.empresa.nom_emp],
    [titleBook],
    [`NUMERO DE REGISTRO DE I.V.A.: ${report.empresa.reg_fiscal}`],
    [`NIT: ${report.empresa.nit}`],
    [`PERIODO: ${report.periodo.nombreMes} ${report.periodo.anio}`, '', '', `SUCURSAL: ${report.sucursal}`],
    [], // Blank row
  ];

  let tableData: any[][] = [];

  if (report.libro === 'compras') {
    tableData.push([
      'No. CORR',
      'FECHA',
      'CODIGO GENERACION / DOCUMENTO',
      'No. REGISTRO',
      'NOMBRE DEL PROVEEDOR',
      'COMPRAS EXENTAS',
      'NO SUJETAS',
      'COMPRAS GRAVADAS',
      'CREDITO FISCAL',
      'ANTICIPO A CTA.',
      'IVA RETENIDO',
      'IVA PERCIBIDO',
      'TOTAL COMPRAS',
    ]);

    for (const fila of report.filas as any[]) {
      tableData.push([
        fila.corr,
        fila.fecha,
        fila.codigoGeneracion,
        fila.registro,
        fila.nombreProveedor,
        fila.comprasExentas,
        fila.noSujetas,
        fila.comprasGravadas,
        fila.creditoFiscal,
        fila.anticipoACta,
        fila.ivaRetenido,
        fila.ivaPercibido,
        fila.totalCompras,
      ]);
    }

    tableData.push([
      'TOTALES',
      '',
      '',
      '',
      '',
      report.totales.comprasExentas,
      report.totales.noSujetas,
      report.totales.comprasGravadas,
      report.totales.creditoFiscal,
      report.totales.anticipoACta,
      report.totales.ivaRetenido,
      report.totales.ivaPercibido,
      report.totales.totalCompras,
    ]);
  } else if (report.libro === 'consumidor_final') {
    tableData.push([
      'FECHA',
      'CODIGO GENERACION INICIAL',
      'CODIGO GENERACION FINAL',
      'NUMERO CONTROL DEL',
      'NUMERO CONTROL AL',
      'VENTAS EXENTAS',
      'VENTAS NO SUJETAS',
      'GRAVADAS LOCALES',
      'EXPORTACIONES',
      'IVA PERC./RET.',
      'TOTAL VENTAS',
      'VENTAS A CTA. TERCEROS',
    ]);

    for (const fila of report.filas as any[]) {
      tableData.push([
        fila.fecha,
        fila.codigoGeneracionInicial,
        fila.codigoGeneracionFinal,
        fila.numeroControlDel,
        fila.numeroControlAl,
        fila.ventasExentas,
        fila.ventasNoSujetas,
        fila.gravadasLocales,
        fila.gravadasExportaciones,
        fila.ivaPercibidoRetenido,
        fila.totalVentas,
        fila.ventasCuentasTerceros,
      ]);
    }

    tableData.push([
      'TOTALES',
      '',
      '',
      '',
      '',
      report.totales.ventasExentas,
      report.totales.ventasNoSujetas,
      report.totales.gravadasLocales,
      report.totales.gravadasExportaciones,
      report.totales.ivaPercibidoRetenido,
      report.totales.totalVentas,
      report.totales.ventasCuentasTerceros,
    ]);
  } else {
    // contribuyentes
    tableData.push([
      'No. CORR',
      'FECHA',
      'CODIGO DE GENERACION',
      'NOMBRE DE CLIENTE',
      'No. REGISTRO',
      'VENTAS EXENTAS',
      'VTAS NO SUJETAS',
      'GRAVADAS VENTAS',
      'GRAVADAS DEVOLUC.',
      'DEBITO FISCAL VENTAS',
      'DEBITO FISCAL DEVOLUC.',
      'IVA RET/PER.',
      'VENTAS TOTALES',
    ]);

    for (const fila of report.filas as any[]) {
      tableData.push([
        fila.corr,
        fila.fecha,
        fila.codigoGeneracion,
        fila.nombreCliente,
        fila.registro,
        fila.ventasExentas,
        fila.ventasNoSujetas,
        fila.gravadasVentas,
        fila.gravadasDevoluciones,
        fila.debitoFiscalVentas,
        fila.debitoFiscalDevoluciones,
        fila.ivaRetenidoPercibido,
        fila.ventasTotales,
      ]);
    }

    tableData.push([
      'TOTALES',
      '',
      '',
      '',
      '',
      report.totales.ventasExentas,
      report.totales.ventasNoSujetas,
      report.totales.gravadasVentas,
      report.totales.gravadasDevoluciones,
      report.totales.debitoFiscalVentas,
      report.totales.debitoFiscalDevoluciones,
      report.totales.ivaRetenidoPercibido,
      report.totales.ventasTotales,
    ]);
  }

  // Combine header and table
  const allRows = [...headerData, ...tableData, [], []];

  // Append summary box (Cuadro Resumen)
  allRows.push(['CUADRO RESUMEN']);
  if (report.libro === 'compras') {
    const cr = report.cuadroResumen;
    allRows.push(['', 'COMPRAS EXENTAS', 'COMPRAS GRAVADAS', 'REB. Y DEV. S/COMPRAS', 'TOTAL']);
    allRows.push(['LOCALES', cr.locales?.exentas, cr.locales?.gravadas, cr.locales?.rebajas, cr.locales?.total]);
    allRows.push(['IMPORTACIONES', cr.importaciones?.exentas, cr.importaciones?.gravadas, 0, cr.importaciones?.total]);
    allRows.push(['INTERNACIONES', cr.internaciones?.exentas, cr.internaciones?.gravadas, 0, cr.internaciones?.total]);
    allRows.push(['CREDITO FISCAL', '', cr.creditoFiscal, '', cr.creditoFiscal]);
    allRows.push([]);
    allRows.push(['ANTICIPO A CUENTA', 'I.V.A. PERCIBIDO', 'I.V.A. RETENIDO', 'RETENCION A TERCEROS', 'COMPRAS A EXCLUIDOS']);
    allRows.push([cr.anticipoACuenta, cr.ivaPercibido, cr.ivaRetenido, cr.retencionTerceros, cr.comprasExcluidos]);
  } else if (report.libro === 'consumidor_final') {
    const cr = report.cuadroResumen;
    allRows.push(['CALCULO DEL DEBITO FISCAL']);
    allRows.push(['VENTAS GRAVADAS', cr.calculoDebitoFiscal?.ventasGravadas]);
    allRows.push(['REB. Y DEV. S/VENTA', cr.calculoDebitoFiscal?.rebajasDevoluciones]);
    allRows.push(['VENTA GRAVADA NETA', cr.calculoDebitoFiscal?.ventaGravada]);
    allRows.push(['IMPUESTO IVA', cr.calculoDebitoFiscal?.impuestoIva]);
    allRows.push(['TOTAL VENTAS', cr.resumenGeneral?.totalVentas]);
  } else {
    const cr = report.cuadroResumen;
    allRows.push([
      '', 'VENTAS EXENTAS', 'VENTAS GRAVADAS', 'EXPORTACIONES', 'REBAJAS S/VENTAS',
      'DEBITO FISCAL VENTAS PROPIAS', 'TOTAL',
    ]);
    allRows.push([
      'CONSUMIDORES FINALES',
      cr.consumidoresFinales?.ventasExentas,
      cr.consumidoresFinales?.ventasGravadas,
      cr.consumidoresFinales?.exportaciones,
      cr.consumidoresFinales?.rebajasVentas,
      cr.consumidoresFinales?.debitoFiscalPropias,
      Number(((cr.consumidoresFinales?.ventasGravadas || 0) + (cr.consumidoresFinales?.debitoFiscalPropias || 0)).toFixed(2)),
    ]);
    allRows.push([
      'CONTRIBUYENTES',
      cr.contribuyentes?.ventasExentas,
      cr.contribuyentes?.ventasGravadas,
      cr.contribuyentes?.exportaciones,
      cr.contribuyentes?.rebajasVentas,
      cr.contribuyentes?.debitoFiscalPropias,
      Number(((cr.contribuyentes?.ventasGravadas || 0) + (cr.contribuyentes?.debitoFiscalPropias || 0)).toFixed(2)),
    ]);
    allRows.push([
      'SUB TOTAL',
      cr.subTotal?.ventasExentas,
      cr.subTotal?.ventasGravadas,
      cr.subTotal?.exportaciones,
      cr.subTotal?.rebajasVentas,
      cr.subTotal?.debitoFiscalPropias,
      Number(((cr.subTotal?.ventasGravadas || 0) + (cr.subTotal?.debitoFiscalPropias || 0)).toFixed(2)),
    ]);
  }

  // Signatures
  const validSignatures = getValidVatSignaturesForExcel(report.firmas);
  allRows.push([]);
  allRows.push([]);

  const lineRow: any[] = [];
  const nameRow: any[] = [];
  const puestoRow: any[] = [];

  validSignatures.forEach((f, idx) => {
    if (idx > 0) {
      lineRow.push('', '');
      nameRow.push('', '');
      puestoRow.push('', '');
    }
    lineRow.push('_______________________________');
    nameRow.push(f.nom_firma || '___________________________');
    puestoRow.push(f.puesto || 'Firma Autorizada');
  });

  allRows.push(lineRow);
  allRows.push(nameRow);
  allRows.push(puestoRow);

  const ws = XLSX.utils.aoa_to_sheet(allRows);

  // Set column widths
  ws['!cols'] = [
    { wch: 12 }, { wch: 14 }, { wch: 38 }, { wch: 16 }, { wch: 35 },
    { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 16 },
    { wch: 16 }, { wch: 16 }, { wch: 18 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, titleBook.slice(0, 31));

  const fileName = `${titleBook.replace(/\s+/g, '_')}_${report.periodo.nombreMes}_${report.periodo.anio}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

export function exportMhAnexoToCsv(rows: any[], tipo: string, periodo: string) {
  if (rows.length === 0) {
    alert('No hay registros para exportar en este período.');
    return;
  }
  const cleanedRows = rows.map((r) => {
    if (tipo === 'percepciones') {
      return {
        'NIT AGENTE': r.nit_agente || '',
        'FECHA DE EMISIÓN': r.fecha_emision || '',
        'TIPO DE DOCUMENTO': r.tipo_documento || '',
        'SERIE DE DOCUMENTO': r.serie_documento || '',
        'NÚMERO DE DOCUMENTO': r.numero_documento || '',
        'MONTO SUJETO': Number(r.monto_sujeto || 0),
        'MONTO DE LA PERCEPCIÓN 1%': Number(r.monto_percepcion || 0),
        'DUI DEL AGENTE': r.dui_agente || '',
        'NÚMERO DEL ANEXO': Number(r.numero_anexo || 8),
      };
    }
    if (tipo === 'contribuyentes' && 'numero_resolucion' in r) {
      const { numero_resolucion, ...rest } = r;
      return rest;
    }
    return r;
  });
  const ws = XLSX.utils.json_to_sheet(cleanedRows);
  const csvContent = XLSX.utils.sheet_to_csv(ws, { FS: ';' });
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const filename = tipo === 'percepciones' 
    ? `ANEXO_MH_8_PERCEPCIONES_${periodo}.csv`
    : `ANEXO_MH_${tipo.toUpperCase()}_${periodo}.csv`;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportMhAnexoToExcel(rows: any[], tipo: string, periodo: string) {
  if (rows.length === 0) {
    alert('No hay registros para exportar en este período.');
    return;
  }
  const wb = XLSX.utils.book_new();
  const cleanedRows = rows.map((r) => {
    if (tipo === 'percepciones') {
      return {
        'NIT AGENTE': r.nit_agente || '',
        'FECHA DE EMISIÓN': r.fecha_emision || '',
        'TIPO DE DOCUMENTO': r.tipo_documento || '',
        'SERIE DE DOCUMENTO': r.serie_documento || '',
        'NÚMERO DE DOCUMENTO': r.numero_documento || '',
        'MONTO SUJETO': Number(r.monto_sujeto || 0),
        'MONTO DE LA PERCEPCIÓN 1%': Number(r.monto_percepcion || 0),
        'DUI DEL AGENTE': r.dui_agente || '',
        'NÚMERO DEL ANEXO': Number(r.numero_anexo || 8),
      };
    }
    if (tipo === 'contribuyentes' && 'numero_resolucion' in r) {
      const { numero_resolucion, ...rest } = r;
      return rest;
    }
    return r;
  });
  const ws = XLSX.utils.json_to_sheet(cleanedRows);
  if (tipo === 'percepciones') {
    ws['!cols'] = [
      { wch: 18 }, { wch: 18 }, { wch: 38 }, { wch: 45 }, { wch: 42 },
      { wch: 16 }, { wch: 26 }, { wch: 18 }, { wch: 20 },
    ];
  }
  const sheetName = tipo === 'percepciones' ? 'ANEXO_8_PERCEPCIONES' : `ANEXO_${tipo.toUpperCase()}`.slice(0, 31);
  const fileName = tipo === 'percepciones' 
    ? `ANEXO_MH_8_PERCEPCIONES_${periodo}.xlsx` 
    : `ANEXO_MH_${tipo.toUpperCase()}_${periodo}.xlsx`;
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, fileName);
}

export function exportBlankMhTemplate(columnas: string[], ejemplo: any[], tipo: string) {
  const wb = XLSX.utils.book_new();
  const data = [columnas, ejemplo];
  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'PLANTILLA_MH');
  XLSX.writeFile(wb, `PLANTILLA_OFICIAL_MH_${tipo.toUpperCase()}.xlsx`);
}

export function exportTaxSettlementToExcel(report: TaxSettlementSummary) {
  const wb = XLSX.utils.book_new();

  const rows: any[][] = [
    [report.empresa.nom_emp],
    ['LIQUIDACION MENSUAL DE IMPUESTOS: IVA Y PAGO A CUENTA'],
    [`NUMERO DE REGISTRO DE I.V.A.: ${report.empresa.reg_fiscal}`, '', `NIT: ${report.empresa.nit}`],
    [`PERIODO TRIBUTARIO: ${report.periodo.nombreMes} ${report.periodo.anio}`],
    [],
    ['1. LIQUIDACION DEL IMPUESTO A LA TRANSFERENCIA DE BIENES Y SERVICIOS (IVA - FORMULARIO F-07)'],
    ['CONCEPTO', 'MONTO (USD)'],
    ['(+) Débito Fiscal por Ventas a Contribuyentes (CCF)', report.iva.debitos.contribuyentes],
    ['(+) Débito Fiscal por Ventas a Consumidor Final (Facturas)', report.iva.debitos.consumidorFinal],
    ['TOTAL DEBITO FISCAL DEL PERIODO', report.iva.debitos.totalDebito],
    ['(+) Crédito Fiscal por Compras Internas Gravadas', report.iva.creditos.comprasLocales],
    ['(+) Crédito Fiscal por Importaciones', report.iva.creditos.importaciones],
    ['(+) Crédito Fiscal por Internaciones', report.iva.creditos.internaciones],
    ['TOTAL CREDITO FISCAL DEL PERIODO', report.iva.creditos.totalCredito],
    ['Diferencia Neta (Débito Fiscal - Crédito Fiscal)', report.iva.liquidacion.diferencia],
    [
      report.iva.liquidacion.esAPagar ? 'Impuesto Determinado del Período' : 'Remanente de Crédito Fiscal a Favor del Contribuyente',
      report.iva.liquidacion.esAPagar ? report.iva.liquidacion.impuestoDeterminado : report.iva.liquidacion.remanenteCreditoMes,
    ],
    ['(-) IVA Retenido por Clientes (1%)', report.iva.liquidacion.retencionesClientes],
    ['(-) Anticipo a Cuenta de IVA (2%)', report.iva.liquidacion.anticipoIva],
    ['(+) IVA Percibido', report.iva.liquidacion.percepcionesIva],
    [
      report.iva.liquidacion.esAPagar ? 'TOTAL IMPUESTO IVA A PAGAR EN EL MES' : 'REMANENTE DE CREDITO FISCAL PARA SIGUIENTE MES',
      report.iva.liquidacion.esAPagar ? report.iva.liquidacion.totalIvaAPagar : report.iva.liquidacion.remanenteCreditoProximoMes,
    ],
    [],
    ['2. LIQUIDACION DE PAGO A CUENTA DE IMPUESTO SOBRE LA RENTA (Art. 151 C.T. - FORMULARIO F-14)'],
    ['CONCEPTO', 'MONTO (USD)'],
    ['(+) Ingresos Gravados Ventas a Contribuyentes', report.pagoCuenta.ingresosGravados.contribuyentes],
    ['(+) Ingresos Gravados Netos Ventas al Consumidor Final', report.pagoCuenta.ingresosGravados.consumidorFinalNeto],
    ['(+) Ingresos por Exportaciones', report.pagoCuenta.ingresosGravados.exportaciones],
    ['BASE IMPONIBLE TOTAL INGRESOS GRAVADOS', report.pagoCuenta.ingresosGravados.totalBaseImponible],
    ['Tasa Legal de Pago a Cuenta (1.75%)', '1.75%'],
    ['TOTAL PAGO A CUENTA DETERMINADO A ENTERAR', report.pagoCuenta.totalPagoCuentaAPagar],
    [],
    ['3. RESUMEN GENERAL DE IMPUESTOS A PAGAR AL FISCO (MINISTERIO DE HACIENDA)'],
    ['CONCEPTO', 'MONTO TOTAL (USD)'],
    ['Total Impuesto IVA a Pagar en el Período', report.resumenGeneral.totalIvaAPagar],
    ['Total Pago a Cuenta de Renta a Pagar en el Período', report.resumenGeneral.totalPagoCuentaAPagar],
    ['TOTAL GENERAL A PAGAR AL MINISTERIO DE HACIENDA (MH)', report.resumenGeneral.totalPagarFisco],
    [],
  ];

  const validSignatures = getValidVatSignaturesForExcel(report.firmas);
  const lineRow: any[] = [];
  const nameRow: any[] = [];
  const puestoRow: any[] = [];

  validSignatures.forEach((f, idx) => {
    if (idx > 0) {
      lineRow.push('');
      nameRow.push('');
      puestoRow.push('');
    }
    lineRow.push('_______________________________');
    nameRow.push(f.nom_firma || '___________________________');
    puestoRow.push(f.puesto || 'Firma Autorizada');
  });

  rows.push(lineRow);
  rows.push(nameRow);
  rows.push(puestoRow);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 65 }, { wch: 25 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, ws, 'PAGO_IMPUESTOS');
  XLSX.writeFile(wb, `LIQUIDACION_IMPUESTOS_${report.periodo.nombreMes}_${report.periodo.anio}.xlsx`);
}
