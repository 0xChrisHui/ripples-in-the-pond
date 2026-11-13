import assert from 'node:assert/strict';
import http from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const { pathToRegexp } = createRequire(import.meta.url)('next/dist/compiled/path-to-regexp');
const manifestPath = '.next/routes-manifest.json';
const original = readFileSync(manifestPath, 'utf8');
const manifest = JSON.parse(original);
const seen = [];
let currentPath = '';
const origin = http.createServer((req, res) => {
  seen.push({ path: currentPath, headers: req.headers });
  res.writeHead(206, { 'Content-Type': 'audio/mpeg', 'Content-Length': 1, 'Content-Range': 'bytes 0-0/3' });
  res.end('a');
});
await new Promise(done => origin.listen(0, '127.0.0.1', done));
const reserve = http.createServer();
await new Promise(done => reserve.listen(0, '127.0.0.1', done));
const port = reserve.address().port;
await new Promise(done => reserve.close(done));
const pattern = '/media/:txid([a-zA-Z0-9_-]{43})';
// 只把本地构建产物的改写目标换成可观测源；finally 恢复，绝不改变应用源码或云端配置。
manifest.rewrites.afterFiles = [{ source: pattern, regex: pathToRegexp(pattern).source,
  destination: `http://127.0.0.1:${origin.address().port}/media/:txid` }];
writeFileSync(manifestPath, JSON.stringify(manifest));
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1',
  '--port', String(port)], { windowsHide: true, stdio: 'pipe',
  // 本演练只发 ping 和媒体 GET；使用生产相同的路径规则，避免本地只读开关掩盖路径问题。
  env: { ...process.env, LOCAL_REVIEW_ONLY: '0' } });
let logs = '';
child.stdout.on('data', data => { logs += data; });
child.stderr.on('data', data => { logs += data; });
const request = path => new Promise((done, reject) => {
  currentPath = path;
  const req = http.get({ hostname: '127.0.0.1', port, path, headers: {
    Host: 'pond-ripple.xyz', Cookie: 'canary-cookie=private', Authorization: 'Bearer canary-private',
    'x-pond-edge-secret': 'canary-edge-private', 'x-pond-client-ip': '192.0.2.1',
    'x-unrelated-secret': 'canary-extra-private', Range: 'bytes=0-0', 'If-Range': 'canary-etag',
    Accept: 'audio/mpeg',
  } }, res => {
    res.resume(); res.on('end', () => done(res.statusCode));
  });
  req.setTimeout(5000, () => req.destroy(Error('Next 本地请求超时'))); req.on('error', reject);
});
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { if (await request('/api/ping') === 200) { ready = true; break; } }
    catch { await new Promise(wait => setTimeout(wait, 100)); }
  }
  assert.ok(ready, logs);
  for (const path of ['/media/' + 'a'.repeat(43), '/media/' + 'a'.repeat(43) + '/',
    '/MEDIA/' + 'a'.repeat(43), '/Media/' + 'a'.repeat(43),
    '/%6dedia/' + 'a'.repeat(43), '/med%69a/' + 'a'.repeat(43)]) {
    const code = await request(path);
    if (code === 308 || code === 404) continue;
    assert.equal(code, 206, logs + '\n路径：' + path);
  }
  for (const path of ['/media/' + 'a'.repeat(42), '/media/' + 'a'.repeat(44), '/media/' + '.'.repeat(43)]) {
    const before = seen.length;
    assert.notEqual(await request(path), 206);
    assert.equal(seen.length, before, '非法 txid 不得请求外部源');
  }
  assert.ok(seen.length >= 1);
  for (const { path, headers } of seen) {
    for (const key of ['cookie', 'authorization', 'x-pond-edge-secret', 'x-pond-client-ip', 'x-unrelated-secret']) {
      assert.equal(headers[key], undefined, key + ' 不得到达外部媒体源：' + path);
    }
    assert.equal(headers.range, 'bytes=0-0');
    assert.equal(headers['if-range'], 'canary-etag');
    assert.equal(headers.accept, 'audio/mpeg');
  }
  console.log('真实 Next middleware → 外部改写：凭据 canary 均已清除，Range/条件请求保持');
} finally {
  child.kill();
  await new Promise(wait => setTimeout(wait, 300));
  origin.closeAllConnections(); await new Promise(done => origin.close(done));
  writeFileSync(manifestPath, original);
}
