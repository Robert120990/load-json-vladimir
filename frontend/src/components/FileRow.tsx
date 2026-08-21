import type { DteSummary, EstadoItem } from '../types';

interface Props {
  item: DteSummary;
  estado: EstadoItem;
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
  guardado: 'Guardado',
  error_guardar: 'Error al guardar',
};

export default function FileRow({ item, estado }: Props) {
  const nombreContraparte = item.nombreContraparte ?? '—';
  const detalle = item.error ?? '';

  return (
    <tr>
      <td>{item.id + 1}</td>
      <td title={detalle}>{item.fileName}</td>
      <td>{item.tipoDte ?? '—'}</td>
      <td>{item.fecha ?? '—'}</td>
      <td>{item.nitContraparte ?? item.nrcContraparte ?? '—'}</td>
      <td>{nombreContraparte}</td>
      <td className="num">
        {item.montoTotal !== undefined ? item.montoTotal.toFixed(2) : '—'}
      </td>
      <td>
        <span className={`badge badge-${estado}`}>{ETIQUETAS_ESTADO[estado]}</span>
      </td>
    </tr>
  );
}
