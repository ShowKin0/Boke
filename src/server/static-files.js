const fs = require('fs');
const path = require('path');
const { ROOT } = require('./config');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
};

function resolveStaticPath(reqUrl) {
  const url = new URL(reqUrl, 'http://localhost');
  let urlPath;
  try {
    urlPath = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
  const filePath = path.resolve(ROOT, `.${urlPath}`);

  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
    return null;
  }

  return filePath;
}

function serveStatic(req, res) {
  const filePath = resolveStaticPath(req.url);

  if (!filePath) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const cacheControl = ext === '.html' ? 'no-cache' : 'max-age=3600';

  try {
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': cacheControl,
    });
    fs.createReadStream(filePath).pipe(res);
  } catch {
    res.writeHead(500);
    res.end('Internal Server Error');
  }
}

module.exports = {
  resolveStaticPath,
  serveStatic,
};
