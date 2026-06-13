const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const cache = require('./cache');
const { marked } = require('marked');

/**
 * Processes the content of a file by executing code blocks and optionally transmuting format.
 * @param {string} filePath Path to the physical file being read.
 * @param {Object} config Configuration object.
 * @param {string} virtualPath The path as seen in the VFS (e.g., report.super.html).
 * @returns {string} The processed content.
 */
function processContent(filePath, config, virtualPath = '') {
  const { WORKING_DIR, SCRIPTS_DIR } = config;
  let content = fs.readFileSync(filePath, 'utf8');

  // Regex para bloques con TTL (ej: ```run-node:1h)
  const blockRegex = /```(run-node|run|script)(?::(\w+))?\r?\n([\s\S]*?)\r?\n```/g;

  content = content.replace(blockRegex, (match, type, ttl, command) => {
    // 1. Verificar Caché
    if (ttl) {
      const cachedResult = cache.get(filePath, command);
      if (cachedResult !== null) {
        console.log(`[CACHE HIT] ${type}:${ttl} en ${path.basename(filePath)}`);
        return cachedResult;
      }
    }

    // 2. Ejecución
    let result = '';
    try {
      if (type === 'run-node') {
        console.log(`[RUN-NODE] En ${path.basename(filePath)} (CWD: ${WORKING_DIR})`);
        const wrappedCode = `(async () => {\n${command}\n})().catch(err => { console.error(err); process.exit(1); });`;
        const corePath = path.resolve(__dirname, 'core.js');
        result = execSync(`node --require "${corePath}"`, {
          input: wrappedCode,
          cwd: WORKING_DIR,
          timeout: 5000
        }).toString().trim();
      } else if (type === 'run') {
        console.log(`[RUN] En ${path.basename(filePath)} (CWD: ${WORKING_DIR})`);
        result = execSync(command.trim(), { cwd: WORKING_DIR, timeout: 5000 }).toString().trim();
      } else if (type === 'script') {
        console.log(`[SCRIPT] En ${path.basename(filePath)} (CWD: ${SCRIPTS_DIR})`);
        result = execSync(command.trim(), { cwd: SCRIPTS_DIR, timeout: 5000 }).toString().trim();
      }

      // 3. Guardar en Caché
      if (ttl) {
        cache.set(filePath, command, result, ttl);
      }

      return result;
    } catch (err) {
      return `[Error en ${type.toUpperCase()}: ${err.message}]`;
    }
  });

  // 4. Transmutación (Opcional)
  // Si el usuario está leyendo el archivo con una extensión distinta (ej: .html)
  if (virtualPath.endsWith('.html')) {
    console.log(`[TRANSMUTE] Markdown -> HTML: ${virtualPath}`);
    return `
      <html>
        <head>
          <style>
            body { font-family: sans-serif; padding: 40px; line-height: 1.6; max-width: 800px; margin: 0 auto; background: #f4f4f9; }
            pre { background: #2d2d2d; color: #ccc; padding: 15px; border-radius: 5px; overflow-x: auto; }
            code { font-family: monospace; }
            h1 { color: #333; border-bottom: 2px solid #ddd; padding-bottom: 10px; }
          </style>
        </head>
        <body>
          ${marked.parse(content)}
        </body>
      </html>
    `;
  }

  return content;
}

module.exports = {
  processContent
};
