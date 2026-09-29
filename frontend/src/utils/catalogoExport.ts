import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CuentaContable } from '../types/accounting';
import { Empresa } from '../types';

/**
 * Exports the accounting chart of accounts (Catálogo de Cuentas) to Excel (.xlsx).
 */
export function exportCatalogoToExcel(
  cuentas: CuentaContable[],
  ejercicio: string,
  empresa?: Empresa | null
) {
  const wb = XLSX.utils.book_new();

  const sheetData: any[][] = [
    [empresa?.nom_emp || 'EMPRESA REGISTRADA'],
    ['CATÁLOGO DE CUENTAS CONTABLES'],
    [`NUMERO DE REGISTRO DE I.V.A.: ${empresa?.reg_fiscal || 'N/A'}    |    NIT: ${empresa?.nit || 'N/A'}`],
    [`EJERCICIO FISCAL: ${ejercicio}`],
    ['(CATÁLOGO OFICIAL DE CUENTAS)'],
    [], // Blank separator
    ['CÓDIGO', 'NOMBRE DE LA CUENTA', 'NIVEL', 'PADRE', 'CLASIFICACIÓN', 'TIPO CUENTA', 'NATURALEZA'],
  ];

  cuentas.forEach((cta) => {
    const clasificacion = cta.g_d_m === 'M' ? 'Mayor (M)' : cta.g_d_m === 'G' ? 'Grupo (G)' : 'Detalle (D)';
    const naturaleza = cta.deudor === 1 ? 'Deudora' : 'Acreedora';

    sheetData.push([
      cta.cod_cta,
      cta.nom_cta,
      cta.nivel_cta || '',
      cta.dep_cta || '',
      clasificacion,
      cta.cod_tp_cta || '',
      naturaleza,
    ]);
  });

  sheetData.push([]);
  sheetData.push([`Total de Cuentas: ${cuentas.length}`]);
  sheetData.push(['FIN DEL CATÁLOGO.']);

  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Column widths
  ws['!cols'] = [
    { wch: 18 }, // Código
    { wch: 45 }, // Nombre
    { wch: 8 },  // Nivel
    { wch: 18 }, // Padre
    { wch: 16 }, // Clasificación
    { wch: 14 }, // Tipo
    { wch: 14 }, // Naturaleza
  ];

  XLSX.utils.book_append_sheet(wb, ws, `Catálogo_${ejercicio}`);
  XLSX.writeFile(wb, `Catalogo_Cuentas_${ejercicio}.xlsx`);
}

/**
 * Builds the official PDF representation for the accounting chart of accounts.
 */
function buildCatalogoPdfDoc(
  cuentas: CuentaContable[],
  ejercicio: string,
  empresa?: Empresa | null
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
  });

  const pageWidth = 215.9;
  const centerX = pageWidth / 2;

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(20, 20, 20);
  doc.text(empresa?.nom_emp || 'EMPRESA REGISTRADA', centerX, 13, { align: 'center' });

  doc.setFontSize(10.5);
  doc.text('CATÁLOGO DE CUENTAS CONTABLES', centerX, 18, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  const taxIdText = `NUMERO DE REGISTRO DE I.V.A.: ${empresa?.reg_fiscal || 'N/A'}    |    NIT: ${empresa?.nit || 'N/A'}`;
  doc.text(taxIdText, centerX, 22.5, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 30, 30);
  doc.text(`EJERCICIO FISCAL: ${ejercicio}`, centerX, 27, { align: 'center' });

  // Date and Time
  const now = new Date();
  const dateStr = now.toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  doc.setFontSize(6.5);
  doc.setTextColor(100, 100, 100);
  doc.text(`${dateStr}\n${timeStr}`, 14, 10);

  // Table rows
  const rows = cuentas.map((cta) => {
    const clasificacion = cta.g_d_m === 'M' ? 'Mayor' : cta.g_d_m === 'G' ? 'Grupo' : 'Detalle';
    const naturaleza = cta.deudor === 1 ? 'Deudora' : 'Acreedora';
    const nivelNum = parseInt(cta.nivel_cta || '1', 10);
    const isMayor = cta.g_d_m === 'M' || cta.g_d_m === 'G' || nivelNum <= 3;
    const fontStyleVal: 'bold' | 'normal' = isMayor ? 'bold' : 'normal';
    const centerAlign: 'center' = 'center';
    const indentation = '  '.repeat(Math.max(0, nivelNum - 1));

    return [
      { content: cta.cod_cta, styles: { fontStyle: fontStyleVal } },
      { content: `${indentation}${cta.nom_cta}`, styles: { fontStyle: fontStyleVal } },
      { content: cta.nivel_cta || '1', styles: { halign: centerAlign } },
      { content: cta.dep_cta || '-', styles: { halign: centerAlign } },
      { content: clasificacion, styles: { halign: centerAlign } },
      { content: naturaleza, styles: { halign: centerAlign } },
    ];
  });

  autoTable(doc, {
    head: [['CÓDIGO', 'NOMBRE DE LA CUENTA', 'NIVEL', 'PADRE', 'TIPO', 'NATURALEZA']],
    body: rows,
    startY: 32,
    theme: 'plain',
    styles: { fontSize: 7.5, cellPadding: 1.2 },
    headStyles: { fontStyle: 'bold', fillColor: [230, 235, 245], textColor: [0, 0, 0] },
    columnStyles: {
      0: { cellWidth: 26 },
      1: { cellWidth: 92 },
      2: { cellWidth: 14, halign: 'center' },
      3: { cellWidth: 22, halign: 'center' },
      4: { cellWidth: 18, halign: 'center' },
      5: { cellWidth: 20, halign: 'center' },
    },
  });

  // Footer / Totals
  const finalY = (doc as any).lastAutoTable?.finalY || 100;
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(50, 50, 50);
  doc.text(`Total de Cuentas Contables : ${cuentas.length}`, 14, finalY + 6);
  doc.text('FIN DEL CATÁLOGO.', 14, finalY + 10);

  // Pagination
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120);
    const pageStr = `Página ${i} de ${totalPages}`;
    doc.text(pageStr, pageWidth - 14, 279.4 - 7, { align: 'right' });
  }

  return doc;
}

/**
 * Exports the chart of accounts directly to a downloaded PDF.
 */
export function exportCatalogoToPdf(
  cuentas: CuentaContable[],
  ejercicio: string,
  empresa?: Empresa | null
) {
  const doc = buildCatalogoPdfDoc(cuentas, ejercicio, empresa);
  doc.save(`Catalogo_Cuentas_${ejercicio}.pdf`);
}

/**
 * Opens browser print dialog for the chart of accounts.
 */
export function printCatalogoPdf(
  cuentas: CuentaContable[],
  ejercicio: string,
  empresa?: Empresa | null
) {
  const doc = buildCatalogoPdfDoc(cuentas, ejercicio, empresa);
  const blob = doc.output('blob');
  const blobUrl = URL.createObjectURL(blob);
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.src = blobUrl;
  document.body.appendChild(iframe);
  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
  };
}
