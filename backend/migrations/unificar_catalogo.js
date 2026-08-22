const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const mysql = require('mysql2/promise');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const CATALOGOS = {
  clientes: {
    tabla: 'clientes',
    colCodigo: 'cod_cliente',
    colNit: 'nit_cliente',
    colNombre: 'nom_cliente',
    colDireccion: 'dir_cliente',
    colTelefono: 'telefono',
    colRegistro: 'registro',
    colCorr: 'corr',
    tablaReferencia: 'ventas_iva',
    colReferencia: 'cod_cliente',
  },
  proveedores: {
    tabla: 'proveedores',
    colCodigo: 'cod_proveedor',
    colNit: 'nit_proveedor',
    colNombre: 'nom_proveedor',
    colDireccion: 'dir_proveedor',
    colTelefono: 'telefono',
    colRegistro: 'registro',
    colCorr: 'corr',
    tablaReferencia: 'compras_iva',
    colReferencia: 'cod_proveedor',
  },
};

const OTRAS_TABLAS_REFERENCIA = [
  'busqueda_compras_iva',
  'cabecera_avisos',
  'cabecera_cheques_post',
  'cabecera_compras',
  'cabecera_facturas',
  'cabecera_ingresos',
  'cabecera_movimientos',
  'cabecera_quedan',
  'cnf_clientes',
  'compras_activo_fijo',
  'compras_complementarias',
  'detalle_cxp',
  'estado_cuenta',
  'precios_especiales',
];

const NIT_PLACEHOLDER = '00000000000000';

function normalizar(valor) {
  return String(valor ?? '').replace(/[-\s]/g, '').toUpperCase();
}

function esNitValido(nitNormalizado) {
  return nitNormalizado !== '' && nitNormalizado !== NIT_PLACEHOLDER;
}

function puntajeDatos(fila, cfg) {
  return [fila[cfg.colNombre], fila[cfg.colDireccion], fila[cfg.colTelefono]]
    .filter((v) => String(v ?? '').trim() !== '').length;
}

function esVacio(valor) {
  return String(valor ?? '').trim() === '';
}

function elegirSuperviviente(grupo, cfg) {
  let mejor = grupo[0];
  for (const fila of grupo) {
    const p = puntajeDatos(fila, cfg);
    const pm = puntajeDatos(mejor, cfg);
    if (
      p > pm
      || (p === pm
        && (fila[cfg.colCorr] < mejor[cfg.colCorr] || fila.codEmp < mejor.codEmp))
    ) {
      mejor = fila;
    }
  }
  return mejor;
}

function rellenarDesdeGrupo(superviviente, grupo, columnas) {
  const fila = { ...superviviente };
  for (const columna of columnas) {
    if (esVacio(fila[columna])) {
      const primera = grupo.find((f) => !esVacio(f[columna]));
      if (primera) fila[columna] = primera[columna];
    }
  }
  return fila;
}

function asignarCodigosNuevos(grupos, todosLosCodigos, cfg) {
  const usados = new Set(todosLosCodigos);
  let maxNumero = 0;
  for (const codigo of usados) {
    const match = String(codigo).match(/^(\d+)/);
    if (match) maxNumero = Math.max(maxNumero, Number(match[1]));
  }

  const gruposPorCodigo = new Map();
  for (const grupo of grupos) {
    const codigo = grupo.codigoFinal;
    if (!gruposPorCodigo.has(codigo)) gruposPorCodigo.set(codigo, []);
    gruposPorCodigo.get(codigo).push(grupo);
  }

  for (const [, lista] of gruposPorCodigo) {
    if (lista.length === 1) continue;
    lista.sort((a, b) => {
      const ca = a.superviviente.codEmp;
      const cb = b.superviviente.codEmp;
      return ca - cb || a.superviviente[cfg.colCorr] - b.superviviente[cfg.colCorr];
    });
    for (let i = 1; i < lista.length; i += 1) {
      let nuevo;
      do {
        maxNumero += 1;
        nuevo = `${String(maxNumero).padStart(6, '0')}-0`;
      } while (usados.has(nuevo));
      usados.add(nuevo);
      lista[i].codigoFinal = nuevo;
    }
  }
}

