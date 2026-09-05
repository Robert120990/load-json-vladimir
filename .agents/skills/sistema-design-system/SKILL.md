---
name: sistema-design-system
description: >-
  Guía completa de diseño, componentes UI, paleta de colores, estándares de navegación
  con Enter, reglas de búsqueda multi-token, y patrones visuales del sistema Módulo Tributario / Control IVA / Contabilidad.
---

# Sistema de Diseño y Estándares UI/UX (Módulo Tributario y Contabilidad)

Esta guía define las directrices oficiales de diseño, componentes, paleta cromática, patrones de interacción, captura de datos y estándares de experiencia de usuario para toda la aplicación. Todo desarrollador o agente de IA **DEBE** consultar y cumplir estas directrices antes de implementar cualquier nueva pantalla o refactorización.

---

## 1. Principios Fundamentales y Reglas de Idioma

- **Código Fuente**: Todo el código (variables, funciones, tipos, clases, nombres de archivos) debe escribirse estrictamente en **Inglés**.
- **Interfaz de Usuario**: Todos los textos visibles por el usuario (botones, etiquetas, modales, tablas, alertas, placeholders, breadcrumbs) deben estar en **Español**.
- **Estética Profesional**: Interfaces limpias, modernas, con estética corporativa tributaria/financiera, sombras suaves, micro-animaciones y glassmorphism sutil.

---

## 2. Paleta de Colores Oficial

### Colores Principales (Brand & Action)
- **Azul Primario (Acción Principal)**: `#2563eb` (`hover: #1d4ed8`, `active: #1e40af`)
- **Azul Neón / Acentos**: `#38bdf8` / `#60a5fa`
- **Degradado Corporativo**: `linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)`

### Fondos y Superficies
- **Sidebar & Dark Surfaces**: `#0f172a` (Base), `#1e293b` (Bordes/Hover), `#090d16` (Footer)
- **Fondo de Aplicación**: `#f8fafc`
- **Tarjetas y Modales**: `#ffffff` (Borde `#e2e8f0`, Sombra `0 10px 25px -5px rgba(15, 23, 42, 0.08)`)

### Estados y Semántica
- **Éxito (Success / Cuadrado)**: Texto `#065f46`, Fondo `#ecfdf5`, Borde `#10b981` / `#a7f3d0`
- **Error / Peligro (Danger / Descuadre)**: Texto `#991b1b`, Fondo `#fef2f2`, Borde `#ef4444` / `#fecaca`
- **Advertencia (Warning)**: Texto `#92400e`, Fondo `#fffbeb`, Borde `#f59e0b` / `#fde68a`
- **Información / Resumen**: Texto `#1e40af`, Fondo `#eff6ff`, Borde `#bfdbfe`

---

## 3. Estándar de Encabezados de Páginas y Listados Principales

Todas las páginas de listado (Clientes, Proveedores, Compras, Ventas, Partidas Contables, Catálogo de Cuentas, Carga JSON) deben compartir exactamente la misma estructura de cabecera y barra de herramientas:

```tsx
<div className="page-header-container">
  <div className="flex items-center justify-between gap-4 mb-6">
    {/* Título e Ícono */}
    <div className="flex items-center gap-3">
      <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
        <BookOpen size={24} />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Partidas Contables</h1>
        <p className="text-sm text-slate-500">Gestión de asientos de diario, ajustes y cierres contables</p>
      </div>
    </div>

    {/* Acciones Principales */}
    <div className="flex items-center gap-3">
      <button onClick={handleOpenModal} className="btn-primario btn-icon-gap">
        <Plus size={18} />
        <span>Nueva Partida</span>
      </button>
    </div>
  </div>

  {/* Barra de Filtros y Búsqueda */}
  <div className="filtros-card mb-6">
    <div className="search-box">
      <Search size={18} className="search-icon" />
      <input
        type="text"
        placeholder="Buscar por concepto, correlativo..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="search-input"
      />
    </div>
    <div className="registros-badge">
      <span>{filteredItems.length} registros</span>
    </div>
  </div>
</div>
```

### ❌ Anti-Patrones en Encabezados:
- **NO** crear barras de búsqueda flotantes sin el formato estándar `.filtros-card`.
- **NO** omitir el contador de registros encontrados.
- **NO** cambiar la posición de los botones de acción principal (siempre a la derecha superior).

---

## 4. Estándar de Tablas de Datos (`tabla-moderna`)

1. **Estructura**: Envolver siempre en `<div className="tabla-container-card">` con `<table className="tabla-moderna">`.
2. **Formato de Fechas**: **Obligatoriamente** `DD/MM/YYYY` (mediante `formatFechaDDMMYYYY`). Jamás mostrar `YYYY-MM-DD` o cadenas ISO crudas.
3. **Columnas Innecesarias**: **NO** incluir columnas redundantes (por ejemplo, columna "Estado: ACTIVO" si todos los registros están activos y no aporta valor visual).
4. **Valores Monetarios**: Siempre con clase `font-mono font-bold text-right` y formateados a dos decimales (`$0.00`).

---

## 5. Estándar de Modales y Formularios

Todos los modales deben utilizar estrictamente el componente global `<Modal>` (`frontend/src/components/ui/Modal.tsx`) con la estructura simétrica:

