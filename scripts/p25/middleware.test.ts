import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { NextRequest, NextResponse } from 'next/server';
import * as ip from '../../src/lib/rate-limit/client-ip';
import { localReviewBlocks } from '../../src/lib/runtime/local-review';

const requireLocal = createRequire(import.meta.url);
function load(outcome: 'ok' | 'deny' | 'error' | 'disabled', review = false) {
  const keys: string[] = [];
  const module = { exports: {} as { middleware: (req: NextRequest) => Promise<NextResponse> } };
  const code = ts.transpileModule(readFileSync('middleware.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const dependencies: Record<string, unknown> = {
    'next/server': { NextRequest, NextResponse },
    '@/src/lib/runtime/local-review': { localReviewBlocks },
    '@/src/lib/rate-limit/client-ip': ip,
    '@upstash/redis': { Redis: class {} },
    '@upstash/ratelimit': { Ratelimit: class {
      static slidingWindow(count: number, window: string) {
        assert.equal(count, 60); assert.equal(window, '10 s'); return {};
      }
      constructor(config: { analytics: boolean }) { assert.equal(config.analytics, false); }
      async limit(key: string) {
        keys.push(key);
        if (outcome === 'error') throw Error('离线限流异常');
        return { success: outcome !== 'deny', limit: 60, remaining: 59, reset: Date.now() + 5000 };
      }
    } },
  };
  runInNewContext(code, { module, exports: module.exports, Headers, console: { warn() {}, error() {} },
    require: (id: string) => dependencies[id] ?? requireLocal(id), process: { env: {
      EDGE_PROXY_SECRET: 'a'.repeat(64), LOCAL_REVIEW_ONLY: review ? '1' : '0',
      ...(outcome === 'disabled' ? {} : { UPSTASH_REDIS_REST_URL: 'https://offline', UPSTASH_REDIS_REST_TOKEN: 'offline' }),
    } },
  });
  return { run: module.exports.middleware, keys };
}
const req = (path: string, edge = true) => new NextRequest(`https://pond-ripple.xyz${path}`, {
  method: path.includes('/mint/') ? 'POST' : 'GET', headers: {
    'x-forwarded-for': '203.0.113.1', 'x-pond-client-ip': '192.0.2.1',
    'x-pond-edge-secret': edge ? 'a'.repeat(64) : 'wrong',
  },
});

test('公开 API、禁用限流与本地保护的提前返回均带核验来源', async () => {
  for (const [outcome, path, review, status] of [
    ['ok', '/api/ping', false, 200], ['disabled', '/api/mint/material', false, 200],
    ['ok', '/api/mint/material', true, 503],
  ] as const) {
    const res = await load(outcome, review).run(req(path));
    assert.equal(res.status, status);
    assert.equal(res.headers.get('x-pond-ip-source'), 'edge');
  }
});

test('成功、429 与后端失败均带核验头，P24 阈值和失败开放不变', async () => {
  for (const outcome of ['ok', 'deny', 'error'] as const) {
    const worker = load(outcome);
    const res = await worker.run(req('/api/mint/material'));
    assert.equal(res.headers.get('x-pond-ip-source'), 'edge');
    assert.equal(res.status, outcome === 'deny' ? 429 : 200);
    assert.equal(worker.keys[0], '192.0.2.1');
    if (outcome === 'deny') assert.ok(Number(res.headers.get('retry-after')) >= 1);
  }
  const direct = load('ok');
  assert.equal((await direct.run(req('/api/mint/material', false))).headers.get('x-pond-ip-source'), 'direct');
  assert.equal(direct.keys[0], '203.0.113.1');
});

test('媒体分支只保留媒体必要头，Cookie/Authorization/edge 凭据不进入外部改写', async () => {
  const worker = load('ok');
  for (const path of ['/media/' + 'a'.repeat(43), '/media/' + 'a'.repeat(43) + '/',
    '/MEDIA/' + 'a'.repeat(43), '/Media/' + 'a'.repeat(43)]) {
    const res = await worker.run(new NextRequest('https://pond-ripple.xyz' + path, {
      headers: { Cookie: 'canary=private', Authorization: 'Bearer private', 'x-pond-edge-secret': 'private',
        'x-pond-client-ip': '192.0.2.1', 'x-extra-secret': 'private', Range: 'bytes=0-0', 'If-Range': 'etag',
        Accept: 'audio/mpeg', Host: 'pond-ripple.xyz' },
    }));
    assert.equal(res.headers.get('x-middleware-request-cookie'), null);
    assert.equal(res.headers.get('x-middleware-request-authorization'), null);
    assert.equal(res.headers.get('x-middleware-request-x-pond-edge-secret'), null);
    assert.equal(res.headers.get('x-middleware-request-x-extra-secret'), null);
    assert.equal(res.headers.get('x-middleware-request-range'), 'bytes=0-0');
    assert.equal(res.headers.get('x-middleware-request-if-range'), 'etag');
  }
  assert.equal(worker.keys.length, 0);
});
