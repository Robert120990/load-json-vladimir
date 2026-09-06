import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { VatBookSummary, TaxSettlementSummary } from '../types/controlIva';

function getValidVatSignatures(firmasRaw: any): Array<{ id_firma?: number; nom_firma: string; puesto: string }> {
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

function drawVatSignatures(doc: jsPDF, firmasRaw: any, pageWidth: number, currentY: number) {
  const firmas = getValidVatSignatures(firmasRaw);
  const numFirmas = Math.min(firmas.length, 3);
  const colWidth = pageWidth / (numFirmas + 1);
  const lineWidth = numFirmas === 3 ? 24 : 32;

  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);

  firmas.slice(0, 3).forEach((firma, index) => {
    const centerX = colWidth * (index + 1);
    const lineStartX = centerX - lineWidth;
    const lineEndX = centerX + lineWidth;

    // Line
    doc.setDrawColor(80, 80, 80);
    doc.setLineWidth(0.3);
    doc.line(lineStartX, currentY + 8, lineEndX, currentY + 8);

    // Name
    doc.setFont('helvetica', 'bold');
    doc.text(firma.nom_firma || '___________________________', centerX, currentY + 13, { align: 'center' });

    // Puesto / Cargo
    doc.setFont('helvetica', 'normal');
    doc.text(firma.puesto || 'Firma Autorizada', centerX, currentY + 17, { align: 'center' });
  });
}

