export interface ReportGuideInfo {
  descripcionBreve: string;
  enQueConsiste: string;
  baseLegal?: string;
  comoFunciona: string[];
  tablas: string;
  requiereMayorizacion: boolean;
  consejos: string[];
}

export const ACCOUNTING_REPORT_GUIDES: Record<string, ReportGuideInfo> = {
  diario_mayor: {
    descripcionBreve: 'Libro principal y obligatorio que consolida las transacciones mensuales por cuenta de mayor.',
    enQueConsiste:
      'Es uno de los registros oficiales más importantes exigidos por la legislación mercantil salvadoreña. En él se centralizan mensualmente las operaciones registradas en el Libro Diario, agrupándolas cronológicamente bajo cada cuenta de mayor con sus respectivos saldos iniciales, cargos, abonos y saldo resultante.',
    baseLegal: 'Código de Comercio de El Salvador (Arts. 435 numeral 2, 438 y ss.) y Normas Internacionales de Información Financiera (NIIF).',
    comoFunciona: [
      'Obtiene el saldo inicial del mes para cada cuenta a partir de los saldos mayorizados acumulados (tabla `cuentas_saldos`).',
      'Extrae las partidas de diario aprobadas del mes (`cabecera_partida` y `detalle_partida`), agrupando los débitos y créditos correspondientes a cada cuenta mayor.',
      'Calcula en cada movimiento el nuevo saldo progresivo respetando la naturaleza de la cuenta (Deudora o Acreedora).',
      'Totaliza los cargos y abonos por cuenta y genera la suma de comprobación final del ejercicio.',
    ],
    tablas: 'cat_cuentas, cuentas_saldos, cabecera_partida, detalle_partida, firmas_conta',
    requiereMayorizacion: true,
    consejos: [
      'Ejecuta el botón "Mayorizar" antes de generar este reporte si se registraron o modificaron partidas recientemente.',
      'Verifica que el año y mes seleccionados correspondan exactamente al ejercicio fiscal deseado.',
      'Al imprimir o exportar a PDF, se anexarán automáticamente las firmas autorizadas (Representante Legal, Contador General y Auditor Externo).',
    ],
  },

  diario: {
    descripcionBreve: 'Registro cronológico y detallado de cada partida contable con sus débitos y créditos.',
    enQueConsiste:
      'Libro obligatorio donde se asientan día a día todas las transacciones financieras que realiza la entidad económica, partida por partida, en estricto orden cronológico y bajo el principio de partida doble (total Debe = total Haber).',
    baseLegal: 'Código de Comercio de El Salvador (Art. 435 numeral 1 y Art. 437).',
    comoFunciona: [
      'Consulta directamente las partidas contables (`cabecera_partida`) comprendidas entre la fecha de inicio y fecha de fin seleccionadas.',
      'Obtiene las líneas de detalle (`detalle_partida`) asociando cada movimiento a su cuenta contable del catálogo (`cat_cuentas`).',
      'Permite filtrar por un tipo de partida específico (Ingreso, Egreso, Diario, etc.) o consolidar todas las partidas del período.',
      'Valida la cuadratura exacta de cada partida individual y suma los totales generales de Debe y Haber al final del reporte.',
    ],
    tablas: 'cabecera_partida, detalle_partida, cat_cuentas, tipos_partida, firmas_conta',
    requiereMayorizacion: false,
    consejos: [
      'No requiere mayorización previa ya que extrae las partidas directamente en tiempo real de la base de datos.',
      'Ideal para auditar la correlatividad de los asientos y revisar los conceptos específicos de cada comprobante.',
      'Verifica que no queden partidas en estado borrador si deseas que el libro sea definitivo.',
    ],
  },

  diario_mayor_consolidado: {
    descripcionBreve: 'Resumen condensado de movimientos y saldos acumulados de todas las cuentas de mayor del mes.',
    enQueConsiste:
      'Proporciona una visión sintética y global del movimiento de las cuentas de mayor en un único resumen, permitiendo a la gerencia y auditores evaluar la evolución de los saldos anteriores, débitos y créditos mensuales y los saldos acumulados al cierre.',
    baseLegal: 'Práctica contable y mercantil salvadoreña para auditoría y comprobación de libros mayores.',
    comoFunciona: [
      'Consulta los saldos históricos de la tabla `cuentas_saldos` para el año y mes seleccionados.',
      'Muestra por cada cuenta: Saldo Anterior (arrastre del mes previo), Débitos del mes, Créditos del mes y Saldo Actual resultante.',
      'Asegura que la suma de todos los débitos consolidados sea exactamente igual a la suma de todos los créditos consolidados.',
    ],
    tablas: 'cat_cuentas, cuentas_saldos, firmas_conta',
    requiereMayorizacion: true,
    consejos: [
      'Es indispensable ejecutar la mayorización si se han ingresado nuevas partidas para que los saldos mensuales estén al día.',
      'Útil como paso previo antes de emitir los balances de comprobación generales.',
    ],
  },

  auxiliar_operaciones: {
    descripcionBreve: 'Detalle analítico movimiento a movimiento de una cuenta o rango de cuentas específico.',
    enQueConsiste:
      'Es la herramienta de análisis y auditoría más detallada del módulo contable. Permite inspeccionar el historial completo de transacciones que afectaron una o varias cuentas durante un período de fechas, mostrando saldo inicial, fecha, correlativo de partida, concepto analítico, cargos, abonos y saldo resultante tras cada movimiento.',
    baseLegal: 'Soporte documental exigido en auditorías fiscales del Ministerio de Hacienda (Código Tributario Art. 139).',
    comoFunciona: [
      'Calcula el saldo inicial de cada cuenta sumando algebraicamente todos los movimientos anteriores a la fecha de inicio seleccionada.',
      'Filtra las cuentas por el rango "Desde Cuenta" y "Hasta Cuenta" mediante el selector inteligente con búsqueda multi-token.',
      'Recorre cronológicamente cada renglón de las partidas aprobadas y recalcula el saldo línea a línea según la naturaleza contable (Deudora o Acreedora).',
      'Genera subtotales por cuenta y totales generales de cuentas impresas al final del reporte.',
    ],
    tablas: 'detalle_partida, cabecera_partida, cat_cuentas, firmas_conta',
    requiereMayorizacion: false,
    consejos: [
      'Utiliza los selectores buscables para delimitar rangos precisos (por ejemplo, solo cuentas de Banco 111101 a 111105).',
      'Si dejas los selectores en blanco, se auditarán todas las cuentas con movimiento en el período seleccionado.',
      'Excelente para conciliar saldos bancarios y cuentas por cobrar o pagar.',
    ],
  },

  bal_comp_cargos_abonos: {
    descripcionBreve: 'Comprobación de sumas de cargos y abonos con saldos iniciales y finales por nivel jerárquico.',
    enQueConsiste:
      'Comprueba que la totalidad de los cargos realizados en el período sea exactamente igual a la totalidad de los abonos, verificando que no existan inconsistencias o descuadres en la contabilidad general de la empresa. Aplica la igualdad: Saldo Inicial + Cargos - Abonos = Saldo Final.',
    baseLegal: 'Código de Comercio de El Salvador (Art. 435 numeral 3).',
    comoFunciona: [
      'Lee los saldos de apertura y movimientos mensuales de `cuentas_saldos` para el año y mes seleccionados.',
      'Filtra las cuentas hasta el nivel máximo de profundidad especificado (Nivel 1 al 6).',
      'Presenta 4 columnas clave: Saldo Inicial, Cargos, Abonos y Saldo Final.',
      'Verifica que la suma total de Cargos sea igual a la suma total de Abonos al pie de la tabla.',
    ],
    tablas: 'cat_cuentas, cuentas_saldos, firmas_conta',
    requiereMayorizacion: true,
    consejos: [
      'Se recomienda generar a Nivel 3 (Mayor) para revisión gerencial o Nivel 4/5 para auditoría detallada.',
      'Si notas diferencias entre cargos y abonos, mayoriza nuevamente para recalcular los acumulados del año.',
    ],
  },

  bal_comp_niveles: {
    descripcionBreve: 'Estructura jerárquica con saldos escalonados en columnas de Nivel Anterior, 5, 4, 3, 2 y 1.',
    enQueConsiste:
      'Formato tradicional y oficial en El Salvador que organiza los saldos según la jerarquía del catálogo. Permite visualizar simultáneamente cómo las subcuentas analíticas acumulan hacia las cuentas de mayor, rubro y clase principal.',
    baseLegal: 'Normas de presentación de información contable ante el Registro de Comercio (CNR) y auditores externos.',
    comoFunciona: [
      'Recorre el árbol del catálogo de cuentas clasificando cada cuenta según su nivel jerárquico.',
      'Ubica el saldo resultante de cada cuenta en la columna correspondiente (Nivel Ant., Nivel 5, Nivel 4, etc.).',
      'Calcula los subtotales oficiales: Total Activo, Total Pasivo, Total Capital, Total Acreedoras y Total Deudoras.',
      'Determina la Utilidad o Pérdida del Ejercicio por diferencia patrimonial.',
    ],
    tablas: 'cat_cuentas, cuentas_saldos, firmas_conta',
    requiereMayorizacion: true,
    consejos: [
      'Formato preferido por contadores y auditores para verificar la integridad del catálogo de cuentas.',
      'Asegúrate de haber mayorizado para que todas las columnas de niveles sumen correctamente.',
    ],
  },

  balance_general_cuenta: {
    descripcionBreve: 'Estado de Situación Financiera a dos columnas horizontales (Activo vs Pasivo y Patrimonio).',
    enQueConsiste:
      'Presenta la situación patrimonial y financiera de la empresa a una fecha determinada en el formato clásico en forma de cuenta (esquema horizontal): a la izquierda los bienes y derechos (Activo) y a la derecha las deudas (Pasivo) y recursos propios (Patrimonio Neto).',
    baseLegal: 'Sección 4 de NIIF para las PYMES / NIC 1 y Código de Comercio de El Salvador (Art. 439).',
    comoFunciona: [
      'Agrupa las cuentas de clase 1 en el bloque de Activos.',
      'Agrupa las cuentas de clase 2 en Pasivos y clase 3 en Patrimonio.',
      'Calcula automáticamente la Utilidad del Ejercicio resultante de ingresos y gastos, incorporándola al Patrimonio.',
      'Verifica la ecuación patrimonial fundamental: ACTIVO = PASIVO + PATRIMONIO.',
    ],
    tablas: 'cat_cuentas, cuentas_saldos, firmas_conta',
    requiereMayorizacion: true,
    consejos: [
      'Si el total de Activo no coincide con Pasivo + Patrimonio, verifica que todas las partidas del ejercicio estén debidamente balanceadas y mayorizadas.',
      'El balance incluye las tres firmas legales requeridas por las autoridades mercantiles.',
    ],
  },

  bal_comp_cuenta: {
    descripcionBreve: 'Comprobación simétrica en dos columnas: Deudoras y Activos vs Acreedoras, Pasivo y Patrimonio.',
    enQueConsiste:
      'Permite comprobar los saldos finales de todas las cuentas dividiéndolas en dos grandes bloques confrontados: las cuentas con saldo deudor (Activo y Pérdidas) frente a las cuentas con saldo acreedor (Pasivo, Capital y Ganancias).',
    baseLegal: 'Técnica contable de balanceo y comprobación de saldos según NIIF.',
    comoFunciona: [
      'Clasifica las cuentas según su saldo neto y naturaleza deudora o acreedora.',
      'Totaliza la columna izquierda (Total Deudoras / Activo) y la columna derecha (Total Acreedoras / Pasivo y Patrimonio).',
      'Valida la igualdad perfecta entre ambos totales.',
    ],
    tablas: 'cat_cuentas, cuentas_saldos, firmas_conta',
    requiereMayorizacion: true,
    consejos: [
      'Excelente para revisiones rápidas de cierre mensual antes de la emisión de estados financieros definitivos.',
    ],
  },

  anexo_balance_general: {
    descripcionBreve: 'Desglose complementario de las cuentas principales del balance distribuidas por nivel.',
    enQueConsiste:
      'Documento complementario y obligatorio que acompaña al Balance General. Desglosa analíticamente cada uno de los rubros del activo, pasivo y capital hasta el nivel de subcuenta, sirviendo de soporte explicativo a las cifras del balance.',
    baseLegal: 'Código Tributario de El Salvador (Art. 139) y requisitos del Formulario F-11 de Renta ante el Ministerio de Hacienda.',
    comoFunciona: [
      'Filtra todas las cuentas con movimiento y saldo de las clases de balance (1, 2 y 3).',
      'Despliega los saldos en columnas estructuradas de nivel jerárquico.',
      'Presenta los totales de Activo, Pasivo, Capital y Utilidad o Pérdida del Ejercicio calculada.',
    ],
    tablas: 'cat_cuentas, cuentas_saldos, firmas_conta',
    requiereMayorizacion: true,
    consejos: [
      'Documento requerido por el Ministerio de Hacienda y auditores como anexo indispensable a la declaración anual del Impuesto Sobre la Renta.',
    ],
  },

  estado_resultados: {
    descripcionBreve: 'Estado financiero del resultado económico (ingresos, costos, gastos, reserva legal e ISR).',
    enQueConsiste:
      'Muestra de forma ordenada y comprensible cómo se obtuvo la utilidad o pérdida del ejercicio económico en un período determinado, deduciendo de los ingresos operacionales los costos y gastos, la reserva legal obligatoria y la provisión de impuesto sobre la renta.',
    baseLegal: 'Sección 5 de NIIF para las PYMES, Código de Comercio (Art. 123 - Reserva Legal 7%) y Ley de Impuesto Sobre la Renta.',
    comoFunciona: [
      'Suma los ingresos ordinarios y extraordinarios de las cuentas de clase 5.',
      'Resta los costos operacionales para obtener la Utilidad Bruta.',
      'Deduce los gastos de administración, venta y financieros para determinar la Utilidad de Operación.',
      'Calcula la Reserva Legal del 7% obligatoria para sociedades mercantiles en El Salvador.',
      'Aplica la estimación de Impuesto Sobre la Renta (ISR) y determina la Utilidad Neta Definitiva.',
    ],
    tablas: 'cat_cuentas, cuentas_saldos, detalle_partida, firmas_conta',
    requiereMayorizacion: true,
    consejos: [
      'El resultado neto debe coincidir exactamente con la "Utilidad o Pérdida del Ejercicio" mostrada en el Balance General y Balances de Comprobación.',
      'Fundamental para la toma de decisiones gerenciales y la distribución de dividendos.',
    ],
  },

  cuadro_ingresos_gastos: {
    descripcionBreve: 'Confrontación directa de cuentas de resultados (clases 4 y 5) y evolución acumulada.',
    enQueConsiste:
      'Reporte de control presupuestario y gerencial que compara la totalidad de las cuentas de ingresos contra las de costos y gastos, mostrando saldos anteriores, movimientos del mes y saldos acumulados al cierre.',
    baseLegal: 'Control de gestión financiera y auditoría de cuentas nominales de resultados.',
    comoFunciona: [
      'Extrae los saldos anteriores, cargos del mes y abonos del mes de todas las cuentas de ingresos (grupo 5) y gastos/costos (grupo 4).',
      'Calcula el saldo acumulado de cada cuenta individual.',
      'Totaliza Ingresos vs Gastos y determina el Resultado Neto del Período.',
    ],
    tablas: 'cat_cuentas, cuentas_saldos, firmas_conta',
    requiereMayorizacion: true,
    consejos: [
      'Muy útil para comparar la velocidad del gasto frente a la generación de ingresos mes a mes.',
    ],
  },

  balance_comparativo: {
    descripcionBreve: 'Análisis de variaciones absolutas ($) y relativas (%) entre dos ejercicios fiscales.',
    enQueConsiste:
      'Compara los saldos contables entre dos años distintos (ej. 2026 vs 2025) para el mismo período de corte. Es esencial para evaluar el crecimiento, contracción o estabilidad financiera de la empresa a lo largo del tiempo.',
    baseLegal: 'Análisis financiero NIIF y requerimientos de informes comparativos de auditoría.',
    comoFunciona: [
      'Recupera los saldos del Año Base y del Año Comparativo para el mismo mes y nivel seleccionados.',
      'Calcula la variación monetaria: Variación ($) = Saldo Base - Saldo Comparativo.',
      'Calcula el porcentaje de variación: Variación (%) = ((Saldo Base - Saldo Comparativo) / Saldo Comparativo) * 100.',
      'Destaca con colores semánticos incrementos (verde) y decrementos (rojo).',
    ],
    tablas: 'cat_cuentas, cuentas_saldos, firmas_conta',
    requiereMayorizacion: true,
    consejos: [
      'Asegúrate de que ambos años (Base y Comparativo) se encuentren debidamente mayorizados para que las comparaciones sean precisas.',
      'Indispensable para presentaciones a inversionistas, bancos o asambleas de socios.',
    ],
  },
};
