const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// ========== 初始化数据文件和目录 ==========
const DATA_DIR = path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');

const DATA_FILES = {
  articles: path.join(DATA_DIR, 'articles.json'),
  updates: path.join(DATA_DIR, 'updates.json'),
  explores: path.join(DATA_DIR, 'explores.json'),
  music: path.join(DATA_DIR, 'music.json'),
  theme: path.join(DATA_DIR, 'theme.json'),
};

const DEFAULT_THEME = {
  bgColor: '#fff5f7',
  primaryColor: '#ffb0c0',
  secondaryColor: '#87ceeb',
  cardBg: 'rgba(255,255,255,0.6)',
  textColor: '#2d2d2d',
  textSecondary: '#888888',
};

function initDataFiles() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  ['images', 'audio', 'video'].forEach(dir => {
    const p = path.join(UPLOAD_DIR, dir);
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
  });
  Object.entries(DATA_FILES).forEach(([key, filePath]) => {
    if (!fs.existsSync(filePath)) {
      const initial = key === 'theme' ? DEFAULT_THEME : [];
      fs.writeFileSync(filePath, JSON.stringify(initial, null, 2));
    }
  });
}

initDataFiles();

// ========== 文件读取/写入队列（防并发冲突） ==========
const writeQueues = {};

function readJSON(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeJSON(filePath, data) {
  return new Promise((resolve, reject) => {
    const queue = writeQueues[filePath] || Promise.resolve();
    writeQueues[filePath] = queue.then(() => {
      return new Promise((res) => {
        try {
          fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
          res();
        } catch (err) {
          reject(err);
        }
      });
    });
    writeQueues[filePath].then(resolve).catch(reject);
  });
}

// ========== 中间件 ==========
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'boke-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname)); // 提供 index.html 和 admin.html

// ========== 文件上传配置 ==========
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let subdir = 'images';
    if (file.mimetype.startsWith('audio/')) subdir = 'audio';
    else if (file.mimetype.startsWith('video/')) subdir = 'video';
    cb(null, path.join(UPLOAD_DIR, subdir));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, uuidv4() + ext);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 200 * 1024 * 1024,
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const images = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const audio = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/mp4'];
    const video = ['video/mp4', 'video/webm', 'video/quicktime'];
    const allowed = [...images, ...audio, ...video];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件格式'));
    }
  }
});

// ========== 认证中间件 ==========
function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  res.status(401).json({ error: '未登录' });
}

// ========== API 路由 ==========

// 登录
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.json({ success: true });
  }
  res.status(401).json({ error: '密码错误' });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/check-auth', (req, res) => {
  res.json({ isAdmin: !!req.session?.isAdmin });
});

// ========== CRUD 通用工厂 ==========
function createCRUD(key, dataFile) {
  const filePath = DATA_FILES[dataFile] || dataFile;

  // 公开读取
  app.get(`/api/${key}`, (req, res) => {
    const data = readJSON(filePath);
    res.json(data);
  });

  // 需要认证的写操作
  app.post(`/api/${key}`, requireAuth, (req, res) => {
    const data = readJSON(filePath);
    const item = { id: uuidv4(), ...req.body, createdAt: new Date().toISOString() };
    data.unshift(item);
    writeJSON(filePath, data).then(() => res.json(item)).catch(err => res.status(500).json({ error: err.message }));
  });

  app.put(`/api/${key}/:id`, requireAuth, (req, res) => {
    const data = readJSON(filePath);
    const idx = data.findIndex(i => i.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: '未找到' });
    data[idx] = { ...data[idx], ...req.body, id: data[idx].id, createdAt: data[idx].createdAt };
    writeJSON(filePath, data).then(() => res.json(data[idx])).catch(err => res.status(500).json({ error: err.message }));
  });

  app.delete(`/api/${key}/:id`, requireAuth, (req, res) => {
    const data = readJSON(filePath);
    const item = data.find(i => i.id === req.params.id);
    const filtered = data.filter(i => i.id !== req.params.id);
    if (filtered.length === data.length) return res.status(404).json({ error: '未找到' });
    // 尝试删除关联媒体文件
    if (item && item.mediaList) {
      item.mediaList.forEach(m => {
        if (m.url && m.url.startsWith('/uploads/')) {
          const fp = path.join(__dirname, 'public', m.url);
          if (fs.existsSync(fp)) fs.unlinkSync(fp);
        }
      });
    }
    writeJSON(filePath, filtered).then(() => res.json({ success: true })).catch(err => res.status(500).json({ error: err.message }));
  });
}

createCRUD('articles', 'articles');
createCRUD('updates', 'updates');
createCRUD('explores', 'explores');
createCRUD('music', 'music');

// 主题特殊处理
app.get('/api/theme', (req, res) => {
  res.json(readJSON(DATA_FILES.theme));
});

app.put('/api/theme', requireAuth, (req, res) => {
  const updated = { ...DEFAULT_THEME, ...req.body };
  writeJSON(DATA_FILES.theme, updated).then(() => res.json(updated)).catch(err => res.status(500).json({ error: err.message }));
});

// 文件上传
app.post('/api/upload', requireAuth, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) return res.status(400).json({ error: '文件过大，最大200MB' });
      return res.status(400).json({ error: err.message || '上传失败' });
    }
    if (!req.file) return res.status(400).json({ error: '请选择文件' });
    let subdir = 'images';
    if (req.file.mimetype.startsWith('audio/')) subdir = 'audio';
    else if (req.file.mimetype.startsWith('video/')) subdir = 'video';
    const url = `/uploads/${subdir}/${req.file.filename}`;
    res.json({ url, filename: req.file.filename, size: req.file.size });
  });
});

// ========== 前台数据聚合接口 ==========
app.get('/api/home', (req, res) => {
  const articles = readJSON(DATA_FILES.articles).slice(0, 3);
  const updates = readJSON(DATA_FILES.updates).slice(0, 3);
  const music = readJSON(DATA_FILES.music);
  const theme = readJSON(DATA_FILES.theme);
  res.json({ articles, updates, music, theme });
});

// ========== 启动 ==========
app.listen(PORT, () => {
  console.log(`🚀 Boke blog running at http://localhost:${PORT}`);
  console.log(`📝 Admin panel: http://localhost:${PORT}/admin.html`);
});
