const fs = require('fs');
const path = require('path');

const helpers = {
  read: (filePath) => {
    try {
      return fs.readFileSync(filePath, 'utf8');
    } catch (err) {
      return `[Error reading ${filePath}: ${err.message}]`;
    }
  },
  print: console.log,
  exists: (filePath) => fs.existsSync(filePath),
  ls: (dirPath = '.') => {
    try {
      return fs.readdirSync(dirPath);
    } catch (err) {
      return [];
    }
  },
  json: (filePath) => {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (err) {
      return null;
    }
  }
};

global.use = (name) => {
  if (helpers[name]) {
    global[name] = helpers[name];
    return helpers[name];
  }
  throw new Error(`Helper '${name}' not found`);
};
