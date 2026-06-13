#!/usr/bin/env node

const Fuse = require("fuse-native")
const path = require("path")
const fs = require("fs")
const readline = require("readline")
const { processContent } = require("./lib/processor")
const cache = require("./lib/cache")

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

const args = process.argv.slice(2)
if (args.length < 1) {
  console.log("Uso: node index.js <project_dir>")
  process.exit(1)
}

const PROJECT_ROOT = path.resolve(args[0])
const SUPER_MD_DIR = path.join(PROJECT_ROOT, ".super_md")
const CONFIG_PATH = path.join(SUPER_MD_DIR, "config.json")

let CONFIG = {
  SOURCE_DIR: path.join(SUPER_MD_DIR, "archives"),
  PROJECT_DIR: PROJECT_ROOT,
  MOUNT_POINT: "",
  SCRIPTS_DIR: path.join(SUPER_MD_DIR, "scripts"),
  WORKING_DIR: PROJECT_ROOT,
  IGNORE_LIST: ["node_modules", ".git", ".super_md", "mnt"]
}

let MODE = "edit"
const openHandles = new Map()

async function start() {
  // 1. Asegurar que exista .super_md
  if (!fs.existsSync(SUPER_MD_DIR)) {
    fs.mkdirSync(SUPER_MD_DIR, { recursive: true })
  }

  // Inicializar Caché SQLite
  cache.initCache(PROJECT_ROOT);

  // 2. Cargar o crear Config
  if (fs.existsSync(CONFIG_PATH)) {
    const data = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"))
    CONFIG.MOUNT_POINT = data.mountPoint || ""
  }

  if (!CONFIG.MOUNT_POINT) {
    CONFIG.MOUNT_POINT = await new Promise(resolve => {
      rl.question(`No se encontró punto de montaje para este proyecto.\nEscribe la ruta donde quieres montar el VFS: `, (answer) => {
        resolve(path.resolve(answer))
      })
    })
    fs.writeFileSync(CONFIG_PATH, JSON.stringify({ mountPoint: CONFIG.MOUNT_POINT }, null, 2))
    console.log(`Configuración guardada en: ${CONFIG_PATH}`)
  }

  // 3. Asegurar subcarpetas
  [CONFIG.SOURCE_DIR, CONFIG.SCRIPTS_DIR, CONFIG.MOUNT_POINT].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  })

  main()
}

