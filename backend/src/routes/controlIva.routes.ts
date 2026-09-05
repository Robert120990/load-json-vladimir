import { Router } from 'express';
import * as catalogsController from '../controllers/catalogsController';
import * as clientController from '../controllers/clientController';
import * as dashboardController from '../controllers/dashboardController';
import * as purchaseIvaController from '../controllers/purchaseIvaController';
import * as saleIvaController from '../controllers/saleIvaController';
import * as supplierController from '../controllers/supplierController';
import * as vatReportController from '../controllers/vatReportController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

// Apply authentication middleware to all Control IVA routes
router.use(authMiddleware);

// Dashboard
router.get('/dashboard', dashboardController.getDashboardData);

// Catalogs
router.get('/catalogos/departamentos', catalogsController.getDepartamentos);
router.get('/catalogos/municipios', catalogsController.getMunicipios);
router.get('/catalogos/tipos-documento-compras', catalogsController.getTiposDocumentoCompras);
router.get('/catalogos/tipos-documento-ventas', catalogsController.getTiposDocumentoVentas);
router.get('/catalogos/firmas', catalogsController.getFirmasConta);
router.get('/periodo-compras', catalogsController.getPeriodoCompras);
router.put('/periodo-compras', catalogsController.updatePeriodoCompras);

// Clients (Global catalog)
router.get('/clientes', clientController.listClients);
router.get('/clientes/:codCliente', clientController.getClientByCode);
router.post('/clientes', clientController.createClient);
router.put('/clientes/:codCliente', clientController.updateClient);
router.delete('/clientes/:codCliente', clientController.deleteClient);

// Suppliers (Global catalog)
router.get('/proveedores', supplierController.listSuppliers);
router.get('/proveedores/:codProveedor', supplierController.getSupplierByCode);
router.post('/proveedores', supplierController.createSupplier);
router.put('/proveedores/:codProveedor', supplierController.updateSupplier);
router.delete('/proveedores/:codProveedor', supplierController.deleteSupplier);

// Purchases (compras_iva)
router.get('/compras', purchaseIvaController.listPurchases);
router.get('/compras/:llave', purchaseIvaController.getPurchaseByLlave);
router.post('/compras', purchaseIvaController.createPurchase);
router.put('/compras/:llave', purchaseIvaController.updatePurchase);
router.delete('/compras/:llave', purchaseIvaController.deletePurchase);

// Sales (ventas_iva)
router.get('/ventas', saleIvaController.listSales);
router.post('/ventas/batch-consumidor-final', saleIvaController.createBatchConsumidorFinal);
router.get('/ventas/:llave', saleIvaController.getSaleByLlave);
router.post('/ventas', saleIvaController.createSale);
router.put('/ventas/:llave', saleIvaController.updateSale);
router.delete('/ventas/:llave', saleIvaController.deleteSale);

// VAT Reports & MH Annexes
router.get('/reportes/libro-compras', vatReportController.getLibroCompras);
router.get('/reportes/libro-consumidor-final', vatReportController.getLibroConsumidorFinal);
router.get('/reportes/libro-contribuyentes', vatReportController.getLibroContribuyentes);
router.get('/reportes/anexo-hacienda', vatReportController.getAnexoHacienda);
router.get('/reportes/plantilla-anexo', vatReportController.getPlantillaOficialAnexo);
router.get('/reportes/pago-impuestos', vatReportController.getLiquidacionImpuestos);

export default router;
