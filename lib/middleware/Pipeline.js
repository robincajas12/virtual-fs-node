const cache = require('../cache');
const { getStrategy } = require('../strategies/ExecutorStrategy');
const LoggingDecorator = require('../strategies/decorators/LoggingDecorator');
const CacheDecorator = require('../strategies/decorators/CacheDecorator');
const { marked } = require('marked');
const fs = require('fs');

class Pipeline {
    constructor() {
        this.middlewares = [];
    }

    use(middleware) {
        this.middlewares.push(middleware);
        return this;
    }

    async execute(context) {
        let index = 0;
        const next = async () => {
            if (index < this.middlewares.length) {
                const middleware = this.middlewares[index++];
                await middleware(context, next);
            }
        };
        await next();
        return context.content;
    }
}

// Middleware: Cargar contenido inicial
const loadContent = async (ctx, next) => {
    ctx.content = fs.readFileSync(ctx.filePath, 'utf8');
    await next();
};

// Middleware: Ejecutar bloques de código (Patrones Strategy y Decorator integrados)
const executeBlocks = async (ctx, next) => {
    const blockRegex = /```(run-node|run|script)(?::(\w+))?\r?\n([\s\S]*?)\r?\n```/g;
    const matches = [...ctx.content.matchAll(blockRegex)];
    const results = [];

    for (const match of matches) {
        const [fullMatch, type, ttl, command] = match;
        
        // Obtener estrategia base
        let executor = getStrategy(type);
        
        if (executor) {
            // Envolver con Decoradores (Logging y Cache)
            // El orden importa: Cache envuelve a Logging para no loguear si hay cache hit
            executor = new LoggingDecorator(executor);
            executor = new CacheDecorator(executor);

            try {
                // Pasar TTL en el contexto para el CacheDecorator
                ctx.ttl = ttl; 
                const result = await executor.execute(command, ctx.config, ctx);
                results.push({ fullMatch, result });
            } catch (err) {
                results.push({ fullMatch, result: `[Error en ${type.toUpperCase()}: ${err.message}]` });
            }
        }
    }

    for (const item of results) {
        ctx.content = ctx.content.replace(item.fullMatch, item.result);
    }
    await next();
};

// Middleware: Transmutación HTML
const transmuteHtml = async (ctx, next) => {
    if (ctx.virtualPath.endsWith('.html')) {
        ctx.content = `
            <html>
                <head><style>body { font-family: sans-serif; padding: 40px; }</style></head>
                <body>${marked.parse(ctx.content)}</body>
            </html>
        `;
    }
    await next();
};

module.exports = {
    Pipeline,
    middlewares: {
        loadContent,
        executeBlocks,
        transmuteHtml
    }
};
