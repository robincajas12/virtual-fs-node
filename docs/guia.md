# Virtual FS Node - Guía de Arquitectura Avanzada

Virtual FS Node ha evolucionado de un sistema de archivos simple a una **Plataforma de Diagnóstico Universal** desacoplada y asíncrona.

---

## 🏗 Arquitectura del Sistema

El procesamiento de archivos ahora sigue un flujo de trabajo modular basado en patrones de diseño industriales:

### 1. El Pipeline (Middleware)
Cada vez que se lee un archivo, el contenido pasa por una serie de middlewares:
- `loadContent`: Carga el Markdown original.
- `executeBlocks`: Detecta bloques de código y delega su ejecución.
- `transmuteHtml`: (Opcional) Convierte el Markdown en una página web si la extensión es `.html`.

### 2. Ejecutores (Strategy)
La lógica de ejecución está separada por tipos:
- **`NodeExecutor`**: Ejecuta JS moderno inyectando código vía `stdin`.
- **`ShellExecutor`**: Ejecuta comandos de sistema.
- **`ScriptExecutor`**: Lanza scripts predefinidos.

### 3. Decoradores (Decorator)
Añadimos capacidades sin tocar el código base de los ejecutores:
- **`LoggingDecorator`**: Mide y reporta tiempos de ejecución en consola.
- **`CacheDecorator`**: Gestiona el TTL (Time To Live) de los resultados.

---

## ⚡ Concurrencia y Rendimiento
A diferencia de las versiones anteriores, este sistema es **No Bloqueante**:
- Puedes abrir múltiples archivos pesados (con `sleep` o procesos largos) simultáneamente.
- El Sistema de Archivos seguirá respondiendo a comandos como `ls` o `getattr` mientras los procesos pesados corren de fondo.

---

## 🗄 Capa de Datos (Repository)
El sistema de caché es ahora intercambiable:
- **SQLite**: Persistencia garantizada entre reinicios.
- **Memory**: Velocidad máxima para desarrollo efímero.
- *Próximamente:* Soporte para Redis.

---

## 🪄 El concepto de "Sidecar Aumentado"
Los archivos `.super.md` ahora pueden actuar como sidecars de tus archivos `.js`.
- **Ejemplo:** `auth.js` puede tener un `auth.js.super.md` que verifique en tiempo real si el archivo tiene errores de linting, cobertura de tests o vulnerabilidades de seguridad, ofreciendo un contexto enriquecido a cualquier Agente IA que interactúe con él.
