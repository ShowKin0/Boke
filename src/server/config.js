const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const DATA_DIR = process.env.BOKE_DATA_DIR
  ? path.resolve(process.env.BOKE_DATA_DIR)
  : path.join(ROOT, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const PORT = process.env.PORT || 3000;
const MAX_BODY = 25 * 1024 * 1024;
const ADMIN_PASSWORD = process.env.BOKE_ADMIN_PASSWORD || 'zhang';
const TOKEN_TTL_MS = Number.parseInt(process.env.BOKE_TOKEN_TTL_MS || '', 10) || 24 * 60 * 60 * 1000;
const UPLOAD_MAX_BYTES = 20 * 1024 * 1024;

const ALLOWED_UPLOAD_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/flac',
  'audio/aac',
  'audio/mp4',
  'audio/x-m4a',
]);

const DATA_TYPES = ['articles', 'updates', 'explores', 'music', 'theme'];

const DEFAULT_THEME = {
  bgColor: '#fff5f7',
  primaryColor: '#ffb0c0',
  secondaryColor: '#87ceeb',
  cardBg: 'rgba(255,255,255,0.6)',
  textColor: '#2d2d2d',
  textSecondary: '#888888',
};

const DEFAULT_DATA = {
  articles: [],
  updates: [],
  explores: [],
  music: [],
  theme: DEFAULT_THEME,
};

module.exports = {
  ROOT,
  DATA_DIR,
  UPLOADS_DIR,
  PORT,
  MAX_BODY,
  ADMIN_PASSWORD,
  TOKEN_TTL_MS,
  UPLOAD_MAX_BYTES,
  ALLOWED_UPLOAD_MIME,
  DATA_TYPES,
  DEFAULT_DATA,
  DEFAULT_THEME,
};
