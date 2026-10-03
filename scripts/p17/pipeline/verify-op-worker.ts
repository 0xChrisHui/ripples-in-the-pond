import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { resolveMaterialRecipient } from '../../../src/lib/runtime/material-recipient';
import { selectMaterialJobContract } from '../../../src/lib/material-mint/op/target';

// 运行真实worker，只替换数据库/RPC边界；不读取环境密钥、不广播交易。
const legacy = `0x${'aa'.repeat(20)}`;
const sbt = `0x${'bb'.repeat(20)}`;
const frozen = `0x${'cc'.repeat(20)}`;
const current = `0x${'dd'.repeat(20)}`;
const target = { status: 'ready', chainId: 10, contractAddress: sbt, standard: 'ERC1155' };
const compiled = ts.transpileModule(readFileSync('app/api/cron/process-mint-queue/steps.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
type Scenario = { snapshot?: boolean; stampFails?: boolean; trackExists?: boolean; snapshotFails?: boolean };
async function execute(options: Scenario) {
  const writes: { address: string; args: unknown[] }[] = [];
  const reads: string[] = []; const failures: string[] = [];
  const projection = { id: 'local-job', user_id: 'local-user', token_id: 1, retry_count: 0 };
  const job = { ...projection, status: 'minting_onchain', recipient_address: options.snapshot ? frozen : null,
    material_contract_address: options.snapshot ? sbt : null };
  const db = {
    rpc: async () => ({ data: [projection], error: null }),
    from(table: string) {
      let update: Record<string, unknown> | null = null;
      const builder = {
        select(fields: string) { reads.push(`${table}:${fields}`); return builder; },
        eq() { return builder; }, order() { return builder; }, limit() { return builder; },
        update(value: Record<string, unknown>) { update = value; return builder; },
        async maybeSingle() {
          if (table === 'mint_queue') return { data: options.snapshotFails ? null : job, error: options.snapshotFails ? new Error('夹具读回失败') : null };
          return { data: options.trackExists === false ? null : { id: 'real-local-track' }, error: null };
        },
        async single() { return { data: { evm_address: current }, error: null }; },
        then(accept: (value: unknown) => unknown) {
          return Promise.resolve({ data: null, error: options.stampFails && update?.mint_attempted_at ? new Error('夹具stamp失败') : null }).then(accept);
        },
      };
      return builder;
    },
  };
  const modules: Record<string, unknown> = {
    '@/src/lib/supabase': { supabaseAdmin: db },
    '@/src/lib/chain/operator-wallet': { operatorWalletClient: { async writeContract(value: { address: string; args: unknown[] }) {
      writes.push(value); return `0x${'11'.repeat(32)}`;
    } }, publicClient: { getChainId: async () => 10 } },
    '@/src/lib/chain/contracts': { MATERIAL_NFT_ADDRESS: legacy, MATERIAL_NFT_ABI: [] },
    '@/src/lib/runtime/material-recipient': { resolveMaterialRecipient },
    '@/src/lib/music-catalog/asset-registry': { getMusicCatalog: () => ({ tracks: [{ trackId: 'track' }] }), getOriginalMintDeployment: () => target },
    '@/src/lib/material-mint/op/target': { selectMaterialJobContract },
    '@/src/lib/material-mint/op/proof': { verifyOpSbtReceipt() { throw new Error('此夹具只验证发送路径'); } },
    './steps-helpers': { markFailed: async (_id: string, kind: string) => { failures.push(kind); }, markSuccess: async () => {}, resetToPending: async () => {} },
  };
  const exported: { trySendNew?: () => Promise<{ result: string }> } = {};
  vm.runInNewContext(compiled, { exports: exported, require(name: string) {
    assert.ok(name in modules, `禁止未登记I/O依赖 ${name}`); return modules[name];
  }, process: { env: { OP_ORIGINAL_SBT_MINT_MODE: 'live' } }, console: { error() {} }, Date });
  const result = await exported.trySendNew!(); return { result, writes, reads, failures };
}
async function main() {
  const snapshot = await execute({ snapshot: true });
  assert.equal(snapshot.result.result, 'sent');
  assert.equal(snapshot.writes[0].address.toLowerCase(), sbt);
  assert.equal(String(snapshot.writes[0].args[0]).toLowerCase(), frozen);
  assert.ok(snapshot.reads.includes('mint_queue:*'), '旧claim投影也必须读回冻结快照');
  const stamp = await execute({ snapshot: true, stampFails: true });
  assert.equal(stamp.result.result, 'stamp_failed'); assert.equal(stamp.writes.length, 0);
  const old = await execute({ snapshot: false });
  assert.equal(old.result.result, 'sent'); assert.equal(old.writes[0].address.toLowerCase(), legacy);
  assert.equal(String(old.writes[0].args[0]).toLowerCase(), current);
  const invalidTrack = await execute({ trackExists: false });
  assert.equal(invalidTrack.result.result, 'invalid_track'); assert.equal(invalidTrack.writes.length, 0);
  const missing = await execute({ snapshot: true, snapshotFails: true });
  assert.equal(missing.result.result, 'snapshot_read_failed'); assert.equal(missing.writes.length, 0);
  console.log('PASS OP真实worker：关闭flag仍保留目标/recipient，stamp失败不发送，旧NULL兼容，真实Track校验，快照失败不发送');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