function procesarCatalogo(filas, cfg) {
  for (const fila of filas) {
    fila[cfg.colCodigo] = String(fila[cfg.colCodigo]).trim();
    const nitNorm = normalizar(fila[cfg.colNit]);
    const regNorm = normalizar(fila[cfg.colRegistro]);
    fila.nitNorm = nitNorm;
    fila.regNorm = regNorm;
    fila.llave = esNitValido(nitNorm) ? `N:${nitNorm}` : regNorm ? `R:${regNorm}` : '';
  }

  const gruposPorLlave = new Map();
  for (const fila of filas) {
    if (!gruposPorLlave.has(fila.llave)) gruposPorLlave.set(fila.llave, []);
    gruposPorLlave.get(fila.llave).push(fila);
  }

  const grupos = [];
  for (const [llave, lista] of gruposPorLlave) {
    if (!llave) {
      for (const fila of lista) {
        grupos.push({
          llave,
          filas: [fila],
          superviviente: fila,
          codigoFinal: fila[cfg.colCodigo],
          sinLlave: true,
        });
      }
      continue;
    }
    const superviviente = elegirSuperviviente(lista, cfg);
    grupos.push({
      llave,
      filas: lista,
      superviviente,
      codigoFinal: superviviente[cfg.colCodigo],
      sinLlave: false,
    });
  }

  asignarCodigosNuevos(grupos, filas.map((f) => String(f[cfg.colCodigo])), cfg);

  return grupos;
}

function construirRemapeos(grupos, cfg) {
  const remapeos = new Map();
  for (const grupo of grupos) {
    for (const fila of grupo.filas) {
      const clave = `${fila.codEmp}|${fila[cfg.colCodigo]}`;
      remapeos.set(clave, String(grupo.codigoFinal));
    }
  }
  return remapeos;
}

function remapeosConCambio(remapeos) {
  return [...remapeos.entries()].filter(([clave, nuevo]) => !clave.endsWith(`|${nuevo}`));
}

function construirFilasUnificadas(grupos, columnas, cfg) {
  const filas = [];
  for (const grupo of grupos) {
    const fila = rellenarDesdeGrupo(grupo.superviviente, grupo.filas, columnas);
    fila[cfg.colCodigo] = String(grupo.codigoFinal);
    filas.push(fila);
  }
  return filas;
}

async function crearConexion() {
  return mysql.createConnection({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    connectTimeout: 10000,
    charset: 'latin1',
  });
}

async function obtenerColumnas(conn, tabla) {
  const [filas] = await conn.query(`SHOW COLUMNS FROM ${tabla}`);
  return filas.map((f) => f.Field);
}

async function cargarFilas(conn, tabla) {
  const [filas] = await conn.query(`SELECT * FROM ${tabla} ORDER BY cod_emp, corr`);
  return filas.map((f) => ({ ...f, codEmp: f.cod_emp }));
}

async function contarReferencias(conn, tabla, columna, remapeos) {
  const pares = remapeosConCambio(remapeos).map(([clave]) => {
    const [codEmp, codigo] = clave.split('|');
    return { codEmp: Number(codEmp), codigo };
  });
  if (pares.length === 0) return 0;
  const condiciones = pares.map(() => `(cod_emp = ? AND ${columna} = ?)`).join(' OR ');
  const parametros = pares.flatMap((p) => [p.codEmp, p.codigo]);
  const [filas] = await conn.query(
    `SELECT COUNT(*) AS n FROM ${tabla} WHERE ${condiciones}`,
    parametros,
  );
  return filas[0].n;
}

async function hacerBackups(conn, fecha) {
  const tablas = ['clientes', 'proveedores', 'ventas_iva', 'compras_iva'];
  for (const tabla of tablas) {
    const destino = `${tabla}_bkp_${fecha}`;
    await conn.query(`CREATE TABLE IF NOT EXISTS ${destino} AS SELECT * FROM ${tabla}`);
    console.log(`  Backup creado: ${destino}`);
  }
}

async function reemplazarCatalogo(conn, cfg, columnas, filasUnificadas) {
  const placeholders = columnas.map(() => '?').join(', ');
  await conn.query(`DELETE FROM ${cfg.tabla}`);
  for (const fila of filasUnificadas) {
    await conn.query(
      `INSERT INTO ${cfg.tabla} (${columnas.join(', ')}) VALUES (${placeholders})`,
      columnas.map((col) => fila[col]),
    );
  }
}

