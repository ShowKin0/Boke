const crypto = require('crypto');
const { readAllData, readData, writeData, isDataType } = require('./data-store');
const { parseBody, sendJSON, sendError } = require('./http-utils');
const { saveDataUrl } = require('./upload-store');

// ===== 简单内存 Token 认证 =====
const PASSWORD = 'zhang';
let currentToken = null;

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function requireAuth(req) {
  if (!currentToken) return false;
  const auth = req.headers['authorization'] || '';
  return auth === `Bearer ${currentToken}`;
}

function getSiteUrl(req) {
  const host = req.headers['host'] || 'localhost:3000';
  const proto = req.headers['x-forwarded-proto'] || (req.socket.encrypted ? 'https' : 'http');
  return `${proto}://${host}`;
}

async function handleApi(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  // 登录
  if (req.method === 'POST' && pathname === '/api/login') {
    const body = await parseBody(req);
    if (body && body.password === PASSWORD) {
      currentToken = generateToken();
      sendJSON(res, 200, { ok: true, token: currentToken });
    } else {
      sendError(res, 401, '密码错误');
    }
    return true;
  }

  // 退出
  if (req.method === 'POST' && pathname === '/api/logout') {
    currentToken = null;
    sendJSON(res, 200, { ok: true });
    return true;
  }

  // 验证 token
  if (req.method === 'GET' && pathname === '/api/verify') {
    const authenticated = requireAuth(req);
    sendJSON(res, 200, { ok: authenticated, authenticated });
    return true;
  }

  // RSS Feed
  if (req.method === 'GET' && (pathname === '/feed.xml' || pathname === '/api/feed.xml')) {
    return handleRSS(req, res);
  }

  // Sitemap
  if (req.method === 'GET' && pathname === '/sitemap.xml') {
    return handleSitemap(req, res);
  }

  // 阅读计数
  const viewMatch = pathname.match(/^\/api\/data\/(\w+)\/([\w-]+)\/view$/);
  if (viewMatch && req.method === 'POST') {
    return handleViewCount(req, res, viewMatch[1], viewMatch[2]);
  }

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
    if (!requireAuth(req)) {
      sendError(res, 401, 'Unauthorized');
      return true;
    }
    const body = await parseBody(req);
    writeData(type, body);
    sendJSON(res, 200, { ok: true, type, message: `${type}.json saved` });
    return true;
  }

  sendError(res, 405, 'Method not allowed');
  return true;
}

async function handleUpload(req, res) {
  if (!requireAuth(req)) {
    sendError(res, 401, 'Unauthorized');
    return true;
  }
  const body = await parseBody(req);
  if (!body || !body.file) {
    sendError(res, 400, 'Missing file field');
    return true;
  }
  const file = saveDataUrl(body.file);
  sendJSON(res, 200, { ok: true, ...file });
  return true;
}

async function handleViewCount(req, res, type, id) {
  const items = readData(type);
  const item = items.find(i => i.id === id);
  if (!item) {
    sendError(res, 404, 'Item not found');
    return true;
  }
  item.views = (item.views || 0) + 1;
  writeData(type, items);
  sendJSON(res, 200, { ok: true, views: item.views });
  return true;
}

function handleRSS(req, res) {
  const data = readAllData();
  const articles = data.articles || [];
  const siteUrl = getSiteUrl(req);

  let items = articles.map(a => `
    <item>
      <title><![CDATA[${a.title || '无标题'}]]></title>
      <link>${siteUrl}/?article=${a.id}</link>
      <description><![CDATA[${a.summary || a.title || ''}]]></description>
      <pubDate>${a.createdAt ? new Date(a.createdAt).toUTCString() : ''}</pubDate>
      <guid isPermaLink="false">${a.id}</guid>
    </item>`).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Bōkè</title>
    <link>${siteUrl}</link>
    <description>个人博客</description>
    <atom:link href="${siteUrl}/feed.xml" rel="self" type="application/rss+xml"/>
    ${items}
  </channel>
</rss>`;

  writeXML(res, xml);
}

function handleSitemap(req, res) {
  const data = readAllData();
  const articles = data.articles || [];
  const siteUrl = getSiteUrl(req);

  let urls = articles.map(a => `
  <url>
    <loc>${siteUrl}/?article=${encodeURIComponent(a.id)}</loc>
    <lastmod>${a.createdAt ? new Date(a.createdAt).toISOString() : ''}</lastmod>
  </url>`).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${siteUrl}/</loc></url>
  ${urls}
</urlset>`;

  writeXML(res, xml);
}

function writeXML(res, xml) {
  res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8' });
  res.end(xml);
}

module.exports = { handleApi };
