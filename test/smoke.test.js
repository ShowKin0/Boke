const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boke-smoke-'));
process.env.BOKE_DATA_DIR = tempDataDir;
process.env.BOKE_ADMIN_PASSWORD = 'test-password';

const { createServer } = require('../src/server/app');

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve(`http://127.0.0.1:${port}`);
    });
  });
}

test('API smoke: data, auth, save, upload, feed, sitemap', async (t) => {
  const server = createServer();
  const baseUrl = await listen(server);
  t.after(() => server.close());

  const dataRes = await fetch(`${baseUrl}/api/data`);
  assert.equal(dataRes.status, 200);
  const data = await dataRes.json();
  assert.deepEqual(data.articles, []);

  const loginRes = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'test-password' }),
  });
  assert.equal(loginRes.status, 200);
  const { token } = await loginRes.json();
  assert.ok(token);

  const articles = [{ id: 'smoke-1', title: 'Smoke Test', createdAt: new Date().toISOString() }];
  const saveRes = await fetch(`${baseUrl}/api/data/articles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(articles),
  });
  assert.equal(saveRes.status, 200);

  const uploadRes = await fetch(`${baseUrl}/api/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ file: 'data:image/png;base64,iVBORw0KGgo=' }),
  });
  assert.equal(uploadRes.status, 200);
  const upload = await uploadRes.json();
  assert.match(upload.url, /^data\/uploads\/.+\.png$/);

  const feedRes = await fetch(`${baseUrl}/feed.xml`);
  assert.equal(feedRes.status, 200);
  assert.match(await feedRes.text(), /Smoke Test/);

  const sitemapRes = await fetch(`${baseUrl}/sitemap.xml`);
  assert.equal(sitemapRes.status, 200);
  assert.match(await sitemapRes.text(), /smoke-1/);
});
