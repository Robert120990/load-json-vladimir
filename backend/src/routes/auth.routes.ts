import { Router } from 'express';
import {
  cambiarEmpresa,
  login,
  obtenerEmpresa,
  obtenerMisEmpresas,
  seleccionarEmpresa,
} from '../controllers/authController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.post('/login', login);
router.post('/select-empresa', seleccionarEmpresa);
router.get('/company', authMiddleware, obtenerEmpresa);
router.get('/my-companies', authMiddleware, obtenerMisEmpresas);
router.post('/switch-company', authMiddleware, cambiarEmpresa);

export default router;
