const assert = require('node:assert/strict');
const test = require('node:test');

const { validateData } = require('../src/server/data-store');
const { requireAuth, createSession } = require('../src/server/api-routes');
const { resolveStaticPath } = require('../src/server/static-files');
const { saveDataUrl } = require('../src/server/upload-store');

test('validateData accepts existing top-level data shapes', () => {
  assert.equal(validateData('articles', [{ id: 'a1', title: 'Hello' }]), true);
  assert.equal(validateData('updates', []), true);
  assert.equal(validateData('explores', []), true);
  assert.equal(validateData('music', []), true);
  assert.equal(validateData('theme', { bgColor: '#fff' }), true);
});

test('validateData rejects malformed top-level data', () => {
  assert.throws(() => validateData('articles', {}), /articles must be an array/);
  assert.throws(() => validateData('theme', []), /theme must be an object/);
  assert.throws(() => validateData('unknown', []), /Unknown data type/);
});

test('resolveStaticPath blocks directory traversal', () => {
  assert.equal(resolveStaticPath('/..%2f..%2fWindows/win.ini'), null);
  assert.equal(resolveStaticPath('/public%2f..%2f..%2fpackage.json'), null);
  assert.match(resolveStaticPath('/index.html'), /index\.html$/);
});

test('saveDataUrl rejects unsupported mime types and oversized files before writing', () => {
  assert.throws(
    () => saveDataUrl('data:text/plain;base64,SGVsbG8='),
    /Unsupported file type/
  );

  const oversized = Buffer.alloc(21 * 1024 * 1024).toString('base64');
  assert.throws(
    () => saveDataUrl(`data:image/png;base64,${oversized}`),
    /exceeds 20MB limit/
  );
});

test('memory auth token expires', () => {
  const session = createSession(-1);
  assert.equal(
    requireAuth({ headers: { authorization: `Bearer ${session.value}` } }),
    false
  );
});