async function remapearReferencias(conn, cfg, remapeos) {
  for (const [clave, codigoNuevo] of remapeosConCambio(remapeos)) {
    const [codEmp, codigoViejo] = clave.split('|');
    await conn.query(
      `UPDATE ${cfg.tablaReferencia} SET ${cfg.colReferencia} = ? WHERE cod_emp = ? AND ${cfg.colReferencia} = ?`,
      [codigoNuevo, Number(codEmp), codigoViejo],
    );
  }
}

async function crearIndices(conn, cfg) {
  const prefijo = cfg.tabla === 'clientes' ? 'cli' : 'prov';
  const intentos = [
    `ALTER TABLE ${cfg.tabla} ADD UNIQUE INDEX uq_${prefijo}_cod (${cfg.colCodigo})`,
    `ALTER TABLE ${cfg.tabla} ADD UNIQUE INDEX uq_${prefijo}_nit ((CASE WHEN REPLACE(REPLACE(TRIM(${cfg.colNit}),'-',''),' ','') IN ('','${NIT_PLACEHOLDER}') THEN NULL ELSE REPLACE(REPLACE(TRIM(${cfg.colNit}),'-',''),' ','') END))`,
    `ALTER TABLE ${cfg.tabla} ADD INDEX idx_${prefijo}_reg (${cfg.colRegistro})`,
  ];
  for (const sql of intentos) {
    try {
      await conn.query(sql);
      console.log(`  Indice creado: ${sql.split('ADD ')[1].split(' (')[0]}`);
    } catch (err) {
      console.warn(`  AVISO: no se pudo crear indice -> ${err.message}`);
    }
  }
}

async function generarReporte(conn, fechaHora) {
  const dir = path.join(__dirname, 'reportes');
  fs.mkdirSync(dir, { recursive: true });

  const reporte = { fecha: new Date().toISOString(), catalogos: {} };
  const resumen = [];

  for (const [nombre, cfg] of Object.entries(CATALOGOS)) {
    const filas = await cargarFilas(conn, cfg.tabla);
    const columnas = await obtenerColumnas(conn, cfg.tabla);

    const grupos = procesarCatalogo(filas, cfg);
    const remapeos = construirRemapeos(grupos, cfg);
    const filasUnificadas = construirFilasUnificadas(grupos, columnas, cfg);

    const gruposConDuplicados = grupos.filter((g) => g.filas.length > 1 || g.sinLlave);
    const codigosCambiados = remapeosConCambio(remapeos);
    const refsPropias = await contarReferencias(
      conn, cfg.tablaReferencia, cfg.colReferencia, remapeos,
    );
    const refsOtras = {};
    for (const tabla of OTRAS_TABLAS_REFERENCIA) {
      const columna = nombre === 'clientes' ? 'cod_cliente' : 'cod_proveedor';
      try {
        refsOtras[tabla] = await contarReferencias(conn, tabla, columna, remapeos);
      } catch {
        refsOtras[tabla] = -1;
      }
    }

    reporte.catalogos[nombre] = {
      totalFilas: filas.length,
      filasUnificadas: filasUnificadas.length,
      gruposConDuplicados: gruposConDuplicados.length,
      codigosCambiados: codigosCambiados.length,
      referenciasTablaPrincipal: refsPropias,
      referenciasOtrasTablas: refsOtras,
      cambios: gruposConDuplicados.slice(0, 200).map((g) => ({
        llave: g.llave,
        filas: g.filas.map((f) => ({
          corr: f[cfg.colCorr],
          codEmp: f.codEmp,
          codigo: f[cfg.colCodigo],
          nombre: f[cfg.colNombre],
        })),
        codigoFinal: g.codigoFinal,
        superviviente: g.superviviente[cfg.colCorr],
      })),
    };

    resumen.push(`=== ${nombre.toUpperCase()} ===`);
    resumen.push(`Filas originales: ${filas.length}`);
    resumen.push(`Filas unificadas: ${filasUnificadas.length}`);
    resumen.push(`Grupos con duplicados o sin llave: ${gruposConDuplicados.length}`);
    resumen.push(`Codigos que cambian: ${codigosCambiados.length}`);
    resumen.push(`Referencias a actualizar en ${cfg.tablaReferencia}: ${refsPropias}`);
    for (const [tabla, n] of Object.entries(refsOtras)) {
      resumen.push(`Referencias (sin actualizar) en ${tabla}: ${n === -1 ? 'tabla no existe' : n}`);
    }
    resumen.push('');
  }

  const archivoJson = path.join(dir, `reporte_unificacion_${fechaHora}.json`);
  const archivoTxt = path.join(dir, `resumen_unificacion_${fechaHora}.txt`);
  fs.writeFileSync(archivoJson, JSON.stringify(reporte, null, 2), 'utf-8');
  fs.writeFileSync(archivoTxt, resumen.join('\n'), 'utf-8');

  console.log(resumen.join('\n'));
  console.log(`\nReportes generados en: ${dir}`);
}

