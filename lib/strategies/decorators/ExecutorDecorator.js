class ExecutorDecorator {
    constructor(executor) {
        this.executor = executor;
    }

    async execute(command, config, context) {
        return await this.executor.execute(command, config, context);
    }
}

module.exports = ExecutorDecorator;
