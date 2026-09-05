import DteUploader from '../components/DteUploader';
import ControlIvaLayout from '../components/layout/ControlIvaLayout';

export default function ComprasPage() {
  return (
    <ControlIvaLayout>
      <DteUploader tipo="compras" titulo="Carga de Json-DTE Compras" />
    </ControlIvaLayout>
  );
}
