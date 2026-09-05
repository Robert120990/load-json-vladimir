---
name: sistema-design-system
description: >-
  Guía completa de diseño, componentes UI, paleta de colores, estándares de navegación
  con Enter y patrones visuales del sistema Módulo Tributario / Control IVA.
---

# Sistema de Diseño y Estándares UI/UX (Módulo Tributario)

Esta guía define las directrices oficiales de diseño, componentes, paleta cromática, patrones de interacción y estándares de experiencia de usuario para toda la aplicación.

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
- **Éxito (Success)**: Texto `#065f46`, Fondo `#ecfdf5`, Borde `#10b981` / `#a7f3d0`
- **Error / Peligro (Danger)**: Texto `#991b1b`, Fondo `#fef2f2`, Borde `#ef4444` / `#fecaca`
- **Advertencia (Warning)**: Texto `#92400e`, Fondo `#fffbeb`, Borde `#f59e0b` / `#fde68a`
- **Información / Resumen**: Texto `#1e40af`, Fondo `#eff6ff`, Borde `#bfdbfe`

---

## 3. Estructura de Layout y Menú Lateral

### Menú Lateral Contraíble (Sidebar)
- **Ancho Expandido**: `260px`
- **Ancho Compacto**: `72px`
- **Transición**: `transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1)`
- **Modo Compacto**:
  - Los textos y encabezados de grupos se ocultan.
  - Los iconos se centran (`width: 44px, height: 44px`) y llevan `title={item.label}` para tooltips nativos.
- **Persistencia**: La preferencia se almacena en `localStorage.getItem('sidebar_collapsed')`.
- **Móvil (`max-width: 1024px`)**: Se transforma automáticamente en un cajón deslizante con fondo oscuro (`sidebar-backdrop`).

### Barra Superior (Topbar)
- **Altura fija**: `60px` sticky en la parte superior (`z-index: 20`).
- **Lado Izquierdo**: Botón menú móvil + Botón colapso escritorio (`desktop-sidebar-toggle-btn`) + Breadcrumb de navegación.
- **Lado Derecho**: Badge de Empresa activa (`topbar-empresa`) + Botón secundario Cerrar Sesión.

---

## 4. Estándar de Navegación Continua con Tecla `Enter`

Todo formulario o modal **debe implementar obligatoriamente** la navegación continua con `Enter`:

```tsx
import { handleEnterNavigation } from '../utils/formNavigation';

// En el formulario o contenedor:
<form onSubmit={handleSave} onKeyDown={handleEnterNavigation}>
  {/* Inputs y Selects */}
</form>
```

### Reglas de Navegación:
1. Al presionar `Enter` en cualquier `input` o `select`, el foco salta al siguiente campo editable y selecciona su texto para reemplazo rápido.
2. Los `textarea` mantienen su comportamiento normal (salto de línea).
3. En el último campo o botón de acción (`type="submit"`), `Enter` ejecuta el guardado directo.

---

## 5. Indicador de Versión y Estado Activo

Toda referencia a la versión del sistema (`VERSION_APP`) debe lucir tecnológica y llamativa:

### Estructura con Pulso Vivo (Live Dot):
```tsx
<div className="version-pill-badge" title={`Versión: ${VERSION_APP}`}>
  <span className="version-pulse-dot" />
  <span className="version-tag-text">VER</span>
  <span className="version-number-highlight">{VERSION_APP}</span>
</div>
```

- **Animación**: `@keyframes pulse-dot` con halo esmeralda continuo.
- **Gradiente**: Texto de versión con clip gradiente `#60a5fa` $\rightarrow$ `#38bdf8`.

---

## 6. Notificaciones Toast del Sistema

Las notificaciones deben ser limpias, ubicadas en la esquina superior derecha:

```tsx
<Toaster
  position="top-right"
  gutter={10}
  containerStyle={{ top: 20, right: 20 }}
  toastOptions={{
    duration: 4000,
    className: 'system-toast',
    style: {
      background: '#ffffff',
      color: '#0f172a',
      borderRadius: '12px',
      fontSize: '0.88rem',
      fontWeight: 500,
      padding: '12px 18px',
      border: '1px solid #e2e8f0',
      boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.12)',
    },
    success: {
      style: { border: '1px solid #bbf7d0', borderLeft: '4px solid #10b981' },
      iconTheme: { primary: '#10b981', secondary: '#ffffff' },
    },
    error: {
      style: { border: '1px solid #fecaca', borderLeft: '4px solid #ef4444' },
      iconTheme: { primary: '#ef4444', secondary: '#ffffff' },
    },
  }}
/>
```

---

## 7. Componentes Clave y Tablas de Datos

### Botones y Acciones
- `.btn-primario`: Fondo azul corporativo `#2563eb`, texto blanco, sombra sutil.
- `.btn-secundario`: Borde `#cbd5e1`, fondo blanco, texto `#334155`.
- `.header-actions`: Contenedor flexible `display: flex; gap: 12px; align-items: center; flex-wrap: wrap;`.

### Tablas Compactas (`.tabla-compacta`, `.tabla-anexo-mh`)
- Encabezados oscuros o gris neutro (`#0f172a` o `#f1f5f9`), texto en negrita y uppercase pequeño.
- Celdas con `white-space: nowrap !important;`, padding reducido `6px 10px`.
- Valores monetarios alineados a la derecha (`font-family: monospace; font-weight: 600;`).
