const fs = require('fs');
const path = require('path');
const { UPLOADS_DIR } = require('./config');

const MIME_EXTENSIONS = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/flac': 'flac',
  'audio/aac': 'aac',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
};

function saveDataUrl(dataUrl) {
  const matches = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) {
    throw new Error('File must use data:*/*;base64,... format');
  }

  const mime = matches[1];
  const base64Data = matches[2];
  const rawExt = MIME_EXTENSIONS[mime] || mime.split('/')[1] || 'bin';
  const ext = rawExt.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
  const fileName = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
  const filePath = path.join(UPLOADS_DIR, fileName);

  fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));

  return {
    url: `data/uploads/${fileName}`,
    fileName,
  };
}

module.exports = {
  saveDataUrl,
};
