// 显式生产项目、单事务替换封面池；默认完整执行后 ROLLBACK 演练。
import '../../_env';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

type Row = { id: string; ar_tx_id: string; usage_count: number; created_at: string };
type Uri = { order: number; file: string; txId: string; sha256: string; bytes: number };
const ref = 'uupobbgnhpattyxhxvmc', root = 'data/p23';
const beforePath = join(root, 'score-covers-before.json'), afterPath = join(root, 'score-covers-after.json');
const save = (p: string, value: unknown) => writeFileSync(p, `${JSON.stringify(value, null, 2)}\n`);
function sql(query: string): Record<string, unknown>[] {
  const file = join(root, 'review', 'cover-transaction.sql');
  writeFileSync(file, query);
  const output = execFileSync('supabase', ['db', 'query', '--linked', '--project-ref', ref, '--file', file, '-o', 'json'],
    { encoding: 'utf8', timeout: 120_000, maxBuffer: 4 * 1024 * 1024, windowsHide: true });
  const start = output.indexOf('{'), end = output.lastIndexOf('}');
  assert.ok(start >= 0 && end > start, 'CLI 未返回 JSON');
  return JSON.parse(output.slice(start, end + 1)).rows;
}
const quote = (s: string) => `'${s.replaceAll("'", "''")}'`;
function rows(): Row[] { return sql('select id,ar_tx_id,usage_count,created_at from public.score_covers order by created_at,id') as Row[]; }
function validateOld(current: Row[]) {
  const old = Object.values(JSON.parse(readFileSync('data/cover-arweave-map.json', 'utf8'))) as { txId: string }[];
  assert.equal(current.length, 100, '写库前必须正好 100 行旧封面');
  assert.ok(current.every((r) => old.some((x) => x.txId === r.ar_tx_id)), '包含未知封面');
}
function verifyNew(current: Row[], uris: Uri[]) {
  assert.equal(current.length, 600);
  assert.deepEqual(current.map((r) => r.ar_tx_id), uris.map((u) => u.txId), '封面排序必须与轮转顺序一致');
}
async function main() {
  const execute = process.argv.includes('--execute'), rollback = process.argv.includes('--rollback');
  const current = rows();
  if (rollback) {
    assert.ok(existsSync(beforePath), '缺少旧池快照');
    const before: Row[] = JSON.parse(readFileSync(beforePath, 'utf8'));
    validateOld(before);
    const uris: Uri[] = JSON.parse(readFileSync(join(root, 'cover-uris.json'), 'utf8'));
    const values = before.map((r) => `(${quote(r.id)}::uuid,${quote(r.ar_tx_id)},${r.usage_count},${quote(r.created_at)}::timestamptz)`).join(',');
    const ids = uris.map((u) => quote(u.txId)).join(',');
    const query = `begin; set local lock_timeout='10s'; lock table public.score_covers in exclusive mode;
      insert into public.score_covers(id,ar_tx_id,usage_count,created_at) values ${values} on conflict(id) do nothing;
      do $$ begin if (select count(*) from public.score_covers where id in (${before.map((r) => `${quote(r.id)}::uuid`).join(',')}))<>100 then raise exception '旧池恢复失败'; end if; end $$;
      delete from public.score_covers where ar_tx_id in (${ids}) and usage_count=0;
      select count(*) as remaining_count from public.score_covers; ${execute ? 'commit' : 'rollback'};`;
    const result = sql(query);
    save(join(root, 'review', execute ? 'rollback-execute.json' : 'rollback-dry-run.json'), result);
    if (execute) save(afterPath, { phase: 'rolled-back', rows: rows() });
    console.log(execute ? '回滚完成，已取用的新封面保留' : '回滚演练完成，未提交');
    return;
  }
  validateOld(current);
  const uris: Uri[] = JSON.parse(readFileSync(join(root, 'cover-uris.json'), 'utf8'));
  const ledger = JSON.parse(readFileSync(join(root, 'cover-upload-ledger.json'), 'utf8'));
  assert.equal(uris.length, 600); assert.equal(new Set(uris.map((u) => u.txId)).size, 600);
  for (const [i, uri] of uris.entries()) {
    assert.equal(uri.order, i + 1); assert.match(uri.txId, /^[\w-]{43}$/);
    const e = ledger[uri.file];
    assert.equal(e?.state, 'uploaded'); assert.equal(e.txId, uri.txId); assert.equal(e.sha256, uri.sha256);
    assert.ok(e.verified?.includes('https://arweave.net') && e.verified.length >= 2, `${uri.file} 缺双网关核验`);
    assert.ok(!current.some((r) => r.ar_tx_id === uri.txId));
  }
  if (!execute) {
    assert.ok(!existsSync(beforePath), '旧池快照已存在，拒绝覆盖；--execute 会读取它');
    save(beforePath, current);
  } else {
    assert.ok(existsSync(beforePath), '必须先运行事务演练');
    const before: Row[] = JSON.parse(readFileSync(beforePath, 'utf8'));
    assert.deepEqual(current.map((r) => [r.id, r.ar_tx_id, r.created_at]), before.map((r) => [r.id, r.ar_tx_id, r.created_at]), '旧池静态字段与演练快照不同');
    assert.ok(existsSync(join(root, 'review', 'write-dry-run.json')), '缺演练结果');
  }
  const t0 = Math.floor(Date.now() / 1000) * 1000;
  const values = uris.map((u) => `(${quote(u.txId)},0,${quote(new Date(t0 + u.order * 1000).toISOString())}::timestamptz)`).join(',');
  const oldIds = current.map((r) => `${quote(r.id)}::uuid`).join(',');
  const oldStatic = current.map((r) => `(${quote(r.id)}::uuid,${quote(r.ar_tx_id)},${quote(r.created_at)}::timestamptz)`).join(',');
  const expected = `array[${uris.map((u) => quote(u.txId)).join(',')}]::text[]`;
  const result = sql(`begin; set local lock_timeout='10s'; lock table public.score_covers in exclusive mode;
    do $$ begin if (select count(*) from public.score_covers)<>100 or (select count(*) from public.score_covers c join (values ${oldStatic}) as b(id,ar_tx_id,created_at) on c.id=b.id and c.ar_tx_id=b.ar_tx_id and c.created_at=b.created_at)<>100 then raise exception '旧池静态字段在事务前发生变化'; end if; end $$;
    insert into public.score_covers(ar_tx_id,usage_count,created_at) values ${values};
    delete from public.score_covers where id in (${oldIds});
    do $$ begin if (select count(*) from public.score_covers)<>600 or (select array_agg(ar_tx_id order by created_at) from public.score_covers)<>${expected} then raise exception '新池集合或排序断言失败'; end if; end $$;
    select count(*) as cover_count,min(created_at) as first_at,max(created_at) as last_at from public.score_covers;
    ${execute ? 'commit' : 'rollback'};`);
  save(join(root, 'review', execute ? 'write-execute.json' : 'write-dry-run.json'), result);
  const after = rows();
  if (execute) {
    verifyNew(after, uris);
    save(afterPath, { phase: 'verified', projectRef: ref, at: new Date().toISOString(), rows: after });
    const next = [...after].sort((a, b) => a.usage_count - b.usage_count || Date.parse(a.created_at) - Date.parse(b.created_at))[0];
    console.log('单事务已提交，读回 600 张且顺序一致；下一张', next.ar_tx_id);
  } else {
    assert.deepEqual(after, current, '演练 ROLLBACK 后必须与之前完全一致');
    console.log('事务试跑通过：600 插入、100 删除及顺序断言全部通过；ROLLBACK 后旧池不变');
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
