const assert = require('node:assert/strict');
const test = require('node:test');
const { readFileSync } = require('node:fs');
const { load } = require('../p23/regressions/load.cjs');
const jsx = (type, props) => ({ type, props });

function poster(state) {
  return load('app/(pond)/score/[id]/poster/route.tsx', {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'next/og': { ImageResponse: class extends Response { constructor(_, opts) { super('image', opts); } } },
    qrcode: { default: { toDataURL: async () => 'data:image/png;base64,AA==' } },
    '@/src/data/score-source': { getScoreById: async () => ({ state, tokenId: 12, id: '12', coverUrl: '', eventCount: 3 }) },
    '@/src/i18n/content/og-copy': { posterLocale: () => 'zh', ogText: () => '中文' },
  }, { Response, process: { env: {} } }).GET;
}
test('完成海报允许CDN缓存，处理中和失败海报不得共享缓存', async () => {
  for (const state of ['ready', 'processing', 'failed']) {
    const response = await poster(state)(new Request('https://example.test/score/12/poster'), { params: Promise.resolve({ id: '12' }) });
    assert.equal(response.headers.get('Cache-Control'), state === 'ready'
      ? 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800' : 'private, no-store');
  }
});
test('公开曲目目录响应可被CDN缓存五分钟', async () => {
  const { GET } = load('app/api/music-catalog/route.ts', {
    '@/src/lib/music-catalog/asset-registry': { getMusicCatalog: () => ({ revision: 'verified' }) },
  }, { Response });
  const response = await GET();
  assert.equal(response.headers.get('Cache-Control'), 'public, max-age=300, s-maxage=300, stale-while-revalidate=60');
  assert.equal(response.headers.get('ETag'), '"verified"');
});
test('作品渲染不再输出音频预载，避免点击前下载', () => {
  const source = readFileSync('app/(pond)/score/[id]/components/ScorePondScene.tsx', 'utf8');
  assert.ok(!source.includes('preloadStartupAudio(score)'));
});
