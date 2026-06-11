# Virtual FS Node - Guía Completa del Sistema Híbrido

Virtual FS Node es un sistema de archivos virtual basado en FUSE que convierte tu documentación en una interfaz interactiva y ejecutable. Esta versión **Híbrida** permite fusionar tu código real con herramientas de diagnóstico dinámicas.

---

## 🚀 Conceptos Clave

El sistema funciona mezclando dos directorios físicos en un único punto de montaje virtual:

1.  **Directorio de Proyecto (`PROJECT_DIR`)**: Contiene tu código fuente real (`.js`, `.py`, `.md` normales, etc.).
2.  **Directorio de Fuente/Metadata (`SOURCE_DIR`)**: Contiene tus archivos de diagnóstico con la extensión `.super.md`.

---

## 🛠 Instalación y Uso

### Requisitos
- Node.js ≥ 14
- FUSE instalado en el sistema (`libfuse` en Linux, `macFUSE` en macOS).

### Inicio
```bash
node index.js <nombre_indice> <path_config.json>
```

---

## 🕹 Modos de Operación

Puedes alternar entre dos modos de trabajo en tiempo real usando el teclado de la terminal:

### 1. Modo EDICIÓN (`edit`) - Tecla [1] o [e]
- **Ideal para programar.**
- Todos los archivos son editables y visibles.
- Los archivos `.super.md` muestran su código fuente Markdown original.

### 2. Modo EJECUCIÓN (`exec`) - Tecla [2] o [x]
- **Ideal para diagnósticos.**
- Los archivos `.super.md` se vuelven **virtuales y de solo lectura**.
- Al leer un `.super.md`, el sistema ejecuta los bloques de código internos y devuelve el **resultado en vivo**.
- El resto del proyecto permanece editable.

---

## 📁 Gestión de Archivos Inteligente

El punto de montaje (`mnt/`) redirige automáticamente tus acciones según el tipo de archivo:

- **Crear/Editar `.super.md`**: Se guardan físicamente en `SOURCE_DIR`, manteniendo la estructura de subcarpetas.
- **Crear/Editar cualquier otro archivo**: Se guardan en `PROJECT_DIR`.
- **Operaciones soportadas**: `mkdir` (carpetas), `rename` (mover/renombrar), `unlink` (borrar archivos) y `rmdir` (borrar carpetas).

---

## 🧪 Ejemplo: Sincronización Server/Frontend

Puedes usar los `.super.md` para extraer información de una parte del proyecto y mostrarla en otra.

**Estructura:**
- `server/index.js` (Código del servidor)
- `frontend/type.js` (Definición de tipos)
- `server/index.js.super.md` (Diagnóstico)

**Bloque de código en el `.super.md`:**
````markdown
```run-node
const fs = require('fs');
const types = fs.readFileSync('frontend/type.js', 'utf8');
console.log('Firma de tipos detectada:\n' + types);
```
````
Al leer este archivo en modo **EXEC**, el servidor "verá" los tipos del frontend al instante.

---

## ⌨️ Controles de Teclado
- **`1`** o **`e`**: Cambiar a modo **EDICIÓN**.
- **`2`** o **`x`**: Cambiar a modo **EJECUCIÓN**.
- **`Ctrl+C`**: Desmontar sistema y salir de forma limpia.

---

## 📡 Gestión de Montajes
Si un montaje se bloquea, usa la herramienta incluida:
```bash
# Listar montajes
npm run manage-mounts list

# Cerrar todos los montajes de forma segura
npm run manage-mounts close-all
```
