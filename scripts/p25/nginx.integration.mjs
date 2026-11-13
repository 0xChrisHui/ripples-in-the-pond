import assert from 'node:assert/strict';
import { writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { fixture } from './nginx-fixture.mjs';

const s = await fixture();
try {
  const staticPath = '/_next/static/chunks/012345abcdef.js';
  await s.request(staticPath);
  const count = s.calls.length;
  assert.equal((await s.request(staticPath + '?random=1')).headers.get('x-cache-status'), 'HIT');
  assert.equal(s.calls.length, count);
  for (const path of ['/', '/tracks/pond', '/tracks/archive', '/api/ping']) {
    for (const headers of [{}, { RSC: '1' }]) {
      const a = await s.request(path, { headers });
      const b = await s.request(path, { headers });
      assert.equal(a.status, 200); assert.equal(b.headers.get('x-cache-status'), null);
    }
  }
  for (const path of ['/tracks/No.1.mp3?v=' + 'a'.repeat(64), '/media/' + 'a'.repeat(43)]) {
    const first = await s.request(path, { headers: { Range: 'bytes=0-0' } });
    assert.equal(first.status, 206); assert.equal(first.body.length, 1);
    assert.equal(first.headers.get('content-range'), `bytes 0-0/${s.audio.length}`);
    const hit = await s.request(path, { headers: { Range: 'bytes=0-0' } });
    assert.equal(hit.headers.get('x-cache-status'), 'HIT');
    const full = await s.request(path);
    assert.equal(full.status, 200);
    assert.equal(createHash('sha256').update(full.body).digest('hex'),
      createHash('sha256').update(s.audio).digest('hex'));
    for (const [range, start, end] of [['bytes=1048500-1048700', 1048500, 1048700],
      ['bytes=-1000', s.audio.length - 1000, s.audio.length - 1]]) {
      const res = await s.request(path, { headers: { Range: range } });
      assert.equal(res.status, 206);
      assert.deepEqual(res.body, s.audio.subarray(start, end + 1));
    }
    assert.equal((await s.request(path, { headers: { Range: 'bytes=9999999-' } })).status, 416);
    assert.notEqual((await s.request(path, { headers: { Range: 'bytes=9999999-' } }))
      .headers.get('x-cache-status'), 'HIT');
    const before = s.calls.length;
    assert.equal((await s.request(path + (path.includes('?') ? '&' : '?') + 'random=x',
      { headers: { Range: 'bytes=0-0' } })).headers.get('x-cache-status'), 'HIT');
    assert.equal(s.calls.length, before);
  }
  const second = '/tracks/No.2.mp3';
  assert.equal((await s.request(second)).status, 200);
  assert.deepEqual((await s.request(second, { headers: { Range: 'bytes=0-0' } })).body, s.audio.subarray(0, 1));
  for (const name of ['cookie', 'failure']) {
    const path = '/_next/static/chunks/' + name + '.js';
    await s.request(path);
    assert.notEqual((await s.request(path)).headers.get('x-cache-status'), 'HIT');
  }
  const absent = '/_next/static/chunks/absent.js';
  assert.equal((await s.request(absent)).status, 404);
  assert.equal((await s.request(absent)).headers.get('x-cache-status'), 'HIT');
  assert.equal((await s.request(staticPath, { method: 'POST' })).status, 405);
  await assert.rejects(s.request('/', { headers: { Host: 'unknown.invalid' } }));
  const absentMedia = '/media/absent' + '0'.repeat(37);
  assert.equal((await s.request(absentMedia)).status, 404);
  assert.equal((await s.request(absentMedia)).headers.get('x-cache-status'), 'HIT');
  const api = await s.request('/api/ping', { headers: { 'x-pond-client-ip': 'fake', 'x-pond-edge-secret': 'fake' } });
  const apiHeaders = JSON.parse(api.body.toString());
  assert.equal(apiHeaders['x-pond-client-ip'], '127.0.0.1');
  assert.equal(apiHeaders['x-pond-edge-secret'], 'a'.repeat(64));
  await s.request('/media/' + 'c'.repeat(43), { headers: { 'x-pond-client-ip': 'fake', 'x-pond-edge-secret': 'fake',
    Cookie: 'canary-cookie=private', Authorization: 'Bearer canary-private', Range: 'bytes=0-0' } });
  const mediaHeaders = s.calls.at(-1).headers;
  assert.equal(mediaHeaders['x-pond-edge-secret'], undefined);
  assert.equal(mediaHeaders['x-pond-client-ip'], undefined);
  assert.equal(mediaHeaders.cookie, undefined);
  assert.equal(mediaHeaders.authorization, undefined);
  assert.ok(s.calls.filter(call => call.url.startsWith('/tracks/No.1.mp3'))
    .every(call => call.url === '/tracks/No.1.mp3?v=' + 'a'.repeat(64)));
  writeFileSync(join(s.root, 'upstream.failed'), 'offline');
  assert.equal((await s.request('/_edge/health')).status, 503);
  unlinkSync(join(s.root, 'upstream.failed'));
  assert.equal((await s.request('/_edge/health')).status, 200);
  console.log('nginx 真实缓存、Range、动态隔离、密钥清洗与健康标记合同通过');
} finally { await s.stop(); }
