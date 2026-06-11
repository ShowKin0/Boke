const http = require('http');
const { ensureDataFiles } = require('./data-store');
const { sendError } = require('./http-utils');
const { handleApi } = require('./api-routes');
const { serveStatic } = require('./static-files');

function createServer() {
  ensureDataFiles();

  return http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      res.end();
      return;
    }

    try {
      if (req.url.startsWith('/api/')) {
        await handleApi(req, res);
        return;
      }

      serveStatic(req, res);
    } catch (error) {
      console.error('[ERROR]', error);
      if (!res.headersSent) {
        sendError(res, 500, error.message || 'Internal server error');
      }
    }
  });
}

module.exports = {
  createServer,
};
