import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  FileCode2,
  FolderUp,
  Save,
  Trash2,
  UploadCloud,
} from 'lucide-react';
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
      const itemsData = e.dataTransfer.items;

      if (itemsData.length > 0 && typeof itemsData[0].webkitGetAsEntry === 'function') {
        for (const item of itemsData) {
          const entrada = item.webkitGetAsEntry();
          if (entrada) {
            await leerEntrada(entrada, archivosJson);
          }
        }
      } else {
        const archivosDirectos = Array.from(e.dataTransfer.files).filter((f) =>
          f.name.toLowerCase().endsWith('.json'),
        );
        archivosJson.push(...archivosDirectos);
      }

      if (archivosJson.length === 0) {
        toast.error('No se encontraron archivos .json en lo que arrastraste');
        return;
      }

      setArchivosPendientes(archivosJson);
      setConfirmacion('cargar');
    } catch {
      toast.error('Error al procesar la carpeta o archivos arrastrados');
    }
  }

  async function leerEntrada(entrada: FileSystemEntry, acumulador: File[]): Promise<void> {
    if (entrada.isFile) {
      const fileEntry = entrada as FileSystemFileEntry;
      return new Promise((resolve) => {
        fileEntry.file((file) => {
          if (file.name.toLowerCase().endsWith('.json')) {
            acumulador.push(file);
          }
          resolve();
        });
      });
    }

    if (entrada.isDirectory) {
      const dirEntry = entrada as FileSystemDirectoryEntry;
      const lector = dirEntry.createReader();
      return new Promise((resolve) => {
        function leerSiguientes() {
          lector.readEntries(async (entradas) => {
            if (entradas.length === 0) {
              resolve();
              return;
            }
            for (const sub of entradas) {
              await leerEntrada(sub, acumulador);
            }
            leerSiguientes();
          });
        }
        leerSiguientes();
      });
    }
  }

  function cancelarSeleccionCarpeta() {
    setArchivosPendientes([]);
    setConfirmacion(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  async function ejecutarCarga() {
    const seleccionados = archivosPendientes;
    setConfirmacion(null);
    setProceso('subiendo');
    setResultado(null);

    try {
      const cargados: ArchivoCargado[] = [];

      for (const file of seleccionados) {
        const buffer = await file.arrayBuffer();
        const content = decodificarArrayBuffer(buffer);
        cargados.push({ file, content });
      }

      const resumenes = await subirArchivos(tipo, cargados.map((c) => c.file));
      setArchivos(cargados);
      setItems(resumenes);

      const estadosIniciales: Record<number, EstadoItem> = {};
      for (const item of resumenes) {
        estadosIniciales[item.id] = item.error
          ? 'error_parseo'
          : item.fueraPeriodo
          ? 'fuera_periodo'
          : item.sinSello
          ? 'sin_sello'
          : item.pertenece
          ? 'pendiente'
          : 'no_pertenece';
      }
      setEstados(estadosIniciales);
      setResumen(calcularResumen(estadosIniciales));
      toast.success(`${resumenes.length} archivo(s) cargado(s) correctamente`);
    } catch (err) {
      toast.error(obtenerError(err));
    } finally {
      setProceso(null);
      setArchivosPendientes([]);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function manejarValidar() {
    const validables: Parameters<typeof validar>[1] = items
      .filter((item) => estados[item.id] === 'pendiente')
      .map((item) => ({
        id: item.id,
        fileName: item.fileName,
        codigoGeneracion: item.codigoGeneracion,
        nitContraparte: item.nitContraparte,
        nrcContraparte: item.nrcContraparte,
      }));

    if (validables.length === 0) {
      toast('No hay archivos pendientes de validación');
      return;
    }

    setProceso('validando');
    try {
      const resultados = await validar(tipo, validables);
      const nuevosEstados = { ...estados };
      for (const resultado of resultados) {
        nuevosEstados[resultado.id] = resultado.estado;
      }
      setEstados(nuevosEstados);
      setResumen(calcularResumen(nuevosEstados));
      toast.success('Validación completada');
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
      const aGuardar = items
        .filter((i) => estados[i.id] === 'valido')
        .map((item) => ({
          fileName: item.fileName,
          content: archivos.find((a) => a.file.name === item.fileName)?.content ?? '',
        }))
        .filter((item) => item.content !== '');

      const res = await guardar(tipo, aGuardar);

      setResultado(res);
      const nuevosItems = [...items];
      const nuevosEstados = { ...estados };
      for (const r of res.resultados) {
        const indice = items.findIndex((i) => i.fileName === r.fileName);
        if (indice >= 0) {
          nuevosItems[indice] = { ...nuevosItems[indice], error: r.ok ? undefined : r.error };
          nuevosEstados[nuevosItems[indice].id] = r.ok ? 'guardado' : 'error_guardar';
        }
      }
      setItems(nuevosItems);
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
    <div className="pagina">
      {/* Page Header aligned with system standard */}
      <div className="page-header">
        <div className="page-header-title">
          <h1>{titulo}</h1>
          <p className="page-header-subtitle">
            {tipo === 'ventas'
              ? 'Carga electrónica masiva y validación de DTE emitidos (ventas_iva) por la empresa.'
              : 'Carga electrónica masiva y validación de DTE recibidos (compras_iva) por la empresa.'}
          </p>
        </div>
        <div className="header-actions">
          <Link
            to={tipo === 'ventas' ? '/control-iva/ventas' : '/control-iva/compras'}
            className="btn-secundario"
            title={`Ir al libro de ${tipo === 'ventas' ? 'Ventas' : 'Compras'}`}
          >
            <span>Ir a Libro de {tipo === 'ventas' ? 'Ventas IVA' : 'Compras IVA'}</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      <main className="contenido">
        {/* Upload Card */}
        <section className="card">
          {tipo === 'compras' && (
            <div className={`periodo-info ${sinPeriodo ? 'periodo-info-sin' : ''}`}>
              {periodoCargado
                ? sinPeriodo
                  ? '⚠️ No hay período de compras activo configurado para esta empresa'
                  : `📅 Período fiscal de compras activo: ${String(periodo?.mes).padStart(2, '0')} / ${periodo?.anio}`
                : 'Consultando período de compras…'}
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
            onClick={() => uploadHabilitado && !deshabilitado && inputRef.current?.click()}
            style={{ cursor: uploadHabilitado && !deshabilitado ? 'pointer' : 'not-allowed' }}
          >
            <div className="zona-arrastre-icon">
              <UploadCloud size={40} />
            </div>
            <p className="zona-arrastre-text">
              Arrastra y suelta aquí la carpeta o archivos <strong>.JSON</strong>
            </p>
            <span className="zona-arrastre-subtext">o haz clic aquí para seleccionar desde tu equipo</span>
            <div className="zona-arrastre-btn-wrap" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="btn-primario"
                onClick={() => inputRef.current?.click()}
                disabled={deshabilitado || !uploadHabilitado}
              >
                <FolderUp size={16} />
                <span>Elegir archivos JSON</span>
              </button>
            </div>
          </div>

          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".json"
            style={{ display: 'none' }}
            onChange={(e) => manejarCarpeta(e.target.files)}
          />

          {items.length > 0 && (
            <div className="archivos-cargados-status">
              <FileCode2 size={16} className="text-primary" />
              <span>
                Archivos en memoria para procesamiento: <strong>{items.length}</strong>
              </span>
            </div>
          )}
        </section>

        {/* Validation Summary Metrics */}
        {resumen && (
          <section className="card resumen-validacion mt-4">
            <h3 className="resumen-section-title">Resumen de Validación del Lote</h3>
            <div className="resumen-items">
              <div className="resumen-item">
                <strong>{resumen.total}</strong>
                <span>Total Archivos</span>
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

        {/* Save Result Banner */}
        {resultado && (
          <section className="card resumen-guardado mt-4">
            <h3>Resultado del guardado masivo</h3>
            <p>
              <strong>{resultado.insertados}</strong> documento(s) insertado(s) exitosamente ·{' '}
              <strong>{resultado.errores}</strong> con error
            </p>
          </section>
        )}

        {/* Document Table Section */}
        {items.length > 0 && (
          <section className="card mt-4">
            <div className="table-header-toolbar">
              <div className="table-header-info">
                <h3 className="table-title">Documentos DTE Procesados ({items.length})</h3>
                <span className="text-muted text-xs">
                  (Doble clic en cualquier fila para visualizar el JSON completo)
                </span>
              </div>
              <div className="header-actions">
                <button
                  type="button"
                  className="btn-primario"
                  onClick={manejarValidar}
                  disabled={deshabilitado || !items.some((i) => estados[i.id] === 'pendiente')}
                >
                  <CheckCircle2 size={16} />
                  <span>{proceso === 'validando' ? 'Validando…' : 'Validar Lote'}</span>
                </button>
                <button
                  type="button"
                  className="btn-primario"
                  style={{ background: '#059669', borderColor: '#047857' }}
                  onClick={() => setConfirmacion('guardar')}
                  disabled={deshabilitado || !hayValidos}
                  title={hayValidos ? `Guardar ${cantidadValidos} documento(s) válido(s)` : ''}
                >
                  <Save size={16} />
                  <span>{proceso === 'guardando' ? 'Guardando…' : `Guardar válidos (${cantidadValidos})`}</span>
                </button>
                <button
                  type="button"
                  className="btn-peligro"
                  onClick={() => setConfirmacion('cancelar')}
                  disabled={deshabilitado}
                >
                  <Trash2 size={16} />
                  <span>Cancelar carga</span>
                </button>
              </div>
            </div>

            <div className="data-table-container">
              <table className="data-table tabla-compacta">
                <thead>
                  <tr>
                    <th style={{ width: 45, textAlign: 'center' }}>#</th>
                    <th>Archivo</th>
                    <th>Tipo DTE</th>
                    <th>Fecha</th>
                    <th>NIT / NRC</th>
                    <th>Contraparte</th>
                    <th style={{ textAlign: 'right' }}>Monto ($)</th>
                    <th style={{ textAlign: 'center' }}>Estado</th>
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

      {confirmacion === 'cargar' && (
        <ConfirmModal
          titulo="Cargar archivos JSON"
          mensaje={`¿Deseas cargar los ${archivosPendientes.length} archivo(s) JSON seleccionados en memoria?`}
          textoConfirmar="Cargar Lote"
          textoCancelar="Cancelar"
          variante="confirmar"
          onConfirmar={ejecutarCarga}
          onCancelar={cancelarSeleccionCarpeta}
        />
      )}

      {confirmacion === 'guardar' && (
        <ConfirmModal
          titulo="Guardar documentos válidos"
          mensaje={`¿Deseas guardar ${cantidadValidos} documento(s) válido(s) directamente en la base de datos de ${tipo === 'ventas' ? 'Ventas IVA' : 'Compras IVA'}?`}
          textoConfirmar="Guardar en Base de Datos"
          textoCancelar="Volver"
          variante="confirmar"
          onConfirmar={ejecutarGuardar}
          onCancelar={() => setConfirmacion(null)}
        />
      )}

      {confirmacion === 'cancelar' && (
        <ConfirmModal
          titulo="Cancelar carga de lote"
          mensaje={`¿Seguro que deseas cancelar la carga? Se descartarán los ${items.length} documento(s) cargados en memoria.`}
          textoConfirmar="Descartar Lote"
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
