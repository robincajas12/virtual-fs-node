const path = require('path');

/**
 * Resolves a configuration path. If the path is relative, it resolves it relative to configDir.
 * @param {string} p The path to resolve.
 * @param {string} configDir The directory where the config file is located.
 * @returns {string} The resolved absolute path.
 */
const resolveConfigPath = (p, configDir) =>
  path.isAbsolute(p) ? p : path.resolve(configDir, p);

/**
 * Applies configuration settings from a config object.
 * @param {Object} config The configuration object (parsed from JSON).
 * @param {string} configDir The directory where the config file is located.
 * @param {Object} defaults Default values for SOURCE_DIR, MOUNT_POINT, SCRIPTS_DIR, WORKING_DIR.
 * @returns {Object} The updated configuration.
 */
function applyConfig(config, configDir, defaults) {
  let { SOURCE_DIR, MOUNT_POINT, SCRIPTS_DIR, WORKING_DIR } = defaults;

  if (config.sourceDir) SOURCE_DIR = resolveConfigPath(config.sourceDir, configDir);
  if (config.mountPoint) MOUNT_POINT = resolveConfigPath(config.mountPoint, configDir);
  if (config.scriptsDir) SCRIPTS_DIR = resolveConfigPath(config.scriptsDir, configDir);

  if (config.workingDir) {
    WORKING_DIR = resolveConfigPath(config.workingDir, configDir);
  } else {
    WORKING_DIR = SCRIPTS_DIR;
  }

  return { SOURCE_DIR, MOUNT_POINT, SCRIPTS_DIR, WORKING_DIR };
}

module.exports = {
  resolveConfigPath,
  applyConfig,
};
