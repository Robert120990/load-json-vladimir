import type { DteSummary, EstadoItem } from '../types';

interface Props {
  item: DteSummary;
  estado: EstadoItem;
  onDobleClic?: (item: DteSummary) => void;
}

export const ETIQUETAS_ESTADO: Record<EstadoItem, string> = {
  pendiente: 'Pendiente',
  valido: 'Válido',
  duplicado: 'Duplicado',
  cliente_no_existe: 'Cliente no existe',
  proveedor_no_existe: 'Proveedor no existe',
  no_pertenece: 'No pertenece a la empresa',
  error_parseo: 'Error de formato',
  sin_sello: 'Sin sello de recepción',
  fuera_periodo: 'Fuera de periodo',
  guardado: 'Guardado',
  error_guardar: 'Error al guardar',
};

export default function FileRow({ item, estado, onDobleClic }: Props) {
  const nombreContraparte = item.nombreContraparte ?? '—';
  const detalle = item.error ?? '';
  const tituloArchivo = detalle ? `${item.fileName} — ${detalle}` : item.fileName;

  return (
    <tr
      onDoubleClick={onDobleClic ? () => onDobleClic(item) : undefined}
      title={onDobleClic ? 'Doble clic para ver el JSON' : undefined}
      style={onDobleClic ? { cursor: 'pointer' } : undefined}
    >
      <td style={{ textAlign: 'center', color: '#64748b' }}>{item.id + 1}</td>
      <td className="celda-archivo" title={tituloArchivo} style={{ maxWidth: 220 }}>
        <span className="font-semibold text-primary font-mono text-xs">{item.fileName}</span>
      </td>
      <td>
        <span className="badge badge-neutral text-xs">
          {item.tipoDte ?? '—'}
        </span>
      </td>
      <td>
        <span className="whitespace-nowrap font-medium text-xs">{item.fecha ?? '—'}</span>
      </td>
      <td>
        <span className="font-mono text-xs">{item.nitContraparte ?? item.nrcContraparte ?? '—'}</span>
      </td>
      <td>
        <span className="font-medium text-xs" style={{ maxWidth: 200, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {nombreContraparte}
        </span>
      </td>
      <td style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'monospace' }}>
        $ {item.montoTotal !== undefined ? item.montoTotal.toFixed(2) : '0.00'}
      </td>
      <td style={{ textAlign: 'center' }}>
        <span className={`badge badge-${estado}`} title={detalle || undefined}>
          {ETIQUETAS_ESTADO[estado]}
        </span>
      </td>
    </tr>
  );
}
