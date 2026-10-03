import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getMusicCatalog } from '../../../../src/lib/music-catalog/asset-registry';
import { encodeAbiParameters, encodeEventTopics, getAddress, keccak256, parseAbi, parseAbiParameters, zeroAddress, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { verifyArchiveReceipt } from '../proof';

async function main() {
  const loaded = await import('./engine').catch(() => null);
  assert.equal(typeof loaded?.runArchiveExecution, 'function', '需要真实留存执行状态机');
  const { createExecutionPlan } = await import('./plan');
  const { withExecutionLedger } = await import('./ledger');
  const { requireExecutionTarget, verifyExecutionTransaction } = await import('./adapter');
  const catalog = getMusicCatalog();
  // 固定测试密钥只用于本地签名，不访问钱包或外部网络。
  const signer = privateKeyToAccount(`0x${'01'.repeat(32)}`), recipient = signer.address;
  // 仅改getMusicCatalog返回的隔离副本，不写生产注册表。
  for (const track of catalog.tracks) for (const deployment of track.deployments) {
    deployment.status = 'ready'; deployment.contractAddress = getAddress(`0x${String(deployment.chainId).padStart(40, '0')}`);
    deployment.tokenId = String(track.displayNumber);
    deployment.metadataUri = track.deployments[0].metadataUri;
  }
  const config = { runId: 'execution-test', sourceSha: 'a'.repeat(40), recipient, approvalRef: '本地隔离测试',
    chains: [1, 10].map(chainId => ({ chainId: chainId as 1 | 10, sender: recipient, nonce: 7,
      gasLimit: '100000', maxFeePerGas: '2', maxPriorityFeePerGas: '1', l1FeeCapWei: '0',
      budgetWei: '7000000', confirmations: 2, rpcEnv: 'TEST_RPC' })) };
  const plan = createExecutionPlan(catalog, config), directory = mkdtempSync(join(tmpdir(), 'p17-execution-'));
  const firstItem = plan.archive.items.find(item => item.chainId === 1)!;
  assert.throws(() => requireExecutionTarget(firstItem, null, recipient), /目标/);
  let sends = 0, signs = 0, chain = 1, balance = 7000000n, badTarget = false;
  const calldata = '0x1234' as Hex;
  const raw = await signer.signTransaction({ chainId: 1, to: firstItem.contractAddress!, nonce: 7,
    data: calldata, gas: 100000n, maxFeePerGas: 2n, maxPriorityFeePerGas: 1n, value: 0n, type: 'eip1559' });
  const adapter = {
    chainId: async () => chain,
    validate: async () => { if (badTarget) throw Error('目标不符'); },
    balance: async () => balance,
    nonce: async () => 7,
    inspect: async (item: typeof plan.archive.items[number]) => item,
    sign: async () => { signs++; return { raw, hash: keccak256(raw), calldataHash: keccak256(calldata) }; },
    send: async () => { sends++; return keccak256(raw); },
    assertLease: async () => {},
  };
  try {
    chain = 10;
    await assert.rejects(withExecutionLedger(join(directory, 'chain.json'), plan, (ledger, persist) =>
      loaded!.runArchiveExecution(plan, ledger, adapter, 1, true, persist)), /网络/);
    chain = 1; badTarget = true;
    await assert.rejects(withExecutionLedger(join(directory, 'target.json'), plan, (ledger, persist) =>
      loaded!.runArchiveExecution(plan, ledger, adapter, 1, true, persist)), /目标/);
    badTarget = false; balance = 1n;
    await assert.rejects(withExecutionLedger(join(directory, 'balance.json'), plan, (ledger, persist) =>
      loaded!.runArchiveExecution(plan, ledger, adapter, 1, true, persist)), /余额/);
    balance = 7000000n;
    await assert.rejects(withExecutionLedger(join(directory, 'persist.json'), plan, ledger =>
      loaded!.runArchiveExecution(plan, ledger, adapter, 1, true, async next => {
        if (Object.keys(next.execution.attempts).length) throw Error('落盘失败');
      })), /落盘/);
    assert.equal(sends, 0, 'attempt落盘失败不得广播');
    const file = join(directory, 'rerun.json');
    const first = await withExecutionLedger(file, plan, (ledger, persist) => loaded!.runArchiveExecution(plan, ledger, adapter, 1, true, persist));
    assert.equal(sends, 1);
    const attempt = first.execution.attempts[plan.archive.items.find(item => item.chainId === 1)!.operationId!];
    assert.equal(attempt.nonce, 7);
    assert.throws(() => verifyExecutionTransaction(firstItem, attempt, { hash: attempt.hash,
      to: getAddress('0x0000000000000000000000000000000000000099'), from: recipient, nonce: 7,
      input: calldata, value: 0n, chainId: 1 }), /回执/);
    assert.throws(() => verifyExecutionTransaction(firstItem, attempt, { hash: attempt.hash,
      to: firstItem.contractAddress!, from: recipient, nonce: 8, input: calldata, value: 0n, chainId: 1 }), /回执/);
    const second = await withExecutionLedger(file, plan, (ledger, persist) => loaded!.runArchiveExecution(plan, ledger, adapter, 1, true, persist));
    assert.equal(sends, 1, 'unknown/已知hash重跑禁止重新广播');
    assert.equal(second.execution.attempts[attempt.operationId].nonce, 7, '重跑nonce不得变更');
    assert.equal(signs, 2, '仅落盘失败与首次发送产生签名');
    const lostResponse = join(directory, 'send-unknown.json');
    let uncertainSends = 0;
    const uncertain = { ...adapter, send: async () => { uncertainSends++; throw Error('发送响应丢失'); } };
    await assert.rejects(withExecutionLedger(lostResponse, plan, (ledger, persist) =>
      loaded!.runArchiveExecution(plan, ledger, uncertain, 1, true, persist)), /发送结果未知/);
    const retained = await withExecutionLedger(lostResponse, plan, (ledger, persist) =>
      loaded!.runArchiveExecution(plan, ledger, uncertain, 1, true, persist));
    assert.equal(uncertainSends, 1, '发送响应未知重跑不能再次调用广播');
    assert.equal(retained.items.find(item => item.chainId === 1)!.state, 'unknown');
    await withExecutionLedger(file, plan, async (ledger, persist) => {
      ledger.execution.attempts[attempt.operationId].nonce = 8;
      ledger.items.find(item => item.operationId === attempt.operationId)!.nonce = '8';
      await persist(ledger);
    });
    await assert.rejects(withExecutionLedger(file, plan, async ledger => ledger), /持久交易/);
    const noHash = join(directory, 'unknown.json');
    await withExecutionLedger(noHash, plan, async (ledger, persist) => {
      ledger.items.find(item => item.chainId === 1)!.state = 'unknown'; await persist(ledger); return ledger;
    });
    await withExecutionLedger(noHash, plan, (ledger, persist) => loaded!.runArchiveExecution(plan, ledger, adapter, 1, true, persist));
    assert.equal(sends, 1, '无hash unknown禁止发送');
    const nonceMismatch = { ...adapter, nonce: async () => 8 };
    await assert.rejects(withExecutionLedger(join(directory, 'nonce.json'), plan, (ledger, persist) =>
      loaded!.runArchiveExecution(plan, ledger, nonceMismatch, 1, true, persist)), /nonce/);
    let inspected = 0;
    await withExecutionLedger(join(directory, 'inspect.json'), plan, (ledger, persist) =>
      loaded!.runArchiveExecution(plan, ledger, { ...adapter, inspect: async item => { inspected++; return item; } }, 1, false, persist));
    assert.equal(inspected, 35, '只读模式应检查完整单链35项');
    const blockHash = `0x${'11'.repeat(32)}` as Hex;
    const mintAbi = parseAbi(['event TransferSingle(address indexed operator,address indexed from,address indexed to,uint256 id,uint256 value)']);
    const encodedTopics = encodeEventTopics({ abi: mintAbi, eventName: 'TransferSingle', args: { operator: recipient, from: zeroAddress, to: recipient } });
    const indexedTopics = encodedTopics.slice(1).map(topic => {
      if (typeof topic !== 'string') throw Error('测试mint事件必须指定全部单值主题');
      return topic;
    });
    const topics: [Hex, ...Hex[]] = [encodedTopics[0], ...indexedTopics];
    const mintLog = { address: firstItem.contractAddress!, logIndex: 0,
      topics,
      data: encodeAbiParameters(parseAbiParameters('uint256,uint256'), [BigInt(firstItem.tokenId!), 1n]) };
    const receipt = { status: 'success' as const, transactionHash: attempt.hash, blockNumber: 10n, blockHash, logs: [mintLog] };
    const observation = { chainId: 1, head: 12n, canonicalHash: blockHash, balance: 1n,
      uri: firstItem.metadataUri!, requiredConfirmations: 2, checkedAt: '本地隔离证明' };
    assert.equal(verifyArchiveReceipt(firstItem, receipt, observation).status, 'confirmed');
    assert.equal(verifyArchiveReceipt(firstItem, { ...receipt, logs: [] }, observation).status, 'needs_proof', '缺mint事件不能确认');
    assert.equal(verifyArchiveReceipt(firstItem, receipt, { ...observation, balance: 0n }).status, 'needs_proof', '当前余额不足不能确认');
    assert.equal(verifyArchiveReceipt(firstItem, receipt, { ...observation, canonicalHash: keccak256('0x01') }).status, 'confirming', '孤块回执不能确认');
    console.log('执行门禁、持久失败不广播、unknown不重发、nonce冻结与费用不足检查通过');
  } finally { rmSync(directory, { recursive: true, force: true }); }
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
