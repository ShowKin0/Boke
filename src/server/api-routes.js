const { readAllData, readData, writeData, isDataType } = require('./data-store');
const { parseBody, sendJSON, sendError } = require('./http-utils');
const { saveDataUrl } = require('./upload-store');

async function handleApi(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  if (req.method === 'GET' && (pathname === '/api/data' || pathname === '/api/data/')) {
    sendJSON(res, 200, readAllData());
    return true;
  }

  const dataMatch = pathname.match(/^\/api\/data\/(\w+)$/);
  if (dataMatch) {
    return handleDataRequest(req, res, dataMatch[1]);
  }

  if (req.method === 'POST' && pathname === '/api/upload') {
    return handleUpload(req, res);
  }

  sendError(res, 404, 'API route not found');
  return true;
}

async function handleDataRequest(req, res, type) {
  if (!isDataType(type)) {
    sendError(res, 404, `Unknown data type: ${type}`);
    return true;
  }

  if (req.method === 'GET') {
    sendJSON(res, 200, readData(type));
    return true;
  }

  if (req.method === 'POST') {
    const body = await parseBody(req);
    writeData(type, body);
    sendJSON(res, 200, { ok: true, type, message: `${type}.json saved` });
    return true;
  }

  sendError(res, 405, 'Method not allowed');
  return true;
}

async function handleUpload(req, res) {
  const body = await parseBody(req);

  if (!body || !body.file) {
    sendError(res, 400, 'Missing file field');
    return true;
  }

  const file = saveDataUrl(body.file);
  sendJSON(res, 200, { ok: true, ...file });
  return true;
}

module.exports = {
  handleApi,
};
