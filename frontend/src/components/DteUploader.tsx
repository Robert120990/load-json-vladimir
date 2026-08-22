import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { guardar, obtenerPeriodo, subirArchivos, validar } from '../api/dte';
import { obtenerError } from '../api/client';
import type { DteSummary, EstadoItem, PeriodoCompras, SaveResultado, TipoDte } from '../types';
import { decodificarArrayBuffer } from '../utils/decodificar';
import ConfirmModal from './ConfirmModal';
import FileRow from './FileRow';
import JsonModal from './JsonModal';

interface ArchivoCargado {
  file: File;
  content: string;
}

interface Props {
  tipo: TipoDte;
  titulo: string;
}

type Proceso = 'subiendo' | 'validando' | 'guardando' | null;
type Confirmacion = 'cargar' | 'guardar' | 'cancelar' | null;

interface ResumenEstados {
  total: number;
  pendiente: number;
  valido: number;
  duplicado: number;
  contraparte: number;
  noPertenece: number;
  errorFormato: number;
  sinSello: number;
  fueraPeriodo: number;
  guardado: number;
  errorGuardar: number;
}

function resumenVacio(): ResumenEstados {
  return {
    total: 0,
    pendiente: 0,
    valido: 0,
    duplicado: 0,
    contraparte: 0,
    noPertenece: 0,
    errorFormato: 0,
    sinSello: 0,
    fueraPeriodo: 0,
    guardado: 0,
    errorGuardar: 0,
  };
}

