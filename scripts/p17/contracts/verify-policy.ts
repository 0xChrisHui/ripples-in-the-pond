import assert from 'node:assert/strict';
import { requireMaterialIssuancePolicy, MaterialError } from '../../../src/lib/material-mint/server/policy';
import type { PublicClient } from 'viem';
import type { MaterialOrder } from '../../../src/lib/material-mint/types';
import { getMusicCatalog } from '../../../src/lib/music-catalog/asset-registry';

// 已批准发行政策不等于允许生产启用；不访问数据库、RPC或真实钱包。
assert.doesNotThrow(() => requireMaterialIssuancePolicy(), '用户已批准规则，不能继续返回政策待决');
const originalMode = process.env.ETH_MATERIAL_SELF_MINT_MODE;
const originalList = process.env.ETH_MATERIAL_SELF_MINT_ALLOWLIST;
const originalUrl = process.env.SERVER_SUPABASE_URL;
const originalKey = process.env.SERVER_SUPABASE_SERVICE_ROLE_KEY;
async function main() { try {
  // 只满足模块初始化，任何调用都不连接数据库；不加载真实环境文件。
  process.env.SERVER_SUPABASE_URL = 'http://127.0.0.1:1';
  process.env.SERVER_SUPABASE_SERVICE_ROLE_KEY = 'local-test-key';
  const { requireMaterialMode } = await import('../../../src/lib/material-mint/server/access');
  const { signMaterialOrder } = await import('../../../src/lib/material-mint/server/authorization');
  const { requireMaterialClaimAvailable } = await import('../../../src/lib/material-mint/server/eligibility');
  const row = { chain_id: 1, token_id: '1', amount: 1, user_id: 'local-test', status: 'prepared',
    track_id: getMusicCatalog().tracks[0].trackId, contract_address: `0x${'11'.repeat(20)}`,
    recipient_address: `0x${'22'.repeat(20)}` } as MaterialOrder;
  delete process.env.ETH_MATERIAL_SELF_MINT_MODE;
  assert.throws(() => requireMaterialMode('local-test'), (error: unknown) => error instanceof MaterialError && error.code === 'FEATURE_DISABLED');
  process.env.ETH_MATERIAL_SELF_MINT_MODE = 'allowlist';
  process.env.ETH_MATERIAL_SELF_MINT_ALLOWLIST = 'allowed';
  assert.throws(() => requireMaterialMode('local-test'));
  assert.doesNotThrow(() => requireMaterialMode('allowed'));
  await assert.rejects(() => signMaterialOrder(row), (error: unknown) => error instanceof MaterialError && error.code === 'FEATURE_DISABLED');
  process.env.ETH_MATERIAL_SELF_MINT_MODE = 'live';
  await assert.rejects(() => signMaterialOrder(row), (error: unknown) => error instanceof MaterialError && error.code === 'DEPLOYMENT_NOT_READY');
  let claimed = false;
  const client = { getChainId: async () => 1,
    readContract: async (input: { functionName: string; address: string; args: readonly unknown[] }) => {
      assert.equal(input.functionName, 'hasClaimed', '不能读余额代替历史领取资格');
      assert.equal(input.address.toLowerCase(), row.contract_address);
      assert.deepEqual(input.args, [row.recipient_address, 1n]);
      return claimed;
    } } as unknown as PublicClient;
  await requireMaterialClaimAvailable(client, row);
  claimed = true;
  await assert.rejects(() => requireMaterialClaimAvailable(client, row), (error: unknown) => error instanceof MaterialError && error.code === 'MATERIAL_ALREADY_CLAIMED');
  await assert.rejects(() => requireMaterialClaimAvailable(client, { ...row, amount: 2 } as unknown as MaterialOrder));
  await assert.rejects(() => requireMaterialClaimAvailable({ ...client, getChainId: async () => 10 } as unknown as PublicClient, row));
} finally {
  if (originalMode === undefined) delete process.env.ETH_MATERIAL_SELF_MINT_MODE; else process.env.ETH_MATERIAL_SELF_MINT_MODE = originalMode;
  if (originalList === undefined) delete process.env.ETH_MATERIAL_SELF_MINT_ALLOWLIST; else process.env.ETH_MATERIAL_SELF_MINT_ALLOWLIST = originalList;
  if (originalUrl === undefined) delete process.env.SERVER_SUPABASE_URL; else process.env.SERVER_SUPABASE_URL = originalUrl;
  if (originalKey === undefined) delete process.env.SERVER_SUPABASE_SERVICE_ROLE_KEY; else process.env.SERVER_SUPABASE_SERVICE_ROLE_KEY = originalKey;
}
console.log('ETH原曲：默认off/独立allowlist、错误部署坐标拒绝、链上历史资格/数量/网络检查，通过');
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
