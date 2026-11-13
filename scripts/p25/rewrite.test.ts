import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import config from '../../next.config';

const { pathToRegexp } = createRequire(import.meta.url)('next/dist/compiled/path-to-regexp') as {
  pathToRegexp(pattern: string): RegExp;
};

test('同源媒体缺省不启用；配置后仅改写完整 43 位 txid', async () => {
  const old = process.env.MEDIA_BLOB_ORIGIN;
  try {
    delete process.env.MEDIA_BLOB_ORIGIN;
    assert.deepEqual(await config.rewrites?.(), []);
    process.env.MEDIA_BLOB_ORIGIN = 'https://snyugncezabohwf6.public.blob.vercel-storage.com/';
    const rules = await config.rewrites?.();
    assert.ok(Array.isArray(rules));
    assert.equal(rules.length, 1);
    assert.equal(rules[0].destination,
      'https://snyugncezabohwf6.public.blob.vercel-storage.com/media/:txid');
    const pattern = pathToRegexp(rules[0].source);
    assert.ok(pattern.test('/media/' + 'a'.repeat(43)));
    for (const path of ['/media/' + 'a'.repeat(42), '/media/' + 'a'.repeat(44),
      '/media/' + 'a'.repeat(43) + '/extra', '/media/' + '.'.repeat(43), '/api/media/' + 'a'.repeat(43)]) {
      assert.equal(pattern.test(path), false, path);
    }
  } finally {
    if (old === undefined) delete process.env.MEDIA_BLOB_ORIGIN;
    else process.env.MEDIA_BLOB_ORIGIN = old;
  }
});

test('错误配置拒绝构建，不能包含路径、凭证、参数或指向自身造成循环', async () => {
  const old = process.env.MEDIA_BLOB_ORIGIN;
  try {
    for (const origin of ['http://blob.example', 'https://blob.example/media',
      'https://u:p@blob.example', 'https://blob.example?q=x', 'https://blob.example/#x',
      'https://pond-ripple.xyz', 'invalid']) {
      process.env.MEDIA_BLOB_ORIGIN = origin;
      await assert.rejects(async () => config.rewrites?.(), /MEDIA_BLOB_ORIGIN/);
    }
  } finally {
    if (old === undefined) delete process.env.MEDIA_BLOB_ORIGIN;
    else process.env.MEDIA_BLOB_ORIGIN = old;
  }
});
