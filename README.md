# Sistema de Carga de DTE (JSON) — compras_iva y ventas_iva

Sistema web para cargar archivos JSON de DTE (formato Ministerio de Hacienda de El Salvador) en un sistema existente con MySQL. Backend en Node.js (Express + TypeScript) y frontend en React (Vite + TypeScript).

## Requisitos

- Node.js 18 o superior
- MySQL con las tablas ya existentes: `compras_iva`, `ventas_iva`, `usuarios`, `empresas`, `clientes`, `proveedores`

## Configuración

### Backend (`backend/`)

1. Copiar `.env.example` a `.env` y configurar:

```
PORT=4000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASS=
DB_NAME=nombre_de_base
JWT_SECRET=clave_secreta_para_firmar_tokens
```

2. Instalar y ejecutar:

```bash
npm install
npm run dev        # http://localhost:4000
```

### Frontend (`frontend/`)

```bash
npm install
npm run dev        # http://localhost:5173  (proxy /api -> localhost:4000)
```

## Uso

1. Ingresar con usuario y contraseña del sistema existente (la contraseña se compara usando la misma función `Codificar` del sistema VISION: cada carácter desplazado -1 en ASCII, no usa hash).
2. En el inicio elegir **Carga de Ventas** o **Carga de Compras**.
3. **Arrastrar la carpeta** con los JSON de DTE sobre la zona indicada (o usar **Elegir archivos** para seleccionarlos).
4. Confirmar la carga con el modal personalizado: se listan los archivos con su resumen (tipo, fecha, NIT/NRC de la contraparte, monto) y se valida que el DTE pertenezca a la empresa configurada:
   - **Ventas**: el `emisor.nit/nrc` del JSON debe coincidir con la empresa del usuario.
   - **Compras**: el `receptor.nit/nrc` del JSON debe coincidir con la empresa del usuario.
5. Pulsar **Validar**: verifica si el DTE ya existe (mismo `cod_emp` + `codigoGeneracion`) y si el cliente (`clientes.nit_cliente`/`registro`) o proveedor (`proveedores.nit_proveedo`/`registro`) existe.
6. El usuario decide **Guardar válidos** o **Cancelar carga**.

## Mapeo de campos (JSON → tablas)

| Concepto | Fuente en el JSON |
|---|---|
| `llave` | Código único con formato `{cod_emp}WCP{correlativo}` (correlativo de 7 dígitos del SP `devolver_correlativo_compra`) |
| `fecha` | `identificacion.fecEmi` |
| `id_tipo_documento` | `identificacion.tipoDte` |
| `documento` | `codigoGeneracion` |
| `cod_cliente` / `cod_proveedor` | `receptor.nit` / `emisor.nit` (fallback `nrc`) |
| gravadas / exentas / no_sujetas | `resumen.totalGravada` / `totalExenta` / `totalNoSuj` (en compras, a `gravadas_locales` se le suma el descuento para guardar el valor bruto antes de rebajas) |
| debito/credito fiscal | Tributo IVA (`codigo: "20"`) en `resumen.tributos` |
| `iva_retenido` / `iva_percibido` | `resumen.ivaRete1` / `resumen.ivaPerci1` |
| `rebajas_y_devoluciones` | `resumen.totalDescu` (suma de descuentos aplicados a la compra) |
| `serie` (ventas) / `sello_recepcion` (compras) | `selloRecibido` del JSON |
| `num_control` | `identificacion.numeroControl` |
| `id_sucursal` / `cod_sucursal` | `'01'` fijo |
| `periodo_ano` / `periodo_mes` (compras) | Tabla `periodo_compras` según `cod_emp` de la empresa (si no hay registro, no se habilita la carga) |
| `cod_punto_venta` (compras) | `emisor.codPuntoVenta` |
| columnas de importaciones/internaciones, terceros, etc. | `0` |

## Comandos útiles

- `npm run dev` — servidor de desarrollo (backend: tsx watch; frontend: vite)
- `npm run typecheck` — verificación de tipos
- `npm run build` — compilación de producción (backend → `dist/`, frontend → `dist/`)

## Despliegue con Docker (auto-deploy en push)

El repo incluye `Dockerfile` para backend y frontend, `docker-compose.yml` y un workflow de GitHub Actions (`.github/workflows/deploy.yml`) que hace build + push a GHCR (ghcr.io) + redeploy automático en el VPS con cada push a `main`.

### Setup del VPS (una sola vez)

1. Instalar Docker y el plugin compose en el VPS (Linux).
2. Crear el directorio y el archivo de entorno:

```bash
mkdir -p ~/load-json-vladimir
cd ~/load-json-vladimir
nano .env
```

Contenido del `.env` (nunca subirlo al repo):

```
DB_HOST=<host_mysql>
DB_PORT=3306
DB_USER=<usuario>
DB_PASS=<password>
DB_NAME=<base>
JWT_SECRET=<secreto>
```

3. Descargar el `docker-compose.yml` del repo y hacer el primer despliegue manual:

```bash
curl -O https://raw.githubusercontent.com/Robert120990/load-json-vladimir/main/docker-compose.yml
docker compose pull
docker compose up -d
```

La app queda en `http://<IP_del_VPS>:5173` (puerto configurable en `docker-compose.yml`). El backend se comunica con el MySQL externo por variables de entorno.

### Secrets de GitHub (para el auto-deploy)

En GitHub → repo → Settings → Secrets and variables → Actions:

- `SSH_HOST` — IP o dominio del VPS
- `SSH_USER` — usuario SSH
- `SSH_PRIVATE_KEY` — clave privada SSH (del par que tenga acceso al VPS)

### Flujo

Cada `git push` a `main` dispara: build de las imágenes → push a `ghcr.io/robert120990/load-json-vladimir/{backend,frontend}:latest` → SSH al VPS → `docker compose pull && docker compose up -d`.

### Ejecución local con Docker

```bash
docker compose build
docker compose up -d
# App en http://localhost:5173
```

