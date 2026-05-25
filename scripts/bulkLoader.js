const fs = require('fs');
const path = require('path');

/**
 * Script para resumir o inyectar múltiples archivos de una carpeta
 */
const targetDir = '../textos';
const files = fs.readdirSync(targetDir);

files.forEach(file => {
    if (file.endsWith('.md') || file.endsWith('.txt')) {
        const content = fs.readFileSync(path.join(targetDir, file), 'utf8');
        console.log(`--- ARCHIVO: ${file} ---`);
        // Inyectamos solo las primeras 10 líneas para que no sea tan pesado si son muchos
        const lines = content.split('\n').slice(0, 10).join('\n');
        console.log(lines);
        console.log(`\n[... rest of ${file} omitted for brevity ...]\n`);
    }
});
