#!/usr/bin/env node

const Fuse = require('fuse-native')
const path = require('path')
const fs = require('fs')
const { applyConfig } = require('./lib/config')
const { processContent } = require('./lib/processor')

// --- ARGUMENTOS CLI ---
const args = process.argv.slice(2)
if (args.length < 2) {
  console.log('Uso: virtual-fs <index> <config_path>')
  process.exit(1)
}

const [INDEX, CONFIG_PATH] = args
console.log(`Iniciando con Index: ${INDEX} y Config Path: ${CONFIG_PATH}`)

// --- CONFIGURACIÓN POR DEFECTO ---
let CONFIG = {
  SOURCE_DIR: path.join(__dirname, 'textos'),
  MOUNT_POINT: path.join(__dirname, 'mnt', INDEX),
  SCRIPTS_DIR: path.join(__dirname, 'scripts'),
  WORKING_DIR: path.join(__dirname, 'scripts')
}

// ---------------------

async function main() {
  // Intentar cargar configuración desde un archivo local
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      console.log(`[CONFIG] Cargando configuración desde ${CONFIG_PATH}...`)
      const configData = fs.readFileSync(CONFIG_PATH, 'utf8')
      const userConfig = JSON.parse(configData)
      const configDir = path.dirname(path.resolve(CONFIG_PATH))

      CONFIG = applyConfig(userConfig, configDir, CONFIG)
      
      console.log('[CONFIG] Configuración aplicada exitosamente.')
    } catch (err) {
      console.warn(`[CONFIG] Error al leer el archivo de configuración: ${err.message}. Usando valores por defecto.`)
    }
  } else {
    console.log(`[CONFIG] No se encontró el archivo ${CONFIG_PATH}. Usando valores por defecto.`)
  }

  // Asegurar que existan los directorios
  try {
    Object.values(CONFIG).forEach(dir => {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    })
  } catch (err) {
    console.error('Error al crear directorios:', err.message)
    process.exit(1)
  }

  const ops = {
    readdir: function (dirPath, cb) {
      if (dirPath === '/') {
        fs.readdir(CONFIG.SOURCE_DIR, (err, files) => {
          if (err) return cb(Fuse.ENOENT)
          return cb(0, files)
        })
      } else {
        return cb(Fuse.ENOENT)
      }
    },

    getattr: function (filePath, cb) {
      const fullPath = path.join(CONFIG.SOURCE_DIR, filePath)
      if (filePath === '/') {
        return cb(null, { mtime: new Date(), atime: new Date(), ctime: new Date(), mode: 16877, size: 4096, uid: process.getuid(), gid: process.getgid() })
      }

      if (fs.existsSync(fullPath)) {
        const stats = fs.statSync(fullPath)
        if (stats.isDirectory()) return cb(null, { ...stats, mode: 16877 })

        const processed = processContent(fullPath, CONFIG)
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
      const fullPath = path.join(CONFIG.SOURCE_DIR, filePath)
      if (fs.existsSync(fullPath)) {
        const processed = processContent(fullPath, CONFIG)
        const buffer = Buffer.from(processed)
        const part = buffer.slice(pos, pos + len)
        part.copy(buf)
        return cb(part.length)
      }
      return cb(Fuse.ENOENT)
    }
  }

  const fuse = new Fuse(CONFIG.MOUNT_POINT, ops, { debug: false, displayFolder: true, nonempty: true })

  fuse.mount(err => {
    if (err) {
      console.error('Error al montar FUSE:', err)
      process.exit(1)
    }
    console.log('--- SISTEMA VIRTUAL DE COMANDOS ACTIVO ---')
    console.log(`Index: ${INDEX}`)
    console.log('1. Archivos fuente en: ' + CONFIG.SOURCE_DIR)
    console.log('2. Punto de montaje en: ' + CONFIG.MOUNT_POINT)
    console.log('-------------------------------------------')
  })

  const exit = () => {
    console.log('\nDesmontando y saliendo...')
    fuse.unmount(() => process.exit())
  }
  process.on('SIGINT', exit)
  process.on('SIGTERM', exit)
}

main().catch(err => {
  console.error('Error crítico:', err)
  process.exit(1)
})
