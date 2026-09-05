const { pool } = require('../dist/config/db');

// Master replacement rules
const REPLACEMENTS = [
  // Surnames and proper names
  [/\bMart\?+nez\b/gi, (m) => m[0] === 'M' && m[1] === 'A' ? 'MARTÍNEZ' : 'Martínez'],
  [/\bRam\?+rez\b/gi, (m) => m[0] === 'R' && m[1] === 'A' ? 'RAMÍREZ' : 'Ramírez'],
  [/\bRodr\?+guez\b/gi, (m) => m[0] === 'R' && m[1] === 'O' ? 'RODRÍGUEZ' : 'Rodríguez'],
  [/\bHern\?+ndez\b/gi, (m) => m[0] === 'H' && m[1] === 'E' ? 'HERNÁNDEZ' : 'Hernández'],
  [/\bM\?+ndez\b/gi, (m) => m[0] === 'M' && m[1] === 'E' ? 'MÉNDEZ' : 'Méndez'],
  [/\bD\?+az\b/gi, (m) => m[0] === 'D' && m[1] === 'I' ? 'DÍAZ' : 'Díaz'],
  [/\bJos\?+\b/gi, (m) => m[0] === 'J' && m[1] === 'O' ? 'JOSÉ' : 'José'],
  [/\bJes\?+s\b/gi, (m) => m[0] === 'J' && m[1] === 'E' ? 'JESÚS' : 'Jesús'],
  [/\b\?+ngel\b/gi, () => 'Ángel'],

  // Names with Ñ
  [/\bPe\?+a\b/gi, (m) => m[0] === 'P' && m[1] === 'E' ? 'PEÑA' : 'Peña'],
  [/\bPe\?+ate\b/gi, (m) => m[0] === 'P' && m[1] === 'E' ? 'PEÑATE' : 'Peñate'],
  [/\bMaga\?+a\b/gi, (m) => m[0] === 'M' && m[1] === 'A' ? 'MAGAÑA' : 'Magaña'],
  [/\bUma\?+a\b/gi, (m) => m[0] === 'U' && m[1] === 'M' ? 'UMAÑA' : 'Umaña'],
  [/\bOrdo\?+ez\b/gi, (m) => m[0] === 'O' && m[1] === 'R' ? 'ORDÓÑEZ' : 'Ordóñez'],
  [/\bAvenda\?+o\b/gi, (m) => m[0] === 'A' && m[1] === 'V' ? 'AVENDAÑO' : 'Avendaño'],
  [/\bAgui\?+ada\b/gi, (m) => m[0] === 'A' && m[1] === 'G' ? 'AGUIÑADA' : 'Aguiñada'],
  [/\bNu\?+ez\b/gi, (m) => m[0] === 'N' && m[1] === 'U' ? 'NÚÑEZ' : 'Núñez'],
  [/\bBola\?+os\b/gi, (m) => m[0] === 'B' && m[1] === 'O' ? 'BOLAÑOS' : 'Bolaños'],
  [/\bDo\?+an\b/gi, (m) => m[0] === 'D' && m[1] === 'O' ? 'DOÑAN' : 'Doñan'],
  [/\bCarre\?+o\b/gi, (m) => m[0] === 'C' && m[1] === 'A' ? 'CARREÑO' : 'Carreño'],
  [/\bDo\?+a\b/gi, (m) => m[0] === 'D' && m[1] === 'O' ? 'DOÑA' : 'Doña'],
  [/\bMu\?+oz\b/gi, (m) => m[0] === 'M' && m[1] === 'U' ? 'MUÑOZ' : 'Muñoz'],
  [/\bDue\?+as\b/gi, (m) => m[0] === 'D' && m[1] === 'U' ? 'DUEÑAS' : 'Dueñas'],
  [/\bSerme\?+o\b/gi, (m) => m[0] === 'S' && m[1] === 'E' ? 'SERMEÑO' : 'Sermeño'],
  [/\bLime\?+os\b/gi, (m) => m[0] === 'L' && m[1] === 'I' ? 'LIMEÑOS' : 'Limeños'],
  [/\bMonta\?+a\b/gi, (m) => m[0] === 'M' && m[1] === 'O' ? 'MONTAÑA' : 'Montaña'],
  [/\bCa\?+as\b/gi, (m) => m[0] === 'C' && m[1] === 'A' ? 'CAÑAS' : 'Cañas'],
  [/\bCa\?+a\b/gi, (m) => m[0] === 'C' && m[1] === 'A' ? 'CAÑA' : 'Caña'],
  [/\bPaname\?+o\b/gi, (m) => m[0] === 'P' && m[1] === 'A' ? 'PANAMEÑO' : 'Panameño'],
  [/\bZu\?+iga\b/gi, (m) => m[0] === 'Z' && m[1] === 'U' ? 'ZUÑIGA' : 'Zuñiga'],
  [/\bQui\?+onez\b/gi, (m) => m[0] === 'Q' && m[1] === 'U' ? 'QUIÑONEZ' : 'Quiñonez'],
  [/\bMembre\?+o\b/gi, (m) => m[0] === 'M' && m[1] === 'E' ? 'MEMBREÑO' : 'Membreño'],
  [/\bSe\?+ora\b/gi, (m) => m[0] === 'S' && m[1] === 'E' ? 'SEÑORA' : 'Señora'],
  [/\bPeque\?+o\b/gi, (m) => m[0] === 'P' && m[1] === 'E' ? 'PEQUEÑO' : 'Pequeño'],
  [/\bEspa\?+a\b/gi, (m) => m[0] === 'E' && m[1] === 'S' ? 'ESPAÑA' : 'España'],
  [/\bBa\?+os\b/gi, (m) => m[0] === 'B' && m[1] === 'A' ? 'BAÑOS' : 'Baños'],
  [/\bSue\?+o\b/gi, (m) => m[0] === 'S' && m[1] === 'U' ? 'SUEÑO' : 'Sueño'],
  [/\bNorte\?+o\b/gi, (m) => m[0] === 'N' && m[1] === 'O' ? 'NORTEÑO' : 'Norteño'],
  [/\bCaba\?+a\b/gi, (m) => m[0] === 'C' && m[1] === 'A' ? 'CABAÑA' : 'Cabaña'],
  [/\bIstme\?+a\b/gi, (m) => m[0] === 'I' && m[1] === 'S' ? 'ISTMEÑA' : 'Istmeña'],
  [/\bP\?+neda\b/gi, 'PINEDA'],
  [/\bP\?+nama\b/gi, 'PANAMA'],

  // Business words
  [/\bSalvadore\?+a\b/gi, (m) => m[0] === 'S' && m[1] === 'A' ? 'SALVADOREÑA' : 'Salvadoreña'],
  [/\bSalvadore\?+os\b/gi, (m) => m[0] === 'S' && m[1] === 'A' ? 'SALVADOREÑOS' : 'Salvadoreños'],
  [/\bSalvadore\?+o\b/gi, (m) => m[0] === 'S' && m[1] === 'A' ? 'SALVADOREÑO' : 'Salvadoreño'],
  [/\bDise\?+o\b/gi, (m) => m[0] === 'D' && m[1] === 'I' ? 'DISEÑO' : 'Diseño'],
  [/\bDise\?+os\b/gi, (m) => m[0] === 'D' && m[1] === 'I' ? 'DISEÑOS' : 'Diseños'],
  [/\bCompa\?+ia\b/gi, (m) => m[0] === 'C' && m[1] === 'O' ? 'COMPAÑÍA' : 'Compañía'],
  [/\bCompa\?+ias\b/gi, (m) => m[0] === 'C' && m[1] === 'O' ? 'COMPAÑÍAS' : 'Compañías'],
  [/\bCompa\?+as\b/gi, (m) => m[0] === 'C' && m[1] === 'O' ? 'COMPAÑÍAS' : 'Compañías'],
  [/\bShef\?+s\b/gi, "Shef's"],
  [/\bDay\?+s\b/gi, "Day's"],
  [/\bAFP\?+s\b/gi, "AFPs"],

  // Accounting terms
  [/\bRepresentaci\?+n\b/gi, (m) => m === m.toUpperCase() ? 'REPRESENTACIÓN' : 'Representación'],
  [/\bPr\?+stamos\b/gi, (m) => m === m.toUpperCase() ? 'PRÉSTAMOS' : 'Préstamos'],
  [/\bCr\?+dito\b/gi, (m) => m === m.toUpperCase() ? 'CRÉDITO' : 'Crédito'],
  [/\bCred\?+to\b/gi, (m) => m === m.toUpperCase() ? 'CRÉDITO' : 'Crédito'],
  [/\bCr\?+d\?+to\b/gi, (m) => m === m.toUpperCase() ? 'CRÉDITO' : 'Crédito'],
  [/\bD\?+bito\b/gi, (m) => m === m.toUpperCase() ? 'DÉBITO' : 'Débito'],
  [/\bArt\?+culos\b/gi, (m) => m === m.toUpperCase() ? 'ARTÍCULOS' : 'Artículos'],
  [/\bProvisi\?+n\b/gi, (m) => m === m.toUpperCase() ? 'PROVISIÓN' : 'Provisión'],
  [/\bVeh\?+culos\b/gi, (m) => m === m.toUpperCase() ? 'VEHÍCULOS' : 'Vehículos'],
  [/\bEnerg\?+a\b/gi, (m) => m === m.toUpperCase() ? 'ENERGÍA' : 'Energía'],
  [/\bEl\?+ctrica\b/gi, (m) => m === m.toUpperCase() ? 'ELÉCTRICA' : 'Eléctrica'],
  [/\bPapeler\?+a\b/gi, (m) => m === m.toUpperCase() ? 'PAPELERÍA' : 'Papelería'],
  [/\b\?+tiles\b/gi, (m) => m === m.toUpperCase() ? 'ÚTILES' : 'Útiles'],
  [/\bVi\?+ticos\b/gi, (m) => m === m.toUpperCase() ? 'VIÁTICOS' : 'Viáticos'],
  [/\bTel\?+fono\b/gi, (m) => m === m.toUpperCase() ? 'TELÉFONO' : 'Teléfono'],
  [/\bPl\?+stico\b/gi, (m) => m === m.toUpperCase() ? 'PLÁSTICO' : 'Plástico'],
  [/\bSint\?+tico\b/gi, (m) => m === m.toUpperCase() ? 'SINTÉTICO' : 'Sintético'],
  [/\bP\?+rdidas\b/gi, (m) => m === m.toUpperCase() ? 'PÉRDIDAS' : 'Pérdidas'],
  [/\bP\?+RDIDAS\b/gi, 'PÉRDIDAS'],
  [/\bP\?+blico\b/gi, (m) => m === m.toUpperCase() ? 'PÚBLICO' : 'Público'],
  [/\bConstrucci\?+n\b/gi, (m) => m === m.toUpperCase() ? 'CONSTRUCCIÓN' : 'Construcción'],
  [/\bInform\?+ticos\b/gi, (m) => m === m.toUpperCase() ? 'INFORMÁTICOS' : 'Informáticos'],
  [/\bMec\?+nica\b/gi, (m) => m === m.toUpperCase() ? 'MECÁNICA' : 'Mecánica'],
  [/\bNeum\?+ticos\b/gi, (m) => m === m.toUpperCase() ? 'NEUMÁTICOS' : 'Neumáticos'],
  [/\bAlimentaci\?+n\b/gi, (m) => m === m.toUpperCase() ? 'ALIMENTACIÓN' : 'Alimentación'],
  [/\bDecoraci\?+n\b/gi, (m) => m === m.toUpperCase() ? 'DECORACIÓN' : 'Decoración'],
  [/\bRegularizaci\?+n\b/gi, (m) => m === m.toUpperCase() ? 'REGULARIZACIÓN' : 'Regularización'],
  [/\bGr\?+a\b/gi, (m) => m === m.toUpperCase() ? 'GRÚA' : 'Grúa'],
  [/\bGr\?+as\b/gi, (m) => m === m.toUpperCase() ? 'GRÚAS' : 'Grúas'],
  [/\bGarant\?+as\b/gi, (m) => m === m.toUpperCase() ? 'GARANTÍAS' : 'Garantías'],
  [/\bDep\?+sitos\b/gi, (m) => m === m.toUpperCase() ? 'DEPÓSITOS' : 'Depósitos'],
  [/\bC\?+mputo\b/gi, (m) => m === m.toUpperCase() ? 'CÓMPUTO' : 'Cómputo'],
  [/\bConsultor\?+as\b/gi, (m) => m === m.toUpperCase() ? 'CONSULTORÍAS' : 'Consultorías'],
  [/\bTelefon\?+a\b/gi, (m) => m === m.toUpperCase() ? 'TELEFONÍA' : 'Telefonía'],
  [/\bReproducci\?+n\b/gi, (m) => m === m.toUpperCase() ? 'REPRODUCCIÓN' : 'Reproducción'],
  [/\bEstad\?+as\b/gi, (m) => m === m.toUpperCase() ? 'ESTADÍAS' : 'Estadías'],
  [/\bJur\?+dicos\b/gi, (m) => m === m.toUpperCase() ? 'JURÍDICOS' : 'Jurídicos'],
  [/\bAgr\?+cola\b/gi, (m) => m === m.toUpperCase() ? 'AGRÍCOLA' : 'Agrícola'],
  [/\bProcuradur\?+a\b/gi, (m) => m === m.toUpperCase() ? 'PROCURADURÍA' : 'Procuraduría'],
  [/\bReparaci\?+n\b/gi, (m) => m === m.toUpperCase() ? 'REPARACIÓN' : 'Reparación'],
  [/\bM\?+vil\b/gi, (m) => m === m.toUpperCase() ? 'MÓVIL' : 'Móvil'],
  [/\bEncuadernaci\?+n\b/gi, (m) => m === m.toUpperCase() ? 'ENCUADERNACIÓN' : 'Encuadernación'],
  [/\bLaminaci\?+n\b/gi, (m) => m === m.toUpperCase() ? 'LAMINACIÓN' : 'Laminación'],
  [/\bVal\?+o\b/gi, (m) => m === m.toUpperCase() ? 'VALÚO' : 'Valúo'],
  [/\bM\?+nimo\b/gi, (m) => m === m.toUpperCase() ? 'MÍNIMO' : 'Mínimo'],
  [/\bPer\?+odo\b/gi, (m) => m === m.toUpperCase() ? 'PERÍODO' : 'Período'],
  [/\bA\?+reos\b/gi, (m) => m === m.toUpperCase() ? 'AÉREOS' : 'Aéreos'],

  // Connectors / Special artifacts
  [/\s*\?+CP\b/gi, ' - CP'],
  [/\bIVA\?+Proximo\b/gi, 'IVA Próximo'],
  [/\bAvisos\?+Publicidad\b/gi, 'Avisos y Publicidad'],
  [/\b\?+Pr\?+ximo\b/gi, 'Próximo'],
  [/\b\?+Publicidad\b/gi, 'Publicidad'],

  // Any leftover isolated multi-question mark artifacts between words
  [/\s*\?{2,}\s*/g, ' '],
];

