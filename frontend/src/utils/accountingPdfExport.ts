import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ReporteContableResponse } from '../types/accounting';

export function formatCurrency(val: number | undefined | null, showDashWhenZero = true): string {
  if (val === null || val === undefined) return '';
  const n = Number(val);
  if (Math.abs(n) < 0.001) {
    return showDashWhenZero ? '$ -' : '$ 0.00';
  }
  const formatted = Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (n < 0) {
    return `$(${formatted})`;
  }
  return `$ ${formatted}`;
}

/**
 * Draws the standardized company header on every accounting PDF report.
 * Matches the Libros de IVA standard: nom_emp, report title, NIT, reg_fiscal, periodo, and USD legend.
 */
function drawHeader(doc: jsPDF, report: ReporteContableResponse, orientation: 'portrait' | 'landscape') {
  const pageWidth = orientation === 'landscape' ? 279.4 : 215.9;
  const centerX = pageWidth / 2;

  // 1. Company Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(20, 20, 20);
  doc.text(report.empresa.nom_emp || 'EMPRESA REGISTRADA', centerX, 13, { align: 'center' });

  // 2. Report Title
  doc.setFontSize(10.5);
  doc.text(report.titulo, centerX, 18, { align: 'center' });

  // 3. Tax Identifiers
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  const taxIdText = `NUMERO DE REGISTRO DE I.V.A.: ${report.empresa.reg_fiscal || 'N/A'}    |    NIT: ${report.empresa.nit || 'N/A'}`;
  doc.text(taxIdText, centerX, 22.5, { align: 'center' });

  // 4. Period
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 30, 30);
  doc.text(report.periodoTexto, centerX, 27, { align: 'center' });

  // 5. Currency standard
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(80, 80, 80);
  doc.text('(CIFRAS EXPRESADAS EN DOLARES DE LOS ESTADOS UNIDOS DE AMERICA)', centerX, 31, { align: 'center' });

  // Date and Time on top-left / top-right
  const now = new Date();
  const dateStr = now.toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  doc.setFontSize(6.5);
  doc.setTextColor(100, 100, 100);
  doc.text(`${dateStr}\n${timeStr}`, 14, 10);
}

/**
 * Draws the official accounting signatures block at the bottom of the PDF.
 * Ensures signatures are cleanly placed and creates a new page if necessary.
 */
function drawSignatures(doc: jsPDF, report: ReporteContableResponse, orientation: 'portrait' | 'landscape') {
  const pageHeight = orientation === 'landscape' ? 215.9 : 279.4;
  const pageWidth = orientation === 'landscape' ? 279.4 : 215.9;

  const sigBlockHeight = orientation === 'landscape' ? 26 : 30;
  const bottomTargetY = pageHeight - sigBlockHeight - 14;

  let lastTableY = (doc as any).lastAutoTable?.finalY ?? 120;
  let currentY: number;

  // Check if there is enough space on the current page for signatures
  if (lastTableY + sigBlockHeight + 10 > pageHeight - 12) {
    // If table reaches bottom edge, advance to a new final page
    doc.addPage();
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(120, 120, 120);
    doc.text('(Vienen firmas autorizadas del reporte oficial)', 14, 25);
    currentY = bottomTargetY;
  } else {
    // Anchor signatures to the bottom of the final page
    currentY = Math.max(lastTableY + 12, bottomTargetY);
  }

  const firmas = report.firmas && report.firmas.length > 0 ? report.firmas : [
    { id_firma: 1, nom_firma: 'Representante Legal', puesto: 'Representante Legal' },
    { id_firma: 2, nom_firma: 'Contador General', puesto: 'Contador' },
    { id_firma: 3, nom_firma: 'Auditor Externo', puesto: 'Auditor Externo' },
  ];

  const numFirmas = Math.min(firmas.length, 3);
  const colWidth = pageWidth / (numFirmas + 1);

  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);

  firmas.slice(0, 3).forEach((firma, index) => {
    const centerX = colWidth * (index + 1);
    const lineStartX = centerX - 30;
    const lineEndX = centerX + 30;

    // Signature line
    doc.setDrawColor(80, 80, 80);
    doc.setLineWidth(0.3);
    doc.line(lineStartX, currentY + 10, lineEndX, currentY + 10);

    // Name
    doc.setFont('helvetica', 'bold');
    doc.text(firma.nom_firma || '___________________________', centerX, currentY + 15, { align: 'center' });

    // Position / Title
    doc.setFont('helvetica', 'normal');
    doc.text(firma.puesto || 'Firma Autorizada', centerX, currentY + 19, { align: 'center' });
  });
}

