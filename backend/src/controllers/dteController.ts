import type { Request, Response } from 'express';
import multer from 'multer';
import { ApiError } from '../middlewares/error';
import * as companyService from '../services/companyService';
import * as dteService from '../services/dteService';
import type { TipoDte } from '../services/dteService';
import { asyncHandler } from '../utils/asyncHandler';
import { decodificarBuffer } from '../utils/decodificar';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 200, fileSize: 15 * 1024 * 1024 },
});

function parsearTipo(valor: unknown): TipoDte {
  if (valor !== 'ventas' && valor !== 'compras') {
    throw new ApiError(400, 'El parámetro tipo debe ser "ventas" o "compras"');
  }
  return valor;
}

export const subirArchivos = [
  upload.array('files'),
  asyncHandler(async (req: Request, res: Response) => {
    const usuario = req.usuario;
    if (!usuario) throw new ApiError(401, 'Sesión no válida');
    if (usuario.cod_emp === null) throw new ApiError(400, 'El usuario no tiene cod_emp asignado');

    const tipo = parsearTipo(req.body.tipo);
    const archivos = (req.files as Express.Multer.File[] | undefined) ?? [];

    if (archivos.length === 0) {
      throw new ApiError(400, 'No se recibieron archivos');
    }

    const empresa = await companyService.getEmpresaPorCodEmp(usuario.cod_emp);

    const items: dteService.DteSummary[] = archivos.map((archivo, indice) => {
      try {
        const contenido = decodificarBuffer(archivo.buffer);
        const dte = dteService.parseDte(contenido);
        if (!dteService.perteneceEmpresa(dte, empresa, tipo)) {
          return {
            ...dteService.construirResumen(dte, archivo.originalname, indice, tipo),
            pertenece: false,
          };
        }
        return dteService.construirResumen(dte, archivo.originalname, indice, tipo);
      } catch (err) {
        const mensaje = err instanceof SyntaxError
          ? 'El archivo no es un JSON válido'
          : 'El archivo no es un JSON DTE válido';
        return dteService.construirErrorResumen(archivo.originalname, indice, mensaje);
      }
    });

    res.json({ items });
  }),
];

export const validar = asyncHandler(async (req: Request, res: Response) => {
  const usuario = req.usuario;
  if (!usuario) throw new ApiError(401, 'Sesión no válida');
  if (usuario.cod_emp === null) throw new ApiError(400, 'El usuario no tiene cod_emp asignado');

  const tipo = parsearTipo(req.body?.tipo);
  const items = req.body?.items;

  if (!Array.isArray(items)) {
    throw new ApiError(400, 'El campo items es obligatorio');
  }

  const resultados = await dteService.validarItems(tipo, items, usuario.cod_emp);
  res.json({ resultados });
});

export const guardar = asyncHandler(async (req: Request, res: Response) => {
  const usuario = req.usuario;
  if (!usuario) throw new ApiError(401, 'Sesión no válida');
  if (usuario.cod_emp === null) throw new ApiError(400, 'El usuario no tiene cod_emp asignado');

  const tipo = parsearTipo(req.body?.tipo);
  const items = req.body?.items;

  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, 'No hay documentos para guardar');
  }

  const empresa = await companyService.getEmpresaPorCodEmp(usuario.cod_emp);
  const resultado = await dteService.guardarItems(tipo, items, usuario, empresa);
  res.json(resultado);
});
