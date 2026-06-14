const { Pipeline, middlewares } = require('./middleware/Pipeline');

/**
 * Modern, decoupled content processing using Pipeline (Middleware) and Strategy patterns.
 * @param {string} filePath Path to the physical file being read.
 * @param {Object} config Configuration object.
 * @param {string} virtualPath The path as seen in the VFS.
 * @returns {Promise<string>} The processed content.
 */
async function processContent(filePath, config, virtualPath = '') {
    const pipeline = new Pipeline();

    // Setup processing flow
    pipeline
        .use(middlewares.loadContent)
        .use(middlewares.executeBlocks)
        .use(middlewares.transmuteHtml);

    // Initial context
    const context = {
        filePath,
        config,
        virtualPath,
        content: ''
    };

    return await pipeline.execute(context);
}

module.exports = {
    processContent
};
