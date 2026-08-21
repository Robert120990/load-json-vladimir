# Migración de unificación de catálogos

Script para unificar los catálogos de `clientes` y `proveedores` en un único catálogo global para todas las empresas.

## Uso

Desde `backend/`:

```bash
node migrations/unificar_catalogo.js --reporte     # vista previa (NO modifica nada)
node migrations/unificar_catalogo.js --aplicar     # ejecuta la migración (pide confirmación)
node migrations/unificar_catalogo.js --verificar   # controles post-migración
```

La configuración de la base de datos se lee del archivo `backend/.env`.

## Reglas de unificación

1. **Llave maestra**: NIT normalizado (sin guiones ni espacios) → si no hay NIT válido, se usa el registro (NRC) normalizado → si no hay ninguno, la fila se conserva separada con un código nuevo único.
2. **Superviviente del grupo**: la fila con más campos completos (nombre, dirección, teléfono); desempate por menor `cod_emp` y menor `corr`. Los campos vacíos del superviviente se rellenan con datos de otras filas del grupo.
3. **Conflictos de código**: si un mismo `cod_cliente`/`cod_proveedor` es usado por entidades distintas, el grupo con menor `cod_emp` conserva el código y el otro recibe un código nuevo único (`######-0`).
4. La columna `cod_emp` del catálogo conserva el valor del superviviente (solo referencia).

## Qué hace `--aplicar`

1. Crea backups automáticos: `clientes_bkp_<fecha>`, `proveedores_bkp_<fecha>`, `ventas_iva_bkp_<fecha>`, `compras_iva_bkp_<fecha>`.
2. Reemplaza el catálogo por las filas unificadas (en transacción).
3. **Remapea** las referencias de `ventas_iva.cod_cliente` y `compras_iva.cod_proveedor` (clave `cod_emp viejo + código viejo → código nuevo`).
4. Agrega índices únicos: código, NIT normalizado y registro normalizado (los valores placeholder se indexan como NULL para no colisionar).

## Notas

- **Otras tablas** (`estado_cuenta`, `busqueda_compras_iva`, etc.) que referencian estos códigos **no se remapean**; el `--reporte` muestra cuántas filas de cada una quedan afectadas para evaluación futura.
- El `--reporte` genera archivos en `backend/migrations/reportes/` (JSON completo + resumen TXT).
- Antes de `--aplicar`, ten un respaldo completo (`mysqldump`).
