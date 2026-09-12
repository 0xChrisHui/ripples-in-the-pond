import '../_env';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

if (process.env.SOURCE_CURSOR_TEST_DATABASE !== '1'
  || process.env.NEXT_PUBLIC_CHAIN_ID !== '11155420') {
  throw new Error('只允许在显式标记的 OP Sepolia 独立测试库运行');
}
const url = process.env.SERVER_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SERVER_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('测试 Supabase service-role 环境不完整');
const db = createClient(url, key, { auth: { persistSession: false } });
const contract = `0x${randomBytes(20).toString('hex')}`;

async function initialize(chainId: number) {
  return db.rpc('initialize_source_chain_cursor', {
    p_chain_id: chainId,
    p_score_contract: contract,
    p_safe_head: '100',
  });
}

async function main() {
const initialized = await Promise.all([initialize(11155420), initialize(11155420)]);
assert.equal(
  initialized.filter((result) => !result.error).length,
  1,
  `并发初始化结果：${initialized.map((result) => result.error?.message ?? 'ok').join(' | ')}`,
);

const advances = await Promise.all([
  db.rpc('advance_source_chain_cursor', {
    p_chain_id: 11155420, p_score_contract: contract, p_expected: '100', p_next: '110',
  }),
  db.rpc('advance_source_chain_cursor', {
    p_chain_id: 11155420, p_score_contract: contract, p_expected: '100', p_next: '120',
  }),
]);
assert.equal(
  advances.filter((result) => !result.error).length,
  1,
  `并发推进结果：${advances.map((result) => result.error?.message ?? 'ok').join(' | ')}`,
);
const winner = advances.find((result) => !result.error)?.data;

const regression = await db.rpc('advance_source_chain_cursor', {
  p_chain_id: 11155420,
  p_score_contract: contract,
  p_expected: String(winner),
  p_next: '90',
});
assert.ok(regression.error);
const wrongChain = await db.rpc('advance_source_chain_cursor', {
  p_chain_id: 10, p_score_contract: contract, p_expected: '100', p_next: '101',
});
assert.ok(wrongChain.error);
const direct = await db.from('system_kv').upsert({
  key: `chain-events:cursor:11155420:${contract}`,
  value: '1',
}, { onConflict: 'key' });
assert.ok(direct.error);

console.log(JSON.stringify({ contract, initialized: 1, concurrentAdvance: winner }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
