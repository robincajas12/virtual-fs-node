const { exec } = require('child_process');
const util = require('util');
const path = require('path');
const fs = require('fs');

class ExecutorStrategy {
    async execute(command, config, context) {
        throw new Error("execute() must be implemented");
    }
}

class NodeExecutor extends ExecutorStrategy {
    async execute(command, config, context) {
        const { WORKING_DIR } = config;
        const wrappedCode = `const fs = require('fs');\nconst path = require('path');\n(async () => {\n${command}\n})().catch(err => { console.error(err); process.exit(1); });`;
        const corePath = path.resolve(__dirname, '../core.js');

        return new Promise((resolve, reject) => {
            const child = exec(`node --require "${corePath}"`, {
                cwd: WORKING_DIR,
                timeout: 10 * 1000
            }, (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(stderr || error.message));
                    return;
                }
                resolve(stdout.trim());
            });

            // Inyectar el código vía stdin para evitar problemas de escape en shell
            child.stdin.write(wrappedCode);
            child.stdin.end();
        });
    }
}

class ShellExecutor extends ExecutorStrategy {
    async execute(command, config, context) {
        const util = require('util');
        const execPromise = util.promisify(exec);
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
        const util = require('util');
        const execPromise = util.promisify(exec);
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
