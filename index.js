const Fuse = require('fuse-native')
const path = require('path')
const fs = require('fs')
const { execSync } = require('child_process')

// --- CONFIGURACIÓN ---
const SOURCE_DIR = path.join(__dirname, 'textos') 
const MOUNT_POINT = path.join(__dirname, 'mnt')
// ---------------------

if (!fs.existsSync(SOURCE_DIR)) fs.mkdirSync(SOURCE_DIR, { recursive: true })
if (!fs.existsSync(MOUNT_POINT)) fs.mkdirSync(MOUNT_POINT, { recursive: true })

/**
 * Esta función es la que "corre los comandos"
 * Busca bloques ```execute ... ``` y los reemplaza por su salida
 */
function processContent(filePath) {
  let content = fs.readFileSync(filePath, 'utf8')
  const regex = /```execute\n([\s\S]*?)\n```/g
  
  return content.replace(regex, (match, command) => {
    const trimmedCommand = command.trim()
    try {
      console.log(`[EJECUTANDO] En ${path.basename(filePath)}: ${trimmedCommand}`)
      // Ejecutamos el comando y devolvemos el resultado
      const output = execSync(trimmedCommand, { cwd: __dirname, timeout: 5000 }).toString()
      return output.trim()
    } catch (err) {
      return `[Error al ejecutar: ${err.message}]`
    }
  })
}

const ops = {
  readdir: function (dirPath, cb) {
    if (dirPath === '/') {
      fs.readdir(SOURCE_DIR, (err, files) => {
        if (err) return cb(Fuse.ENOENT)
        return cb(0, files)
      })
    } else {
      return cb(Fuse.ENOENT)
    }
  },

  getattr: function (filePath, cb) {
    const fullPath = path.join(SOURCE_DIR, filePath)
    if (filePath === '/') {
      return cb(null, { mtime: new Date(), atime: new Date(), ctime: new Date(), mode: 16877, size: 4096, uid: process.getuid(), gid: process.getgid() })
    }
    
    if (fs.existsSync(fullPath)) {
      const stats = fs.statSync(fullPath)
      if (stats.isDirectory()) return cb(null, { ...stats, mode: 16877 })

      // Calculamos el tamaño del archivo YA PROCESADO
      const processed = processContent(fullPath)
      const size = Buffer.byteLength(processed)
      
      return cb(null, {
        mtime: stats.mtime,
        atime: stats.atime,
        ctime: stats.ctime,
        mode: 33188,
        size: size,
        uid: process.getuid(),
        gid: process.getgid()
      })
    }
    return cb(Fuse.ENOENT)
  },

  read: function (filePath, fd, buf, len, pos, cb) {
    const fullPath = path.join(SOURCE_DIR, filePath)
    if (fs.existsSync(fullPath)) {
      const processed = processContent(fullPath)
      const buffer = Buffer.from(processed)
      const part = buffer.slice(pos, pos + len)
      part.copy(buf)
      return cb(part.length)
    }
    return cb(Fuse.ENOENT)
  }
}

const fuse = new Fuse(MOUNT_POINT, ops, { debug: false, displayFolder: true, nonempty: true })

fuse.mount(err => {
  if (err) throw err
  console.log('--- SISTEMA VIRTUAL DE COMANDOS ACTIVO ---')
  console.log('1. Pon tus archivos (.md, .txt, etc.) en: ' + SOURCE_DIR)
  console.log('2. Mira el resultado en: ' + MOUNT_POINT)
  console.log('-------------------------------------------')
})

const exit = () => fuse.unmount(() => process.exit())
process.on('SIGINT', exit)
process.on('SIGTERM', exit)
