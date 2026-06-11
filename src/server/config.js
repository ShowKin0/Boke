const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const DATA_DIR = path.join(ROOT, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const PORT = process.env.PORT || 3000;
const MAX_BODY = 25 * 1024 * 1024;

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
  DATA_TYPES,
  DEFAULT_DATA,
  DEFAULT_THEME,
};
