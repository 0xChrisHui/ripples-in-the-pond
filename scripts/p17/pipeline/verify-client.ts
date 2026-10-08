import assert from 'node:assert/strict';
import { createMaterialMintClient } from '../../../src/features/material-catalog/mint/order-client';
import { rememberMaterialHash, readMaterialHash, forgetMaterialHash } from '../../../src/features/material-catalog/mint/attempt-cache';
import { getMusicCatalog } from '../../../src/lib/music-catalog/asset-registry';
import type { MaterialVoucher } from '../../../src/features/material-catalog/mint/wallet-send';
import { getAddress, type Hex } from 'viem';
import { parseMaterialOrder } from '../../../src/features/material-catalog/mint/order-model';
import { sendMaterialVoucher } from '../../../src/features/material-catalog/mint/wallet-send';

async function main() {
  // 测试只替换HTTP/钱包/浏览器存储边界，不加载.env、不启用假部署、不发送资金。
  const storage = new Map<string, string>(), previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  } });
  try {
    const id = `0x${'ab'.repeat(32)}` as Hex, hash = `0x${'cd'.repeat(32)}` as Hex;
    const catalog=getMusicCatalog(), deployment=catalog.tracks[0].deployments.find((item)=>item.chainId===1)!;
    const address = `0x${'12'.repeat(20)}` as const, contract = getAddress(deployment.contractAddress!);
    const row = { orderId: id, trackId: catalog.tracks[0].trackId, chainId: 1 as const,
      contractAddress: contract, tokenId: '1', recipientAddress: address, amount: 1,
      metadataUri: deployment.metadataUri!, catalogRevision: catalog.revision,
      status: 'unknown', version: 3, digest: id, txHash: null };
    const wallet = { address, switchChain: async () => { throw Error('夹具不能切真实链'); },
      getEthereumProvider: async () => { throw Error('夹具不能访问钱包'); } };
    const identity = { userId: 'owner-a', environment: 'production', chainId: 1,
      contractAddress: contract, recipientAddress: address, orderId: id };
    const requests: string[] = []; let sends = 0, failSubmission = false, wrongVoucher = false;
    const request = async (path: string, method: string, body?: Record<string, unknown>) => {
      requests.push(`${method}:${path}`);
      if (method === 'GET') return path === 'orders' || path.startsWith('orders?') ? { orders: [row] } : { ...row };
      if (path === 'authorization') {
        row.status = 'authorized'; row.version++;
        return { ...row, orderId: wrongVoucher ? `0x${'ef'.repeat(32)}` : id, authorizer: address,
          signature: `0x${'11'.repeat(65)}`, authorization: { orderId: id, tokenId: '1', amount: '1',
            recipient: address, tokenURIHash: id, deadline: '12345678900' } };
      }
      assert.equal(body?.version, row.version, '恢复/发送必须使用当前CAS版本');
      assert.equal(body?.digest, id); assert.equal(body?.walletAddress, address);
      if (path === 'submission' && failSubmission) throw Error('本地HTTP夹具断开');
      row.version++; row.status = path === 'submission' ? 'submitted' : method === 'POST' ? 'sending' : 'unknown';
      return { ...row };
    };
    const client = createMaterialMintClient({ userId: 'owner-a', wallet, request,
      send: async (_voucher: MaterialVoucher, _wallet, state) => {
        sends++; await state.attempt(); state.remember(hash);
        try { await state.submission(hash); state.forget(); }
        catch (error) { await state.outcome('unknown'); throw error; }
        return hash;
      } });
    rememberMaterialHash(identity, hash);
    assert.equal(await client.sendOrder(id), hash);
    assert.deepEqual(requests, [`GET:orders/${id}`, 'POST:submission']);
    assert.equal(sends, 0, 'unknown恢复必须先登记旧hash，不能续签或再次发钱包');
    assert.equal(readMaterialHash(identity), null);

    requests.length = 0; row.status = 'unknown'; row.txHash = null;
    await assert.rejects(() => client.sendOrder(id), /等待核对/);
    assert.equal(requests.length, 1); assert.equal(sends, 0);
    rememberMaterialHash(identity, hash);
    const another = createMaterialMintClient({ userId: 'owner-b', wallet, request });
    await assert.rejects(() => another.sendOrder(id), /等待核对/);
    assert.equal(readMaterialHash(identity), hash, '换用户不得消费另一用户的恢复线索');
    const changed = createMaterialMintClient({ userId: 'owner-a', wallet: { ...wallet, address: contract }, request });
    await assert.rejects(() => changed.recoverOrder(id), /接收钱包/);
    assert.equal(readMaterialHash(identity), hash);

    forgetMaterialHash(identity); row.status = 'prepared'; row.digest = id; requests.length = 0;
    assert.equal(await client.sendOrder(id), hash);
    assert.equal(sends, 1);
    assert.deepEqual(requests, [`GET:orders/${id}`, 'POST:authorization', 'POST:attempt', 'POST:submission']);
    assert.equal(readMaterialHash(identity), null);

    row.status = 'prepared'; failSubmission = true;
    await assert.rejects(() => client.sendOrder(id), /断开/);
    assert.equal(row.status, 'unknown'); assert.equal(readMaterialHash(identity), hash);
    failSubmission = false; const sentBeforeRecovery = sends, signedBeforeRecovery = requests.filter(x => x.endsWith('authorization')).length;
    await client.recoverOrder(id);
    assert.equal(sends, sentBeforeRecovery); assert.equal(requests.filter(x => x.endsWith('authorization')).length, signedBeforeRecovery);
    assert.equal(readMaterialHash(identity), null);

    row.status = 'prepared'; wrongVoucher = true;
    await assert.rejects(() => client.sendOrder(id), /冻结订单/);
    assert.equal(sends, sentBeforeRecovery, '响应换订单不得触发钱包');
    const beforePrepare = requests.length;
    assert.equal((await client.prepareOrder(row.trackId)).orderId, id);
    assert.deepEqual(requests.slice(beforePrepare), [`GET:orders?trackId=${encodeURIComponent(row.trackId)}`]);
    const orders = await client.listOrders(row.trackId); assert.equal(orders[0].orderId, id);
    for (const mutation of [{ chainId: 10 }, { amount: 2 }, { status: 'invented' }, { version: -1 }, { recipientAddress: '0x0' }]) {
      assert.throws(() => parseMaterialOrder({ ...row, ...mutation }), '非法链/数量/状态/接收地址不得进入订单视图');
    }
    await assert.rejects(() => sendMaterialVoucher({ ...row, contractAddress:`0x${'34'.repeat(20)}`, status: undefined,
      digest: id, signature: `0x${'11'.repeat(65)}`,
      authorizer: address, authorization: { orderId: id, tokenId: '1', amount: '1', recipient: address, tokenURIHash: id,
        deadline: '12345678900' } } as MaterialVoucher, wallet, {
      attempt: async () => { throw Error('未部署不能占用attempt'); }, outcome: async () => { throw Error('不能发交易'); },
      submission: async () => { throw Error('不能发交易'); }, remember: () => { throw Error('不能写hash'); }, forget: () => {},
    }), /发行\/永久资料与目录不一致/, '真实发送器必须在访问钱包之前拒绝未部署原曲');
    row.status = 'unknown'; requests.length = 0;
    await client.recoverOrder(id, hash);
    assert.deepEqual(requests, [`GET:orders/${id}`, 'POST:submission']);
    const beforeInvalid = requests.length;
    await assert.rejects(() => client.recoverOrder(id, '0x1234' as Hex), /标识无效/);
    assert.equal(requests.length, beforeInvalid, '非法手工hash不能发HTTP或钱包请求');
    // 对账cron在用户停留钱包期间给sending订单加版本号：拒绝结果必须重读后重试，订单回到待领取。
    forgetMaterialHash(identity); row.status = 'prepared'; row.digest = id; row.version = 10;
    const strict = async (path: string, method: string, body?: Record<string, unknown>) => {
      if (method === 'GET') return path.startsWith('orders?') ? { orders: [row] } : { ...row };
      if (path === 'authorization') {
        row.status = 'authorized'; row.version++;
        return { ...row, authorizer: address, signature: `0x${'11'.repeat(65)}`, authorization: { orderId: id, tokenId: '1',
          amount: '1', recipient: address, tokenURIHash: id, deadline: '12345678900' } };
      }
      if (body?.version !== row.version) throw Error('订单状态已变化');
      row.version++; row.status = method === 'POST' ? 'sending' : body?.outcome === 'rejected' ? 'prepared' : 'unknown';
      return { ...row };
    };
    const racing = createMaterialMintClient({ userId: 'owner-a', wallet, request: strict,
      send: async (_voucher: MaterialVoucher, _wallet, state) => {
        await state.attempt(); row.version += 2; await state.outcome('rejected'); throw Error('用户拒绝');
      } });
    await assert.rejects(() => racing.sendOrder(id), /用户拒绝/);
    assert.equal(row.status, 'prepared', '版本被cron推进后，拒绝结果仍须落库并回到待领取');
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => { throw Error('缓存不可读'); } } });
    assert.equal(readMaterialHash(identity), null, '缓存不可用不应阻断真实订单查询与手工恢复');
    console.log('原曲客户端：unknown旧hash优先/不重发、丢回报恢复、CAS、换用户/钱包隔离、同源坐标与坏凭证拒绝，通过（I/O夹具）');
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous); else Reflect.deleteProperty(globalThis, 'localStorage');
  }
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
