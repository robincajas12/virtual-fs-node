const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

let db;

function initCache(projectRoot) {
    const dbPath = path.join(projectRoot, '.super_md', 'cache.db');
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

    db = new Database(dbPath);
    
    // Crear tabla si no existe
    db.exec(`
        CREATE TABLE IF NOT EXISTS block_cache (
            id TEXT PRIMARY KEY,
            result TEXT,
            expires_at INTEGER
        )
    `);
}

function getCacheId(filePath, code) {
    const hash = crypto.createHash('md5');
    hash.update(filePath + code);
    return hash.digest('hex');
}

function parseTTL(ttlStr) {
    if (!ttlStr) return 0;
    const match = ttlStr.match(/^(\d+)([smhd])$/);
    if (!match) return 0;
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    const multiplier = {
        's': 1000,
        'm': 60 * 1000,
        'h': 60 * 60 * 1000,
        'd': 24 * 60 * 60 * 1000
    };
    
    return value * multiplier[unit];
}

function get(filePath, code) {
    if (!db) return null;
    const id = getCacheId(filePath, code);
    const now = Date.now();
    
    const row = db.prepare('SELECT result FROM block_cache WHERE id = ? AND expires_at > ?').get(id, now);
    return row ? row.result : null;
}

function set(filePath, code, result, ttlStr) {
    if (!db) return;
    const ttl = parseTTL(ttlStr);
    if (ttl <= 0) return;

    const id = getCacheId(filePath, code);
    const expiresAt = Date.now() + ttl;

    db.prepare('REPLACE INTO block_cache (id, result, expires_at) VALUES (?, ?, ?)').run(id, result, expiresAt);
}

module.exports = {
    initCache,
    get,
    set
};
