#!/usr/bin/env node

const Fuse = require("fuse-native")
const path = require("path")
const fs = require("fs")
const { applyConfig } = require("./lib/config")
const { processContent } = require("./lib/processor")

const args = process.argv.slice(2)
if (args.length < 2) {
  console.log("Uso: node index.js <index> <config_path>")
  process.exit(1)
}

const [INDEX, CONFIG_PATH] = args
console.log(`Iniciando Sistema Híbrido con Index: ${INDEX}`)

let CONFIG = {
  SOURCE_DIR: path.join(__dirname, "textos"),
  PROJECT_DIR: path.join(__dirname, "archives"),
  MOUNT_POINT: path.join(__dirname, "mnt", INDEX),
  SCRIPTS_DIR: path.join(__dirname, "scripts"),
  WORKING_DIR: path.join(__dirname, "archives"),
  IGNORE_LIST: ["node_modules", ".git", ".super_md", "mnt"]
}

let MODE = "edit"

async function main() {
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const configData = fs.readFileSync(CONFIG_PATH, "utf8")
      const userConfig = JSON.parse(configData)
      const configDir = path.dirname(path.resolve(CONFIG_PATH))
      CONFIG = applyConfig(userConfig, configDir, CONFIG)
    } catch (err) {}
  }

  [CONFIG.SOURCE_DIR, CONFIG.PROJECT_DIR, CONFIG.MOUNT_POINT].forEach(dir => {
    if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  })

  const SUPER_SUFFIX = ".super.md"
  const isSuperFile = (p) => p.endsWith(SUPER_SUFFIX)

  function getRealFilePath(filePath) {
    let relative = filePath.startsWith("/") ? filePath.slice(1) : filePath
    if (isSuperFile(relative)) {
      const sPath = path.join(CONFIG.SOURCE_DIR, relative)
      if (fs.existsSync(sPath)) return sPath
      return sPath
    }
    return path.join(CONFIG.PROJECT_DIR, relative)
  }

  const ops = {
    readdir: function (dirPath, cb) {
      let relative = dirPath.startsWith("/") ? dirPath.slice(1) : dirPath
      const projectPath = path.join(CONFIG.PROJECT_DIR, relative)
      const superPath = path.join(CONFIG.SOURCE_DIR, relative)
      const entries = new Set()
      if (dirPath === "/" || dirPath === "") entries.add(".mode")
      try {
        if (fs.existsSync(projectPath)) {
          const files = fs.readdirSync(projectPath)
          files.forEach(f => {
            if (relative === "" && CONFIG.IGNORE_LIST.includes(f)) return
            entries.add(f)
          })
        }
      } catch (e) {}
      try {
        if (fs.existsSync(superPath)) {
          fs.readdirSync(superPath).forEach(f => { if (isSuperFile(f)) entries.add(f) })
        }
      } catch (e) {}
      return cb(0, Array.from(entries))
    },

    getattr: function (filePath, cb) {
      if (filePath === "/.mode") {
        return cb(null, { mtime: new Date(), atime: new Date(), ctime: new Date(), mode: 33188, size: MODE.length + 1, uid: process.getuid(), gid: process.getgid() })
      }
      const relative = filePath.startsWith("/") ? filePath.slice(1) : filePath
      const sPath = path.join(CONFIG.SOURCE_DIR, relative)
      const pPath = path.join(CONFIG.PROJECT_DIR, relative)
      let realPath = (isSuperFile(relative) && fs.existsSync(sPath)) ? sPath : (fs.existsSync(pPath) ? pPath : null)
      if (realPath) {
        try {
          const stats = fs.statSync(realPath)
          if (stats.isDirectory()) return cb(null, stats)
          if (MODE === "exec" && isSuperFile(filePath)) {
            const processed = processContent(realPath, CONFIG)
            return cb(null, { ...stats, size: Buffer.byteLength(processed), mode: 33060 })
          }
          return cb(null, stats)
        } catch (e) { return cb(Fuse.EIO) }
      }
      return cb(Fuse.ENOENT)
    },

    open: (f, fl, cb) => cb(0, 0),
    read: function (filePath, fd, buf, len, pos, cb) {
      if (filePath === "/.mode") {
        const str = MODE + "\n"
        const part = Buffer.from(str).slice(pos, pos + len)
        part.copy(buf)
        return cb(part.length)
      }
      const realPath = getRealFilePath(filePath)
      if (MODE === "exec" && isSuperFile(filePath)) {
        const processed = processContent(realPath, CONFIG)
        const buffer = Buffer.from(processed)
        const part = buffer.slice(pos, pos + len)
        part.copy(buf)
        return cb(part.length)
      }
      try {
        const fdReal = fs.openSync(realPath, "r")
        const bytesRead = fs.readSync(fdReal, buf, 0, len, pos)
        fs.closeSync(fdReal)
        return cb(bytesRead)
      } catch (e) { return cb(Fuse.EIO) }
    },

    write: function (filePath, fd, buf, len, pos, cb) {
      if (filePath === "/.mode") {
        const input = buf.slice(0, len).toString().trim()
        if (input === "exec" || input === "edit") { MODE = input; return cb(len) }
        return cb(Fuse.EINVAL)
      }
      if (MODE === "exec" && isSuperFile(filePath)) return cb(Fuse.EACCES)
      try {
        const realPath = getRealFilePath(filePath)
        const fdReal = fs.openSync(realPath, "r+")
        const written = fs.writeSync(fdReal, buf, 0, len, pos)
        fs.closeSync(fdReal)
        return cb(written)
      } catch (err) { return cb(Fuse.EIO) }
    },

    create: function (filePath, mode, cb) {
      const realPath = getRealFilePath(filePath)
      try {
        const dir = path.dirname(realPath)
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
        const fd = fs.openSync(realPath, "w")
        fs.closeSync(fd)
        cb(0, 0)
      } catch (err) { cb(Fuse.EIO) }
    },

    mkdir: function (filePath, mode, cb) {
      const realPath = path.join(CONFIG.PROJECT_DIR, filePath)
      try { fs.mkdirSync(realPath, { recursive: true }); cb(0) } catch (e) { cb(Fuse.EIO) }
    },

    rename: function (src, dest, cb) {
      const isSuper = (p) => p.endsWith(".super.md")
      const getP = (p) => isSuper(p) ? path.join(CONFIG.SOURCE_DIR, p) : path.join(CONFIG.PROJECT_DIR, p)
      const oldP = getP(src)
      const newP = getP(dest)
      try {
        const dir = path.dirname(newP)
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
        fs.renameSync(oldP, newP)
        cb(0)
      } catch (e) { cb(Fuse.EIO) }
    },

    unlink: function (filePath, cb) {
      const sPath = path.join(CONFIG.SOURCE_DIR, filePath)
      const pPath = path.join(CONFIG.PROJECT_DIR, filePath)
      try {
        if (fs.existsSync(sPath)) fs.unlinkSync(sPath)
        if (fs.existsSync(pPath)) fs.unlinkSync(pPath)
        cb(0)
      } catch (err) { cb(Fuse.EIO) }
    },

    truncate: (p, s, cb) => { try { fs.truncateSync(getRealFilePath(p), s); cb(0) } catch(e) { cb(Fuse.EIO) } },
    release: (f, fd, cb) => cb(0),
    utimens: (p, at, mt, cb) => cb(0),
    chown: (p, u, g, cb) => cb(0),
    chmod: (p, m, cb) => cb(0)
  }

  const fuse = new Fuse(CONFIG.MOUNT_POINT, ops, { debug: false, displayFolder: true, nonempty: true })

  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true); process.stdin.resume(); process.stdin.setEncoding("utf8")
    process.stdin.on("data", (key) => {
      if (key === "\u0003") exit()
      const input = key.toLowerCase()
      if (input === "1" || input === "e") { MODE = "edit"; console.log("\n[TECLADO] MODO: EDICION") }
      else if (input === "2" || input === "x") { MODE = "exec"; console.log("\n[TECLADO] MODO: EJECUCION") }
    })
  }

  function exit() { fuse.unmount(() => { if (process.stdin.isTTY) process.stdin.setRawMode(false); process.exit() }) }
  fuse.mount(err => {
    if (err) process.exit(1)
    console.log("--- SISTEMA TOTAL RECUPERADO ---")
  })
  process.on("SIGINT", exit); process.on("SIGTERM", exit)
}
main().catch(() => process.exit(1))