export function exportVatBookToPdf(report: VatBookSummary) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'letter',
  });

  const titleBook =
    report.libro === 'compras'
      ? 'LIBRO DE COMPRAS'
      : report.libro === 'consumidor_final'
      ? 'LIBRO DE VENTAS AL CONSUMIDOR'
      : 'LIBRO DE VENTAS A CONTRIBUYENTES';

  // Header Title & Company
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(report.empresa.nom_emp, 140, 12, { align: 'center' });

  doc.setFontSize(11);
  doc.text(titleBook, 140, 17, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`NUMERO DE REGISTRO DE I.V.A. ${report.empresa.reg_fiscal}`, 140, 22, { align: 'center' });
  doc.text(`NIT # ${report.empresa.nit}`, 140, 26, { align: 'center' });

  // Period and Branch
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`PERIODO : ${report.periodo.nombreMes} ${report.periodo.anio}`, 14, 32);
  doc.text(`SUCURSAL : ${report.sucursal}`, 140, 32, { align: 'center' });

  const formatMoney = (val: number | undefined) =>
    val && val !== 0 ? `$ ${Number(val).toFixed(2)}` : '$ -';

  if (report.libro === 'compras') {
    const tableColumns = [
      'No.\nCORR',
      'FECHA',
      'CODIGO\nGENERACION',
      'No.\nREGISTRO',
      'NOMBRE DEL PROVEEDOR',
      'COMPRAS\nEXENTAS',
      'NO\nSUJETAS',
      'COMPRAS\nGRAVADAS',
      'CREDITO\nFISCAL',
      'ANTICIPO\nA CTA.',
      'IVA\nRETENIDO',
      'TOTAL\nCOMPRAS',
    ];

    const tableRows = (report.filas as any[]).map((f) => [
      f.corr,
      f.fecha,
      f.codigoGeneracion,
      f.registro,
      f.nombreProveedor,
      formatMoney(f.comprasExentas),
      formatMoney(f.noSujetas),
      formatMoney(f.comprasGravadas),
      formatMoney(f.creditoFiscal),
      formatMoney(f.anticipoACta),
      formatMoney(f.ivaRetenido),
      formatMoney(f.totalCompras),
    ]);

    // Totals row
    tableRows.push([
      'TOTALES',
      '',
      '',
      '',
      '',
      formatMoney(report.totales.comprasExentas),
      formatMoney(report.totales.noSujetas),
      formatMoney(report.totales.comprasGravadas),
      formatMoney(report.totales.creditoFiscal),
      formatMoney(report.totales.anticipoACta),
      formatMoney(report.totales.ivaRetenido),
      formatMoney(report.totales.totalCompras),
    ]);

    autoTable(doc, {
      head: [tableColumns],
      body: tableRows,
      startY: 35,
      styles: { fontSize: 7, cellPadding: 1.5, halign: 'left' },
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { halign: 'center', cellWidth: 18 },
        2: { cellWidth: 50 },
        3: { halign: 'center', cellWidth: 16 },
        4: { cellWidth: 52 },
        5: { halign: 'right' },
        6: { halign: 'right' },
        7: { halign: 'right' },
        8: { halign: 'right' },
        9: { halign: 'right' },
        10: { halign: 'right' },
        11: { halign: 'right', fontStyle: 'bold' },
      },
      theme: 'grid',
    });
  } else if (report.libro === 'consumidor_final') {
    const tableColumns = [
      'FECHA',
      'CODIGO GENERACION\nINICIAL',
      'CODIGO GENERACION\nFINAL',
      'NUMERO CONTROL\nDEL',
      'NUMERO CONTROL\nAL',
      'VENTAS\nEXENTAS',
      'VENTAS NO\nSUJETAS',
      'VENTAS GRAVADAS\nLOCALES',
      'TOTAL\nVENTAS',
      'VENTAS A CTA.\nTERCEROS',
    ];

    const tableRows = (report.filas as any[]).map((f) => [
      f.fecha,
      f.codigoGeneracionInicial,
      f.codigoGeneracionFinal,
      f.numeroControlDel,
      f.numeroControlAl,
      formatMoney(f.ventasExentas),
      formatMoney(f.ventasNoSujetas),
      formatMoney(f.gravadasLocales),
      formatMoney(f.totalVentas),
      formatMoney(f.ventasCuentasTerceros),
    ]);

    tableRows.push([
      'TOTALES',
      '',
      '',
      '',
      '',
      formatMoney(report.totales.ventasExentas),
      formatMoney(report.totales.ventasNoSujetas),
      formatMoney(report.totales.gravadasLocales),
      formatMoney(report.totales.totalVentas),
      formatMoney(report.totales.ventasCuentasTerceros),
    ]);

    autoTable(doc, {
      head: [tableColumns],
      body: tableRows,
      startY: 35,
      styles: { fontSize: 7, cellPadding: 1.5, halign: 'left' },
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
      columnStyles: {
        0: { halign: 'center', cellWidth: 18 },
        1: { cellWidth: 42 },
        2: { cellWidth: 42 },
        3: { cellWidth: 32 },
        4: { cellWidth: 32 },
        5: { halign: 'right' },
        6: { halign: 'right' },
        7: { halign: 'right' },
        8: { halign: 'right', fontStyle: 'bold' },
        9: { halign: 'right' },
      },
      theme: 'grid',
    });
  } else {
    // contribuyentes
    const tableColumns = [
      'No.\nCORR',
      'FECHA',
      'CODIGO DE\nGENERACION',
      'NOMBRE DE CLIENTE',
      'No.\nREGISTRO',
      'VENTAS\nEXENTAS',
      'VTAS NO\nSUJETAS',
      'GRAVADAS\nVENTAS',
      'DEBITO\nFISCAL',
      'IVA\nRET/PER',
      'VENTAS\nTOTALES',
    ];

    const tableRows = (report.filas as any[]).map((f) => [
      f.corr,
      f.fecha,
      f.codigoGeneracion,
      f.nombreCliente,
      f.registro,
      formatMoney(f.ventasExentas),
      formatMoney(f.ventasNoSujetas),
      formatMoney(f.gravadasVentas),
      formatMoney(f.debitoFiscalVentas),
      formatMoney(f.ivaRetenidoPercibido),
      formatMoney(f.ventasTotales),
    ]);

    tableRows.push([
      'TOTALES',
      '',
      '',
      '',
      '',
      formatMoney(report.totales.ventasExentas),
      formatMoney(report.totales.ventasNoSujetas),
      formatMoney(report.totales.gravadasVentas),
      formatMoney(report.totales.debitoFiscalVentas),
      formatMoney(report.totales.ivaRetenidoPercibido),
      formatMoney(report.totales.ventasTotales),
    ]);

    autoTable(doc, {
      head: [tableColumns],
      body: tableRows,
      startY: 35,
      styles: { fontSize: 7, cellPadding: 1.5, halign: 'left' },
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { halign: 'center', cellWidth: 18 },
        2: { cellWidth: 50 },
        3: { cellWidth: 55 },
        4: { halign: 'center', cellWidth: 18 },
        5: { halign: 'right' },
        6: { halign: 'right' },
        7: { halign: 'right' },
        8: { halign: 'right' },
        9: { halign: 'right' },
        10: { halign: 'right', fontStyle: 'bold' },
      },
      theme: 'grid',
    });
  }

  // Summary box & Signatures
  let finalY = (doc as any).lastAutoTable?.finalY ?? 130;

  if (report.libro === 'compras' && (report as any).cuadroResumen) {
    const cr = (report as any).cuadroResumen;
    let crStartY = finalY + 5;
    if (crStartY + 50 > 190) {
      doc.addPage();
      crStartY = 15;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('CUADRO RESUMEN', 140, crStartY + 2, { align: 'center' });

    autoTable(doc, {
      head: [['', 'COMPRAS\nEXENTAS', 'COMPRAS\nGRAVADAS', 'REB. Y DEV.\nS/COMPRAS', 'TOTAL']],
      body: [
        ['LOCALES', formatMoney(cr.locales?.exentas), formatMoney(cr.locales?.gravadas), formatMoney(cr.locales?.rebajas), formatMoney(cr.locales?.total)],
        ['IMPORTACIONES', formatMoney(cr.importaciones?.exentas), formatMoney(cr.importaciones?.gravadas), '$ -', formatMoney(cr.importaciones?.total)],
        ['INTERNACIONES', formatMoney(cr.internaciones?.exentas), formatMoney(cr.internaciones?.gravadas), '$ -', formatMoney(cr.internaciones?.total)],
        ['CREDITO FISCAL', '', formatMoney(cr.creditoFiscal), '', formatMoney(cr.creditoFiscal)],
      ],
      startY: crStartY + 4,
      margin: { left: 55, right: 55 },
      styles: { fontSize: 6.5, cellPadding: 1.2, halign: 'right' },
      headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
      columnStyles: {
        0: { halign: 'left', fontStyle: 'bold', cellWidth: 32 },
        1: { cellWidth: 32 },
        2: { cellWidth: 35 },
        3: { cellWidth: 35 },
        4: { cellWidth: 35, fontStyle: 'bold' },
      },
      theme: 'grid',
    });

    const crTable2Y = (doc as any).lastAutoTable?.finalY + 2;

    autoTable(doc, {
      head: [['ANTICIPO A\nCUENTA', 'I.V.A.\nPERCIBIDO', 'I.V.A.\nRETENIDO', 'RETENCION A\nTERCEROS', 'COMPRAS A\nEXCLUIDOS']],
      body: [
        [formatMoney(cr.anticipoACuenta), formatMoney(cr.ivaPercibido), formatMoney(cr.ivaRetenido), formatMoney(cr.retencionTerceros), formatMoney(cr.comprasExcluidos)],
      ],
      startY: crTable2Y,
      margin: { left: 55, right: 55 },
      styles: { fontSize: 6.5, cellPadding: 1.2, halign: 'center' },
      headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
      theme: 'grid',
    });

    finalY = (doc as any).lastAutoTable?.finalY ?? finalY;
  }

  // Signatures on bottom
  let sigY = Math.min(finalY + 18, 180);
  if (finalY + 25 > 195) {
    doc.addPage();
    sigY = 25;
  }

  drawVatSignatures(doc, report.firmas, 279.4, sigY);

  const fileName = `${titleBook.replace(/\s+/g, '_')}_${report.periodo.nombreMes}_${report.periodo.anio}.pdf`;
  doc.save(fileName);
}

