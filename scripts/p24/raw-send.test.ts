import assert from 'node:assert/strict';
import test from 'node:test';
import * as viem from 'viem';
import { optimism } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { loadOfflineModule } from '../p14-j/offline-module';

test('实际 viem 本地签名后、原始交易交给节点前检查；拒绝时不触发 RPC', async () => {
  const account = privateKeyToAccount(('0x' + '12'.repeat(32)) as viem.Hex);
  const events: string[] = [];
  let expected: viem.Hex | undefined;
  const rpc = { request: async (args: { method: string; params: viem.Hex[] }) => {
    if (args.method === 'eth_chainId') return '0xa';
    assert.equal(args.method, 'eth_sendRawTransaction');
    const hash = viem.keccak256(args.params[0]);
    assert.equal(hash, expected);
    events.push('raw');
    return hash;
  }};
  const mod = loadOfflineModule<typeof import('../../src/lib/chain/broadcast/guarded-wallet')>(
    'src/lib/chain/broadcast/guarded-wallet.ts', { viem, '../public-client':{ publicClient:rpc } });
  for (const allow of [false, true]) {
    const wallet = mod.guardedWallet(account, optimism, async hash => {
      events.push('guard'); expected = hash;
      if (!allow) throw Error('租约过期');
    });
    const result = wallet.sendTransaction({ to:account.address, value:0n, gas:21000n,
      nonce:0, chain:optimism, type:'eip1559', maxFeePerGas:1n, maxPriorityFeePerGas:1n });
    if (allow) assert.equal(await result, expected);
    else await assert.rejects(result,/租约过期/);
  }
  assert.deepEqual(events,['guard','guard','raw']);
});
