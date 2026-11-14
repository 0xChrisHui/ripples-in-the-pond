// 在独立测试 schema 运行真实迁移与并发 RPC，绝不向生产业务表插入夹具。
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const exec = promisify(execFile);
const schema = 'p23_atomic_test_20261114';
const root = '.tmp/p23-atomic-live'; mkdirSync(root, { recursive: true });
let serial = 0;
async function sql(query) {
  const path = `${root}/db-test-${++serial}.sql`; writeFileSync(path, query);
  const { stdout } = await exec('supabase', ['db', 'query', '--linked', '--project-ref',
    'uupobbgnhpattyxhxvmc', '--file', path, '-o', 'json'], { timeout: 120_000, windowsHide: true });
  return JSON.parse(stdout.slice(stdout.indexOf('{'), stdout.lastIndexOf('}') + 1)).rows;
}
const q = `${schema}.score_nft_queue`;
const ids = ['00000000-0000-0000-0000-000000002301','00000000-0000-0000-0000-000000002302'];
const owner = '00000000-0000-0000-0000-000000002303';
const issuer = '0x0000000000000000000000000000000000000023';
const reserve = (id, lease = owner) => `${schema}.reserve_atomic_score('${id}','${lease}','${issuer}','${issuer}',12)`;
await sql(`create schema ${schema}; create table ${q} (like public.score_nft_queue including all);
  create table ${schema}.system_kv (like public.system_kv including all);`);
try {
  const migration = readFileSync('supabase/migrations/phase-23/064_atomic_score_issuance.sql', 'utf8')
    .replaceAll('public.', `${schema}.`).replace("notify pgrst, 'reload schema';", '');
  await sql(migration);
  await sql(`insert into ${schema}.system_kv(key,value) values ('score-atomic:enabled','true');
    insert into ${q} select (jsonb_populate_record(null::${q}, to_jsonb(s) || jsonb_build_object(
      'id',i.id,'pending_score_id',i.id,'issuance_mode','atomic','token_id',null,'token_uri',null,
      'tx_hash',null,'uri_tx_hash',null,'mint_attempted_at',null,'status','minting_onchain',
      'locked_by','${owner}','lease_expires_at',(now()+interval '5 minutes')::text))).*
    from (select * from public.score_nft_queue order by created_at desc limit 1) s
    cross join (values ('${ids[0]}'),('${ids[1]}')) i(id);`);
  const concurrent = await Promise.all(ids.map(id => sql(`select ${reserve(id)} as reserved;`)));
  assert.equal(concurrent.flat().filter(x => x.reserved).length, 1);
  const [held] = await sql(`select id from ${q} where expected_token_id is not null;`);
  const waiting = ids.find(id => id !== held.id);
  const [wrongLease] = await sql(`select ${reserve(waiting, ids[0])} as reserved;`);
  assert.equal(wrongLease.reserved, false);
  await assert.rejects(sql(`update ${q} set expected_token_id=13 where id='${held.id}';`));
  await assert.rejects(sql(`update ${q} set issuance_mode='legacy' where id='${held.id}';`));
  await sql(`update ${q} set status='failed' where id='${held.id}';`);
  const [blocked] = await sql(`select ${reserve(waiting)} as reserved;`); assert.equal(blocked.reserved, false);
  await sql(`update ${q} set status='minting_onchain',locked_by=null,lease_expires_at=null;
    update ${q} set created_at=now()-interval '1 day' where id='${waiting}';`);
  const [claim] = await sql(`select id from ${schema}.claim_score_queue_job('${owner}',5);`);
  assert.equal(claim.id, held.id);
  await sql(`update ${q} set token_id=12 where id='${held.id}';
    update ${q} set locked_by='${owner}',lease_expires_at=now()-interval '1 second' where id='${waiting}';`);
  const [expired] = await sql(`select ${reserve(waiting)} as reserved;`); assert.equal(expired.reserved, false);
  await sql(`update ${q} set lease_expires_at=now()+interval '5 minutes' where id='${waiting}';`);
  const [released] = await sql(`select ${reserve(waiting)} as reserved;`); assert.equal(released.reserved, true);
  console.log('真实 PostgreSQL：并发唯一预留、错误/过期租约、编号/模式不可变、失败保留、认领优先、确认后释放，共8项通过');
} finally {
  assert.equal(schema, 'p23_atomic_test_20261114');
  await sql(`drop schema ${schema} cascade;`);
}
