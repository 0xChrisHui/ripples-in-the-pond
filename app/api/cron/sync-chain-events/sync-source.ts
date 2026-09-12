import {
  safeHeadFromLatest,
  SOURCE_CHUNK_SIZE,
  SOURCE_MAX_BATCHES,
} from '@/src/features/source-index/source-policy';

export type SourceEventRow = {
  chain_id: number;
  contract: string;
  event_name: 'Transfer';
  tx_hash: string;
  log_index: number;
  block_number: number;
  from_addr: string;
  to_addr: string;
  token_id: number;
  raw_data: { from: string; to: string; tokenId: string; blockHash: string };
};

export type SourceSyncDependencies = {
  readCursor(): Promise<bigint>;
  readLatestHead(): Promise<bigint>;
  readLogs(from: bigint, to: bigint): Promise<SourceEventRow[]>;
  upsertEvents(rows: SourceEventRow[]): Promise<void>;
  advanceCursor(expected: bigint, next: bigint): Promise<bigint>;
  recordSuccess(cursor: bigint): Promise<void>;
};

export type SourceSyncResult = {
  processedLogs: number;
  batches: number;
  cursor: string;
  safeHead: string;
  latestHead: string;
  caughtUp: boolean;
};

export async function runSourceSync(deps: SourceSyncDependencies): Promise<SourceSyncResult> {
  let cursor = await deps.readCursor();
  if (cursor < 0n) throw new Error('source cursor 不能为负数');
  const latestHead = await deps.readLatestHead();
  const safeHead = safeHeadFromLatest(latestHead);
  if (cursor > safeHead) throw new Error('source cursor 超出 20 confirmations 安全链头');

  let processedLogs = 0;
  let batches = 0;
  while (cursor < safeHead && batches < SOURCE_MAX_BATCHES) {
    const from = cursor + 1n;
    const proposed = from + SOURCE_CHUNK_SIZE - 1n;
    const to = proposed < safeHead ? proposed : safeHead;
    const rows = await deps.readLogs(from, to);
    if (rows.length > 0) {
      await deps.upsertEvents(rows);
      processedLogs += rows.length;
    }
    const advanced = await deps.advanceCursor(cursor, to);
    if (advanced !== to) throw new Error('source cursor 未推进到完整 batch 终点');
    cursor = advanced;
    batches += 1;
  }
  await deps.recordSuccess(cursor);
  return {
    processedLogs,
    batches,
    cursor: cursor.toString(),
    safeHead: safeHead.toString(),
    latestHead: latestHead.toString(),
    caughtUp: cursor === safeHead,
  };
}
