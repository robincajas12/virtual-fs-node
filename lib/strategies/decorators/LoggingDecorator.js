const ExecutorDecorator = require('./ExecutorDecorator');

class LoggingDecorator extends ExecutorDecorator {
    async execute(command, config, context) {
        const start = Date.now();
        console.log(`[EXEC START] Command: ${command.substring(0, 50)}...`);
        try {
            const result = await this.executor.execute(command, config, context);
            const duration = Date.now() - start;
            console.log(`[EXEC SUCCESS] Duration: ${duration}ms`);
            return result;
        } catch (err) {
            console.error(`[EXEC ERROR] ${err.message}`);
            throw err;
        }
    }
}

module.exports = LoggingDecorator;
