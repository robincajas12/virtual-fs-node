const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Processes the content of a file by executing code blocks.
 * @param {string} filePath Path to the file being read.
 * @param {Object} config Configuration object containing WORKING_DIR and SCRIPTS_DIR.
 * @returns {string} The processed content with command outputs.
 */
function processContent(filePath, config) {
  const { WORKING_DIR, SCRIPTS_DIR } = config;
  let content = fs.readFileSync(filePath, 'utf8');

  // Strict regex patterns as per user requirement
  const runNodeRegex = /```run-node\r?\n([\s\S]*?)\r?\n```/g;
  const runRegex = /```run\r?\n([\s\S]*?)\r?\n```/g;
  const scriptRegex = /```script\r?\n([\s\S]*?)\r?\n```/g;

  // 1. Process run-node blocks (Safe execution via stdin)
  content = content.replace(runNodeRegex, (match, command) => {
    try {
      console.log(`[RUN-NODE] En ${path.basename(filePath)} (CWD: ${WORKING_DIR})`);
      // Use input option to pass code directly to node stdin
      const output = execSync('node', { 
        input: command.trim(), 
        cwd: WORKING_DIR, 
        timeout: 5000 
      }).toString();
      return output.trim();
    } catch (err) {
      return `[Error en RUN-NODE: ${err.message}]`;
    }
  });

  // 2. Process run blocks
  content = content.replace(runRegex, (match, command) => {
    try {
      console.log(`[RUN] En ${path.basename(filePath)} (CWD: ${WORKING_DIR})`);
      const output = execSync(command.trim(), { cwd: WORKING_DIR, timeout: 5000 }).toString();
      return output.trim();
    } catch (err) {
      return `[Error en RUN: ${err.message}]`;
    }
  });

  // 3. Process script blocks
  content = content.replace(scriptRegex, (match, command) => {
    try {
      console.log(`[SCRIPT] En ${path.basename(filePath)} (CWD: ${SCRIPTS_DIR})`);
      const output = execSync(command.trim(), { cwd: SCRIPTS_DIR, timeout: 5000 }).toString();
      return output.trim();
    } catch (err) {
      return `[Error en SCRIPT: ${err.message}]`;
    }
  });

  return content;
}

module.exports = {
  processContent
};
