const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const path = require('path');

class ExecutorStrategy {
    async execute(command, config, context) {
        throw new Error("execute() must be implemented");
    }
}

class NodeExecutor extends ExecutorStrategy {
    async execute(command, config, context) {
        const { WORKING_DIR } = config;
        const wrappedCode = `(async () => {\n${command}\n})().catch(err => { console.error(err); process.exit(1); });`;
        const corePath = path.resolve(__dirname, '../core.js');
        
        const { stdout } = await execPromise(`node --require "${corePath}" -e "${wrappedCode.replace(/"/g, '\\"')}"`, {
            cwd: WORKING_DIR,
            timeout: 10*1000
        });
        return stdout.trim();
    }
}

class ShellExecutor extends ExecutorStrategy {
    async execute(command, config, context) {
        const { WORKING_DIR } = config;
        const { stdout } = await execPromise(command.trim(), { 
            cwd: WORKING_DIR, 
            timeout: 10*1000 
        });
        return stdout.trim();
    }
}

class ScriptExecutor extends ExecutorStrategy {
    async execute(command, config, context) {
        const { SCRIPTS_DIR } = config;
        const { stdout } = await execPromise(command.trim(), { 
            cwd: SCRIPTS_DIR, 
            timeout: 10*1000 
        });
        return stdout.trim();
    }
}

const strategies = {
    'run-node': new NodeExecutor(),
    'run': new ShellExecutor(),
    'script': new ScriptExecutor()
};

module.exports = {
    getStrategy: (type) => strategies[type],
    ExecutorStrategy
};
