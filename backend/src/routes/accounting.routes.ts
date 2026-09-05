import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth';
import * as catalogController from '../controllers/accountingCatalogController';
import * as journalController from '../controllers/journalEntryController';
import * as signaturesController from '../controllers/accountingSignaturesController';
import * as correlativesController from '../controllers/accountingCorrelativesController';
import * as reportsController from '../controllers/accountingReportsController';

const router = Router();

// Apply authentication middleware
router.use(authMiddleware);

// --- MAYORIZACIÓN & REPORTES CONTABLES ---
router.post('/mayorizar', reportsController.mayorizarCuentas);
router.post('/reportes/data', reportsController.generarReporteContable);

// --- ACCOUNTING CORRELATIVES (correlativos_contabilidad & correlativos) ---
router.get('/correlativos', correlativesController.getAccountingCorrelatives);
router.put('/correlativos', correlativesController.updateAccountingCorrelatives);
router.post('/correlativos/inicializar-ano', correlativesController.initializeYear);
router.post('/correlativos/reenumerar', correlativesController.renumberJournalEntries);

// --- CATALOG OF ACCOUNTS (cat_cuentas) ---
router.get('/catalogo', catalogController.listAccounts);
router.get('/catalogo/ejercicios', catalogController.getAvailableYears);
router.get('/catalogo/tipos-cuenta', catalogController.getAccountTypes);
router.get('/catalogo/:id', catalogController.getAccountById);
router.post('/catalogo', catalogController.createAccount);
router.put('/catalogo/:id', catalogController.updateAccount);
router.delete('/catalogo/:id', catalogController.deleteAccount);
router.post('/catalogo/copiar-ejercicio', catalogController.copyCatalogFromYear);

// Import endpoints (with pre-save verification)
router.post('/catalogo/importar/verificar', catalogController.verifyImportCatalog);
router.post('/catalogo/importar/guardar', catalogController.saveImportCatalog);

// --- JOURNAL ENTRIES (cabecera_partida & detalle_partida) ---
router.get('/partidas', journalController.listJournalEntries);
router.get('/partidas/tipos', journalController.getPartidaTypes);
router.get('/partidas/siguiente-correlativo', journalController.getNextCorrelatives);
router.get('/partidas/:codPart', journalController.getJournalEntryByCode);
router.post('/partidas', journalController.createJournalEntry);
router.put('/partidas/:codPart', journalController.updateJournalEntry);
router.patch('/partidas/:codPart/anular', journalController.toggleAnnulJournalEntry);
router.delete('/partidas/:codPart', journalController.deleteJournalEntry);

// --- ACCOUNTING SIGNATURES (firmas_conta) ---
router.get('/firmas', signaturesController.getAccountingSignatures);
router.post('/firmas', signaturesController.saveAccountingSignatures);

export default router;
