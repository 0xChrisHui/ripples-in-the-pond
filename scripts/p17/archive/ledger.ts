import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { ArchiveItem, ArchivePlan, ArchiveState } from './types';

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
const states: readonly ArchiveState[] = ['planned','checked','attempted','submitted','confirming','confirmed','unknown','failed','awaiting_input'];
const coordinates = ['trackId','chainId','contractAddress','tokenId','metadataUri'] as const;
function validateSaved(value: unknown): asserts value is Record<string, unknown> & {
  items: (Record<string, unknown> & { archiveMint: ArchiveItem['archiveMint'] })[];
} {
  if (!record(value) || ![1, 2].includes(Number(value.schemaVersion)) || !Array.isArray(value.items)) {
    throw new Error('账本格式损坏，禁止覆盖');
  }
  for (const item of value.items) {
    if (!record(item) || !record(item.archiveMint)
      || !['not_planned','awaiting_input','pending','confirmed','unknown'].includes(String(item.archiveMint.state))
      || (item.state !== undefined && !states.includes(item.state as ArchiveState))) throw new Error('账本交易状态无效');
    if (item.archiveMint.txHash !== null && !/^0x[0-9a-fA-F]{64}$/.test(String(item.archiveMint.txHash))) {
      throw new Error('账本交易哈希损坏');
    }
    if (item.txHashes !== undefined && (!Array.isArray(item.txHashes)
      || item.txHashes.some(hash => typeof hash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(hash)))) {
      throw new Error('账本历史哈希损坏');
    }
  }
}
/** 旧账本只补结构；unknown、已有哈希/nonce和证明不能被新的dry-run重置。 */
export function mergeArchiveLedger(plan: ArchivePlan, saved: unknown): ArchivePlan {
  validateSaved(saved);
  if (saved.revision !== plan.revision || saved.items.length !== plan.items.length) throw new Error('目录revision或项数变化，需人工核对旧账本');
  if (saved.schemaVersion === 2 && (saved.runId !== plan.runId || saved.planHash !== plan.planHash)) {
    throw new Error('留存计划身份变化，禁止覆盖原交易账本');
  }
  const old = new Map(saved.items.map(item => [`${item.trackId}:${item.chainId}`, item]));
  if (old.size !== plan.items.length) throw new Error('账本坐标重复');
  const items = plan.items.map(item => {
    const prior = old.get(`${item.trackId}:${item.chainId}`);
    if (!prior || coordinates.some(key => prior[key] !== item[key])) throw new Error('留存坐标变化，禁止覆盖旧状态');
    if ((prior.amount !== undefined && prior.amount !== '1')
      || (saved.schemaVersion === 2 && (prior.amount !== '1' || prior.approvalRef !== item.approvalRef))) {
      throw new Error('冻结数量或输入依据损坏，禁止覆盖旧账本');
    }
    const priorRecipient = prior.recipient ?? prior.archiveMint.recipient;
    if (priorRecipient !== item.recipient || (prior.operationId != null && prior.operationId !== item.operationId)) {
      throw new Error('接收地址或操作身份变化，需人工核对');
    }
    const legacy = prior.archiveMint.state;
    const state = (prior.state ?? (legacy === 'pending' ? 'submitted' : legacy === 'not_planned' ? 'awaiting_input' : legacy)) as ArchiveState;
    return { ...prior, ...item, state, archiveMint: prior.archiveMint } as ArchiveItem;
  });
  // 源码HEAD变化本身不丢失已经绑定的计划，操作坐标已逐项对照。
  return saved.schemaVersion === 2 ? { ...saved, items } as ArchivePlan : { ...plan, items };
}

export function updateArchiveLedger(file: string, plan: ArchivePlan,
  update?: (ledger: ArchivePlan) => Promise<ArchivePlan>): Promise<ArchivePlan> {
  mkdirSync(dirname(file), { recursive: true });
  const lock = `${file}.lock`;
  const fd = openSync(lock, 'wx');
  const temporary = `${file}.${process.pid}.tmp`;
  let ownsTemporary = false;
  return (async () => {
    try {
      const current = existsSync(file) ? mergeArchiveLedger(plan, JSON.parse(readFileSync(file, 'utf8'))) : plan;
      const next = update ? await update(current) : current;
      const tempFd = openSync(temporary, 'wx');
      ownsTemporary = true;
      try { writeFileSync(tempFd, JSON.stringify(next, null, 2) + '\n'); fsyncSync(tempFd); }
      finally { closeSync(tempFd); }
      renameSync(temporary, file);
      return next;
    } finally {
      if (ownsTemporary && existsSync(temporary)) unlinkSync(temporary);
      closeSync(fd); unlinkSync(lock);
    }
  })();
}
