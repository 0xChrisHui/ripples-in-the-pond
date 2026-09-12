export const SOURCE_CONFIRMATIONS = 20n;
export const SOURCE_CHUNK_SIZE = 10n;
export const SOURCE_MAX_BATCHES = 50;

const CONTRACT = /^0x[0-9a-f]{40}$/;

export function requireSourceIdentity(chainId: number, contract: string): string {
  if (![10, 11155420].includes(chainId) || !CONTRACT.test(contract)) {
    throw new Error('source cursor chain/contract 身份无效');
  }
  return contract;
}

export function sourceCursorKey(chainId: number, contract: string): string {
  return `chain-events:cursor:${chainId}:${requireSourceIdentity(chainId, contract)}`;
}

export function sourceSuccessKey(chainId: number, contract: string): string {
  return `chain-events:last-success:${chainId}:${requireSourceIdentity(chainId, contract)}`;
}

export function sourceSyncLockKey(chainId: number, contract: string): string {
  return `cron:sync-chain-events:${chainId}:${requireSourceIdentity(chainId, contract)}:lock`;
}

export function safeHeadFromLatest(latestHead: bigint): bigint {
  if (latestHead < 0n) throw new Error('链头不能为负数');
  return latestHead > SOURCE_CONFIRMATIONS ? latestHead - SOURCE_CONFIRMATIONS : 0n;
}

export function parseSourceCursor(value: unknown): bigint {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new Error('source cursor 缺失或格式错误');
  }
  const parsed = BigInt(value);
  if (parsed < 0n) throw new Error('source cursor 不能为负数');
  return parsed;
}
