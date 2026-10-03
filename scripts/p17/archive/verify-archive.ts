import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync, unlinkSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { getMusicCatalog } from '../../../src/lib/music-catalog/asset-registry';
import { createArchivePlan } from './plan';
import { mergeArchiveLedger, updateArchiveLedger } from './ledger';
import { encodeAbiParameters, encodeEventTopics, parseAbi, zeroAddress, type Hex, type PublicClient } from 'viem';

// 使用真实CLI与独立临时账本复现；不接触本轮证据或真实钱包。
const scratch = mkdtempSync(join(tmpdir(), 'ripples-archive-'));
const cli = resolve('scripts/p17/archive/dry-run.ts');
const tsx = resolve('node_modules/tsx/dist/cli.mjs');
const relative = 'reviews/evidence/parallel-2026-10/20261002-night-01/p17/archive/archive-ledger-c2.json';
const destination = join(scratch, relative);
async function main() { try {
  mkdirSync(resolve(destination, '..'), { recursive: true });
  const original = createArchivePlan(getMusicCatalog(), { runId: '20261002-night-01', sourceSha: 'a'.repeat(40) });
  original.items[0].archiveMint.state = 'unknown';
  original.items[0].archiveMint.txHash = `0x${'12'.repeat(32)}`;
  writeFileSync(destination, JSON.stringify(original));
  execFileSync(process.execPath, [tsx, cli], { cwd: scratch, stdio: 'pipe' });
  const recovered = JSON.parse(readFileSync(destination, 'utf8'));
  const unknown = recovered.items.find((item: { trackId: string; chainId: number }) => item.trackId === original.items[0].trackId && item.chainId === original.items[0].chainId);
  assert.equal(unknown.archiveMint.state, 'unknown', '重跑不能抹去未知交易状态');
  assert.equal(unknown.archiveMint.txHash, original.items[0].archiveMint.txHash);
  assert.equal(recovered.items.length, 70);
  console.log('留存CLI：unknown/hash保留，70项未扩张，通过');
  const historical=JSON.parse(readFileSync('reviews/evidence/parallel-2026-10/20261002-night-01/p17/archive/archive-ledger.json','utf8'));
  assert.throws(()=>mergeArchiveLedger(original,historical), '旧revision账本必须保留且拒绝被C2覆盖');
  const before = readFileSync(destination, 'utf8');
  writeFileSync(`${destination}.lock`, '另一写入者');
  assert.throws(() => execFileSync(process.execPath, [tsx, cli], { cwd: scratch, stdio: 'pipe' }));
  assert.equal(readFileSync(destination, 'utf8'), before);
  unlinkSync(`${destination}.lock`);
  const sourceSha = 'a'.repeat(40), recipients = { 10: { address: `0x${'11'.repeat(20)}` as const, approvalRef: '仅本地测试夹具' } };
  const plan = createArchivePlan(getMusicCatalog(), { runId: 'local-test', sourceSha, recipients });
  const repeated = createArchivePlan(getMusicCatalog(), { runId: 'local-test', sourceSha: 'b'.repeat(40), recipients });
  assert.equal(plan.planHash, repeated.planHash);
  assert.deepEqual(plan.items.map(item => item.operationId), repeated.items.map(item => item.operationId));
  assert.equal(plan.items.filter(item => item.operationId !== null).length, 35);
  const moved = createArchivePlan(getMusicCatalog(), { runId: 'local-test', sourceSha,
    recipients: { 10: { ...recipients[10], address: `0x${'22'.repeat(20)}` } } });
  assert.notEqual(plan.planHash, moved.planHash);
  assert.throws(() => mergeArchiveLedger(moved, plan));
  assert.throws(() => mergeArchiveLedger(plan, { ...plan, items: plan.items.slice(1) }));
  const drift = structuredClone(plan); drift.items[0].tokenId = '99';
  assert.throws(() => mergeArchiveLedger(plan, drift));
  const damagedAmount = structuredClone(plan); Object.assign(damagedAmount.items[0], { amount: '0' });
  assert.throws(() => mergeArchiveLedger(plan, damagedAmount), '冻结数量损坏必须拒绝');
  const malformed = join(scratch, 'malformed.json'); writeFileSync(malformed, '{broken');
  await assert.rejects(async () => updateArchiveLedger(malformed, plan));
  assert.equal(readFileSync(malformed, 'utf8'), '{broken');
  const atomic = join(scratch, 'atomic.json');
  await updateArchiveLedger(atomic, plan);
  const atomicBytes = readFileSync(atomic, 'utf8');
  await assert.rejects(() => updateArchiveLedger(atomic, plan, async () => { throw new Error('核验中断'); }));
  assert.equal(readFileSync(atomic, 'utf8'), atomicBytes);
  assert(!existsSync(`${atomic}.lock`));
  const abandoned = `${atomic}.${process.pid}.tmp`; writeFileSync(abandoned, '旧中断现场');
  await assert.rejects(() => updateArchiveLedger(atomic, plan));
  assert.equal(readFileSync(abandoned, 'utf8'), '旧中断现场'); unlinkSync(abandoned);
  console.log('留存计划/文件：稳定编号、换接收地址拒覆盖、坐标/损坏/并发锁/中断保护，通过');
  assert(existsSync(resolve('scripts/p17/archive/proof.ts')), '需要真实mint事件、规范区块和当前余额核验');
  const { verifyArchiveReceipt } = await import('./proof');
  const item = plan.items.find(entry => entry.chainId === 10)!;
  const hash = `0x${'ab'.repeat(32)}` as Hex;
  const abi = parseAbi(['event TransferSingle(address indexed operator,address indexed from,address indexed to,uint256 id,uint256 value)',
    'event TransferBatch(address indexed operator,address indexed from,address indexed to,uint256[] ids,uint256[] values)']);
  const topics = encodeEventTopics({ abi, eventName: 'TransferSingle', args: { operator: recipients[10].address, from: zeroAddress, to: item.recipient! } }) as [Hex, ...Hex[]];
  const log = { address: item.contractAddress!, topics, logIndex: 5,
    data: encodeAbiParameters([{ type: 'uint256' }, { type: 'uint256' }], [BigInt(item.tokenId!), 1n]) };
  const receipt = { status: 'success' as const, transactionHash: hash, blockNumber: 100n, blockHash: hash, logs: [log] };
  const observation = { chainId: 10, head: 111n, canonicalHash: hash, balance: 1n, uri: item.metadataUri!,
    requiredConfirmations: 12, checkedAt: '2026-10-02T00:00:00Z' };
  assert.equal(verifyArchiveReceipt(item, receipt, observation).status, 'confirmed');
  assert.throws(() => verifyArchiveReceipt(Object.assign({ ...item }, { amount: '0' }) as typeof item,
    receipt, { ...observation, balance: 0n }), '运行时不能把零余额确认成留存');
  const transferTopics = encodeEventTopics({ abi, eventName: 'TransferSingle', args: { operator: recipients[10].address,
    from: recipients[10].address, to: item.recipient! } }) as [Hex, ...Hex[]];
  assert.equal(verifyArchiveReceipt(item, { ...receipt, logs: [{ ...log, topics: transferTopics }] }, observation).status, 'needs_proof');
  assert.equal(verifyArchiveReceipt(item, receipt, { ...observation, balance: 0n }).status, 'needs_proof');
  assert.equal(verifyArchiveReceipt(item, receipt, { ...observation, head: 105n }).status, 'confirming');
  assert.equal(verifyArchiveReceipt(item, receipt, { ...observation, canonicalHash: `0x${'ef'.repeat(32)}` }).status, 'confirming');
  assert.throws(() => verifyArchiveReceipt(item, receipt, { ...observation, chainId: 1 }));
  assert.throws(() => verifyArchiveReceipt(item, receipt, { ...observation, uri: 'ar://changed' }));
  const batchTopics = encodeEventTopics({ abi, eventName: 'TransferBatch', args: { operator: recipients[10].address,
    from: zeroAddress, to: item.recipient! } }) as [Hex, ...Hex[]];
  const batch = { ...log, topics: batchTopics, data: encodeAbiParameters([{ type: 'uint256[]' }, { type: 'uint256[]' }], [[BigInt(item.tokenId!), 99n], [1n, 2n]]) };
  assert.equal(verifyArchiveReceipt(item, { ...receipt, logs: [batch] }, observation).status, 'confirmed');
  assert.equal(verifyArchiveReceipt({ ...item, tokenId: '98' }, { ...receipt, logs: [batch] }, observation).status, 'needs_proof');
  const { inspectArchiveItem } = await import('./inspect');
  let headReads = 0;
  // 模拟余额读取之后head重组；旧mint区块不变仍不能确认旧分支余额。
  const reader = { getChainId: async () => 10, getBlockNumber: async () => observation.head,
    readContract: async ({ functionName }: { functionName: string }) => functionName === 'uri' ? item.metadataUri! : 1n,
    getTransactionReceipt: async () => receipt,
    getBlock: async ({ blockNumber }: { blockNumber: bigint }) => ({ hash: blockNumber === observation.head
      && ++headReads > 1 ? `0x${'ef'.repeat(32)}` : hash }),
  } as unknown as PublicClient;
  const reorg = await inspectArchiveItem(reader, { ...item, txHashes: [hash] });
  assert.equal(reorg.state, 'confirming', '观测head重组必须撤回余额确认');
  assert.notEqual(reorg.archiveMint.state, 'confirmed');
  const stableReader = { ...reader, getBlock: async () => ({ hash }) } as unknown as PublicClient;
  const stable = await inspectArchiveItem(stableReader, { ...item, txHashes: [hash] });
  assert.equal(stable.state, 'confirmed');
  assert.equal(JSON.parse(stable.archiveMint.proof!).observedBlockHash, hash);
  console.log('留存证明：普通transfer拒计mint、数量/余额、双链/URI、确认/head重组、batch逐Token核验，通过');
  const inspectCli = resolve('scripts/p17/archive/inspect-cli.ts');
  const noRecipient = join(scratch, 'no-recipient.json');
  await updateArchiveLedger(noRecipient, createArchivePlan(getMusicCatalog(), { runId: 'no-recipient', sourceSha }));
  // 不存在的endpoint：无接收地址必须跳过RPC，不能偷偷选择默认钱包。
  execFileSync(process.execPath, [tsx, inspectCli, '--ledger', noRecipient, '--chain', '10', '--rpc-url', 'http://127.0.0.1:1'], { stdio: 'pipe' });
  assert.equal(JSON.parse(readFileSync(noRecipient, 'utf8')).items.filter((entry: { state: string }) => entry.state === 'confirmed').length, 0);
  assert.throws(() => execFileSync(process.execPath, [tsx, inspectCli, '--execute'], { stdio: 'pipe' }));
  assert.throws(() => execFileSync(process.execPath, [tsx, cli, '--execute'], { stdio: 'pipe' }));
  console.log('只读CLI：缺接收输入不联系RPC，execute明确拒绝，通过');
} finally { assert.equal(dirname(resolve(scratch)), resolve(tmpdir())); rmSync(scratch, { recursive: true, force: true }); }
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
