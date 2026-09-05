import * as XLSX from 'xlsx';
import { ReporteContableResponse } from '../types/accounting';

export function exportAccountingReportToExcel(report: ReporteContableResponse) {
  const wb = XLSX.utils.book_new();

  // Header standard identical to Libros de IVA
  const sheetData: any[][] = [
    [report.empresa.nom_emp || 'EMPRESA REGISTRADA'],
    [report.titulo],
    [`NUMERO DE REGISTRO DE I.V.A.: ${report.empresa.reg_fiscal || 'N/A'}    |    NIT: ${report.empresa.nit || 'N/A'}`],
    [report.periodoTexto],
    ['(CIFRAS EXPRESADAS EN DOLARES DE LOS ESTADOS UNIDOS DE AMERICA)'],
    [], // Blank separator
  ];

  switch (report.reportId) {
    // -------------------------------------------------------------
    // 1. AUXILIAR DE OPERACIONES
    // -------------------------------------------------------------
    case 'auxiliar_operaciones': {
      const { cuentas, totalCargos, totalAbonos, totalCuentasImpresas } = report.data;

      sheetData.push(['FECHA', 'TIPO PARTIDA', 'CONCEPTO', 'SALDO INICIAL', 'CARGOS', 'ABONOS', 'SALDOS']);

      (cuentas || []).forEach((c: any) => {
        sheetData.push([c.cod_cta, c.nom_cta, '', c.saldoInicial, '', '', '']);

        (c.movimientos || []).forEach((m: any) => {
          sheetData.push([m.fecha, m.tipoPartida, m.concepto, '', m.cargo, m.abono, m.saldo]);
        });

        sheetData.push(['TOTALES...', '', '', '', c.totalesCargos, c.totalesAbonos, c.saldoFinal]);
        sheetData.push([]); // blank line between accounts
      });

      sheetData.push(['TOTAL GENERAL...', '', '', '', totalCargos, totalAbonos, '']);
      sheetData.push([`Número de Cuentas Impresas : ${totalCuentasImpresas || 0}`]);
      sheetData.push(['FIN DEL REPORTE.']);
      break;
    }

    // -------------------------------------------------------------
    // 2. BALANCE DE COMPROBACIÓN (CARGOS Y ABONOS)
    // -------------------------------------------------------------
    case 'bal_comp_cargos_abonos': {
      const { filas, totalCargos, totalAbonos, totalCuentasImpresas } = report.data;

      sheetData.push(['CUENTA', 'DESCRIPCION DE LA CUENTA', 'SALDO INICIAL', 'CARGO', 'ABONO', 'SALDO FINAL']);

      (filas || []).forEach((f: any) => {
        sheetData.push([f.cod_cta, f.nom_cta, f.saldo_inicial, f.cargo, f.abono, f.saldo_final]);
      });

      sheetData.push(['TOTALES...', '', '', totalCargos, totalAbonos, '']);
      sheetData.push([]);
      sheetData.push([`Número de Cuentas Impresas : ${totalCuentasImpresas || 0}`]);
      sheetData.push(['FIN DEL REPORTE.']);
      break;
    }

    // -------------------------------------------------------------
    // 3. BALANCE DE COMPROBACIÓN POR NIVELES
    // -------------------------------------------------------------
    case 'bal_comp_niveles': {
      const { filas, totalActivo, totalPasivo, totalCapital, totalAcreedoras, totalDeudoras, utilidadEjercicio, totalCuentasImpresas } = report.data;

      sheetData.push(['CUENTA', 'DESCRIPCION DE LA CUENTA', 'NIVEL ANT.', 'NIVEL 5', 'NIVEL 4', 'NIVEL 3', 'NIVEL 2', 'NIVEL 1']);

      (filas || []).forEach((f: any) => {
        sheetData.push([
          f.cod_cta,
          f.nom_cta,
          f.nivelAnt ?? '',
          f.nivel5 ?? '',
          f.nivel4 ?? '',
          f.nivel3 ?? '',
          f.nivel2 ?? '',
          f.nivel1 ?? '',
        ]);
      });

      sheetData.push([]);
      sheetData.push(['TOTAL ACTIVO :', '', '', '', '', '', '', totalActivo]);
      sheetData.push(['TOTAL PASIVO :', '', '', '', '', '', '', totalPasivo]);
      sheetData.push(['TOTAL CAPITAL :', '', '', '', '', '', '', totalCapital]);
      sheetData.push(['TOTAL ACREEDORAS :', '', '', '', '', '', '', totalAcreedoras]);
      sheetData.push(['TOTAL DEUDORAS :', '', '', '', '', '', '', totalDeudoras]);
      sheetData.push(['UTILIDAD O PERDIDA DEL EJERCICIO... :', '', '', '', '', '', '', utilidadEjercicio]);
      sheetData.push([]);
      sheetData.push([`Numero de Cuentas Impresas : ${totalCuentasImpresas || 0}`]);
      sheetData.push(['FIN DEL INFORME...']);
      break;
    }

    // -------------------------------------------------------------
    // 4. BALANCE GENERAL - CUENTA
    // -------------------------------------------------------------
    case 'balance_general_cuenta': {
      const { activoRows, pasivoRows, patrimonioRows, totalActivo, utilidadEjercicio, totalPasivoPatrimonio } = report.data;

      sheetData.push(['ACTIVO', 'MONTO', 'PASIVO Y PATRIMONIO', 'MONTO']);

      const rightItems: any[] = [
        { isHeader: true, title: 'PASIVO' },
        ...(pasivoRows || []),
        { isHeader: true, title: 'PATRIMONIO' },
        ...(patrimonioRows || []),
        { isSpecial: true, title: 'UTILIDAD DEL EJERCICIO', saldo: utilidadEjercicio },
      ];

      const maxLines = Math.max((activoRows || []).length, rightItems.length);

      for (let i = 0; i < maxLines; i++) {
        const act = (activoRows || [])[i];
        const rgt = rightItems[i];

        const leftName = act ? act.nom_cta : '';
        const leftVal = act ? act.saldo : '';

        let rightName = '';
        let rightVal = '';
        if (rgt) {
          if (rgt.isHeader) rightName = rgt.title;
          else if (rgt.isSpecial) {
            rightName = rgt.title;
            rightVal = rgt.saldo;
          } else {
            rightName = rgt.nom_cta;
            rightVal = rgt.saldo;
          }
        }

        sheetData.push([leftName, leftVal, rightName, rightVal]);
      }

      sheetData.push([]);
      sheetData.push(['TOTAL ACTIVO', totalActivo, 'TOTAL PASIVO Y PATRIMONIO', totalPasivoPatrimonio]);
      break;
    }

    // -------------------------------------------------------------
    // 5. BALANCE DE COMPROBACIÓN - CUENTA
    // -------------------------------------------------------------
    case 'bal_comp_cuenta': {
      const { leftRows, rightRows, totalIzquierda, totalDerecha } = report.data;

      sheetData.push(['DEUDORAS Y ACTIVOS', 'MONTO', 'ACREEDORAS, PASIVO Y PATRIMONIO', 'MONTO']);

      const maxRows = Math.max((leftRows || []).length, (rightRows || []).length);
      for (let i = 0; i < maxRows; i++) {
        const l = (leftRows || [])[i];
        const r = (rightRows || [])[i];
        sheetData.push([
          l ? l.nom_cta : '',
          l ? l.saldo : '',
          r ? r.nom_cta : '',
          r ? r.saldo : '',
        ]);
      }

      sheetData.push([]);
      sheetData.push(['TOTAL ACTIVO', totalIzquierda, 'TOTAL PASIVO Y PATRIMONIO', totalDerecha]);
      break;
    }

    // -------------------------------------------------------------
    // 6. ANEXO AL BALANCE GENERAL
    // -------------------------------------------------------------
    case 'anexo_balance_general': {
      const { filas, totalActivo, totalPasivo, totalCapital, utilidadEjercicio, totalCuentasImpresas } = report.data;

      sheetData.push(['CUENTA CONTABLE', 'NIVEL ANT.', 'NIVEL 5', 'NIVEL 4', 'NIVEL 3', 'NIVEL 2', 'NIVEL 1']);

      (filas || []).forEach((f: any) => {
        sheetData.push([
          `${f.cod_cta} ${f.nom_cta}`,
          f.nivelAnt ?? '',
          f.nivel5 ?? '',
          f.nivel4 ?? '',
          f.nivel3 ?? '',
          f.nivel2 ?? '',
          f.nivel1 ?? '',
        ]);
      });

      sheetData.push([]);
      sheetData.push(['TOTAL ACTIVO :', '', '', '', '', '', totalActivo]);
      sheetData.push(['TOTAL PASIVO :', '', '', '', '', '', totalPasivo]);
      sheetData.push(['TOTAL CAPITAL :', '', '', '', '', '', totalCapital]);
      sheetData.push(['UTILIDAD O PERDIDA DEL EJERCICIO... :', '', '', '', '', '', utilidadEjercicio]);
      sheetData.push([]);
      sheetData.push([`Numero de Cuentas Impresas : ${totalCuentasImpresas || 0}`]);
      sheetData.push(['FIN DEL INFORME...']);
      break;
    }

    // -------------------------------------------------------------
    // 7. LIBRO DIARIO MAYOR
    // -------------------------------------------------------------
    case 'diario_mayor': {
      const { cuentas, grandTotalCargos, grandTotalAbonos } = report.data;

      sheetData.push(['FECHA', 'PARTIDA', 'CONCEPTO', 'DEBITO', 'CREDITO', 'SALDO MAYORIZADO']);

      (cuentas || []).forEach((c: any) => {
        sheetData.push([`${c.cod_cta} - ${c.nom_cta}`, '', '', '', '', '']);

        (c.movimientos || []).forEach((m: any) => {
          sheetData.push([m.fecha, `Partida #${m.corr_part}`, m.concepto, m.cargo, m.abono, m.saldo]);
        });

        sheetData.push(['SUBTOTAL CUENTA', '', '', c.totalCargos, c.totalAbonos, c.saldoFinal]);
        sheetData.push([]);
      });

      sheetData.push(['TOTALES GENERALES', '', '', grandTotalCargos, grandTotalAbonos, '']);
      break;
    }

    // -------------------------------------------------------------
    // 8. LIBRO DIARIO
    // -------------------------------------------------------------
    case 'diario': {
      const { partidas, grandTotalDebe, grandTotalHaber } = report.data;

      sheetData.push(['PARTIDA / CODIGO', 'NOMBRE DE CUENTA', 'CONCEPTO', 'DEBE', 'HABER']);

      (partidas || []).forEach((p: any) => {
        sheetData.push([`Partida No. ${p.corr_part} (${p.fecha})`, p.tipo, p.concepto, '', '']);

        (p.lineas || []).forEach((l: any) => {
          sheetData.push([l.cod_cta, l.nom_cta, l.concepto, l.debe, l.haber]);
        });

        sheetData.push(['TOTAL PARTIDA', '', '', p.totalDebe, p.totalHaber]);
        sheetData.push([]);
      });

      sheetData.push(['TOTALES GENERALES', '', '', grandTotalDebe, grandTotalHaber]);
      break;
    }

    // -------------------------------------------------------------
    // 9. LIBRO DIARIO MAYOR CONSOLIDADO
    // -------------------------------------------------------------
    case 'diario_mayor_consolidado': {
      const { filas, totalDebitos, totalCreditos } = report.data;

      sheetData.push(['CODIGO', 'NOMBRE DE LA CUENTA', 'SALDO ANTERIOR', 'DEBITOS', 'CREDITOS', 'SALDO ACTUAL']);

      (filas || []).forEach((f: any) => {
        sheetData.push([f.cod_cta, f.nom_cta, f.saldo_ant, f.debito, f.credito, f.saldo_act]);
      });

      sheetData.push(['TOTALES CONSOLIDADOS', '', '', totalDebitos, totalCreditos, '']);
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

      sheetData.push(['CONCEPTO FINANCIERO', 'MONTO (USD)']);
      sheetData.push(['INGRESOS DE OPERACIÓN', '']);
      sheetData.push(['  Ingresos por Actividades Ordinarias / Servicios', ingresosOrdinarios]);
      sheetData.push(['COSTOS DE OPERACIÓN', '']);
      sheetData.push(['  Costos por Actividades Ordinarias / Servicios', costosOrdinarios]);
      sheetData.push(['UTILIDAD BRUTA', utilidadBruta]);
      sheetData.push(['GASTOS DE OPERACIÓN', '']);
      sheetData.push(['  Gastos de Administración', gastosAdmin]);
      sheetData.push(['  Gastos de Venta', gastosVenta]);
      sheetData.push(['Total Gastos de Operación', totalGastosOperacion]);
      sheetData.push(['UTILIDAD DE OPERACIÓN', utilidadOperacion]);
      sheetData.push(['  Gastos Financieros y No Ordinarios', gastosFinancieros]);
      sheetData.push(['  Otros Ingresos No Ordinarios', otrosIngresos]);
      sheetData.push(['UTILIDAD ANTES DE RESERVA E IMPUESTOS', utilidadAntesImpuestos]);
      sheetData.push(['  (-) Reserva Legal (7%)', reservaLegal]);
      sheetData.push(['  (-) Impuesto Sobre la Renta (ISR)', impuestoRenta]);
      sheetData.push(['UTILIDAD NETA DEL EJERCICIO', utilidadNeta]);
      break;
    }

    // -------------------------------------------------------------
    // 11. CUADRO DE INGRESOS Y GASTOS
    // -------------------------------------------------------------
    case 'cuadro_ingresos_gastos': {
      const { filas, totalIngresos, totalGastos, resultadoNeto } = report.data;

      sheetData.push(['CODIGO', 'DESCRIPCION DE LA CUENTA', 'SALDO ANTERIOR', 'CARGOS MES', 'ABONOS MES', 'SALDO ACUMULADO']);

      (filas || []).forEach((f: any) => {
        sheetData.push([f.cod_cta, f.nom_cta, f.saldo_ant, f.cargos, f.abonos, f.saldo_act]);
      });

      sheetData.push(['TOTAL INGRESOS (GRUPO 5)', '', '', '', '', totalIngresos]);
      sheetData.push(['TOTAL GASTOS Y COSTOS (GRUPO 4)', '', '', '', '', totalGastos]);
      sheetData.push(['RESULTADO NETO DEL PERIODO', '', '', '', '', resultadoNeto]);
      break;
    }

    // -------------------------------------------------------------
    // 12. BALANCE COMPARATIVO
    // -------------------------------------------------------------
    case 'balance_comparativo': {
      const { filas, anoBase, anoComp } = report.data;

      sheetData.push(['CODIGO', 'NOMBRE DE LA CUENTA', `SALDO ${anoBase}`, `SALDO ${anoComp}`, 'VARIACION ($)', 'VARIACION (%)']);

      (filas || []).forEach((f: any) => {
        sheetData.push([
          f.cod_cta,
          f.nom_cta,
          f.saldoBase,
          f.saldoComp,
          f.variacionAbs,
          `${f.variacionPorc >= 0 ? '+' : ''}${f.variacionPorc.toFixed(1)}%`,
        ]);
      });
      break;
    }

    default:
      break;
  }

  // Bottom Signatures block
  sheetData.push([]);
  sheetData.push([]);

  const firmas = report.firmas && report.firmas.length > 0 ? report.firmas.slice(0, 3) : [
    { id_firma: 1, nom_firma: 'Representante Legal', puesto: 'Representante Legal' },
    { id_firma: 2, nom_firma: 'Contador General', puesto: 'Contador' },
    { id_firma: 3, nom_firma: 'Auditor Externo', puesto: 'Auditor Externo' },
  ];

  sheetData.push([
    '_______________________________',
    '',
    '_______________________________',
    '',
    '_______________________________',
  ]);

  sheetData.push([
    firmas[0]?.nom_firma || '',
    '',
    firmas[1]?.nom_firma || '',
    '',
    firmas[2]?.nom_firma || '',
  ]);

  sheetData.push([
    firmas[0]?.puesto || 'Representante Legal',
    '',
    firmas[1]?.puesto || 'Contador General',
    '',
    firmas[2]?.puesto || 'Auditor Externo',
  ]);

  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Column width styling
  ws['!cols'] = [
    { wch: 18 },
    { wch: 40 },
    { wch: 25 },
    { wch: 16 },
    { wch: 16 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Reporte');

  const fileName = `${report.reportId}_${report.periodoTexto.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
