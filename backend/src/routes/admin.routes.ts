import { Router } from 'express';
import {
  getUserCompanies,
  getUsers,
  updateUserCompanies,
} from '../controllers/adminController';
import { adminMiddleware } from '../middlewares/admin';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

// Todas las rutas de administración requieren autenticación y rol de Administrador
router.use(authMiddleware);
router.use(adminMiddleware);

router.get('/users', getUsers);
router.get('/users/:nomUsu/companies', getUserCompanies);
router.put('/users/:nomUsu/companies', updateUserCompanies);

export default router;
