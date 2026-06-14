const SQLiteCacheRepository = require('./repositories/SQLiteCacheRepository');
const MemoryCacheRepository = require('./repositories/MemoryCacheRepository');

let instance = null;

module.exports = {
    initCache: (projectRoot, type = 'sqlite') => {
        if (type === 'memory') {
            instance = new MemoryCacheRepository();
        } else {
            instance = new SQLiteCacheRepository(projectRoot);
        }
        return instance;
    },
    get: (filePath, code) => instance ? instance.get(filePath, code) : null,
    set: (filePath, code, result, ttlStr) => instance ? instance.set(filePath, code, result, ttlStr) : null,
    getInstance: () => instance
};
