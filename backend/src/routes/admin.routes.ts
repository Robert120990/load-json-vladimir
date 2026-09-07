import { Router } from 'express';
import {
  createUser,
  deleteUser,
  getCompanies,
  getUserCompanies,
  getUsers,
  updateUser,
  updateUserCompanies,
} from '../controllers/adminController';
import * as companyAdminController from '../controllers/companyAdminController';
import { adminMiddleware } from '../middlewares/admin';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

// Todas las rutas de administración requieren autenticación y rol de Administrador
router.use(authMiddleware);
router.use(adminMiddleware);

// --- Usuarios ---
router.get('/users', getUsers);
router.post('/users', createUser);
router.put('/users/:nomUsu', updateUser);
router.delete('/users/:nomUsu', deleteUser);

// --- Asignación de Empresas a Usuarios ---
router.get('/companies', getCompanies);
router.get('/users/:nomUsu/companies', getUserCompanies);
router.put('/users/:nomUsu/companies', updateUserCompanies);

// --- CRUD de Empresas ---
router.get('/empresas', companyAdminController.getCompanies);
router.get('/empresas/:codEmp', companyAdminController.getCompanyById);
router.post('/empresas', companyAdminController.createCompany);
router.put('/empresas/:codEmp', companyAdminController.updateCompany);
router.delete('/empresas/:codEmp', companyAdminController.deleteCompany);

export default router;