function sanitizeString(str) {
  if (!str || !str.includes('?')) return str;
  let res = str;
  for (const [regex, replacement] of REPLACEMENTS) {
    res = res.replace(regex, replacement);
  }
  return res.replace(/\s{2,}/g, ' ').trim();
}

async function runMigration() {
  const connection = await pool.getConnection();
  try {
    console.log('--- INICIANDO SCRIPT DE SANEAMIENTO DE CARACTERES CORROMPIDOS ---');

    // 1. Crear respaldos
    console.log('\n1. Creando tablas de respaldo de seguridad...');
    await connection.query('CREATE TABLE IF NOT EXISTS proveedores_bkp_20260905 AS SELECT * FROM proveedores');
    await connection.query('CREATE TABLE IF NOT EXISTS clientes_bkp_20260905 AS SELECT * FROM clientes');
    await connection.query('CREATE TABLE IF NOT EXISTS cat_cuentas_bkp_20260905 AS SELECT * FROM cat_cuentas');
    console.log('✓ Tablas de respaldo creadas con éxito.');

    // 2. Actualizar proveedores
    console.log('\n2. Saneando nombres en tabla proveedores...');
    const [provs] = await connection.query("SELECT cod_proveedor, nom_proveedor FROM proveedores WHERE nom_proveedor LIKE '%?%'");
    let provUpdated = 0;
    for (const p of provs) {
      const cleaned = sanitizeString(p.nom_proveedor);
      if (cleaned !== p.nom_proveedor) {
        await connection.query('UPDATE proveedores SET nom_proveedor = ? WHERE cod_proveedor = ?', [cleaned, p.cod_proveedor]);
        provUpdated++;
      }
    }
    console.log(`✓ Proveedores actualizados: ${provUpdated} de ${provs.length}`);

    // 3. Actualizar clientes
    console.log('\n3. Saneando nombres en tabla clientes...');
    const [clients] = await connection.query("SELECT cod_cliente, nom_cliente FROM clientes WHERE nom_cliente LIKE '%?%'");
    let clientUpdated = 0;
    for (const c of clients) {
      const cleaned = sanitizeString(c.nom_cliente);
      if (cleaned !== c.nom_cliente) {
        await connection.query('UPDATE clientes SET nom_cliente = ? WHERE cod_cliente = ?', [cleaned, c.cod_cliente]);
        clientUpdated++;
      }
    }
    console.log(`✓ Clientes actualizados: ${clientUpdated} de ${clients.length}`);

    // 4. Actualizar cat_cuentas
    console.log('\n4. Saneando nombres en tabla cat_cuentas...');
    const [cuentas] = await connection.query("SELECT cod_cta, nom_cta FROM cat_cuentas WHERE nom_cta LIKE '%?%'");
    let ctaUpdated = 0;
    for (const c of cuentas) {
      const cleaned = sanitizeString(c.nom_cta);
      if (cleaned !== c.nom_cta) {
        await connection.query('UPDATE cat_cuentas SET nom_cta = ? WHERE cod_cta = ?', [cleaned, c.cod_cta]);
        ctaUpdated++;
      }
    }
    console.log(`✓ Cuentas contables actualizadas: ${ctaUpdated} de ${cuentas.length}`);

    // 5. Verificación final de remanentes
    console.log('\n5. Verificación final de registros con ?...');
    const [pCheck] = await connection.query("SELECT count(1) as c FROM proveedores WHERE nom_proveedor LIKE '%?%'");
    const [cCheck] = await connection.query("SELECT count(1) as c FROM clientes WHERE nom_cliente LIKE '%?%'");
    const [ctaCheck] = await connection.query("SELECT count(1) as c FROM cat_cuentas WHERE nom_cta LIKE '%?%'");

    console.log(`- Proveedores restantes con ?: ${pCheck[0].c}`);
    console.log(`- Clientes restantes con ?: ${cCheck[0].c}`);
    console.log(`- Cuentas restantes con ?: ${ctaCheck[0].c}`);

    console.log('\n=== MIGRACIÓN Y SANEAMIENTO COMPLETADO EXITOSAMENTE ===');
  } catch (err) {
    console.error('Error durante la migración:', err);
  } finally {
    connection.release();
    process.exit(0);
  }
}

runMigration();
