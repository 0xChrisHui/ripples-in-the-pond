import { getAddress, keccak256 } from 'viem';
import { transactionCost } from './plan';
import type { ExecutionAdapter, ExecutionLedger, ExecutionPlan, PersistExecution } from './types';

/** 每轮最多发送一笔；已有attempt/hash/unknown只查账，确认后才分配下一个nonce。 */
export async function runArchiveExecution(plan: ExecutionPlan, ledger: ExecutionLedger, adapter: ExecutionAdapter,
  chainId: 1 | 10, execute: boolean, persist: PersistExecution): Promise<ExecutionLedger> {
  const chain = plan.config.chains.find(item => item.chainId === chainId);
  if (!chain || await adapter.chainId() !== chainId) throw Error('实际RPC网络与冻结执行计划不符');
  const items = ledger.items.filter(item => item.chainId === chainId);
  for (const item of items) {
    await adapter.validate(item);
    const attempt = item.operationId ? ledger.execution.attempts[item.operationId] : undefined;
    const inspected = await adapter.inspect(item, attempt);
    Object.assign(item, inspected); await persist(ledger);
    if (item.state === 'confirmed') continue;
    if (!execute) continue;
    if (attempt || item.txHashes?.length || item.archiveMint.txHash
      || ['unknown','attempted','submitted','confirming','failed'].includes(item.state)) return ledger;
    if (!item.operationId || !item.recipient || !item.contractAddress || !item.tokenId || !item.metadataUri
      || item.amount !== '1' || getAddress(item.recipient) !== plan.config.recipient) throw Error('执行坐标或数量未冻结');
    const prior = Object.values(ledger.execution.attempts).filter(value => value.chainId === chainId);
    const nonce = chain.nonce + prior.length;
    if (await adapter.nonce(chain.sender) !== nonce) throw Error('串行nonce变化或存在其他在途交易，禁止发送');
    const remaining = items.filter(value => value.state !== 'confirmed').length;
    if (await adapter.balance(chain.sender) < transactionCost(chain) * BigInt(remaining)) throw Error('最新余额不足剩余冻结最大费用');
    await adapter.assertLease();
    const signed = await adapter.sign(item, chain, nonce);
    if (keccak256(signed.raw) !== signed.hash) throw Error('预计算交易hash不符');
    ledger.execution.attempts[item.operationId] = { ...signed, operationId: item.operationId, chainId,
      sender: chain.sender, nonce, attemptedAt: new Date().toISOString() };
    Object.assign(item, { state: 'attempted', sender: chain.sender, nonce: String(nonce), calldataHash: signed.calldataHash,
      attemptedAt: ledger.execution.attempts[item.operationId].attemptedAt, txHashes: [signed.hash],
      archiveMint: { ...item.archiveMint, state: 'unknown', recipient: item.recipient, amount: '1', txHash: signed.hash } });
    await persist(ledger);
    await adapter.assertLease();
    if (await adapter.nonce(chain.sender) !== nonce) throw Error('广播前nonce发生变化，已持久尝试只读保留');
    if (await adapter.balance(chain.sender) < transactionCost(chain) * BigInt(remaining)) throw Error('广播前余额不足，已持久尝试只读保留');
    try {
      const hash = await adapter.send(signed.raw);
      if (hash !== signed.hash) throw Error('RPC返回交易hash与预计算不符');
      item.state = 'submitted'; item.archiveMint.state = 'pending'; await persist(ledger);
    } catch {
      item.state = 'unknown'; item.archiveMint.state = 'unknown'; await persist(ledger);
      throw Error('发送结果未知，已保存原nonce/hash，禁止再次广播');
    }
    return ledger;
  }
  return ledger;
}
