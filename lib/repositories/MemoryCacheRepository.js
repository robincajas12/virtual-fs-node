const CacheRepository = require('./CacheRepository');

class MemoryCacheRepository extends CacheRepository {
    constructor() {
        super();
        this.cache = new Map();
    }

    get(filePath, code) {
        const id = this.getCacheId(filePath, code);
        const entry = this.cache.get(id);
        if (!entry) return null;
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(id);
            return null;
        }
        return entry.result;
    }

    set(filePath, code, result, ttlStr) {
        const ttl = this.parseTTL(ttlStr);
        if (ttl <= 0) return;

        const id = this.getCacheId(filePath, code);
        const expiresAt = Date.now() + ttl;
        this.cache.set(id, { result, expiresAt });
    }
}

module.exports = MemoryCacheRepository;
