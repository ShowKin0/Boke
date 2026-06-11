const fs = require('fs');
const path = require('path');
const { DATA_DIR, UPLOADS_DIR, DATA_TYPES, DEFAULT_DATA } = require('./config');

function ensureDataFiles() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });

  for (const type of DATA_TYPES) {
    const filePath = getDataPath(type);
    if (!fs.existsSync(filePath)) {
      writeJSON(filePath, DEFAULT_DATA[type]);
    }
  }
}

function isDataType(type) {
  return DATA_TYPES.includes(type);
}

function getDataPath(type) {
  return path.join(DATA_DIR, `${type}.json`);
}

function readJSON(filePath, fallback = null) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJSON(filePath, data) {
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpPath, filePath);
}

function readData(type) {
  if (!isDataType(type)) return undefined;
  return readJSON(getDataPath(type), DEFAULT_DATA[type]);
}

function writeData(type, data) {
  if (!isDataType(type)) return false;
  writeJSON(getDataPath(type), data);
  return true;
}

function readAllData() {
  const result = {};
  for (const type of DATA_TYPES) {
    result[type] = readData(type);
  }
  return result;
}

module.exports = {
  ensureDataFiles,
  isDataType,
  readData,
  writeData,
  readAllData,
};
