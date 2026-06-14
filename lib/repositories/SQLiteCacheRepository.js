const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const CacheRepository = require('./CacheRepository');

class SQLiteCacheRepository extends CacheRepository {
    constructor(projectRoot) {
        super();
        const dbPath = path.join(projectRoot, '.super_md', 'cache.db');
        const dbDir = path.dirname(dbPath);
        if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

        this.db = new Database(dbPath);
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS block_cache (
                id TEXT PRIMARY KEY,
                result TEXT,
                expires_at INTEGER
            )
        `);
    }

    get(filePath, code) {
        const id = this.getCacheId(filePath, code);
        const now = Date.now();
        const row = this.db.prepare('SELECT result FROM block_cache WHERE id = ? AND expires_at > ?').get(id, now);
        return row ? row.result : null;
    }

    set(filePath, code, result, ttlStr) {
        const ttl = this.parseTTL(ttlStr);
        if (ttl <= 0) return;

        const id = this.getCacheId(filePath, code);
        const expiresAt = Date.now() + ttl;
        this.db.prepare('REPLACE INTO block_cache (id, result, expires_at) VALUES (?, ?, ?)').run(id, result, expiresAt);
    }
}

module.exports = SQLiteCacheRepository;
