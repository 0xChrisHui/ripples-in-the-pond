import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter } from 'node:events';
import * as viem from 'viem';
import { createMaterialMintClient } from '../../../src/features/material-catalog/mint/order-client';
import { getMusicCatalog } from '../../../src/lib/music-catalog/asset-registry';
import { rememberMaterialHash } from '../../../src/features/material-catalog/mint/attempt-cache';
import { MATERIAL_ABI } from '../../../src/lib/material-mint/contract';
import type { sendMaterialVoucher, MaterialVoucher } from '../../../src/features/material-catalog/mint/wallet-send';
import { loadOfflineModule } from '../../p14-j/offline-module';

const id = `0x${'ab'.repeat(32)}` as const, hash = `0x${'cd'.repeat(32)}` as const;
const address = `0x${'12'.repeat(20)}` as const, contract = `0x${'34'.repeat(20)}` as const;
const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key),
} });

test('真实订单客户端：授权返回后意图失效，不进入钱包发送器', async () => {
  storage.clear();
  const catalog = getMusicCatalog(), track = catalog.tracks[0], deployment = track.deployments.find(d => d.chainId === 1)!;
  const row = { orderId: id, trackId: track.trackId, chainId: 1, contractAddress: deployment.contractAddress,
    tokenId: deployment.tokenId, recipientAddress: address, amount: 1, metadataUri: deployment.metadataUri,
    catalogRevision: catalog.revision, status: 'prepared', version: 1, txHash: null, digest: id };
  let current = true, sends = 0;
  const client = createMaterialMintClient({ userId: 'user-A', wallet: { address,
    switchChain: async () => {}, getEthereumProvider: async () => { throw Error('禁止访问真实钱包'); } },
  request: async (_path, method) => {
    if (method === 'GET') return row;
    current = false;
    return { ...row, status: 'authorized', version: 2, authorizer: address, signature: `0x${'11'.repeat(65)}`,
      authorization: { orderId: id, tokenId: deployment.tokenId, amount: '1', recipient: address,
        tokenURIHash: id, deadline: '12345678900' } };
  }, send: async () => { sends++; return hash; } });
  await assert.rejects(() => client.sendOrder(id, () => current), /意图/);
  assert.equal(sends, 0);
  storage.clear(); row.status = 'unknown';
  const cacheIdentity = { userId: 'user-A', environment: catalog.environment, chainId: 1,
    contractAddress: deployment.contractAddress!, recipientAddress: address, orderId: id };
  rememberMaterialHash(cacheIdentity, hash);
  const paths: string[] = [];
  const recovery = createMaterialMintClient({ userId: 'user-A', wallet: { address,
    switchChain: async () => {}, getEthereumProvider: async () => { throw Error('禁止访问真实钱包'); } },
  request: async (path) => { paths.push(path); return { ...row, status: path === 'submission' ? 'submitted' : 'unknown' }; },
  send: async () => { sends++; return hash; } });
  assert.equal(await recovery.sendOrder(id, () => false), hash, '旧hash恢复不被UI意图取消');
  assert.deepEqual(paths, [`orders/${id}`, 'submission']); assert.equal(sends, 0);
});

function walletBoundary(invalidate: 'initial' | 'preflight' | 'attempt' | 'after-send') {
  let current = invalidate !== 'initial';
  const calls: string[] = [];
  const metadataUri = `ar://${'A'.repeat(43)}`, revision = 'a'.repeat(64);
  const provider = Object.assign(new EventEmitter(), { request: async ({ method }: { method: string }) => method === 'eth_chainId' ? '0x1' : [address] });
  const sdk = { ...viem, createPublicClient: () => ({
    simulateContract: async () => { calls.push('preflight'); if (invalidate === 'preflight') current = false; },
    estimateContractGas: async () => 21_000n, getGasPrice: async () => 1n, getBalance: async () => 1_000_000n,
  }), createWalletClient: () => ({ sendTransaction: async () => {
    calls.push('wallet-send'); if (invalidate === 'after-send') current = false; return hash;
  } }) };
  const senderModule = loadOfflineModule<{ sendMaterialVoucher: typeof sendMaterialVoucher }>(
    'src/features/material-catalog/mint/wallet-send.ts', {
      viem: sdk, 'viem/chains': { mainnet: {}, sepolia: {} },
      '../../../lib/music-catalog/asset-registry': { getMusicCatalog: () => ({ revision }),
        getOriginalDeployment: () => ({ status: 'ready', contractAddress: contract, metadataUri, tokenId: '1' }) },
      '../../../lib/material-mint/contract': { MATERIAL_ABI, hashMaterialAuthorization: () => id },
    });
  const voucher: MaterialVoucher = { orderId: id, trackId: 'track-A', chainId: 1, contractAddress: contract,
    recipientAddress: address, metadataUri, catalogRevision: revision, digest: id, signature: '0x11', authorizer: address,
    version: 1, authorization: { orderId: id, tokenId: '1', amount: '1', recipient: address,
      tokenURIHash: viem.keccak256(viem.stringToHex(metadataUri)), deadline: '12345678900' } };
  const run = () => senderModule.sendMaterialVoucher(voucher, { address,
    switchChain: async () => { calls.push('switch'); }, getEthereumProvider: async () => provider }, {
    isCurrent: () => current,
    attempt: async () => { calls.push('attempt'); if (invalidate === 'attempt') current = false; },
    outcome: async outcome => { calls.push(outcome); }, submission: async () => { calls.push('submission'); },
    remember: () => calls.push('remember'), forget: () => calls.push('forget'),
  });
  return { run, calls };
}
test('真实发送器：失效意图在切链、预检后或attempt后均不得弹签名', async () => {
  for (const boundary of ['initial', 'preflight', 'attempt'] as const) {
    const h = walletBoundary(boundary);
    await assert.rejects(h.run, /意图/);
    assert.ok(!h.calls.includes('wallet-send'));
    if (boundary === 'initial') assert.deepEqual(h.calls, []);
    if (boundary === 'preflight') assert.ok(!h.calls.includes('attempt'));
    if (boundary === 'attempt') assert.equal(h.calls.at(-1), 'rejected', '确认未发送，沿现有拒绝分支释放attempt');
  }
});
test('真实发送器：钱包已返回hash后意图失效仍完成恢复记账', async () => {
  const h = walletBoundary('after-send');
  assert.equal(await h.run(), hash);
  assert.deepEqual(h.calls.slice(-4), ['wallet-send', 'remember', 'submission', 'forget']);
});
