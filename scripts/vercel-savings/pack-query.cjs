const assert = require('node:assert/strict');
const test = require('node:test');
const { load } = require('../p23/regressions/load.cjs');
const { hooks } = require('./hook-harness.cjs');
const flush = () => new Promise(r => setImmediate(r));

function setup() {
  const h = hooks(), requests = [];
  let target = { chainId: 10, contract: '0x' + '12'.repeat(20), tokenId: 1 };
  const { useScorePack } = load('src/hooks/score-pack/useScorePack.ts', {
    react: h.react, viem: {}, 'viem/chains': {}, '@/src/lib/score-pack/contract': {},
    '../useAuth': { useAuth: () => ({ walletCapability: {} }) },
    '@/src/lib/performance/visible-poll': { startVisiblePolling: () => () => {} },
  }, { fetch: url => new Promise(resolve => { requests.push({ url, resolve }); }),
    URLSearchParams, setInterval, clearInterval, document: new EventTarget() });
  const render = () => h.render(() => useScorePack(target));
  return { requests, render, unmount: h.unmount,
    select(id) { target = { ...target, tokenId: id }; return render(); } };
}
test('同一资产包首读与重复刷新共用一个在途请求', async () => {
  const h = setup(); const value = h.render();
  const a = value.refresh(), b = value.refresh();
  assert.equal(h.requests.length, 1);
  h.requests[0].resolve({ ok: true, json: async () => ({ enabled: true }) });
  await Promise.all([a, b]); h.unmount();
});
test('切换目标后旧请求不能覆盖新资产包状态', async () => {
  const h = setup(); h.render(); h.select(2);
  assert.equal(h.requests.length, 2);
  h.requests[1].resolve({ ok: true, json: async () => ({ enabled: true, account: 'new' }) }); await flush();
  h.requests[0].resolve({ ok: true, json: async () => ({ enabled: true, account: 'old' }) }); await flush();
  assert.equal(h.render().status.account, 'new'); h.unmount();
});