export default function DteUploader({ tipo, titulo }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [archivos, setArchivos] = useState<ArchivoCargado[]>([]);
  const [archivosPendientes, setArchivosPendientes] = useState<File[]>([]);
  const [items, setItems] = useState<DteSummary[]>([]);
  const [estados, setEstados] = useState<Record<number, EstadoItem>>({});
  const [proceso, setProceso] = useState<Proceso>(null);
  const [resultado, setResultado] = useState<SaveResultado | null>(null);
  const [confirmacion, setConfirmacion] = useState<Confirmacion>(null);
  const [jsonSeleccionado, setJsonSeleccionado] = useState<{ fileName: string; content: string } | null>(
    null,
  );
  const [arrastrando, setArrastrando] = useState(false);
  const [resumen, setResumen] = useState<ResumenEstados | null>(null);
  const [periodo, setPeriodo] = useState<PeriodoCompras | null>(null);
  const [periodoCargado, setPeriodoCargado] = useState(false);

  useEffect(() => {
    if (tipo !== 'compras') return;
    let activo = true;
    obtenerPeriodo()
      .then((p) => {
        if (activo) setPeriodo(p);
      })
      .catch((err) => toast.error(obtenerError(err)))
      .finally(() => {
        if (activo) setPeriodoCargado(true);
      });
    return () => {
      activo = false;
    };
  }, [tipo]);

  const sinPeriodo = tipo === 'compras' && periodo === null;
  const uploadHabilitado = tipo !== 'compras' || periodo !== null;
  const hayValidos = items.some((item) => estados[item.id] === 'valido');
  const cantidadValidos = items.filter((item) => estados[item.id] === 'valido').length;
  const deshabilitado = proceso !== null || (tipo === 'compras' && !periodoCargado);

  function calcularResumen(estadosActuales: Record<number, EstadoItem>): ResumenEstados {
    const r = resumenVacio();
    const valores = Object.values(estadosActuales);
    r.total = valores.length;
    for (const estado of valores) {
      if (estado === 'pendiente') r.pendiente += 1;
      else if (estado === 'valido') r.valido += 1;
      else if (estado === 'duplicado') r.duplicado += 1;
      else if (estado === 'cliente_no_existe' || estado === 'proveedor_no_existe') r.contraparte += 1;
      else if (estado === 'no_pertenece') r.noPertenece += 1;
      else if (estado === 'error_parseo') r.errorFormato += 1;
      else if (estado === 'sin_sello') r.sinSello += 1;
      else if (estado === 'fuera_periodo') r.fueraPeriodo += 1;
      else if (estado === 'guardado') r.guardado += 1;
      else if (estado === 'error_guardar') r.errorGuardar += 1;
    }
    return r;
  }

  function manejarCarpeta(lista: FileList | null) {
    if (!lista || lista.length === 0) return;

    if (sinPeriodo) {
      toast.error('No hay periodo de compras configurado para esta empresa');
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    const archivosJson = Array.from(lista).filter((f) => f.name.toLowerCase().endsWith('.json'));

    if (archivosJson.length === 0) {
      toast.error('La carpeta seleccionada no contiene archivos .json');
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    setArchivosPendientes(archivosJson);
    setConfirmacion('cargar');
  }

  async function manejarSoltar(e: React.DragEvent) {
    e.preventDefault();
    setArrastrando(false);

    if (sinPeriodo) {
      toast.error('No hay periodo de compras configurado para esta empresa');
      return;
    }

    try {
      const archivosJson: File[] = [];
      const items = e.dataTransfer.items;

      if (items.length > 0 && typeof items[0].webkitGetAsEntry === 'function') {
        for (const item of items) {
          const entrada = item.webkitGetAsEntry();
          if (entrada) await recorrerEntrada(entrada, archivosJson);
        }
      } else {
        archivosJson.push(...Array.from(e.dataTransfer.files));
      }

      const filtrados = archivosJson.filter((f) => f.name.toLowerCase().endsWith('.json'));

      if (filtrados.length === 0) {
        toast.error('No se encontraron archivos .json en lo soltado');
        return;
      }

      setArchivosPendientes(filtrados);
      setConfirmacion('cargar');
    } catch (err) {
      toast.error(obtenerError(err));
    }
  }

  async function recorrerEntrada(entrada: FileSystemEntry, resultado: File[]): Promise<void> {
    if (entrada.isFile) {
      if (!entrada.name.toLowerCase().endsWith('.json')) return;
      const archivo = await new Promise<File>((resolve, reject) => {
        (entrada as FileSystemFileEntry).file(resolve, reject);
      });
      resultado.push(archivo);
      return;
    }

    const lector = (entrada as FileSystemDirectoryEntry).createReader();
    let lote: FileSystemEntry[];
    do {
      lote = await new Promise<FileSystemEntry[]>((resolve, reject) => {
        lector.readEntries(resolve, reject);
      });
      for (const subEntrada of lote) {
        await recorrerEntrada(subEntrada, resultado);
      }
    } while (lote.length > 0);
  }

  async function ejecutarCarga() {
    setConfirmacion(null);
    setResultado(null);
    setResumen(null);
    setProceso('subiendo');

    try {
      const cargados: ArchivoCargado[] = [];
      for (const archivo of archivosPendientes) {
        cargados.push({ file: archivo, content: decodificarArrayBuffer(await archivo.arrayBuffer()) });
      }

      const resumenes = await subirArchivos(tipo, cargados.map((c) => c.file));

      setArchivos(cargados);
      setArchivosPendientes([]);
      setItems(resumenes);
      setEstados(
        Object.fromEntries(
          resumenes.map((item) => [
            item.id,
            item.error ? 'error_parseo'
              : item.fueraPeriodo ? 'fuera_periodo'
              : item.sinSello ? 'sin_sello'
              : item.pertenece ? 'pendiente'
              : 'no_pertenece',
          ]),
        ),
      );
      toast.success(`${resumenes.length} archivo(s) JSON cargado(s) correctamente`);
    } catch (err) {
      toast.error(obtenerError(err));
    } finally {
      setProceso(null);
    }
  }

  function cancelarSeleccionCarpeta() {
    setConfirmacion(null);
    setArchivosPendientes([]);
    if (inputRef.current) inputRef.current.value = '';
  }

  async function manejarValidar() {
    setResultado(null);
    setProceso('validando');

    try {
      const validables: Parameters<typeof validar>[1] = items
        .filter((item) => estados[item.id] === 'pendiente')
        .map((item) => ({
          id: item.id,
          fileName: item.fileName,
          codigoGeneracion: item.codigoGeneracion,
          nitContraparte: item.nitContraparte,
          nrcContraparte: item.nrcContraparte,
        }));

      const resultados = await validar(tipo, validables);

      const nuevosEstados = { ...estados };
      for (const resultado of resultados) {
        nuevosEstados[resultado.id] = resultado.estado;
      }
      setEstados(nuevosEstados);

      setResumen(calcularResumen(nuevosEstados));
      const conteo = resumirEstados(nuevosEstados);
      toast.success(
        `Validación: ${conteo.valido} válido(s), ${conteo.duplicado} duplicado(s), ` +
          `${conteo.contraparte} sin cliente/proveedor`,
      );
    } catch (err) {
      toast.error(obtenerError(err));
    } finally {
      setProceso(null);
    }
  }

  async function ejecutarGuardar() {
    setConfirmacion(null);
    setProceso('guardando');

    try {
      const seleccionados = items.filter((item) => estados[item.id] === 'valido');
      const aGuardar = seleccionados
        .map((item) => ({
          fileName: item.fileName,
          content: archivos.find((a) => a.file.name === item.fileName)?.content ?? '',
        }))
        .filter((item) => item.content !== '');

      const res = await guardar(tipo, aGuardar);

      setResultado(res);
      const nuevosEstados = { ...estados };
      for (const r of res.resultados) {
        const item = items.find((i) => i.fileName === r.fileName);
        if (item) nuevosEstados[item.id] = r.ok ? 'guardado' : 'error_guardar';
      }
      setEstados(nuevosEstados);
      setResumen(calcularResumen(nuevosEstados));

      if (res.errores > 0) {
        toast.error(`${res.insertados} insertado(s), ${res.errores} con error`);
      } else {
        toast.success(`${res.insertados} documento(s) guardado(s) correctamente`);
      }
    } catch (err) {
      toast.error(obtenerError(err));
    } finally {
      setProceso(null);
    }
  }

  function ejecutarCancelar() {
    setConfirmacion(null);
    setArchivos([]);
    setItems([]);
    setEstados({});
    setResultado(null);
    setResumen(null);
    setJsonSeleccionado(null);
    if (inputRef.current) inputRef.current.value = '';
    toast('Carga descartada');
  }

  function manejarDobleClic(item: DteSummary) {
    setJsonSeleccionado({
      fileName: item.fileName,
      content: archivos.find((a) => a.file.name === item.fileName)?.content ?? '',
    });
  }

  return (
    <div className="pagina pagina-ancha">
      <header className="barra">
        <h1>{titulo}</h1>
        <Link to="/" className="btn-secundario">
          Volver
        </Link>
      </header>

      <main className="contenido">
        <section className="card">
          <h2>Seleccionar carpeta con JSON de DTE</h2>
          <p className="nota">
            {tipo === 'ventas'
              ? 'Se cargarán solo los DTE donde el emisor sea la empresa configurada.'
              : 'Se cargarán solo los DTE donde el receptor sea la empresa configurada.'}
          </p>
          {tipo === 'compras' && (
            <div className={`periodo-info ${sinPeriodo ? 'periodo-info-sin' : ''}`}>
              {periodoCargado
                ? sinPeriodo
                  ? 'No hay periodo de compras configurado para esta empresa'
                  : `Periodo de compras: ${String(periodo?.mes).padStart(2, '0')} / ${periodo?.anio}`
                : 'Consultando periodo de compras…'}
            </div>
          )}
          <div
            className={`zona-arrastre ${arrastrando ? 'zona-arrastre-activa' : ''} ${sinPeriodo ? 'zona-arrastre-deshabilitada' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setArrastrando(true);
            }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={manejarSoltar}
          >
            <p>Arrastra la carpeta o los archivos .json aquí</p>
          </div>
          <div className="acciones">
            <button
              className="btn-primario"
              onClick={() => inputRef.current?.click()}
              disabled={deshabilitado || !uploadHabilitado}
            >
              Elegir archivos
            </button>
          </div>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".json"
            style={{ display: 'none' }}
            onChange={(e) => manejarCarpeta(e.target.files)}
          />
          <p className="nota">Archivos cargados: {items.length}</p>
        </section>

        {resumen && (
          <section className="card resumen-validacion">
            <h3>Resumen</h3>
            <div className="resumen-items">
              <div className="resumen-item">
                <strong>{resumen.total}</strong>
                <span>Total</span>
              </div>
              {resumen.valido > 0 && (
                <div className="resumen-item resumen-valido">
                  <strong>{resumen.valido}</strong>
                  <span>Válidos</span>
                </div>
              )}
              {resumen.duplicado > 0 && (
                <div className="resumen-item resumen-duplicado">
                  <strong>{resumen.duplicado}</strong>
                  <span>Duplicados</span>
                </div>
              )}
              {resumen.contraparte > 0 && (
                <div className="resumen-item resumen-contraparte">
                  <strong>{resumen.contraparte}</strong>
                  <span>Sin cliente/prov.</span>
                </div>
              )}
              {resumen.sinSello > 0 && (
                <div className="resumen-item resumen-sin-sello">
                  <strong>{resumen.sinSello}</strong>
                  <span>Sin sello</span>
                </div>
              )}
              {resumen.fueraPeriodo > 0 && (
                <div className="resumen-item resumen-fuera-periodo">
                  <strong>{resumen.fueraPeriodo}</strong>
                  <span>Fuera de periodo</span>
                </div>
              )}
              {resumen.noPertenece > 0 && (
                <div className="resumen-item resumen-no-pertenece">
                  <strong>{resumen.noPertenece}</strong>
                  <span>No pertenece</span>
                </div>
              )}
              {resumen.errorFormato > 0 && (
                <div className="resumen-item resumen-error">
                  <strong>{resumen.errorFormato}</strong>
                  <span>Error formato</span>
                </div>
              )}
              {resumen.pendiente > 0 && (
                <div className="resumen-item">
                  <strong>{resumen.pendiente}</strong>
                  <span>Pendientes</span>
                </div>
              )}
              {resumen.guardado > 0 && (
                <div className="resumen-item resumen-guardados">
                  <strong>{resumen.guardado}</strong>
                  <span>Guardados</span>
                </div>
              )}
              {resumen.errorGuardar > 0 && (
                <div className="resumen-item resumen-error">
                  <strong>{resumen.errorGuardar}</strong>
                  <span>Error guardar</span>
                </div>
              )}
            </div>
          </section>
        )}

        {resultado && (
          <section className="card resumen-guardado">
            <h3>Resultado del guardado</h3>
            <p>
              <strong>{resultado.insertados}</strong> documento(s) insertado(s) ·{' '}
              <strong>{resultado.errores}</strong> con error
            </p>
          </section>
        )}

        {items.length > 0 && (
          <section className="card">
            <div className="acciones">
              <button
                className="btn-primario"
                onClick={manejarValidar}
                disabled={deshabilitado || !items.some((i) => estados[i.id] === 'pendiente')}
              >
                {proceso === 'validando' ? 'Validando…' : 'Validar'}
              </button>
              <button
                className="btn-primario"
                onClick={() => setConfirmacion('guardar')}
                disabled={deshabilitado || !hayValidos}
                title={hayValidos ? `Guardar ${cantidadValidos} documento(s) válido(s)` : ''}
              >
                {proceso === 'guardando' ? 'Guardando…' : `Guardar válidos (${cantidadValidos})`}
              </button>
              <button
                className="btn-peligro"
                onClick={() => setConfirmacion('cancelar')}
                disabled={deshabilitado}
              >
                Cancelar carga
              </button>
            </div>

            <div className="tabla-scroll">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Archivo</th>
                    <th>Tipo</th>
                    <th>Fecha</th>
                    <th>NIT/NRC</th>
                    <th>Contraparte</th>
                    <th>Monto</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <FileRow
                      key={item.id}
                      item={item}
                      estado={estados[item.id] ?? 'pendiente'}
                      onDobleClic={manejarDobleClic}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>

      <footer className="pie-version">Versión v9 · Carga DTE</footer>

      {confirmacion === 'cargar' && (
        <ConfirmModal
          titulo="Cargar archivos"
          mensaje={`¿Deseas cargar los ${archivosPendientes.length} archivo(s) JSON seleccionados?`}
          textoConfirmar="Cargar"
          textoCancelar="Cancelar"
          variante="confirmar"
          onConfirmar={ejecutarCarga}
          onCancelar={cancelarSeleccionCarpeta}
        />
      )}

      {confirmacion === 'guardar' && (
        <ConfirmModal
          titulo="Guardar documentos"
          mensaje={`¿Deseas guardar ${cantidadValidos} documento(s) válido(s) en la base de datos?`}
          textoConfirmar="Guardar"
          textoCancelar="Volver"
          variante="confirmar"
          onConfirmar={ejecutarGuardar}
          onCancelar={() => setConfirmacion(null)}
        />
      )}

      {confirmacion === 'cancelar' && (
        <ConfirmModal
          titulo="Cancelar carga"
          mensaje={`¿Seguro que deseas cancelar la carga? Se descartarán ${items.length} documento(s).`}
          textoConfirmar="Cancelar carga"
          textoCancelar="Mantener"
          variante="peligro"
          onConfirmar={ejecutarCancelar}
          onCancelar={() => setConfirmacion(null)}
        />
      )}

      {jsonSeleccionado && (
        <JsonModal
          fileName={jsonSeleccionado.fileName}
          content={jsonSeleccionado.content}
          onCerrar={() => setJsonSeleccionado(null)}
        />
      )}
    </div>
  );
}

function resumirEstados(estados: Record<number, EstadoItem>): {
  valido: number;
  duplicado: number;
  contraparte: number;
} {
  const valores = Object.values(estados);
  return {
    valido: valores.filter((e) => e === 'valido').length,
    duplicado: valores.filter((e) => e === 'duplicado').length,
    contraparte: valores.filter((e) => e === 'cliente_no_existe' || e === 'proveedor_no_existe')
      .length,
  };
}
