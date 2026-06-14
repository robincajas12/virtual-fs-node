const crypto = require('crypto');

class CacheRepository {
    get(filePath, code) { throw new Error("Method get() must be implemented"); }
    set(filePath, code, result, ttlStr) { throw new Error("Method set() must be implemented"); }
    
    getCacheId(filePath, code) {
        const hash = crypto.createHash('md5');
        hash.update(filePath + code);
        return hash.digest('hex');
    }

    parseTTL(ttlStr) {
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
}

module.exports = CacheRepository;
