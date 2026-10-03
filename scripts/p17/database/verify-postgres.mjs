import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

// 固定本机端口、独立数据库和公开夹具；拒绝把生产URL传入此安全验证。
const psql = process.env.P17_PSQL;
assert.ok(psql, '需要指定本机P17_PSQL可执行文件');
const database = `p17_gate_${Date.now()}`;
const args = ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-h', '127.0.0.1', '-p', '54327', '-U', 'p17_admin'];
// Windows原生argv可能按系统代码页转换；SQL经UTF-8 stdin发送，保留中文内容。
const connection = { ...process.env, PGCLIENTENCODING: 'UTF8' };
const run = (sql, db = database) => {
  const result = spawnSync(psql, [...args, '-d', db], { input: sql, encoding: 'utf8', env: connection });
  if (result.status !== 0) throw Object.assign(new Error('本机SQL执行失败'), { stderr: result.stderr || result.error?.message });
  return result.stdout.trim();
};
const query = (sql) => new Promise((accept, fail) => {
  const child = spawn(psql, [...args, '-d', database], { env: connection }); let stdout = ''; let stderr = '';
  child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
  child.stdout.on('data', (value) => { stdout += value; }); child.stderr.on('data', (value) => { stderr += value; });
  child.on('error', fail); child.on('close', (code) => code === 0 ? accept({ stdout }) : fail(new Error(stderr)));
  child.stdin.end(sql);
});
const asServer = (sql) => `set role service_role; ${sql}`;
const reject = (sql, reason) => assert.throws(() => run(sql), (error) => String(error.stderr).includes(reason));
const hex = (number) => `0x${number.toString(16).padStart(64, '0')}`;
const owner = '10000000-0000-4000-8000-000000000001';
const other = '10000000-0000-4000-8000-000000000002';
const source = JSON.parse(readFileSync('src/lib/music-catalog/data/tracks-source.json', 'utf8'));
const snapshot = (id, token = 1, wallet = '11') => ({ order_id: hex(id), track_id: source[token - 1].id, chain_id: 1,
  contract_address: `0x${'aa'.repeat(20)}`, token_id: String(token), recipient_address: `0x${wallet.repeat(20)}`,
  amount: 1, catalog_revision: 'b'.repeat(64), metadata_uri: `ar://${'A'.repeat(43)}`, uri_hash: hex(99) });
const prepare = (id, key, token = 1, user = owner, wallet = '11') =>
  asServer(`select prepare_material_order('${user}','${key}','${JSON.stringify(snapshot(id, token, wallet))}'::jsonb);`);
const order = (id) => JSON.parse(run(`select to_jsonb(m) from material_mint_orders m where order_id='${hex(id)}';`));
const transition = (id, action, payload, user = owner, version = order(id).version) => asServer(
  `select transition_material_order('${user}','${hex(id)}',${version},'${action}','${JSON.stringify(payload)}'::jsonb);`);
const authorize = (id) => ({ digest: hex(1000 + id), deadline: Math.floor(Date.now() / 1000) + 3600, authorizer: `0x${'cc'.repeat(20)}` });
const files = ['schema.sql', 'prepare.sql', 'transitions.sql', 'op-recipient.sql', 'op-sbt-queue.sql'];
const migration = files.map((file) => readFileSync(`scripts/p17/database/${file}`, 'utf8')).join('\n');
const assertions = [];
async function check(name, work) { await work(); assertions.push(name); console.log(`PASS ${name}`); }

