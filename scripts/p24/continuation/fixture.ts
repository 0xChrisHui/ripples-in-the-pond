import type { ScoreMintQueueRow } from '../../../src/types/score-mint';

export function scoreRow(id = '1'): ScoreMintQueueRow {
  return {
    id, user_id: 'user', pending_score_id: `draft-${id}`, track_id: 'track',
    cover_ar_tx_id: 'cover', events_ar_tx_id: null, metadata_ar_tx_id: null,
    token_id: null, token_uri: null, status: 'pending', retry_count: 0, last_error: null,
    tx_hash: null, uri_tx_hash: null, locked_by: null, lease_expires_at: null,
    mint_attempted_at: null, uri_attempted_at: null, sound_set_id: 'sounds',
    sounds_map_ar_tx_id: 'sounds-ref', sounds_map_sha256: 'sounds-hash',
    sounds_map_bytes: 12, sounds_map_mime: 'application/json', decoder_id: 'decoder',
    decoder_ar_tx_id: 'decoder-ref', decoder_sha256: 'decoder-hash', decoder_bytes: 12,
    decoder_mime: 'text/html', base_ar_tx_id: 'base-ref', base_sha256: 'base-hash',
    base_bytes: 12, base_mime: 'audio/mpeg', requires_package_v3: true,
    events_sha256: null, events_bytes: null, events_mime: null,
    events_upload_state: 'none', events_verified_at: null, package_ar_tx_id: null,
    package_sha256: null, package_bytes: null, package_mime: null,
    package_upload_state: 'none', package_verified_at: null, metadata_sha256: null,
    metadata_bytes: null, metadata_mime: null, metadata_upload_state: 'none',
    metadata_verified_at: null, created_at: new Date(0).toISOString(), updated_at: new Date(0).toISOString(),
  };
}

// 只代替数据库边界，真实业务模块仍执行自身的查询条件、状态迁移和错误判断。
export function memoryDb(rows: ScoreMintQueueRow[], now: () => number) {
  const records = new Map(rows.map(row => [row.id, { ...row }]));
  let serial = 0;
  let rejectWrites = false;
  const tables: Record<string, Record<string, unknown>[]> = {
    users: [{ id: 'user', evm_address: '0x0000000000000000000000000000000000000001' }],
    pending_scores: rows.map(row => ({ id: row.pending_score_id, events_data: [{ key: 'a', time: 0 }] })),
    tracks: [{ id: 'track', title: '测试曲目', week: 1 }],
    score_arweave_upload_ledger: [], mint_events: [], system_kv: [],
  };
  const db = {
    records,
    failWrites(value: boolean) { rejectWrites = value; },
    claim(owner?: string) {
      const row = [...records.values()].find(item => !['success', 'failed'].includes(item.status)
        && item.retry_count < 3 && (!item.lease_expires_at || Date.parse(item.lease_expires_at) < now()));
      if (!row) return null;
      row.locked_by = owner ?? `owner-${++serial}`;
      row.lease_expires_at = new Date(now() + 300_000).toISOString();
      return { row: { ...row }, leaseOwner: row.locked_by };
    },
    from(table: string) {
      const filters: Array<(row: Record<string, unknown>) => boolean> = [];
      let patch: Record<string, unknown> | null = null;
      let inserting: Record<string, unknown> | null = null;
      const execute = () => {
        if ((patch || inserting) && rejectWrites) return { data: null, error: { message: '模拟数据库写入中断' } };
        const data: Record<string, unknown>[] = table === 'score_nft_queue'
          ? [...records.values()].map(row => row as unknown as Record<string, unknown>)
          : tables[table] ?? (() => { throw Error(`测试未允许数据表：${table}`); })();
        if (inserting) data.push(inserting);
        const selected = data.filter(row => filters.every(filter => filter(row)));
        if (patch) selected.forEach(row => Object.assign(row, patch));
        return { data: selected.map(row => ({ ...row })), error: null };
      };
      const q = {
        select() { return q; },
        update(value: Record<string, unknown>) { patch = value; return q; },
        insert(value: Record<string, unknown>) { inserting = value; return q; },
        upsert(value: Record<string, unknown>) { inserting = value; return q; },
        eq(key: string, value: unknown) { filters.push(row => row[key] === value); return q; },
        is(key: string, value: unknown) { filters.push(row => row[key] === value); return q; },
        gt(key: string, value: string) { filters.push(row => typeof row[key] === 'string' && row[key] > value); return q; },
        lt(key: string, value: string) { filters.push(row => typeof row[key] === 'string' && row[key] < value); return q; },
        in(key: string, values: unknown[]) { filters.push(row => values.includes(row[key])); return q; },
        order() { return q; }, limit() { return q; },
        maybeSingle() { const r = execute(); return Promise.resolve({ ...r, data: r.data?.[0] ?? null }); },
        single() { return q.maybeSingle(); },
        then(resolve: (value: ReturnType<typeof execute>) => unknown, reject?: (error: unknown) => unknown) {
          return Promise.resolve().then(execute).then(resolve, reject);
        },
      };
      return q;
    },
  };
  return db;
}