export function exportTaxSettlementToPdf(report: TaxSettlementSummary) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
  });

  const formatMoney = (val: number | undefined) =>
    val && val !== 0 ? `$ ${Number(val).toFixed(2)}` : '$ 0.00';

  // Header Title & Company
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(report.empresa.nom_emp, 105, 14, { align: 'center' });

  doc.setFontSize(11);
  doc.setTextColor(37, 99, 235);
  doc.text('LIQUIDACION MENSUAL DE IMPUESTOS: IVA Y PAGO A CUENTA', 105, 20, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`NUMERO DE REGISTRO DE I.V.A.: ${report.empresa.reg_fiscal}    |    NIT: ${report.empresa.nit}`, 105, 25, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`PERIODO TRIBUTARIO: ${report.periodo.nombreMes} ${report.periodo.anio}`, 105, 30, { align: 'center' });

  let startY = 35;

  // SECTION 1: IVA LIQUIDATION TABLE
  const ivaRows = [
    [{ content: '1. DEBITOS FISCALES (VENTAS)', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }],
    ['(+) Débito Fiscal por Ventas a Contribuyentes (CCF)', formatMoney(report.iva.debitos.contribuyentes)],
    ['(+) Débito Fiscal por Ventas a Consumidor Final (Facturas)', formatMoney(report.iva.debitos.consumidorFinal)],
    [{ content: 'TOTAL DEBITO FISCAL DEL PERIODO', styles: { fontStyle: 'bold' } }, { content: formatMoney(report.iva.debitos.totalDebito), styles: { fontStyle: 'bold', textColor: [37, 99, 235] } }],
    [{ content: '2. CREDITOS FISCALES (COMPRAS)', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }],
    ['(+) Crédito Fiscal por Compras Internas Gravadas', formatMoney(report.iva.creditos.comprasLocales)],
    ['(+) Crédito Fiscal por Importaciones', formatMoney(report.iva.creditos.importaciones)],
    ['(+) Crédito Fiscal por Internaciones', formatMoney(report.iva.creditos.internaciones)],
    [{ content: 'TOTAL CREDITO FISCAL DEL PERIODO', styles: { fontStyle: 'bold' } }, { content: formatMoney(report.iva.creditos.totalCredito), styles: { fontStyle: 'bold', textColor: [16, 185, 129] } }],
    [{ content: '3. DETERMINACION DEL IMPUESTO IVA (F-07)', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }],
    ['Diferencia Neta (Débito Fiscal - Crédito Fiscal)', formatMoney(report.iva.liquidacion.diferencia)],
    [
      report.iva.liquidacion.esAPagar ? 'Impuesto Determinado del Período' : 'Remanente de Crédito Fiscal a Favor del Contribuyente',
      formatMoney(report.iva.liquidacion.esAPagar ? report.iva.liquidacion.impuestoDeterminado : report.iva.liquidacion.remanenteCreditoMes),
    ],
    ['(-) IVA Retenido por Clientes (Agentes de Retención 1%)', formatMoney(report.iva.liquidacion.retencionesClientes)],
    ['(-) Anticipo a Cuenta de IVA (2% en Importaciones)', formatMoney(report.iva.liquidacion.anticipoIva)],
    ['(+) IVA Percibido', formatMoney(report.iva.liquidacion.percepcionesIva)],
    [
      { content: report.iva.liquidacion.esAPagar ? 'TOTAL IMPUESTO IVA A PAGAR EN EL MES' : 'REMANENTE DE CREDITO FISCAL PARA EL SIGUIENTE MES', styles: { fontStyle: 'bold', fillColor: [238, 242, 255] } },
      { content: formatMoney(report.iva.liquidacion.esAPagar ? report.iva.liquidacion.totalIvaAPagar : report.iva.liquidacion.remanenteCreditoProximoMes), styles: { fontStyle: 'bold', textColor: [37, 99, 235], fillColor: [238, 242, 255] } },
    ],
  ];

  autoTable(doc, {
    startY,
    head: [['LIQUIDACION DEL IMPUESTO A LA TRANSFERENCIA DE BIENES Y SERVICIOS (IVA)', 'MONTO (USD)']],
    body: ivaRows as any[],
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
    columnStyles: {
      0: { cellWidth: 140, fontSize: 8 },
      1: { cellWidth: 46, halign: 'right', fontSize: 8 },
    },
    styles: { cellPadding: 2, lineColor: [226, 232, 240], lineWidth: 0.2 },
  });

  const nextY = (doc as any).lastAutoTable?.finalY + 6;

  // SECTION 2: PAGO A CUENTA TABLE
  const pagoCuentaRows = [
    ['(+) Ingresos Gravados Ventas a Contribuyentes', formatMoney(report.pagoCuenta.ingresosGravados.contribuyentes)],
    ['(+) Ingresos Gravados Netos Ventas al Consumidor Final', formatMoney(report.pagoCuenta.ingresosGravados.consumidorFinalNeto)],
    ['(+) Ingresos por Exportaciones', formatMoney(report.pagoCuenta.ingresosGravados.exportaciones)],
    [{ content: 'BASE IMPONIBLE TOTAL INGRESOS GRAVADOS', styles: { fontStyle: 'bold' } }, { content: formatMoney(report.pagoCuenta.ingresosGravados.totalBaseImponible), styles: { fontStyle: 'bold' } }],
    ['Porcentaje / Tasa de Pago a Cuenta (Art. 151 Código Tributario)', '1.75 %'],
    [
      { content: 'TOTAL PAGO A CUENTA DETERMINADO A ENTERAR', styles: { fontStyle: 'bold', fillColor: [238, 242, 255] } },
      { content: formatMoney(report.pagoCuenta.totalPagoCuentaAPagar), styles: { fontStyle: 'bold', textColor: [37, 99, 235], fillColor: [238, 242, 255] } },
    ],
  ];

  autoTable(doc, {
    startY: nextY,
    head: [['LIQUIDACION DE PAGO A CUENTA DE IMPUESTO SOBRE LA RENTA (Art. 151 C.T.)', 'MONTO (USD)']],
    body: pagoCuentaRows as any[],
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
    columnStyles: {
      0: { cellWidth: 140, fontSize: 8 },
      1: { cellWidth: 46, halign: 'right', fontSize: 8 },
    },
    styles: { cellPadding: 2, lineColor: [226, 232, 240], lineWidth: 0.2 },
  });

  const finalSummaryY = (doc as any).lastAutoTable?.finalY + 6;

  // SECTION 3: TOTAL GENERAL TO PAY TO MH
  const totalGeneralRows = [
    ['Impuesto IVA a Pagar en el Período', formatMoney(report.resumenGeneral.totalIvaAPagar)],
    ['Pago a Cuenta de Renta a Pagar en el Período', formatMoney(report.resumenGeneral.totalPagoCuentaAPagar)],
    [
      { content: 'TOTAL GENERAL A PAGAR AL MINISTERIO DE HACIENDA (MH)', styles: { fontStyle: 'bold', fontSize: 9, fillColor: [30, 41, 59], textColor: [255, 255, 255] } },
      { content: formatMoney(report.resumenGeneral.totalPagarFisco), styles: { fontStyle: 'bold', fontSize: 9, halign: 'right', fillColor: [30, 41, 59], textColor: [255, 255, 255] } },
    ],
  ];

  autoTable(doc, {
    startY: finalSummaryY,
    head: [['CONSOLIDADO TOTAL DE IMPUESTOS A PAGAR', 'MONTO TOTAL (USD)']],
    body: totalGeneralRows as any[],
    theme: 'grid',
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
    columnStyles: {
      0: { cellWidth: 140, fontSize: 8 },
      1: { cellWidth: 46, halign: 'right', fontSize: 8 },
    },
    styles: { cellPadding: 2.2, lineColor: [226, 232, 240], lineWidth: 0.2 },
  });

  // Signatures on bottom
  let sigY = Math.min((doc as any).lastAutoTable?.finalY + 20, 245);
  if ((doc as any).lastAutoTable?.finalY + 28 > 260) {
    doc.addPage();
    sigY = 25;
  }

  drawVatSignatures(doc, report.firmas, 215.9, sigY);

  const fileName = `LIQUIDACION_IMPUESTOS_${report.periodo.nombreMes}_${report.periodo.anio}.pdf`;
  doc.save(fileName);
}
