const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Cargar configuración actual para saber las rutas
let config = {
    sourceDir: "./textos",
    mountPoint: "./mnt/virtual",
    scriptsDir: "./scripts"
};

try {
    const configData = fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8');
    config = JSON.parse(configData);
} catch (e) {
    console.log("Usando config por defecto en el servidor");
}

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Endpoint para obtener la estructura de archivos
app.get('/api/files', (req, res) => {
    const getFiles = (dir) => {
        const absolutePath = path.resolve(__dirname, dir);
        if (!fs.existsSync(absolutePath)) return [];
        return fs.readdirSync(absolutePath).map(file => ({
            name: file,
            path: path.join(dir, file),
            type: fs.statSync(path.join(absolutePath, file)).isDirectory() ? 'dir' : 'file',
            category: dir
        }));
    };

    res.json({
        sourceFiles: getFiles(config.sourceDir),
        scriptFiles: getFiles(config.scriptsDir),
        workingFiles: getFiles(config.workingDir || '.')
    });
});

// Endpoint para obtener archivos del WORKING_DIR (soporta subcarpetas)
app.get('/api/working-files', (req, res) => {
    const subDir = req.query.subDir || '';
    const baseDir = config.workingDir || config.scriptsDir;
    const absolutePath = path.resolve(__dirname, baseDir, subDir);
    
    try {
        if (!fs.existsSync(absolutePath)) return res.json([]);
        
        const files = fs.readdirSync(absolutePath).map(file => {
            const stats = fs.statSync(path.join(absolutePath, file));
            return {
                name: file,
                path: path.join(subDir, file),
                type: stats.isDirectory() ? 'dir' : 'file'
            };
        });
        res.json(files);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Leer contenido de un archivo
app.get('/api/file', (req, res) => {
    const filePath = req.query.path;
    const absolutePath = path.resolve(__dirname, filePath);
    try {
        const content = fs.readFileSync(absolutePath, 'utf8');
        res.json({ content });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Guardar archivo
app.post('/api/save', (req, res) => {
    const { path: filePath, content } = req.body;
    const absolutePath = path.resolve(__dirname, filePath);
    try {
        fs.writeFileSync(absolutePath, content, 'utf8');
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Crear nuevo archivo
app.post('/api/create', (req, res) => {
    const { category, name } = req.body;
    const dir = category === 'source' ? config.sourceDir : config.scriptsDir;
    const absolutePath = path.resolve(__dirname, dir, name);
    try {
        if (fs.existsSync(absolutePath)) return res.status(400).json({ error: "El archivo ya existe" });
        fs.writeFileSync(absolutePath, '', 'utf8');
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Eliminar archivo
app.post('/api/delete', (req, res) => {
    const { path: filePath } = req.body;
    const absolutePath = path.resolve(__dirname, filePath);
    try {
        if (!fs.existsSync(absolutePath)) return res.status(404).json({ error: "No encontrado" });
        fs.unlinkSync(absolutePath);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Ver archivo PROCESADO (desde el punto de montaje)
app.get('/api/view', (req, res) => {
    const fileName = req.query.name;
    const mountPath = path.resolve(__dirname, config.mountPoint, fileName);
    try {
        if (!fs.existsSync(mountPath)) {
            return res.json({ content: "El archivo aún no está montado o no existe en mnt." });
        }
        const content = fs.readFileSync(mountPath, 'utf8');
        res.json({ content });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, () => {
    console.log(`Editor disponible en http://localhost:${PORT}`);
});