async function aplicar(conn, fechaHora) {
  console.log('Creando backups...');
  await hacerBackups(conn, fechaHora);

  for (const [nombre, cfg] of Object.entries(CATALOGOS)) {
    console.log(`Unificando ${nombre}...`);
    const filas = await cargarFilas(conn, cfg.tabla);
    const columnas = await obtenerColumnas(conn, cfg.tabla);

    const grupos = procesarCatalogo(filas, cfg);
    const remapeos = construirRemapeos(grupos, cfg);
    const filasUnificadas = construirFilasUnificadas(grupos, columnas, cfg);

    const transaccion = conn;
    try {
      await transaccion.beginTransaction();
      await reemplazarCatalogo(transaccion, cfg, columnas, filasUnificadas);
      await remapearReferencias(transaccion, cfg, remapeos);
      await transaccion.commit();
      console.log(
        `  ${nombre}: ${filas.length} -> ${filasUnificadas.length} filas, ${remapeosConCambio(remapeos).length} remapeos aplicados`,
      );
    } catch (err) {
      await transaccion.rollback();
      throw err;
    }

    await crearIndices(conn, cfg);
  }

  console.log('Migracion completada. Backups disponibles para restauracion.');
}

async function verificar(conn) {
  for (const [nombre, cfg] of Object.entries(CATALOGOS)) {
    const [dupsCodigo] = await conn.query(
      `SELECT ${cfg.colCodigo} AS codigo, COUNT(*) AS n FROM ${cfg.tabla} GROUP BY ${cfg.colCodigo} HAVING COUNT(*) > 1`,
    );
    const [total] = await conn.query(`SELECT COUNT(*) AS n FROM ${cfg.tabla}`);
    const [huerfanas] = await conn.query(
      `SELECT COUNT(*) AS n FROM ${cfg.tablaReferencia} r
       LEFT JOIN ${cfg.tabla} c ON r.${cfg.colReferencia} = c.${cfg.colCodigo}
       WHERE c.${cfg.colCodigo} IS NULL`,
    );
    const [indices] = await conn.query(
      `SELECT index_name AS indice FROM information_schema.statistics
       WHERE table_schema = DATABASE() AND table_name = ? GROUP BY index_name`,
      [cfg.tabla],
    );

    console.log(`=== ${nombre.toUpperCase()} ===`);
    console.log(`Filas en catalogo: ${total[0].n}`);
    console.log(`Codigos duplicados: ${dupsCodigo.length}`);
    console.log(`Referencias sin resolver en ${cfg.tablaReferencia}: ${huerfanas[0].n}`);
    console.log(`Indices unicos: ${indices.map((i) => i.indice).join(', ') || 'ninguno'}`);
  }
}

function pedirConfirmacion(pregunta) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(pregunta, (respuesta) => {
      rl.close();
      resolve(respuesta.trim().toLowerCase());
    });
  });
}

async function main() {
  const modo = process.argv[2] ?? '--reporte';
  const conn = await crearConexion();
  const fechaHora = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);

  try {
    if (modo === '--reporte') {
      console.log('Generando reporte (no modifica la base de datos)...\n');
      await generarReporte(conn, fechaHora);
    } else if (modo === '--aplicar') {
      const respuesta = await pedirConfirmacion(
        'SE EJECUTARA LA MIGRACION. Ten un respaldo completo (mysqldump) antes. Continuar? (si/no): ',
      );
      if (respuesta !== 'si') {
        console.log('Migracion cancelada.');
        return;
      }
      await aplicar(conn, fechaHora);
    } else if (modo === '--verificar') {
      await verificar(conn);
    } else {
      console.log('Modos: --reporte | --aplicar | --verificar');
    }
  } catch (err) {
    console.error(`ERROR: ${err.message}`);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
}

main();
