import assert from 'node:assert/strict';
import * as wait from '../../src/lib/permanent-core/permanent-wait';
import { loadOfflineModule } from './offline-module';

const nowMs = Date.UTC(2026, 9, 28, 12);
const iso = (age: number) => new Date(nowMs - age).toISOString();
const old = 21 * 24 * 60 * 60_000;
const row = { id: 'order-a', retry_count: 2, created_at: iso(old), status: 'uploading_events',
  events_upload_state: 'verified', package_upload_state: 'uploaded', metadata_upload_state: 'none' };
type LedgerRow = { queue_id: string; arweave_tx_id: string; attempted_at: string };
type Reply = { body: { result?: string; error?: string }; status: number };
const pending = new wait.PermanentResourcePendingError('永久资源未达到双网关 quorum：尚未传播', ['package', 'metadata']);

async function runRoute(error: unknown, ledger: LedgerRow[] = [], options: {
  row?: Partial<typeof row>; readError?: 'return' | 'throw'; lostLease?: boolean; updateError?: boolean;
} = {}) {
  let update: Record<string, unknown> = {};
  let queried = 0, leaseChecks = 0, alerts = 0, released = 0;
  const imports: Record<string, unknown> = {
    'next/server': { NextResponse: { json: (body: Reply['body'], init?: { status: number }) => ({ body, status: init?.status ?? 200 }) } },
    crypto: { randomUUID: () => 'worker' },
    '@/src/lib/auth/cron-auth': { verifyCronSecret: () => true },
    '@/src/lib/chain/operator-lock': { acquireOpLock: async () => true, heartbeatOpLock: async () => true,
      releaseOpLock: async () => { released += 1; } },
    '@/src/lib/alerts/resend': { sendAlert: () => { alerts += 1; } },
    '@/src/lib/permanent-core/permanent-wait': wait,
    '@/src/lib/supabase': { supabaseAdmin: {
      rpc: async (name: string) => {
        assert.equal(name, 'claim_score_queue_job');
        return { data: [{ ...row, ...options.row }], error: null };
      },
      from: (table: string) => {
        if (table === 'score_arweave_upload_ledger') {
          queried += 1;
          let selected = [...ledger];
          const query = {
            select: (column: string) => { assert.equal(column, 'attempted_at'); return query; },
            eq: (column: string, value: string) => {
              assert.equal(column, 'queue_id'); assert.equal(value, row.id);
              selected = selected.filter((item) => item.queue_id === value); return query;
            },
            in: (column: string, ids: string[]) => {
              assert.equal(column, 'arweave_tx_id'); assert.deepEqual(ids, pending.arTxIds);
              selected = selected.filter((item) => ids.includes(item.arweave_tx_id)); return query;
            },
            order: (column: string, config: { ascending: boolean }) => {
              assert.equal(column, 'attempted_at'); assert.equal(config.ascending, false);
              selected.sort((a, b) => Date.parse(b.attempted_at) - Date.parse(a.attempted_at)); return query;
            },
            limit: (count: number) => { assert.equal(count, 1); selected = selected.slice(0, count); return query; },
            maybeSingle: async () => {
              if (options.readError === 'throw') throw new Error('账本读取异常');
              return { data: selected[0] ?? null, error: options.readError ? { message: '账本读取失败' } : null };
            },
          };
          return query;
        }
        assert.equal(table, 'score_nft_queue');
        const query = {
          update: (value: Record<string, unknown>) => { update = value; return query; },
          eq: (column: string, value: string) => {
            assert.equal(value, column === 'id' ? row.id : 'worker'); return query;
          },
          gt: (column: string, value: string) => {
            assert.equal(column, 'lease_expires_at'); assert.equal(value, iso(0)); leaseChecks += 1; return query;
          },
          select: async () => ({ data: options.lostLease ? [] : [{ id: row.id }],
            error: options.updateError ? { message: '写入失败' } : null }),
        };
        return query;
      },
    } },
  };
  for (const [file, name] of [['upload', 'UploadEvents'], ['package', 'PreparePackage'],
    ['mint', 'MintOnchain'], ['set-uri', 'SetTokenUri'], ['finalize', 'FinalizeSnapshot']]) {
    imports[`./steps-${file}`] = { [`step${name}`]: async () => { throw error; } };
  }
  const route = loadOfflineModule<{ GET: (request: object) => Promise<Reply> }>(
    'app/api/cron/process-score-queue/route.ts', imports, {
      Date: class extends Date { static now() { return nowMs; } },
      setInterval: () => 1, clearInterval: () => undefined,
      console: { log: () => undefined, error: () => undefined },
    });
  const reply = await route.GET({});
  assert.equal(released, 1);
  return { reply, update, queried, leaseChecks, alerts };
}

