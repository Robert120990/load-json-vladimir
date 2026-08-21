import { Router } from 'express';
import { login, obtenerEmpresa, seleccionarEmpresa } from '../controllers/authController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.post('/login', login);
router.post('/select-empresa', seleccionarEmpresa);
router.get('/company', authMiddleware, obtenerEmpresa);

export default router;