```tsx
<Modal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Título del Modal"
  maxWidth="3xl" // '2xl', '3xl', '4xl' según necesidad
>
  <form onSubmit={handleSubmit} onKeyDown={handleEnterNavigation} className="form-symmetrical">
    {/* Sección 1: Datos Generales */}
    <div className="form-section-title">1. Datos del Documento</div>
    <div className="form-grid-symmetrical cols-3">
      <div className="form-group">
        <label className="form-label">Fecha *</label>
        <input type="date" className="form-input" ... />
      </div>
      <div className="form-group">
        <label className="form-label">Correlativo / N° Partida</label>
        <input
          type="text"
          className="form-input font-mono font-bold input-readonly"
          disabled
          readOnly
          value={correlativo}
        />
      </div>
    </div>

    {/* Barra de Acciones */}
    <div className="modal-actions">
      <button type="button" className="btn-secundario" onClick={() => setIsOpen(false)}>
        Cancelar
      </button>
      <button type="submit" className="btn-primario btn-icon-gap">
        <CheckCircle2 size={16} />
        <span>Guardar</span>
      </button>
    </div>
  </form>
</Modal>
```

### ❌ Anti-Patrones en Modales:
- **NO** crear contenedores de modal manuales con `divs` crudos que provoquen botones desalineados o sombras fuera de lugar.
- **NO** dejar campos correlativos automáticos como inputs editables. Deben ser `disabled readOnly` con clase `input-readonly`.

---

## 6. Patrón de Captura Rápida vs Listado Acumulado (Partidas / Facturas Continuas)

Para formularios con ingreso de múltiples renglones (como Partidas Contables o Lotes de Facturas):

### 1. Barra Superior de Captura Rápida (`.partida-quick-entry-card`):
- Los campos de captura (`Cuenta Imputable`, `Concepto`, `Cargo/Debe`, `Abono/Haber` y botón `+ Agregar`) se ubican en **una sola fila superior compacta**.
- **Flujo de teclado**: Presionar <kbd>Enter</kbd> salta secuencialmente entre campos. Al presionar <kbd>Enter</kbd> en el último campo o botón de agregar, se inserta el renglón y el foco vuelve automáticamente al selector de cuenta.

### 2. Tabla Inferior de Renglones Acumulados (Texto Plano de Alta Densidad):
- **PROHIBIDO** incrustar inputs de formulario (`<input>`) en cada celda de la tabla acumulada.
- Los registros se muestran como **texto plano estilizado** en filas ultracompactas (`height: 28px`, `padding: 3px 10px`, clase `.tabla-renglones-compacta`).
- **Código y Nombre en la misma línea**: `[Código] - [Nombre de la Cuenta]` de forma horizontal compacta.
- Contenedor con scroll vertical (`max-height: 250px`, `overflow-y: auto`) para soportar partidas de 50 o más renglones con total fluidez.

---

## 7. Búsqueda Multi-Token e Insensible a Acentos

Todos los selectores con búsqueda (`SearchableSelect`, autocompletado de cuentas, clientes, proveedores, catálogos) deben cumplir con búsqueda inteligente por palabras clave múltiples en cualquier orden y sin importar acentos:

### Regla de Coincidencia Multi-Palabra:
- Si el usuario busca `"raul sosa"`, el sistema **debe encontrar** `"Raúl Rafael Sosa Castellanos"`.
- Utilizar la utilidad oficial `matchesSearchTokens`:

```ts
import { matchesSearchTokens } from '../../utils/searchUtils';

// En filtros y autocompletados:
const filtered = items.filter((item) =>
  matchesSearchTokens([item.nombre, item.codigo, item.nit, item.nrc], searchQuery)
);
```

### En el Backend:
Las consultas con parámetro `search` deben separar la cadena en palabras individuales (`split(/\s+/)`) y generar cláusulas `AND (...)` para cada palabra:

```ts
if (search && search.trim()) {
  const tokens = search.trim().split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    const term = `%${token}%`;
    conditions.push('(c.nom_cliente LIKE ? OR c.cod_cliente LIKE ? OR c.registro LIKE ?)');
    queryParams.push(term, term, term);
  }
}
```

---

## 8. Totales y Secciones de Balance Ligeras y Corporativas

- **PROHIBIDO** usar fondos negros pesados (`#0f172a`), cajas oscuras saturadas o colores neón invasivos en los totales de modales.
- Utilizar el diseño ligero corporativo (`.partida-balance-footer`):
  - Fondo claro `#f8fafc`, borde sutil `#e2e8f0`, tarjetas blancas `#ffffff` con etiquetas pequeñas uppercase.
  - Insignias tipo píldora suave (*soft pills*):
    - **Cuadrada**: Fondo `#ecfdf5`, borde `#a7f3d0`, texto `#047857`.
    - **Descuadrada**: Fondo `#fef2f2`, borde `#fecdd3`, texto `#b91c1c`.

---

## 9. Formato Estricto de Fechas y Moneda

- **Fechas en Tablas**: Siempre formateadas en formato estricto `DD/MM/YYYY` mediante `formatFechaDDMMYYYY()`.
- **Valores Monetarios**: Siempre alineados a la derecha con tipografía monospace (`font-mono font-bold`), prefijo `$`, y dos decimales (`minimumFractionDigits: 2`).

---

## 10. Navegación Continua con Tecla `Enter`

Todo formulario debe incluir `onKeyDown={handleEnterNavigation}`:
- Salto automático al siguiente campo interactivo seleccionando el texto.
- En botones `submit` o último campo, ejecuta el guardado directo.

