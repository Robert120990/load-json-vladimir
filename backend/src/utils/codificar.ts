/**
 * Réplica de la función Codificar del sistema VISION (VB6).
 * Accion 0: codificar (cada carácter baja 1 en la tabla ASCII).
 * Accion 1: decodificar (cada carácter sube 1).
 * En la tabla usuarios, password_usu guarda el resultado con Accion 0.
 */
export function codificarPassword(valor: string, accion: 0 | 1 = 0): string {
  let resultado = '';
  for (const caracter of valor) {
    const codigo = caracter.charCodeAt(0) + (accion === 1 ? 1 : -1);
    resultado += String.fromCharCode(codigo);
  }
  return resultado;
}
