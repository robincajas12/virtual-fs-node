const ExecutorDecorator = require('./ExecutorDecorator');
const cache = require('../../cache');

class CacheDecorator extends ExecutorDecorator {
    async execute(command, config, context) {
        const ttl = context.ttl; // Get TTL from context instead of constructor
        
        if (ttl) {
            const cachedResult = cache.get(context.filePath, command);
            if (cachedResult !== null) {
                console.log(`[CACHE HIT] Found in cache (TTL: ${ttl})`);
                return cachedResult;
            }
        }

        const result = await this.executor.execute(command, config, context);

        if (ttl) {
            cache.set(context.filePath, command, result, ttl);
        }

        return result;
    }
}

module.exports = CacheDecorator;
