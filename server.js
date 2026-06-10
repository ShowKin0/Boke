/**
 * Bōkè Server — 零依赖 Node.js 服务器
 *
 * 让数据直接读写 data/*.json 文件，实现数据跟着项目走。
 * 启动: node server.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

// ===== 启动时确保目录存在 =====
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// ===== MIME 映射 =====
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
};

// ===== 工具函数 =====

/** 解析请求体 JSON（限制 25MB） */
const MAX_BODY = 25 * 1024 * 1024;
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY) {
        req.destroy(new Error('请求体超过 25MB 限制'));
      }
      raw += chunk;
    });
    req.on('end', () => {
      try { resolve(JSON.parse(raw)); }
      catch { reject(new Error('JSON 格式错误')); }
    });
    req.on('error', reject);
  });
}

/** 安全的路径检查 — 防止目录穿越 */
function isSafePath(p) {
  const resolved = path.resolve(p);
  return resolved.startsWith(ROOT + path.sep) || resolved === ROOT;
}

/** 读取 JSON 文件 */
function readJSON(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch { return null; }
}

/** 写入 JSON 文件（原子写入：先写 .tmp 再 rename） */
function writeJSON(filePath, data) {
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmp, filePath);
}

/** 发送 JSON 响应 */
function sendJSON(res, code, data) {
  const json = JSON.stringify(data, null, 2);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(json);
}

/** 发送错误响应 */
function sendError(res, code, msg) {
  sendJSON(res, code, { error: msg });
}

// ===== 路由处理器 =====

const routes = {

  // GET /api/data — 读取所有数据
  async get(req, res, url) {
    // GET /api/data → 读取全部
    if (url === '/api/data' || url === '/api/data/') {
      const FILES = ['articles', 'updates', 'explores', 'music', 'theme'];
      const result = {};
      for (const key of FILES) {
        const filePath = path.join(DATA_DIR, `${key}.json`);
        result[key] = readJSON(filePath);
      }
      // 如果 theme 为空，给默认值
      if (!result.theme) {
        result.theme = {
          bgColor: '#fff5f7',
          primaryColor: '#ffb0c0',
          secondaryColor: '#87ceeb',
          cardBg: 'rgba(255,255,255,0.6)',
          textColor: '#2d2d2d',
          textSecondary: '#888888'
        };
      }
      return sendJSON(res, 200, result);
    }

    // GET /api/data/:type → 读取某一类型
    const typeMatch = url.match(/^\/api\/data\/(\w+)$/);
    if (typeMatch) {
      const type = typeMatch[1];
      const filePath = path.join(DATA_DIR, `${type}.json`);
      if (!fs.existsSync(filePath)) {
        return sendError(res, 404, `数据文件 ${type}.json 不存在`);
      }
      const data = readJSON(filePath);
      return sendJSON(res, 200, data);
    }

    // 不匹配任何 API 路由
    return null;
  },

  // POST /api/data/:type — 写入某一类型数据
  async post(req, res, url) {
    const match = url.match(/^\/api\/data\/(\w+)$/);
    if (!match) return null;

    const type = match[1];
    const filePath = path.join(DATA_DIR, `${type}.json`);

    // 安全检查：只允许写入 data/ 目录下的 JSON 文件
    if (!isSafePath(filePath) || path.extname(filePath) !== '.json') {
      return sendError(res, 403, '禁止写入此路径');
    }

    const body = await parseBody(req);
    writeJSON(filePath, body);
    return sendJSON(res, 200, { ok: true, type, message: `${type}.json 已保存` });
  },

  // POST /api/upload — 上传文件（图片、音频等）
  async upload(req, res, reqUrl) {
    if (reqUrl !== '/api/upload') return null;

    const body = await parseBody(req);
    if (!body || !body.file) {
      return sendError(res, 400, '缺少 file 字段');
    }

    // 解析 base64 data URL: "data:image/png;base64,..." 或 "data:audio/mpeg;base64,..."
    const dataUrl = body.file;
    const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      return sendError(res, 400, '文件格式不正确，需要 data:*/*;base64,... 格式');
    }

    const mime = matches[1];        // 如 image/png, audio/mpeg
    const base64Data = matches[2];

    // 从 MIME 推断扩展名
    const mimeExt = {
      'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif',
      'image/webp': 'webp', 'image/svg+xml': 'svg',
      'audio/mpeg': 'mp3', 'audio/mp3': 'mp3',
      'audio/wav': 'wav', 'audio/x-wav': 'wav',
      'audio/ogg': 'ogg', 'audio/flac': 'flac',
      'audio/aac': 'aac', 'audio/mp4': 'm4a',
      'audio/x-m4a': 'm4a',
    };
    const ext = mimeExt[mime] || mime.split('/')[1] || 'bin';

    // 生成唯一文件名: 时间戳_随机数.ext
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 6);
    const fileName = `${ts}_${rand}.${ext}`;
    const filePath = path.join(UPLOADS_DIR, fileName);

    // 写入文件
    fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));

    const fileUrl = `data/uploads/${fileName}`;
    return sendJSON(res, 200, { ok: true, url: fileUrl, fileName });
  },
};

// ===== 静态文件服务 =====
function serveStatic(req, res) {
  let urlPath = req.url.split('?')[0];

  // 默认首页
  if (urlPath === '/') urlPath = '/index.html';

  const filePath = path.join(ROOT, urlPath);

  // 安全检查
  if (!isSafePath(filePath)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  // 检查文件是否存在
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('404 Not Found');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';

  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'max-age=3600',
    });
    res.end(content);
  } catch (err) {
    res.writeHead(500);
    res.end('Internal Server Error');
  }
}

// ===== 创建 HTTP 服务器 =====
const server = http.createServer(async (req, res) => {
  const url = req.url;
  const method = req.method;

  // CORS 预检
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  try {
    // API 路由
    if (url.startsWith('/api/')) {
      let handled = false;

      if (method === 'GET') {
        const result = await routes.get(req, res, url);
        if (result !== null) handled = true;
      }

      if (method === 'POST') {
        // 先尝试 upload 路由
        let result = await routes.upload(req, res, url);
        if (result !== null) handled = true;

        // 再尝试 data 写入路由
        if (!handled) {
          result = await routes.post(req, res, url);
          if (result !== null) handled = true;
        }
      }

      if (!handled) {
        sendError(res, 404, 'API 路由不存在');
      }
      return;
    }

    // 静态文件
    serveStatic(req, res);
  } catch (err) {
    console.error('[ERROR]', err.message);
    if (!res.headersSent) sendError(res, 500, err.message || '服务器内部错误');
  }
});

// ===== 启动 =====
server.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════╗
  ║     Bōkè — 个人博客服务器            ║
  ║──────────────────────────────────────║
  ║  前端:  http://localhost:${PORT}       ║
  ║  后台:  http://localhost:${PORT}/admin.html  ║
  ║  数据:  ${DATA_DIR}                   ║
  ╚══════════════════════════════════════╝
  `);
});
