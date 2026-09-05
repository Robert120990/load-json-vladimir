declare namespace Express {
  interface Request {
    usuario?: {
      cod_usu: number;
      nom_usu: string;
      cod_emp: number | null;
      isAdmin?: boolean;
    };
  }
}
