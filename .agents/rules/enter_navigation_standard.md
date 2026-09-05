---
description: Estándar de navegación continua con la tecla Enter en formularios
globs: frontend/src/**/*.tsx
---

# Estándar de Navegación Continua con Tecla Enter

Todos los formularios, modales y pantallas de captura de datos en el sistema deben soportar **navegación continua con la tecla `Enter`** entre campos:

1. **Comportamiento**:
   - Al presionar `Enter` en cualquier campo `input` o `select`, el foco debe avanzar automáticamente al siguiente campo visible y habilitado.
   - Si el siguiente campo es de texto/número, debe auto-seleccionar el texto existente para permitir sobreescritura rápida.
   - En campos multilínea (`textarea`), la tecla `Enter` inserta un salto de línea normal.
   - En el botón de envío (`submit` o `Guardar`), la tecla `Enter` ejecuta el guardado del formulario.

2. **Implementación**:
   - Utilizar la utilidad estándar `handleEnterNavigation` de `src/utils/formNavigation.ts`.
   - Asignar `onKeyDown={handleEnterNavigation}` en la etiqueta `<form>` o contenedor de campos.