async function testEth(): Promise<void> {
  let error: unknown = pending;
  const query = { select: () => query, eq: () => query,
    single: async () => ({ data: { events_data: [] }, error: null }) };
  const assets = loadOfflineModule<{ processSelfMintAsset: (row: object, owner: string) => Promise<{ verified: boolean }> }>(
    'src/lib/self-mint/assets.ts', {
      'server-only': {}, '@/src/lib/arweave': {},
      '@/src/lib/permanent-core/attestation': { attestPermanentResource: async () => { throw error; } },
      '@/src/lib/permanent-core/permanent-wait': wait,
      '@/src/lib/score-package': { sha256Hex: async () => 'digest' },
      '@/src/lib/sound-set': { isSoundKey: () => true }, '../chain/multichain/registry': {},
      '@/src/lib/supabase': { supabaseAdmin: { from: (table: string) => { assert.equal(table, 'pending_scores'); return query; } } },
    });
  const order = { events_upload_state: 'uploaded', events_sha256: 'digest', events_bytes: 2,
    events_mime: 'application/json', events_ar_tx_id: 'events' };
  assert.equal((await assets.processSelfMintAsset(order, 'worker')).verified, false);
  error = new Error('永久资源未达到双网关 quorum：SHA-256 mismatch');
  await assert.rejects(assets.processSelfMintAsset(order, 'worker'), (caught) => {
    assert.ok(caught instanceof Error);
    assert.equal(caught.message, 'CRITICAL: events 永久资源身份冲突');
    assert.equal(caught.cause, error); return true;
  });
}

async function main(): Promise<void> {
  const ledger = [
    { queue_id: row.id, arweave_tx_id: 'events', attempted_at: iso(old) },
    { queue_id: row.id, arweave_tx_id: 'package', attempted_at: iso(240_000) },
    { queue_id: row.id, arweave_tx_id: 'metadata', attempted_at: iso(600_000) },
    { queue_id: 'other-order', arweave_tx_id: 'package', attempted_at: iso(0) },
  ];
  const recentResource = await runRoute(pending, ledger);
  assert.equal(recentResource.reply.body.result, 'waiting');
  assert.equal(recentResource.update.lease_expires_at, new Date(nowMs + 120_000).toISOString());
  assert.equal(recentResource.update.retry_count, undefined);
  assert.equal(recentResource.leaseChecks, 1);
  for (const readError of [undefined, 'return', 'throw'] as const) {
    // 错误响应即使附带 data 也必须弃用；核心资源没有账本时按订单年龄处理。
    const rows = readError ? ledger : [ledger[0]];
    const expired = await runRoute(pending, rows, { readError });
    assert.equal(expired.reply.status, 500); assert.equal(expired.update.failure_kind, 'safe_retry');
    const recent = await runRoute(pending, rows, { readError, row: { created_at: iso(60_000) } });
    assert.equal(recent.reply.body.result, 'waiting');
    assert.equal(recent.update.lease_expires_at, new Date(nowMs + 60_000).toISOString());
  }
  for (const field of ['events_upload_state', 'package_upload_state', 'metadata_upload_state']) {
    for (const state of ['uploading', 'upload_result_unknown']) {
      const unknown = await runRoute(pending, ledger, { row: { [field]: state } });
      assert.equal(unknown.update.failure_kind, 'safe_retry'); assert.equal(unknown.update.retry_count, 3);
      assert.equal(unknown.reply.status, 500);
    }
  }
  for (const timestamp of [iso(-60_001), '损坏时间']) {
    const result = await runRoute(pending, [{ ...ledger[1], attempted_at: timestamp }]);
    assert.equal(result.update.failure_kind, 'safe_retry');
  }
  for (const options of [{ lostLease: true }, { updateError: true }]) {
    assert.equal((await runRoute(pending, ledger, options)).reply.status, 500);
  }
  for (const error of [new Error('普通错误'), new Error('永久资源未达到双网关 quorum：SHA-256 mismatch'), new Error('CRITICAL: 未知')]) {
    for (const retry_count of [0, 1, 2]) {
      const result = await runRoute(error, [], { row: { retry_count } });
      const critical = error.message.startsWith('CRITICAL');
      assert.equal(result.update.retry_count, critical ? retry_count : retry_count + 1);
      assert.equal(result.update.failure_kind, critical ? 'manual_review' : retry_count === 2 ? 'safe_retry' : undefined);
      assert.equal(result.update.lease_expires_at, null); assert.equal(result.update.locked_by, null);
      assert.equal(result.alerts, critical ? 1 : 0); assert.equal(result.queried, 0);
      assert.equal(result.leaseChecks, 0); assert.equal(result.reply.status, 500);
    }
  }
  await testEth();
  console.log('通过');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