function main() {
  const SUPER_SUFFIX = ".super.md"
  const isSuperFile = (p) => p.endsWith(SUPER_SUFFIX)
  const isTransmutable = (p) => p.match(/\.super\.\w+\.md$/)

  function getRealFilePath(filePath) {
    let relative = filePath.startsWith("/") ? filePath.slice(1) : filePath
    
    // Si la ruta virtual no termina en .md pero contiene .super., 
    // es una señal de que es un archivo transmutado (ej: reporte.super.html)
    if (!relative.endsWith(".md") && relative.includes(".super.")) {
      const transmutablePath = relative + ".md"
      const sPath = path.join(CONFIG.SOURCE_DIR, transmutablePath)
      if (fs.existsSync(sPath)) return sPath
    }

    if (isSuperFile(relative) || isTransmutable(relative)) {
      return path.join(CONFIG.SOURCE_DIR, relative)
    }
    return path.join(CONFIG.PROJECT_DIR, relative)
  }

  const ops = {
    readdir: (dirPath, cb) => {
      let relative = dirPath.startsWith("/") ? dirPath.slice(1) : dirPath
      const pPath = path.join(CONFIG.PROJECT_DIR, relative)
      const sPath = path.join(CONFIG.SOURCE_DIR, relative)
      const entries = new Set()
      if (dirPath === "/" || dirPath === "") entries.add(".mode")
      
      try {
        if (fs.existsSync(pPath)) {
          fs.readdirSync(pPath).forEach(f => {
            if (relative === "" && CONFIG.IGNORE_LIST.includes(f)) return
            entries.add(f)
          })
        }
      } catch (e) {}
      
      try {
        if (fs.existsSync(sPath)) {
          fs.readdirSync(sPath).forEach(f => {
            if (MODE === "exec" && isTransmutable(f)) {
              // Transmuta: reporte.super.html.md -> reporte.super.html
              entries.add(f.replace(/\.md$/, ""))
            } else if (isSuperFile(f) || isTransmutable(f)) {
              entries.add(f)
            }
          })
        }
      } catch (e) {}
      cb(0, Array.from(entries))
    },

    getattr: (filePath, cb) => {
      if (filePath === "/.mode" || filePath === ".mode") {
        return cb(null, { mtime: new Date(), atime: new Date(), ctime: new Date(), mode: 33188, size: 10, uid: process.getuid(), gid: process.getgid() })
      }
      const relative = filePath.startsWith("/") ? filePath.slice(1) : filePath
      
      // Mapeo para archivos transmutados en modo EXEC
      let mappedRelative = relative
      if (MODE === "exec" && !relative.endsWith(".md") && relative.includes(".super.")) {
        mappedRelative = relative + ".md"
      }

      const sPath = path.join(CONFIG.SOURCE_DIR, mappedRelative)
      const pPath = path.join(CONFIG.PROJECT_DIR, mappedRelative)
      
      let realPath = ((isSuperFile(mappedRelative) || isTransmutable(mappedRelative)) && fs.existsSync(sPath)) 
        ? sPath 
        : (fs.existsSync(pPath) ? pPath : null)
      
      if (realPath) {
        try {
          const stats = fs.statSync(realPath)
          if (stats.isDirectory()) return cb(null, stats)
          return cb(null, { ...stats, size: 1024 * 1024 })
        } catch (e) { return cb(Fuse.EIO) }
      }
      cb(Fuse.ENOENT)
    },

    open: (filePath, flags, cb) => {
      if (filePath === "/.mode" || filePath === ".mode") return cb(0, 42)
      
      const realPath = getRealFilePath(filePath)
      const relative = filePath.startsWith("/") ? filePath.slice(1) : filePath

      if (MODE === "exec" && (isSuperFile(realPath) || isTransmutable(realPath))) {
        const content = processContent(realPath, CONFIG, relative)
        openHandles.set(filePath, Buffer.from(content))
      }
      cb(0, 42)
    },

    read: (filePath, fd, buf, len, pos, cb) => {
      if (filePath === "/.mode" || filePath === ".mode") {
        const part = Buffer.from(MODE + "\n").slice(pos, pos + len)
        part.copy(buf); return cb(part.length)
      }
      if (openHandles.has(filePath)) {
        const part = openHandles.get(filePath).slice(pos, pos + len)
        part.copy(buf); return cb(part.length)
      }
      try {
        const fdReal = fs.openSync(getRealFilePath(filePath), "r")
        const bytesRead = fs.readSync(fdReal, buf, 0, len, pos)
        fs.closeSync(fdReal); return cb(bytesRead)
      } catch (e) { cb(Fuse.EIO) }
    },

    write: (filePath, fd, buf, len, pos, cb) => {
      if (filePath === "/.mode" || filePath === ".mode") {
        const input = buf.slice(0, len).toString().trim()
        if (input === "exec" || input === "edit") { MODE = input; return cb(len) }
        return cb(Fuse.EINVAL)
      }
      try {
        const fdReal = fs.openSync(getRealFilePath(filePath), "r+")
        const written = fs.writeSync(fdReal, buf, 0, len, pos)
        fs.closeSync(fdReal); return cb(written)
      } catch (err) { cb(Fuse.EIO) }
    },

    truncate: (p, s, cb) => {
      if (p === "/.mode" || p === ".mode") return cb(0)
      try { fs.truncateSync(getRealFilePath(p), s); cb(0) } catch(e) { cb(Fuse.EIO) }
    },

    release: (filePath, fd, cb) => { openHandles.delete(filePath); cb(0) },
    flush: (path, fd, cb) => cb(0),
    create: (filePath, mode, cb) => {
      try {
        const realPath = getRealFilePath(filePath)
        if (!fs.existsSync(path.dirname(realPath))) fs.mkdirSync(path.dirname(realPath), { recursive: true })
        fs.closeSync(fs.openSync(realPath, "w")); cb(0, 0)
      } catch (e) { cb(Fuse.EIO) }
    },
    mkdir: (filePath, mode, cb) => {
      try { fs.mkdirSync(path.join(CONFIG.PROJECT_DIR, filePath), { recursive: true }); cb(0) } catch (e) { cb(Fuse.EIO) }
    },
    unlink: (filePath, cb) => {
      try {
        const s = path.join(CONFIG.SOURCE_DIR, filePath), p = path.join(CONFIG.PROJECT_DIR, filePath)
        if (fs.existsSync(s)) fs.unlinkSync(s)
        if (fs.existsSync(p)) fs.unlinkSync(p)
        cb(0)
      } catch (e) { cb(Fuse.EIO) }
    },
    rename: (src, dest, cb) => {
      try {
        const getP = (p) => isSuperFile(p) ? path.join(CONFIG.SOURCE_DIR, p) : path.join(CONFIG.PROJECT_DIR, p)
        const n = getP(dest)
        if (!fs.existsSync(path.dirname(n))) fs.mkdirSync(path.dirname(n), { recursive: true })
        fs.renameSync(getP(src), n); cb(0)
      } catch (e) { cb(Fuse.EIO) }
    },
    utimens: (p, at, mt, cb) => cb(0), chown: (p, u, g, cb) => cb(0), chmod: (p, m, cb) => cb(0)
  }

  const fuse = new Fuse(CONFIG.MOUNT_POINT, ops, { debug: false, displayFolder: true, nonempty: true })
  
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true); process.stdin.resume(); process.stdin.setEncoding("utf8")
    process.stdin.on("data", (key) => {
      if (key === "\u0003") exit()
      if (key === "1" || key === "e") { MODE = "edit"; console.log("\nMODO: EDICION") }
      else if (key === "2" || key === "x") { MODE = "exec"; console.log("\nMODO: EJECUCION") }
    })
  }

  function exit() { fuse.unmount(() => { if (process.stdin.isTTY) process.stdin.setRawMode(false); process.exit() }) }
  fuse.mount(err => { if (err) process.exit(1); console.log(`VFS ONLINE: ${CONFIG.MOUNT_POINT}`) })
  process.on("SIGINT", exit); process.on("SIGTERM", exit)
}

start()
