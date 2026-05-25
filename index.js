#!/usr/bin/env node

const Fuse = require('fuse-native')
const path = require('path')
const fs = require('fs')
const { execSync } = require('child_process')

// --- ARGUMENTOS CLI ---
const args = process.argv.slice(2)
if (args.length < 2) {
  console.log('Uso: virtual-fs <index> <config_path>')
  process.exit(1)
}

const [INDEX, CONFIG_PATH] = args
console.log(`Iniciando con Index: ${INDEX} y Config Path: ${CONFIG_PATH}`)

// --- CONFIGURACIÓN POR DEFECTO ---
let SOURCE_DIR = path.join(__dirname, 'textos') 
let MOUNT_POINT = path.join(__dirname, 'mnt', INDEX)
let SCRIPTS_DIR = path.join(__dirname, 'scripts')
let WORKING_DIR = SCRIPTS_DIR // Por defecto los comandos corren en scripts/

// ---------------------

async function main() {
  // Intentar cargar configuración desde un archivo local
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      console.log(`[CONFIG] Cargando configuración desde ${CONFIG_PATH}...`)
      const configData = fs.readFileSync(CONFIG_PATH, 'utf8')
      const config = JSON.parse(configData)
      
      if (config.sourceDir) SOURCE_DIR = path.resolve(config.sourceDir)
      if (config.mountPoint) MOUNT_POINT = path.resolve(config.mountPoint)
      if (config.scriptsDir) SCRIPTS_DIR = path.resolve(config.scriptsDir)
      if (config.workingDir) WORKING_DIR = path.resolve(config.workingDir)
      else WORKING_DIR = SCRIPTS_DIR // Si no hay workingDir, usamos scriptsDir
      
      console.log('[CONFIG] Configuración aplicada exitosamente.')
    } catch (err) {
      console.warn(`[CONFIG] Error al leer el archivo de configuración: ${err.message}. Usando valores por defecto.`)
    }
  } else {
    console.log(`[CONFIG] No se encontró el archivo ${CONFIG_PATH}. Usando valores por defecto.`)
    WORKING_DIR = SCRIPTS_DIR
  }

  // Asegurar que existan los directorios
  try {
    if (!fs.existsSync(SOURCE_DIR)) fs.mkdirSync(SOURCE_DIR, { recursive: true })
    if (!fs.existsSync(MOUNT_POINT)) fs.mkdirSync(MOUNT_POINT, { recursive: true })
    if (!fs.existsSync(SCRIPTS_DIR)) fs.mkdirSync(SCRIPTS_DIR, { recursive: true })
    if (!fs.existsSync(WORKING_DIR)) fs.mkdirSync(WORKING_DIR, { recursive: true })
  } catch (err) {
    console.error('Error al crear directorios:', err.message)
    process.exit(1)
  }

  /**
   * Esta función es la que "corre los comandos"
   * Soporta dos tipos de bloques:
   * ```run ... ``` -> Corre en WORKING_DIR (ej: raíz del proyecto)
   * ```script ... ``` -> Corre en SCRIPTS_DIR (carpeta de scripts)
   */
  function processContent(filePath) {
    let content = fs.readFileSync(filePath, 'utf8')
    
    // 1. Procesar bloques ```run ... ``` (Soporta \n y \r\n)
    const runRegex = /```run\r?\n([\s\S]*?)\r?\n```/g
    content = content.replace(runRegex, (match, command) => {
      const trimmedCommand = command.trim()
      try {
        console.log(`[RUN] En ${path.basename(filePath)} (CWD: ${WORKING_DIR}): ${trimmedCommand}`)
        const output = execSync(trimmedCommand, { cwd: WORKING_DIR, timeout: 5000 }).toString()
        return output.trim()
      } catch (err) {
        return `[Error en RUN: ${err.message}]`
      }
    })

    // 2. Procesar bloques ```script ... ``` (Soporta \n y \r\n)
    const scriptRegex = /```script\r?\n([\s\S]*?)\r?\n```/g
    content = content.replace(scriptRegex, (match, command) => {
      const trimmedCommand = command.trim()
      try {
        console.log(`[SCRIPT] En ${path.basename(filePath)} (CWD: ${SCRIPTS_DIR}): ${trimmedCommand}`)
        const output = execSync(trimmedCommand, { cwd: SCRIPTS_DIR, timeout: 5000 }).toString()
        return output.trim()
      } catch (err) {
        return `[Error en SCRIPT: ${err.message}]`
      }
    })

    return content
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
    if (err) {
      console.error('Error al montar FUSE:', err)
      process.exit(1)
    }
    console.log('--- SISTEMA VIRTUAL DE COMANDOS ACTIVO ---')
    console.log(`Index: ${INDEX}`)
    console.log('1. Archivos fuente en: ' + SOURCE_DIR)
    console.log('2. Punto de montaje en: ' + MOUNT_POINT)
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
