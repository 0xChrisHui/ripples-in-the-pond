// 封面永久上传与双网关读回；逐张落账，成功项永不重传。
import '../../_env';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { ARWEAVE_GATEWAYS, getTurboUploadBudget, uploadBuffer } from '../../../src/lib/arweave/core';

type Item = { order: number; file: string; style: string; n: number; seed: number; bytes: number; sha256: string };
type Entry = { state: 'pending' | 'uploaded'; sha256: string; bytes: number; attempts: number; txId?: string; verified?: string[]; checkedAt?: string };
const root = 'data/p23', pool = join(root, 'cover-pool'), ledgerPath = join(root, 'cover-upload-ledger.json');
const items: Item[] = JSON.parse(readFileSync(join(pool, 'manifest.json'), 'utf8')).items;
const ledger: Record<string, Entry> = existsSync(ledgerPath) ? JSON.parse(readFileSync(ledgerPath, 'utf8')) : {};
const hash = (b: Buffer) => createHash('sha256').update(b).digest('hex');
function save(file: string, value: unknown) {
  writeFileSync(`${file}.tmp`, `${JSON.stringify(value, null, 2)}\n`);
  // Windows 索引/防护软件会短暂占用目标，重试本地改名不重发永久上传。
  for (let attempt = 0; ; attempt++) {
    try { renameSync(`${file}.tmp`, file); return; }
    catch (error) {
      if (attempt >= 20 || !['EPERM', 'EBUSY'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    }
  }
}
function validate() {
  if (items.length !== 600 || new Set(items.map((x) => x.sha256)).size !== 600) throw new Error('封面池必须正好 600 张且唯一');
  for (const [index, item] of items.entries()) {
    const b = readFileSync(join(pool, item.file));
    if (item.order !== index + 1 || hash(b) !== item.sha256 || b.length !== item.bytes) throw new Error(`本地内容不符 ${item.file}`);
    const known = ledger[item.file];
    if (known && (known.sha256 !== item.sha256 || known.bytes !== item.bytes)) throw new Error(`账本内容冲突 ${item.file}`);
  }
}
async function quote() {
  const todo = items.filter((x) => ledger[x.file]?.state !== 'uploaded');
  let required = 0n, balance = '';
  for (let i = 0; i < todo.length; i += 50) {
    const budget = await getTurboUploadBudget(todo.slice(i, i + 50).map((x) => x.bytes));
    required += BigInt(budget.requiredWinc); balance = budget.effectiveBalanceWinc;
  }
  if (!balance) balance = (await getTurboUploadBudget([1])).effectiveBalanceWinc;
  console.log(JSON.stringify({ at: new Date().toISOString(), remaining: todo.length, balanceWinc: balance, quotedWinc: String(required) }));
  if (BigInt(balance) < required) throw new Error('余额不足全部剩余文件报价，停止上传');
}
async function upload() {
  await quote();
  if (process.argv.includes('--quote')) return;
  for (const item of items) {
    const known = ledger[item.file];
    if (known?.state === 'uploaded' && /^[\w-]{43}$/.test(known.txId ?? '')) continue;
    if ((known?.attempts ?? 0) >= 2) throw new Error(`${item.file} 第二次上传仍未确认，停止`);
    ledger[item.file] = { state: 'pending', sha256: item.sha256, bytes: item.bytes, attempts: (known?.attempts ?? 0) + 1 };
    save(ledgerPath, ledger);
    const result = await uploadBuffer(readFileSync(join(pool, item.file)), 'image/jpeg', [
      { name: 'App-Name', value: 'ripples-p23-cover' },
      { name: 'Ripples-Cover-File', value: item.file },
      { name: 'Ripples-Cover-Sha256', value: item.sha256 },
    ]);
    if (!/^[\w-]{43}$/.test(result.txId)) throw new Error('Turbo 返回非法 txId');
    ledger[item.file] = { ...ledger[item.file], state: 'uploaded', txId: result.txId };
    save(ledgerPath, ledger);
    console.log(`${item.order}/600 ${item.file} ${result.txId}`);
  }
  await quote();
}
async function checkGateway(gateway: string, item: Item, entry: Entry) {
  try {
    const response = await fetch(`${gateway}/${entry.txId}`, { signal: AbortSignal.timeout(30_000) });
    if (response.status !== 200 || !response.headers.get('content-type')?.startsWith('image/jpeg')) return false;
    return hash(Buffer.from(await response.arrayBuffer())) === item.sha256;
  } catch { return false; }
}
async function verify() {
  if (items.some((x) => ledger[x.file]?.state !== 'uploaded')) throw new Error('尚未上传全部 600 张');
  const deadline = Date.now() + 2 * 60 * 60 * 1000;
  let delay = 60_000;
  while (true) {
    const todo = items.filter((x) => (ledger[x.file].verified?.length ?? 0) < 2);
    let cursor = 0;
    await Promise.all(Array.from({ length: 8 }, async () => {
      while (cursor < todo.length) {
        const item = todo[cursor++], entry = ledger[item.file];
        const results = await Promise.all(ARWEAVE_GATEWAYS.map(async (gw) => await checkGateway(gw, item, entry) ? gw : null));
        const passed = results.filter((x) => x !== null);
        entry.checkedAt = new Date().toISOString();
        entry.verified = passed.includes(ARWEAVE_GATEWAYS[0]) && passed.length >= 2 ? passed : [];
        save(ledgerPath, ledger);
      }
    }));
    const passed = items.filter((x) => (ledger[x.file].verified?.length ?? 0) >= 2).length;
    console.log(`${new Date().toISOString()} 双网关通过 ${passed}/600`);
    if (passed === 600) break;
    if (Date.now() + delay >= deadline) throw new Error('读回两小时内未全部通过，禁止写生产库');
    await new Promise((r) => setTimeout(r, delay)); delay = Math.min(delay * 2, 16 * 60_000);
  }
  const uris = items.map((item) => ({ ...item, txId: ledger[item.file].txId }));
  if (new Set(uris.map((x) => x.txId)).size !== 600) throw new Error('上传 txId 不唯一');
  save(join(root, 'cover-uris.json'), uris);
}
async function main() { validate(); await (process.argv.includes('--verify') ? verify() : upload()); }
main().catch((error) => { console.error(error); process.exitCode = 1; });
