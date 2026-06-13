const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const cache = require('./cache');

/**
 * Processes the content of a file by executing code blocks.
 * @param {string} filePath Path to the file being read.
 * @param {Object} config Configuration object containing WORKING_DIR and SCRIPTS_DIR.
 * @returns {string} The processed content with command outputs.
 */
function processContent(filePath, config) {
  const { WORKING_DIR, SCRIPTS_DIR } = config;
  let content = fs.readFileSync(filePath, 'utf8');

  // New regex with optional TTL support (e.g., ```run-node:1h)
  const blockRegex = /```(run-node|run|script)(?::(\w+))?\r?\n([\s\S]*?)\r?\n```/g;

  content = content.replace(blockRegex, (match, type, ttl, command) => {
    // 1. Check Cache first
    if (ttl) {
      const cachedResult = cache.get(filePath, command);
      if (cachedResult !== null) {
        console.log(`[CACHE HIT] ${type}:${ttl} en ${path.basename(filePath)}`);
        return cachedResult;
      }
    }

    // 2. Execution Logic
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

      // 3. Save to Cache if TTL is present
      if (ttl) {
        cache.set(filePath, command, result, ttl);
      }

      return result;
    } catch (err) {
      return `[Error en ${type.toUpperCase()}: ${err.message}]`;
    }
  });

  return content;
}

module.exports = {
  processContent
};