async function main() {
  run(`create database ${database};`, 'postgres');
  run(readFileSync('supabase/migrations/phase-0-2/001_initial_minimal.sql', 'utf8'));
  run(readFileSync('supabase/migrations/phase-0-2/003_tracks_and_mint_events.sql', 'utf8'));
  run(readFileSync('scripts/p17/database/fixture.sql', 'utf8'));
  for (const row of source) {
    assert.match(row.id, /^[0-9a-f-]{36}$/); assert.ok(Number.isInteger(row.week));
    run(`insert into tracks(id,title,week,audio_url) values('${row.id}','本地曲目夹具',${row.week},'local-fixture');`);
  }
  run(readFileSync('supabase/migrations/phase-10/043_mint_queue_status_check.sql', 'utf8'));
  await check('真实PostgreSQL执行五份迁移并可安全重跑', () => { run(`begin; ${migration} commit;`); run(`begin; ${migration} commit;`); });
  await check('政策未启用拒绝新订单', () => reject(prepare(1, 'pending'), 'ISSUANCE_POLICY_NOT_ACTIVATED'));
  run(`update material_issuance_policy set status='approved',approval_reference='2026-10-03用户明确批准',
    policy='{"id":"eth-original-wallet-once-v1","perWalletPerToken":1,"transferable":true,"reclaimAfterTransfer":false,"totalSupplyCap":null}';`);
  await check('并发同请求只生成一张冻结订单', async () => {
    const responses = await Promise.all([query(prepare(1, 'same')), query(prepare(2, 'same'))]);
    const ids = responses.map((response) => JSON.parse(response.stdout.trim()).order_id);
    assert.equal(ids[0], ids[1]); assert.equal(run('select count(*) from material_mint_orders;'), '1');
  });
  const first = JSON.parse(run(prepare(1, 'same'))).order_id;
  const firstId = Number(BigInt(first));
  await check('并发不同账号不能重复占用同一钱包同曲', async () => {
    const results = await Promise.allSettled([query(prepare(3, 'race-a', 2)), query(prepare(4, 'race-b', 2, other))]);
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(run("select count(*) from material_mint_orders where token_id='2';"), '1');
  });
  await check('匿名及客户端无法读写私有表或调用状态RPC', () => {
    for (const role of ['anon', 'authenticated']) {
      reject(`set role ${role}; select * from material_mint_orders;`, 'permission denied');
      reject(`set role ${role}; ${prepare(8, 'forbidden').split(';').slice(1).join(';')}`, 'permission denied');
      reject(`set role ${role}; update material_issuance_policy set status='approved';`, 'permission denied');
    }
    assert.equal(run("select count(*) from pg_class where relname in ('material_mint_orders','material_mint_attempts','material_issuance_policy') and relrowsecurity;"), '3');
    run('begin; grant select on material_mint_orders to authenticated; set role authenticated; select count(*) from material_mint_orders; rollback;');
    assert.equal(run('begin; grant select on material_mint_orders to authenticated; set role authenticated; select count(*) from material_mint_orders; rollback;'), '0');
  });
  const voucher = authorize(firstId);
  await check('错误owner与过期凭证被拒绝且事务回滚', () => {
    reject(transition(firstId, 'authorize', voucher, other), 'ORDER_NOT_FOUND');
    reject(transition(firstId, 'authorize', { ...voucher, deadline: 1 }), 'INVALID_AUTHORIZATION');
    assert.equal(order(firstId).status, 'prepared'); assert.equal(run('select count(*) from material_mint_attempts;'), '0');
  });
  await check('并发CAS只接受一次授权', async () => {
    const version = order(firstId).version;
    const results = await Promise.allSettled([query(transition(firstId, 'authorize', voucher, owner, version)), query(transition(firstId, 'authorize', voucher, owner, version))]);
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(run('select count(*) from material_mint_attempts;'), '1');
  });
  run(transition(firstId, 'send', voucher)); run(transition(firstId, 'unknown', voucher));
  await check('unknown保留互斥及历史凭证，不允许续签或重复发送', () => {
    reject(prepare(9, 'different-account', 1, other), 'MATERIAL_WALLET_TOKEN_RESERVED');
    reject(transition(firstId, 'authorize', authorize(9)), 'UNSAFE_AUTHORIZATION');
    reject(transition(firstId, 'send', voucher), 'UNSAFE_SEND');
    assert.equal(run('select count(*) from material_mint_attempts;'), '1');
  });
  run(transition(firstId, 'submission', { ...voucher, txHash: hex(2000) }));
  await check('并发worker只租用一次且错误worker不能确认', async () => {
    const rows = await Promise.all([query(asServer("select order_id from lease_material_orders('worker-a',1);")), query(asServer("select order_id from lease_material_orders('worker-b',1);"))]);
    assert.equal(rows.filter((row) => row.stdout.trim()).length, 1);
    reject(asServer(`select finalize_material_order('${first}',${order(firstId).version},'wrong-worker','{}');`), 'LEASE_OR_VERSION_CONFLICT');
  });
  const state = order(firstId);
  const proof = { orderId: first, chainId: 1, contract: state.contract_address, recipient: state.recipient_address,
    tokenId: '1', amount: 1, uriHash: hex(99), txHash: hex(2000), blockHash: hex(3000), logIndex: 0,
    blockNumber: '1', canonicalConfirmed: true, digest: voucher.digest };
  const finalize = (value, version = state.version) => asServer(`select finalize_material_order('${first}',${version},'${state.lease_owner}','${JSON.stringify(value)}');`);
  await check('不匹配链证明拒绝并保持原订单和lease', () => {
    reject(finalize({ ...proof, recipient: `0x${'dd'.repeat(20)}` }), 'PROOF_MISMATCH');
    assert.equal(order(firstId).status, 'submitted'); assert.equal(order(firstId).version, state.version);
  });
  await check('确认原子成功且重复回执不改变版本', () => {
    run(finalize(proof)); const confirmed = order(firstId); run(finalize(proof));
    assert.equal(order(firstId).status, 'success'); assert.equal(order(firstId).version, confirmed.version);
  });
  await check('关闭新签发仍可恢复；成功历史与换账号不释放钱包资格', () => {
    run("update material_issuance_policy set status='pending';"); run(finalize(proof));
    run("update material_issuance_policy set status='approved';");
    reject(prepare(10, 'after-success', 1, other), 'MATERIAL_WALLET_TOKEN_RESERVED');
  });
  await check('OP旧行NULL目标兼容；SBT请求幂等并冻结接收人', async () => {
    run(`insert into mint_queue(idempotency_key,user_id,token_id) values('legacy','${owner}',1);`);
    const key = `op-sbt:${owner}:0x${'ee'.repeat(20)}:1`;
    const create = (wallet) => asServer(`select prepare_op_sbt_job('${owner}','${key}',1,'0x${'ee'.repeat(20)}','0x${wallet.repeat(20)}');`);
    const results = await Promise.all([query(create('11')), query(create('22'))]);
    const jobs = results.map((response) => JSON.parse(response.stdout.trim()));
    assert.equal(jobs[0].id, jobs[1].id); assert.equal(jobs[0].recipient_address, jobs[1].recipient_address);
    assert.equal(run("select count(*) from mint_queue where idempotency_key='legacy' and material_contract_address is null and recipient_address is null;"), '1');
    assert.equal(run('select count(*) from claim_pending_material_job();'), '1');
    reject(`insert into mint_queue(idempotency_key,user_id,token_id,material_contract_address) values('bad','${owner}',1,'0x${'ee'.repeat(20)}');`, 'material_target_requires_recipient');
  });
  const proofPath = resolve('.tmp/p17-database-proof.json'); mkdirSync(resolve('.tmp'), { recursive: true });
  writeFileSync(proofPath, JSON.stringify({ verifiedAt: new Date().toISOString(), environment: 'isolated-local-postgresql',
    serverVersion: run('show server_version;'), database, productionWrite: false,
    migrationSha256: createHash('sha256').update(migration).digest('hex'), assertions }, null, 2) + '\n');
  run(`drop database ${database};`, 'postgres'); console.log(`PASS ${assertions.length}组真实数据库断言，夹具库已清理`);
}
main().catch((error) => { console.error('P17本机数据库验证失败，保留夹具库:', database, error.stderr || error.message); process.exitCode = 1; });
