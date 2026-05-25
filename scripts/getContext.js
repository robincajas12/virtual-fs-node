const fs = require('fs');
const path = require('path');

// Simula obtener información relevante del proyecto
const packageJson = JSON.parse(fs.readFileSync('../package.json', 'utf8'));
const files = fs.readdirSync('..').filter(f => !f.startsWith('.'));

console.log(`Proyecto: ${packageJson.name} (v${packageJson.version})`);
console.log(`Archivos principales detectados: ${files.join(', ')}`);
console.log(`Dependencia clave: ${Object.keys(packageJson.dependencies)[0]}`);
