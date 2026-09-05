import DteUploader from '../components/DteUploader';
import ControlIvaLayout from '../components/layout/ControlIvaLayout';

export default function VentasPage() {
  return (
    <ControlIvaLayout>
      <DteUploader tipo="ventas" titulo="Carga de Json-DTE Ventas" />
    </ControlIvaLayout>
  );
}