/**
 * Main export function for accounting reports to PDF.
 */
export function exportAccountingReportToPdf(report: ReporteContableResponse) {
  // Determine orientation based on report type
  const isLandscape = [
    'bal_comp_cargos_abonos',
    'bal_comp_niveles',
    'anexo_balance_general',
    'diario_mayor',
    'diario_mayor_consolidado',
    'cuadro_ingresos_gastos',
    'balance_comparativo',
  ].includes(report.reportId);

  const doc = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'letter',
  });

  const orientation = isLandscape ? 'landscape' : 'portrait';
  drawHeader(doc, report, orientation);

  const startY = 36;

  switch (report.reportId) {
    // -------------------------------------------------------------
    // 1. AUXILIAR DE OPERACIONES
    // -------------------------------------------------------------
    case 'auxiliar_operaciones': {
      const { cuentas, totalCargos, totalAbonos, totalCuentasImpresas } = report.data;
      const rows: any[] = [];

      (cuentas || []).forEach((c: any) => {
        // Account header
        rows.push([
          { content: c.cod_cta, styles: { fontStyle: 'bold', fillColor: [245, 247, 250] } },
          { content: c.nom_cta, colSpan: 2, styles: { fontStyle: 'bold', fillColor: [245, 247, 250] } },
          { content: formatCurrency(c.saldoInicial), styles: { halign: 'right', fontStyle: 'bold', fillColor: [245, 247, 250] } },
          { content: '', colSpan: 3, styles: { fillColor: [245, 247, 250] } },
        ]);

        // Transactions
        (c.movimientos || []).forEach((m: any) => {
          rows.push([
            m.fecha,
            m.tipoPartida,
            m.concepto,
            '',
            formatCurrency(m.cargo),
            formatCurrency(m.abono),
            formatCurrency(m.saldo),
          ]);
        });

        // Account subtotal
        rows.push([
          { content: 'TOTALES...', colSpan: 4, styles: { fontStyle: 'bold', halign: 'left' } },
          { content: formatCurrency(c.totalesCargos), styles: { halign: 'right', fontStyle: 'bold' } },
          { content: formatCurrency(c.totalesAbonos), styles: { halign: 'right', fontStyle: 'bold' } },
          { content: formatCurrency(c.saldoFinal), styles: { halign: 'right', fontStyle: 'bold' } },
        ]);
      });

      // Grand totals row
      rows.push([
        { content: 'TOTAL GENERAL...', colSpan: 4, styles: { fontStyle: 'bold', halign: 'left' } },
        { content: formatCurrency(totalCargos), styles: { halign: 'right', fontStyle: 'bold' } },
        { content: formatCurrency(totalAbonos), styles: { halign: 'right', fontStyle: 'bold' } },
        { content: '', styles: {} },
      ]);

      autoTable(doc, {
        head: [['FECHA', 'TIPO PARTIDA', 'CONCEPTO', 'SALDO INICIAL', 'CARGOS', 'ABONOS', 'SALDOS']],
        body: rows,
        startY,
        theme: 'plain',
        styles: { fontSize: 7, cellPadding: 1.2 },
        headStyles: { fontStyle: 'bold', fillColor: [230, 235, 245], textColor: [0, 0, 0] },
        columnStyles: {
          0: { cellWidth: 18, halign: 'center' },
          1: { cellWidth: 28 },
          2: { cellWidth: 70 },
          3: { halign: 'right', cellWidth: 24 },
          4: { halign: 'right', cellWidth: 24 },
          5: { halign: 'right', cellWidth: 24 },
          6: { halign: 'right', cellWidth: 24, fontStyle: 'bold' },
        },
      });

      // Bottom accounts summary
      const finalY = (doc as any).lastAutoTable?.finalY || 100;
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.text(`Número de Cuentas Impresas : ${totalCuentasImpresas || 0}`, 14, finalY + 6);
      doc.text('FIN DEL REPORTE.', 14, finalY + 10);

      drawSignatures(doc, report, orientation);
      break;
    }

    // -------------------------------------------------------------
    // 2. BALANCE DE COMPROBACIÓN (CARGOS Y ABONOS)
    // -------------------------------------------------------------
    case 'bal_comp_cargos_abonos': {
      const { filas, totalCargos, totalAbonos, totalCuentasImpresas } = report.data;

      const rows = (filas || []).map((f: any) => [
        f.cod_cta,
        f.nom_cta,
        formatCurrency(f.saldo_inicial),
        formatCurrency(f.cargo),
        formatCurrency(f.abono),
        formatCurrency(f.saldo_final),
      ]);

      // Totals row
      rows.push([
        { content: 'TOTALES...', colSpan: 3, styles: { fontStyle: 'bold', halign: 'left' } },
        { content: formatCurrency(totalCargos), styles: { fontStyle: 'bold', halign: 'right' } },
        { content: formatCurrency(totalAbonos), styles: { fontStyle: 'bold', halign: 'right' } },
        { content: '', styles: {} },
      ]);

      autoTable(doc, {
        head: [['CUENTA', 'DESCRIPCION DE LA CUENTA', 'SALDO INICIAL', 'CARGO', 'ABONO', 'SALDO FINAL']],
        body: rows,
        startY,
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 1.2 },
        headStyles: { fillColor: [240, 242, 245], textColor: [0, 0, 0], fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 24 },
          1: { cellWidth: 95 },
          2: { halign: 'right', cellWidth: 32 },
          3: { halign: 'right', cellWidth: 32 },
          4: { halign: 'right', cellWidth: 32 },
          5: { halign: 'right', cellWidth: 35, fontStyle: 'bold' },
        },
      });

      const finalY = (doc as any).lastAutoTable?.finalY || 100;
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.text(`Número de Cuentas Impresas : ${totalCuentasImpresas || 0}`, 14, finalY + 6);
      doc.text('FIN DEL REPORTE.', 14, finalY + 10);

      drawSignatures(doc, report, orientation);
      break;
    }

    // -------------------------------------------------------------
    // 3. BALANCE DE COMPROBACIÓN POR NIVELES
    // -------------------------------------------------------------
    case 'bal_comp_niveles': {
      const { filas, totalActivo, totalPasivo, totalCapital, totalAcreedoras, totalDeudoras, utilidadEjercicio, totalCuentasImpresas } = report.data;

      const rows = (filas || []).map((f: any) => [
        f.cod_cta,
        f.nom_cta,
        formatCurrency(f.nivelAnt),
        formatCurrency(f.nivel5),
        formatCurrency(f.nivel4),
        formatCurrency(f.nivel3),
        formatCurrency(f.nivel2),
        formatCurrency(f.nivel1),
      ]);

      // Summary subtotal rows
      rows.push(
        [{ content: 'TOTAL ACTIVO :', colSpan: 7, styles: { fontStyle: 'bold', halign: 'right' } }, { content: formatCurrency(totalActivo), styles: { fontStyle: 'bold', halign: 'right' } }],
        [{ content: 'TOTAL PASIVO :', colSpan: 7, styles: { fontStyle: 'bold', halign: 'right' } }, { content: formatCurrency(totalPasivo), styles: { fontStyle: 'bold', halign: 'right' } }],
        [{ content: 'TOTAL CAPITAL :', colSpan: 7, styles: { fontStyle: 'bold', halign: 'right' } }, { content: formatCurrency(totalCapital), styles: { fontStyle: 'bold', halign: 'right' } }],
        [{ content: 'TOTAL ACREEDORAS :', colSpan: 7, styles: { fontStyle: 'bold', halign: 'right' } }, { content: formatCurrency(totalAcreedoras), styles: { fontStyle: 'bold', halign: 'right' } }],
        [{ content: 'TOTAL DEUDORAS :', colSpan: 7, styles: { fontStyle: 'bold', halign: 'right' } }, { content: formatCurrency(totalDeudoras), styles: { fontStyle: 'bold', halign: 'right' } }],
        [{ content: 'UTILIDAD O PERDIDA DEL EJERCICIO... :', colSpan: 7, styles: { fontStyle: 'bold', halign: 'right' } }, { content: formatCurrency(utilidadEjercicio), styles: { fontStyle: 'bold', halign: 'right' } }],
      );

      autoTable(doc, {
        head: [['CUENTA', 'DESCRIPCION DE LA CUENTA', 'NIVEL ANT.', 'NIVEL 5', 'NIVEL 4', 'NIVEL 3', 'NIVEL 2', 'NIVEL 1']],
        body: rows,
        startY,
        theme: 'plain',
        styles: { fontSize: 7, cellPadding: 1.1 },
        headStyles: { fontStyle: 'bold', fillColor: [240, 242, 245], textColor: [0, 0, 0] },
        columnStyles: {
          0: { cellWidth: 20 },
          1: { cellWidth: 80 },
          2: { halign: 'right', cellWidth: 24 },
          3: { halign: 'right', cellWidth: 24 },
          4: { halign: 'right', cellWidth: 24 },
          5: { halign: 'right', cellWidth: 24 },
          6: { halign: 'right', cellWidth: 24 },
          7: { halign: 'right', cellWidth: 26, fontStyle: 'bold' },
        },
      });

      const finalY = (doc as any).lastAutoTable?.finalY || 100;
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.text(`Numero de Cuentas Impresas : ${totalCuentasImpresas || 0}`, 14, finalY + 6);
      doc.text('FIN DEL INFORME...', 14, finalY + 10);

      drawSignatures(doc, report, orientation);
      break;
    }

    // -------------------------------------------------------------
    // 4. BALANCE GENERAL - CUENTA (2 Columns)
    // -------------------------------------------------------------
    case 'balance_general_cuenta': {
      const { activoRows, pasivoRows, patrimonioRows, totalActivo, utilidadEjercicio, totalPasivoPatrimonio } = report.data;

      // Dual-column layout table
      const rightItems: any[] = [
        { isHeader: true, title: 'PASIVO' },
        ...(pasivoRows || []),
        { isHeader: true, title: 'PATRIMONIO' },
        ...(patrimonioRows || []),
        { isSpecial: true, title: 'UTILIDAD DEL EJERCICIO', saldo: utilidadEjercicio },
      ];

      const maxLines = Math.max((activoRows || []).length, rightItems.length);
      const rows: any[] = [];

      for (let i = 0; i < maxLines; i++) {
        const act = (activoRows || [])[i];
        const rgt = rightItems[i];

        const colLeftName = act ? `${'  '.repeat(Math.max(0, act.nivel_cta - 1))}${act.nom_cta}` : '';
        const colLeftVal = act ? formatCurrency(act.saldo) : '';

        let colRightName = '';
        let colRightVal = '';
        if (rgt) {
          if (rgt.isHeader) {
            colRightName = rgt.title;
          } else if (rgt.isSpecial) {
            colRightName = rgt.title;
            colRightVal = formatCurrency(rgt.saldo);
          } else {
            colRightName = `${'  '.repeat(Math.max(0, rgt.nivel_cta - 1))}${rgt.nom_cta}`;
            colRightVal = formatCurrency(rgt.saldo);
          }
        }

        if (colLeftName || colRightName) {
          rows.push([colLeftName, colLeftVal, colRightName, colRightVal]);
        }
      }

      // Totals row
      rows.push([
        { content: 'TOTAL ACTIVO', styles: { fontStyle: 'bold', fontSize: 8.5 } },
        { content: formatCurrency(totalActivo), styles: { fontStyle: 'bold', fontSize: 8.5, halign: 'right' } },
        { content: 'TOTAL PASIVO Y PATRIMONIO', styles: { fontStyle: 'bold', fontSize: 8.5 } },
        { content: formatCurrency(totalPasivoPatrimonio), styles: { fontStyle: 'bold', fontSize: 8.5, halign: 'right' } },
      ]);

      autoTable(doc, {
        head: [['ACTIVO', '', 'PASIVO Y PATRIMONIO', '']],
        body: rows,
        startY,
        theme: 'plain',
        styles: { fontSize: 7, cellPadding: 1.2 },
        headStyles: { fontStyle: 'bold', fillColor: [240, 242, 245], textColor: [0, 0, 0] },
        columnStyles: {
          0: { cellWidth: 65 },
          1: { halign: 'right', cellWidth: 28 },
          2: { cellWidth: 65 },
          3: { halign: 'right', cellWidth: 28 },
        },
      });

      drawSignatures(doc, report, orientation);
      break;
    }

    // -------------------------------------------------------------
    // 5. BALANCE DE COMPROBACIÓN - CUENTA (2 Columns)
    // -------------------------------------------------------------
    case 'bal_comp_cuenta': {
      const { leftRows, rightRows, totalIzquierda, totalDerecha } = report.data;
      const maxRows = Math.max((leftRows || []).length, (rightRows || []).length);
      const rows: any[] = [];

      for (let i = 0; i < maxRows; i++) {
        const l = (leftRows || [])[i];
        const r = (rightRows || [])[i];

        rows.push([
          l ? `${'  '.repeat(Math.max(0, l.nivel_cta - 1))}${l.nom_cta}` : '',
          l ? formatCurrency(l.saldo) : '',
          r ? `${'  '.repeat(Math.max(0, r.nivel_cta - 1))}${r.nom_cta}` : '',
          r ? formatCurrency(r.saldo) : '',
        ]);
      }

      // Totals
      rows.push([
        { content: 'TOTAL ACTIVO', styles: { fontStyle: 'bold', fontSize: 8.5 } },
        { content: formatCurrency(totalIzquierda), styles: { fontStyle: 'bold', fontSize: 8.5, halign: 'right' } },
        { content: 'TOTAL PASIVO Y PATRIMONIO', styles: { fontStyle: 'bold', fontSize: 8.5 } },
        { content: formatCurrency(totalDerecha), styles: { fontStyle: 'bold', fontSize: 8.5, halign: 'right' } },
      ]);

      autoTable(doc, {
        head: [['DEUDORAS Y ACTIVOS', '', 'ACREEDORAS, PASIVO Y PATRIMONIO', '']],
        body: rows,
        startY,
        theme: 'plain',
        styles: { fontSize: 7, cellPadding: 1.2 },
        headStyles: { fontStyle: 'bold', fillColor: [240, 242, 245], textColor: [0, 0, 0] },
        columnStyles: {
          0: { cellWidth: 65 },
          1: { halign: 'right', cellWidth: 28 },
          2: { cellWidth: 65 },
          3: { halign: 'right', cellWidth: 28 },
        },
      });

      drawSignatures(doc, report, orientation);
      break;
    }

    // -------------------------------------------------------------
    // 6. ANEXO AL BALANCE GENERAL
    // -------------------------------------------------------------
    case 'anexo_balance_general': {
      const { filas, totalActivo, totalPasivo, totalCapital, utilidadEjercicio, totalCuentasImpresas } = report.data;

      const rows = (filas || []).map((f: any) => [
        `${f.cod_cta} ${f.nom_cta}`,
        formatCurrency(f.nivelAnt),
        formatCurrency(f.nivel5),
        formatCurrency(f.nivel4),
        formatCurrency(f.nivel3),
        formatCurrency(f.nivel2),
        formatCurrency(f.nivel1),
      ]);

      rows.push(
        [{ content: 'TOTAL ACTIVO :', colSpan: 6, styles: { fontStyle: 'bold', halign: 'right' } }, { content: formatCurrency(totalActivo), styles: { fontStyle: 'bold', halign: 'right' } }],
        [{ content: 'TOTAL PASIVO :', colSpan: 6, styles: { fontStyle: 'bold', halign: 'right' } }, { content: formatCurrency(totalPasivo), styles: { fontStyle: 'bold', halign: 'right' } }],
        [{ content: 'TOTAL CAPITAL :', colSpan: 6, styles: { fontStyle: 'bold', halign: 'right' } }, { content: formatCurrency(totalCapital), styles: { fontStyle: 'bold', halign: 'right' } }],
        [{ content: 'UTILIDAD O PERDIDA DEL EJERCICIO... :', colSpan: 6, styles: { fontStyle: 'bold', halign: 'right' } }, { content: formatCurrency(utilidadEjercicio), styles: { fontStyle: 'bold', halign: 'right' } }],
      );

      autoTable(doc, {
        head: [['CUENTA CONTABLE', 'NIVEL ANT.', 'NIVEL 5', 'NIVEL 4', 'NIVEL 3', 'NIVEL 2', 'NIVEL 1']],
        body: rows,
        startY,
        theme: 'plain',
        styles: { fontSize: 7, cellPadding: 1.1 },
        headStyles: { fontStyle: 'bold', fillColor: [240, 242, 245], textColor: [0, 0, 0] },
        columnStyles: {
          0: { cellWidth: 95 },
          1: { halign: 'right', cellWidth: 24 },
          2: { halign: 'right', cellWidth: 24 },
          3: { halign: 'right', cellWidth: 24 },
          4: { halign: 'right', cellWidth: 24 },
          5: { halign: 'right', cellWidth: 24 },
          6: { halign: 'right', cellWidth: 28, fontStyle: 'bold' },
        },
      });

      const finalY = (doc as any).lastAutoTable?.finalY || 100;
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.text(`Numero de Cuentas Impresas : ${totalCuentasImpresas || 0}`, 14, finalY + 6);
      doc.text('FIN DEL INFORME...', 14, finalY + 10);

      drawSignatures(doc, report, orientation);
      break;
    }

    // -------------------------------------------------------------
    // 7. LIBRO DIARIO MAYOR
    // -------------------------------------------------------------
    case 'diario_mayor': {
      const { cuentas, grandTotalCargos, grandTotalAbonos } = report.data;
      const rows: any[] = [];

      (cuentas || []).forEach((c: any) => {
        rows.push([
          { content: `${c.cod_cta} - ${c.nom_cta}`, colSpan: 6, styles: { fontStyle: 'bold', fillColor: [240, 242, 248] } },
        ]);

        (c.movimientos || []).forEach((m: any) => {
          rows.push([
            m.fecha,
            `Partida #${m.corr_part}`,
            m.concepto,
            formatCurrency(m.cargo),
            formatCurrency(m.abono),
            formatCurrency(m.saldo),
          ]);
        });

        rows.push([
          { content: 'SUBTOTAL CUENTA', colSpan: 3, styles: { fontStyle: 'bold', halign: 'right' } },
          { content: formatCurrency(c.totalCargos), styles: { fontStyle: 'bold', halign: 'right' } },
          { content: formatCurrency(c.totalAbonos), styles: { fontStyle: 'bold', halign: 'right' } },
          { content: formatCurrency(c.saldoFinal), styles: { fontStyle: 'bold', halign: 'right' } },
        ]);
      });

      // Grand totals
      rows.push([
        { content: 'TOTALES GENERALES', colSpan: 3, styles: { fontStyle: 'bold', halign: 'right', fillColor: [230, 235, 245] } },
        { content: formatCurrency(grandTotalCargos), styles: { fontStyle: 'bold', halign: 'right', fillColor: [230, 235, 245] } },
        { content: formatCurrency(grandTotalAbonos), styles: { fontStyle: 'bold', halign: 'right', fillColor: [230, 235, 245] } },
        { content: '', styles: { fillColor: [230, 235, 245] } },
      ]);

      autoTable(doc, {
        head: [['FECHA', 'PARTIDA', 'CONCEPTO', 'DEBITO', 'CREDITO', 'SALDO MAYORIZADO']],
        body: rows,
        startY,
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 1.2 },
        headStyles: { fillColor: [240, 242, 245], textColor: [0, 0, 0], fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 20, halign: 'center' },
          1: { cellWidth: 25 },
          2: { cellWidth: 105 },
          3: { halign: 'right', cellWidth: 32 },
          4: { halign: 'right', cellWidth: 32 },
          5: { halign: 'right', cellWidth: 35, fontStyle: 'bold' },
        },
      });

      drawSignatures(doc, report, orientation);
      break;
    }

    // -------------------------------------------------------------
    // 8. LIBRO DIARIO
    // -------------------------------------------------------------
    case 'diario': {
      const { partidas, grandTotalDebe, grandTotalHaber } = report.data;
      const rows: any[] = [];

      (partidas || []).forEach((p: any) => {
        // Entry header
        rows.push([
          {
            content: `Partida No. ${p.corr_part}    |    Fecha: ${p.fecha}    |    Tipo: ${p.tipo}\nConcepto: ${p.concepto}`,
            colSpan: 5,
            styles: { fontStyle: 'bold', fillColor: [245, 247, 250] },
          },
        ]);

        (p.lineas || []).forEach((l: any) => {
          rows.push([
            l.cod_cta,
            l.nom_cta,
            l.concepto,
            formatCurrency(l.debe),
            formatCurrency(l.haber),
          ]);
        });

        // Entry totals
        rows.push([
          { content: 'TOTAL PARTIDA', colSpan: 3, styles: { fontStyle: 'bold', halign: 'right' } },
          { content: formatCurrency(p.totalDebe), styles: { fontStyle: 'bold', halign: 'right' } },
          { content: formatCurrency(p.totalHaber), styles: { fontStyle: 'bold', halign: 'right' } },
        ]);
      });

      // Grand totals
      rows.push([
        { content: 'TOTALES GENERALES', colSpan: 3, styles: { fontStyle: 'bold', halign: 'right', fillColor: [230, 235, 245] } },
        { content: formatCurrency(grandTotalDebe), styles: { fontStyle: 'bold', halign: 'right', fillColor: [230, 235, 245] } },
        { content: formatCurrency(grandTotalHaber), styles: { fontStyle: 'bold', halign: 'right', fillColor: [230, 235, 245] } },
      ]);

      autoTable(doc, {
        head: [['CODIGO', 'NOMBRE DE LA CUENTA', 'CONCEPTO ESPECIFICO', 'DEBE', 'HABER']],
        body: rows,
        startY,
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 1.2 },
        headStyles: { fillColor: [240, 242, 245], textColor: [0, 0, 0], fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 24 },
          1: { cellWidth: 55 },
          2: { cellWidth: 55 },
          3: { halign: 'right', cellWidth: 28 },
          4: { halign: 'right', cellWidth: 28 },
        },
      });

      drawSignatures(doc, report, orientation);
      break;
    }

    // -------------------------------------------------------------
    // 9. LIBRO DIARIO MAYOR CONSOLIDADO
    // -------------------------------------------------------------
    case 'diario_mayor_consolidado': {
      const { filas, totalDebitos, totalCreditos } = report.data;

      const rows = (filas || []).map((f: any) => [
        f.cod_cta,
        f.nom_cta,
        formatCurrency(f.saldo_ant),
        formatCurrency(f.debito),
        formatCurrency(f.credito),
        formatCurrency(f.saldo_act),
      ]);

      rows.push([
        { content: 'TOTALES CONSOLIDADOS', colSpan: 3, styles: { fontStyle: 'bold', halign: 'right' } },
        { content: formatCurrency(totalDebitos), styles: { fontStyle: 'bold', halign: 'right' } },
        { content: formatCurrency(totalCreditos), styles: { fontStyle: 'bold', halign: 'right' } },
        { content: '', styles: {} },
      ]);

      autoTable(doc, {
        head: [['CODIGO', 'NOMBRE DE LA CUENTA', 'SALDO ANTERIOR', 'DEBITOS', 'CREDITOS', 'SALDO ACTUAL']],
        body: rows,
        startY,
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 1.2 },
        headStyles: { fillColor: [240, 242, 245], textColor: [0, 0, 0], fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 24 },
          1: { cellWidth: 95 },
          2: { halign: 'right', cellWidth: 32 },
          3: { halign: 'right', cellWidth: 32 },
          4: { halign: 'right', cellWidth: 32 },
          5: { halign: 'right', cellWidth: 35, fontStyle: 'bold' },
        },
      });

      drawSignatures(doc, report, orientation);
      break;
    }

    // -------------------------------------------------------------
    // 10. ESTADO DE RESULTADOS
    // -------------------------------------------------------------
    case 'estado_resultados': {
      const {
        ingresosOrdinarios,
        costosOrdinarios,
        utilidadBruta,
        gastosAdmin,
        gastosVenta,
        totalGastosOperacion,
        utilidadOperacion,
        gastosFinancieros,
        otrosIngresos,
        utilidadAntesImpuestos,
        reservaLegal,
        impuestoRenta,
        utilidadNeta,
      } = report.data;

      const rows: any[] = [
        [{ content: 'INGRESOS DE OPERACIÓN', styles: { fontStyle: 'bold' } }, ''],
        ['  Ingresos por Actividades Ordinarias / Servicios', formatCurrency(ingresosOrdinarios)],
        [{ content: 'COSTOS DE OPERACIÓN', styles: { fontStyle: 'bold' } }, ''],
        ['  Costos por Actividades Ordinarias / Servicios', formatCurrency(costosOrdinarios)],
        [{ content: 'UTILIDAD BRUTA', styles: { fontStyle: 'bold', fillColor: [245, 247, 250] } }, { content: formatCurrency(utilidadBruta), styles: { fontStyle: 'bold', halign: 'right', fillColor: [245, 247, 250] } }],
        [{ content: 'GASTOS DE OPERACIÓN', styles: { fontStyle: 'bold' } }, ''],
        ['  Gastos de Administración', formatCurrency(gastosAdmin)],
        ['  Gastos de Venta', formatCurrency(gastosVenta)],
        [{ content: 'Total Gastos de Operación', styles: { fontStyle: 'italic' } }, formatCurrency(totalGastosOperacion)],
        [{ content: 'UTILIDAD DE OPERACIÓN', styles: { fontStyle: 'bold', fillColor: [245, 247, 250] } }, { content: formatCurrency(utilidadOperacion), styles: { fontStyle: 'bold', halign: 'right', fillColor: [245, 247, 250] } }],
        ['  Gastos Financieros y No Ordinarios', formatCurrency(gastosFinancieros)],
        ['  Otros Ingresos No Ordinarios', formatCurrency(otrosIngresos)],
        [{ content: 'UTILIDAD ANTES DE RESERVA E IMPUESTO', styles: { fontStyle: 'bold', fillColor: [240, 242, 248] } }, { content: formatCurrency(utilidadAntesImpuestos), styles: { fontStyle: 'bold', halign: 'right', fillColor: [240, 242, 248] } }],
        ['  (-) Reserva Legal (7%)', formatCurrency(reservaLegal)],
        ['  (-) Provisión Impuesto Sobre la Renta (ISR)', formatCurrency(impuestoRenta)],
        [
          { content: 'UTILIDAD NETA DEL EJERCICIO', styles: { fontStyle: 'bold', fontSize: 8.5, fillColor: [220, 230, 242] } },
          { content: formatCurrency(utilidadNeta), styles: { fontStyle: 'bold', fontSize: 8.5, halign: 'right', fillColor: [220, 230, 242] } },
        ],
      ];

      autoTable(doc, {
        head: [['CONCEPTO FINANCIERO', 'MONTO EN USD']],
        body: rows,
        startY,
        theme: 'plain',
        styles: { fontSize: 7.5, cellPadding: 1.8 },
        headStyles: { fillColor: [240, 242, 245], textColor: [0, 0, 0], fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 140 },
          1: { halign: 'right', cellWidth: 46 },
        },
      });

      drawSignatures(doc, report, orientation);
      break;
    }

    // -------------------------------------------------------------
    // 11. CUADRO DE INGRESOS Y GASTOS
    // -------------------------------------------------------------
    case 'cuadro_ingresos_gastos': {
      const { filas, totalIngresos, totalGastos, resultadoNeto } = report.data;

      const rows = (filas || []).map((f: any) => [
        f.cod_cta,
        f.nom_cta,
        formatCurrency(f.saldo_ant),
        formatCurrency(f.cargos),
        formatCurrency(f.abonos),
        formatCurrency(f.saldo_act),
      ]);

      rows.push(
        [{ content: 'TOTAL INGRESOS (GRUPO 5)', colSpan: 5, styles: { fontStyle: 'bold', halign: 'right' } }, { content: formatCurrency(totalIngresos), styles: { fontStyle: 'bold', halign: 'right' } }],
        [{ content: 'TOTAL GASTOS Y COSTOS (GRUPO 4)', colSpan: 5, styles: { fontStyle: 'bold', halign: 'right' } }, { content: formatCurrency(totalGastos), styles: { fontStyle: 'bold', halign: 'right' } }],
        [{ content: 'RESULTADO NETO DEL PERIODO', colSpan: 5, styles: { fontStyle: 'bold', halign: 'right', fillColor: [230, 235, 245] } }, { content: formatCurrency(resultadoNeto), styles: { fontStyle: 'bold', halign: 'right', fillColor: [230, 235, 245] } }],
      );

      autoTable(doc, {
        head: [['CODIGO', 'DESCRIPCION DE LA CUENTA', 'SALDO ANTERIOR', 'CARGOS MES', 'ABONOS MES', 'SALDO ACUMULADO']],
        body: rows,
        startY,
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 1.2 },
        headStyles: { fillColor: [240, 242, 245], textColor: [0, 0, 0], fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 24 },
          1: { cellWidth: 95 },
          2: { halign: 'right', cellWidth: 32 },
          3: { halign: 'right', cellWidth: 32 },
          4: { halign: 'right', cellWidth: 32 },
          5: { halign: 'right', cellWidth: 35, fontStyle: 'bold' },
        },
      });

      drawSignatures(doc, report, orientation);
      break;
    }

    // -------------------------------------------------------------
    // 12. BALANCE COMPARATIVO
    // -------------------------------------------------------------
    case 'balance_comparativo': {
      const { filas, anoBase, anoComp } = report.data;

      const rows = (filas || []).map((f: any) => [
        f.cod_cta,
        f.nom_cta,
        formatCurrency(f.saldoBase),
        formatCurrency(f.saldoComp),
        formatCurrency(f.variacionAbs),
        `${f.variacionPorc >= 0 ? '+' : ''}${f.variacionPorc.toFixed(1)}%`,
      ]);

      autoTable(doc, {
        head: [['CODIGO', 'NOMBRE DE LA CUENTA', `SALDO ${anoBase}`, `SALDO ${anoComp}`, 'VARIACION ($)', 'VARIACION (%)']],
        body: rows,
        startY,
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 1.2 },
        headStyles: { fillColor: [240, 242, 245], textColor: [0, 0, 0], fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 24 },
          1: { cellWidth: 95 },
          2: { halign: 'right', cellWidth: 32 },
          3: { halign: 'right', cellWidth: 32 },
          4: { halign: 'right', cellWidth: 32 },
          5: { halign: 'right', cellWidth: 35, fontStyle: 'bold' },
        },
      });

      drawSignatures(doc, report, orientation);
      break;
    }

    default:
      break;
  }

  // Add Page Numbers (Página X de Y) to all pages confirming the last page
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120);
    const pageStr = `Página ${i} de ${totalPages}`;
    const pageX = orientation === 'landscape' ? 279.4 - 14 : 215.9 - 14;
    const pageY = orientation === 'landscape' ? 215.9 - 7 : 279.4 - 7;
    doc.text(pageStr, pageX, pageY, { align: 'right' });
  }

  const fileName = `${report.reportId}_${report.periodoTexto.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
  doc.save(fileName);
}
