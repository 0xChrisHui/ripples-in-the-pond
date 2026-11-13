const assert = require('node:assert/strict');
const test = require('node:test');
const { load } = require('./load.cjs');
const wallet = '0x' + '12'.repeat(20), other = '0x' + '34'.repeat(20);
const tick = () => new Promise(r => setImmediate(r));
const jsx = (type, props) => ({ type, props });

function harness() {
  const effects = [], cleanups = [], slots = [], cache = [], calls = [];
  let cursor = 0, auth = { authenticated: true, authSource: 'privy', userId: 'user-A', evmAddress: wallet,
    selectedExternalWallet: { address: wallet }, walletCapability: { walletKind: 'external', activeWalletAddress: wallet } };
  let finish, finishSend;
  const mint = { prepareOrder: () => new Promise(resolve => { calls.push('prepare'); finish = resolve; }),
    sendOrder: async () => { calls.push('send'); return new Promise(resolve => { finishSend = () => { calls.push('hash-recovered'); resolve('hash'); }; }); },
    getOrder: async () => ({ orderId: 'order-A', status: 'submitted', txHash: 'hash' }) };
  const react = { useRef: value => slots[cursor++] ??= { current: value }, useState: value => {
    const n = cursor++; slots[n] ??= value; return [slots[n], v => { slots[n] = typeof v === 'function' ? v(slots[n]) : v; }];
  }, useEffect: f => effects.push(f), useLayoutEffect: f => effects.push(f), useSyncExternalStore: () => {} };
  const identityModule = load('src/components/music-catalog/claim/MintStatusPrefetch.tsx', {
    react, '../../../hooks/useAuth': {}, '../../../lib/mint-notice': {}, './mint-status-cache': {},
  });
  const imports = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'next-intl': { useTranslations: () => s => s },
    '../../../hooks/useAuth': { useAuth: () => auth }, '../../../features/material-catalog/mint/useMaterialMint': { useMaterialMint: () => mint },
    '../../../features/material-catalog/mint/order-model': { canSendMaterialOrder: () => true },
    '../../../features/material-catalog/mint/wait-until': { waitUntil: async check => check() },
    '../../../lib/music-catalog/asset-registry': { getOriginalDeployment: () => ({ status: 'ready', contractAddress: 'yes', metadataUri: 'yes' }) },
    '../../../lib/mint-notice': { announceMintRecorded: () => calls.push('recorded') },
    '../../../features/material-catalog/mint/friendly-error': { describeMaterialError: () => ({}), localMaterialNotice: () => ({}) },
    './MaterialNoticeView': {}, './MaterialOrderView': {}, '../../pond-shell/PondRouteLink': {},
    './mint-status-cache': { isFinishedOrder: () => false, isOrderInFlight: () => false, ethCache: { get: () => null,
      set: (address, trackId, order) => cache.push({ address, trackId, order }) }, mintReadFailed: () => false, setMintActivity: () => {} },
    './MintStatusPrefetch': identityModule,
  };
  const { default: Component } = load('src/components/music-catalog/claim/EthereumMaterialMint.tsx', imports);
  function render(trackId = 'track-A') {
    cursor = 0;
    const tree = Component({ track: { trackId } });
    while (effects.length) { const stop = effects.shift()(); if (typeof stop === 'function') cleanups.push(stop); }
    return tree;
  }
  function button(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'button' && node.props.onClick) return node;
    for (const child of [node.props?.children ?? []].flat(Infinity)) { const hit = button(child); if (hit) return hit; }
  }
  return { calls, cache, scope: identityModule.mintAccessScope, auth: () => auth,
    setAuth: patch => { auth = { ...auth, ...patch }; render(); }, render,
    start: async () => { button(render()).props.onClick(); await tick(); },
    unmount: () => cleanups.forEach(f => f()),
    complete: async () => { finish({ orderId: 'order-A', status: 'prepared' }); await tick(); },
    finishSend: async () => { finishSend(); await tick(); },
  };
}
test('真实收藏组件：准备期间卸载，不能继续弹旧钱包', async () => {
  const h = harness(); await h.start(); h.unmount(); await h.complete();
  assert.deepEqual(h.calls, ['prepare']);
  assert.equal(h.cache[0].trackId, 'track-A', '准备结果仍归原曲目缓存，供日后恢复');
});
test('真实收藏组件：同钱包换曲、换用户、换实际关联钱包均取消未发送意图', async () => {
  for (const change of [h => h.render('track-B'), h => h.setAuth({ userId: 'user-B' }),
    h => h.setAuth({ selectedExternalWallet: { address: other } })]) {
    const h = harness(); await h.start(); change(h); await h.complete();
    assert.deepEqual(h.calls, ['prepare']);
  }
});
test('scope包含实际selectedExternalWallet，地址大小写不改变同一身份', () => {
  const h = harness(), a = h.auth();
  assert.notEqual(h.scope(a, 'A'), h.scope({ ...a, selectedExternalWallet: { address: other } }, 'A'));
  assert.equal(h.scope(a, 'A'), h.scope({ ...a, selectedExternalWallet: { address: wallet.toUpperCase() } }, 'A'));
});
test('已经调用发送后卸载，仍保留提交结果与旧钱包缓存', async () => {
  const h = harness(); await h.start(); await h.complete(); assert.deepEqual(h.calls, ['prepare', 'send']);
  h.unmount(); await h.finishSend();
  assert.ok(h.calls.includes('hash-recovered')); assert.ok(h.calls.includes('recorded'));
  assert.equal(h.cache.at(-1).address.toLowerCase(), wallet);
  assert.equal(h.cache.at(-1).order.txHash, 'hash');
});
