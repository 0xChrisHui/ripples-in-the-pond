import { closeSync, existsSync, mkdirSync, openSync, readFileSync, unlinkSync } from 'node:fs';
import { dirname } from 'node:path';
import { getAddress, keccak256, parseTransaction, recoverTransactionAddress } from 'viem';
import { mergeArchiveLedger, updateArchiveLedger } from '../ledger';
import type { ExecutionLedger, ExecutionPlan, PersistExecution } from './types';

/** 外层单写锁覆盖整个执行；每个发送边界复用原账本的fsync+原子rename。 */
export async function withExecutionLedger<T>(file: string, plan: ExecutionPlan,
  action: (ledger: ExecutionLedger, persist: PersistExecution) => Promise<T>): Promise<T> {
  mkdirSync(dirname(file), { recursive: true });
  const lock = `${file}.execution.lock`, fd = openSync(lock, 'wx');
  try {
    const saved = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) as ExecutionLedger : null;
    if (saved && (!saved.execution || JSON.stringify(saved.execution.plan) !== JSON.stringify(plan))) {
      throw Error('冻结执行计划不符，禁止覆盖原交易线索');
    }
    const ledger: ExecutionLedger = saved ? { ...mergeArchiveLedger(plan.archive, saved), execution: saved.execution }
      : { ...structuredClone(plan.archive), execution: { plan: structuredClone(plan), attempts: {} } };
    for (const [operationId, attempt] of Object.entries(ledger.execution.attempts)) {
      const item = ledger.items.find(row => row.operationId === operationId);
      if (!item || attempt.operationId !== operationId || attempt.chainId !== item.chainId
        || !Number.isSafeInteger(attempt.nonce) || attempt.nonce < 0
        || !/^0x02[0-9a-fA-F]+$/.test(attempt.raw) || keccak256(attempt.raw) !== attempt.hash
        || !item.txHashes?.includes(attempt.hash) || item.nonce !== String(attempt.nonce)
        || item.sender !== attempt.sender || item.calldataHash !== attempt.calldataHash) throw Error('持久交易身份损坏，禁止执行');
      const chain = plan.config.chains.find(value => value.chainId === attempt.chainId)!;
      const tx = parseTransaction(attempt.raw);
      const count = Object.values(ledger.execution.attempts).filter(value => value.chainId === attempt.chainId).length;
      if (attempt.sender !== chain.sender || attempt.nonce < chain.nonce || attempt.nonce >= chain.nonce + count
        || tx.nonce !== attempt.nonce || tx.chainId !== attempt.chainId || !tx.to
        || getAddress(tx.to) !== getAddress(item.contractAddress!) || (tx.value ?? 0n) !== 0n
        || tx.gas !== BigInt(chain.gasLimit) || tx.maxFeePerGas !== BigInt(chain.maxFeePerGas)
        || tx.maxPriorityFeePerGas !== BigInt(chain.maxPriorityFeePerGas)
        || keccak256(tx.data ?? '0x') !== attempt.calldataHash
        || await recoverTransactionAddress({ serializedTransaction: attempt.raw as `0x02${string}` }) !== chain.sender) {
        throw Error('持久交易签名/nonce/费用与冻结计划不符');
      }
    }
    const nonces = Object.values(ledger.execution.attempts).map(attempt => `${attempt.chainId}:${attempt.nonce}`);
    if (new Set(nonces).size !== nonces.length) throw Error('持久交易nonce重复，禁止执行');
    const persist: PersistExecution = async next => {
      await updateArchiveLedger(file, plan.archive, async () => next);
    };
    await persist(ledger);
    return await action(ledger, persist);
  } finally { closeSync(fd); unlinkSync(lock); }
}
