import '../../_env';
import { createHash } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { getTurboUploadBudget, uploadBuffer } from '../../../src/lib/arweave/core';
import { ARWEAVE_AUDIO_GATEWAYS } from '../../../src/lib/arweave/shared';
import { FreeUploadError, uploadFreeCollection } from './free-upload';

// 用户已批准这两份具体合集JSON；35份原metadata、音频和封面均不重传。
const root = 'reviews/evidence/parallel-2026-10/20261002-night-01/p17/contracts';
const file = `${root}/collection-upload-ledger.json`;
const approved = [
  { kind: 'ethereum', name: 'ethereum-originals-collection.json', sha256: '250ef982a92ab82200cf3faad8e46c80533efab95eb338d64f3c43ea6361732a' },
  { kind: 'optimism', name: 'optimism-originals-collection.json', sha256: '9750f3be433d617e401e871487cf90ed0eb15dc0097ba4b33befc9606928ee29' },
];
type Row = { kind: string; name: string; sha256: string; bytes: number;
  state: 'prepared' | 'uploading' | 'unknown' | 'uploaded' | 'verified';
  txId: string | null; uploader: string | null; costWinc: string | null;
  failureCode?: string | null; recoveryEvidence?: string | null;
  checkedAt: string | null; gateways: { gateway: string; status: number; exact: boolean; sha256: string | null }[] };
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
function save(rows: Row[]) {
  const temp = `${file}.${process.pid}.tmp`; const descriptor = openSync(temp, 'wx');
  try { writeFileSync(descriptor, JSON.stringify({ schemaVersion: 1, authorization: '用户明确批准两份合集永久上传，禁止充值', rows }, null, 2) + '\n'); fsyncSync(descriptor); }
  finally { closeSync(descriptor); }
  renameSync(temp, file);
}
async function main() {
  const mode = process.argv[2]; if (!['--upload', '--upload-credits', '--verify'].includes(mode)) {
    throw new Error('仅允许--upload、--upload-credits或--verify');
  }
  const lock = `${file}.lock`; const descriptor = openSync(lock, 'wx');
  try {
    const rows: Row[] = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).rows : approved.map((item) => ({ ...item,
      bytes: readFileSync(`${root}/${item.name}`).length, state: 'prepared', txId: null, uploader: null,
      costWinc: null, failureCode: null, recoveryEvidence: null, checkedAt: null, gateways: [] }));
    if (rows.length !== 2 || rows.some((row, index) => row.kind !== approved[index].kind
      || row.name !== approved[index].name || row.sha256 !== approved[index].sha256
      || sha(readFileSync(`${root}/${row.name}`)) !== row.sha256)) throw new Error('上传内容与授权或旧账本不符');
    if (rows.some((row) => ['uploading', 'unknown'].includes(row.state))) throw new Error('已有上传结果未知，禁止重传，先核对原上传');
    if (mode === '--upload' || mode === '--upload-credits') {
      const pending = rows.filter((row) => row.state === 'prepared');
      if (pending.length) {
        save(rows);
        if (mode === '--upload-credits') {
          const budget = await getTurboUploadBudget(pending.map((row) => row.bytes));
          console.log(JSON.stringify({ mode: 'existing-credits', requiredWinc: budget.requiredWinc,
            availableWinc: budget.effectiveBalanceWinc, topUp: false }));
        } else console.log('Turbo两份小JSON使用无签名免费路径，不提供付款签名、不充值、不发EVM交易');
      }
      for (const row of pending) {
        row.state = 'uploading'; save(rows);
        try {
          const bytes = readFileSync(`${root}/${row.name}`);
          const tags = [
            { name: 'Content-Type', value: 'application/json' },
            { name: 'App-Name', value: 'Ripples in the Pond' }, { name: 'P17-Asset-Kind', value: `${row.kind}-originals-collection` },
            { name: 'P17-Content-SHA256', value: row.sha256 },
          ];
          const result = mode === '--upload-credits'
            ? await uploadBuffer(bytes, 'application/json', tags.slice(1))
            : await uploadFreeCollection(bytes, tags);
          const uploaded = 'txId' in result
            ? { id: result.txId, owner: result.uploaderAddress, winc: result.costWinc } : result;
          if (!/^[A-Za-z0-9_-]{43}$/.test(uploaded.id)) throw new Error('返回txid无效');
          row.state = 'uploaded'; row.txId = uploaded.id; row.uploader = uploaded.owner;
          row.costWinc = uploaded.winc; row.failureCode = null;
          row.checkedAt = new Date().toISOString(); save(rows);
          console.log(JSON.stringify({ kind: row.kind, state: row.state, txId: row.txId, costWinc: row.costWinc }));
        } catch (error) {
          const definitive = error instanceof FreeUploadError && error.outcome === 'not_sent';
          row.state = definitive ? 'prepared' : 'unknown';
          row.failureCode = error instanceof FreeUploadError ? `http_${error.status}_${error.outcome}` : 'unknown';
          row.checkedAt = new Date().toISOString(); save(rows);
          throw new Error(definitive ? '免费端点明确拒绝，内容未发送' : '上传结果未知，已保留账本，禁止自动重传');
        }
      }
    } else {
      for (const row of rows) {
        if (!row.txId || !['uploaded', 'verified'].includes(row.state)) throw new Error('没有已知上传txid，禁止伪造永久URI');
        row.gateways = [];
        for (const gateway of ARWEAVE_AUDIO_GATEWAYS) {
          try {
            const response = await fetch(`${gateway}/${row.txId}`, { signal: AbortSignal.timeout(15000) });
            const body = Buffer.from(await response.arrayBuffer()); const digest = sha(body);
            row.gateways.push({ gateway, status: response.status, sha256: digest,
              exact: response.ok && body.length === row.bytes && digest === row.sha256
                && Boolean(response.headers.get('content-type')?.includes('application/json')) });
          } catch { row.gateways.push({ gateway, status: 0, sha256: null, exact: false }); }
        }
        const exact = row.gateways.filter((item) => item.exact).length;
        row.state = exact >= 2 ? 'verified' : 'uploaded'; row.checkedAt = new Date().toISOString(); save(rows);
        console.log(JSON.stringify({ kind: row.kind, state: row.state, exact, uri: `ar://${row.txId}` }));
        if (exact < 2) throw new Error('新合集尚未达到双网关逐字节一致，保留已知txid，不能重传');
      }
    }
  } finally { closeSync(descriptor); unlinkSync(lock); }
}
main().catch((error) => { console.error('P17合集操作停止：', error instanceof Error && error.constructor === Error ? error.message : '外部工具错误，已保留现场'); process.exitCode = 1; });
