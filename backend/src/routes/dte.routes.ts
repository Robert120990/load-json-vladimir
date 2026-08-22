import { Router } from 'express';
import { guardar, obtenerPeriodo, subirArchivos, validar } from '../controllers/dteController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.use(authMiddleware);

router.get('/periodo', obtenerPeriodo);
router.post('/upload', subirArchivos);
router.post('/validate', validar);
router.post('/save', guardar);

export default router;
