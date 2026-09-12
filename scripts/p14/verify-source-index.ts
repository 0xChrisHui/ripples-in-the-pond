import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  parseSourceCursor,
  safeHeadFromLatest,
  sourceCursorKey,
  sourceSyncLockKey,
} from '../../src/features/source-index/source-policy';
import {
  runSourceSync,
  type SourceEventRow,
  type SourceSyncDependencies,
} from '../../app/api/cron/sync-chain-events/sync-source';

const contract = '0x1234567890abcdef1234567890abcdef12345678';
const event: SourceEventRow = {
  chain_id: 10,
  contract,
  event_name: 'Transfer',
  tx_hash: `0x${'1'.repeat(64)}`,
  log_index: 0,
  block_number: 1,
  from_addr: `0x${'0'.repeat(40)}`,
  to_addr: `0x${'2'.repeat(40)}`,
  token_id: 1,
  raw_data: {
    from: `0x${'0'.repeat(40)}`,
    to: `0x${'2'.repeat(40)}`,
    tokenId: '1',
    blockHash: `0x${'3'.repeat(64)}`,
  },
};

function fake(overrides: Partial<SourceSyncDependencies> = {}): SourceSyncDependencies {
  return {
    readCursor: async () => 0n,
    readLatestHead: async () => 30n,
    readLogs: async () => [event],
    upsertEvents: async () => undefined,
    advanceCursor: async (_expected, next) => next,
    recordSuccess: async () => undefined,
    ...overrides,
  };
}

async function main() {
assert.equal(safeHeadFromLatest(100n), 80n);
assert.equal(safeHeadFromLatest(12n), 0n);
assert.equal(parseSourceCursor('123'), 123n);
assert.throws(() => parseSourceCursor(undefined));
assert.throws(() => parseSourceCursor('-1'));
assert.notEqual(sourceCursorKey(10, contract), sourceCursorKey(11155420, contract));
assert.notEqual(sourceSyncLockKey(10, contract), sourceSyncLockKey(11155420, contract));

let reads = 0;
let writes = 0;
await assert.rejects(runSourceSync(fake({
  readCursor: async () => { throw new Error('db read failed'); },
  readLogs: async () => { reads += 1; return []; },
  advanceCursor: async (_expected, next) => { writes += 1; return next; },
})));
assert.equal(reads, 0);
assert.equal(writes, 0);

await assert.rejects(runSourceSync(fake({
  readCursor: async () => 11n,
  readLogs: async () => { reads += 1; return []; },
})));
assert.equal(reads, 0);

let advances = 0;
await assert.rejects(runSourceSync(fake({
  upsertEvents: async () => { throw new Error('upsert failed'); },
  advanceCursor: async (_expected, next) => { advances += 1; return next; },
})));
assert.equal(advances, 0);

let cursor = 0n;
const storedEvents = new Set<string>();
let upsertAttempts = 0;
let releaseFirstRead: (() => void) | undefined;
const firstRead = new Promise<void>((resolveRead) => { releaseFirstRead = resolveRead; });
let readCount = 0;
const concurrent = () => runSourceSync(fake({
  readCursor: async () => {
    readCount += 1;
    if (readCount === 2) releaseFirstRead?.();
    await firstRead;
    return cursor;
  },
  upsertEvents: async (rows) => {
    upsertAttempts += 1;
    for (const row of rows) storedEvents.add(`${row.chain_id}:${row.tx_hash}:${row.log_index}`);
  },
  advanceCursor: async (expected, next) => {
    if (cursor !== expected) throw new Error('CAS conflict');
    cursor = next;
    return cursor;
  },
}));
const results = await Promise.allSettled([concurrent(), concurrent()]);
assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
assert.equal(cursor, 10n);
assert.equal(upsertAttempts, 2);
assert.equal(storedEvents.size, 1);

const migration = readFileSync(resolve(
  'supabase/migrations/phase-14/050_chain_event_source_cursor.sql',
), 'utf8');
for (const fragment of [
  'chain_events_source_log_unique',
  'initialize_source_chain_cursor',
  'advance_source_chain_cursor',
  'source cursor regression rejected',
  'guard_source_chain_cursor_write',
  'grant execute',
]) assert.ok(migration.includes(fragment), `migration 缺少 ${fragment}`);

console.log('P14-G1 source cursor fail-closed、隔离、batch 原子性与并发 CAS 验证通过');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
