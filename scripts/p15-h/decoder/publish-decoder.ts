import '../../_env';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { getTurboUploadBudget, uploadBuffer } from '../../../src/lib/arweave/core';
import { ARWEAVE_AUDIO_GATEWAYS } from '../../../src/lib/arweave/shared';

type State = {
  schema: 'ripples.decoder-publication.v1';
  sha256: string; bytes: number; mime: 'text/html';
  state: 'uploading' | 'uploaded' | 'verified' | 'upload_result_unknown';
  arTxId: string | null; attemptedAt: string; uploadedAt: string | null;
  verifiedAt: string | null; lastError: string | null; gateways: unknown[];
};

const root = process.cwd();
const sourcePath = join(root, 'src/score-decoder/index.html');
const bytes = readFileSync(sourcePath);
const hash = createHash('sha256').update(bytes).digest('hex');
// 每个内容身份一份账本：永久对象只能追加新 revision，绝不覆盖或复用旧 txid。
const statePath = join(root, 'data/score-decoder/v3-publications', `${hash}.json`);
const mode = process.argv.find((arg) => /^--(audit|preflight|upload|verify)$/.test(arg));
const confirmed = process.argv.includes('--confirm-permanent-write');
const txPattern = /^[A-Za-z0-9_-]{43}$/;

function load(): State | null {
  return existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) as State : null;
}

function save(state: State): void {
  mkdirSync(dirname(statePath), { recursive: true });
  const temporary = `${statePath}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`);
  renameSync(temporary, statePath);
}

function assertSource(): void {
  const html = bytes.toString('utf8');
  if (!html.includes('ripples.score-package.v3') || !html.includes('ripples.score-compatibility.v1')) {
    throw new Error('decoder 缺少 package v3 或 compatibility v1 合同');
  }
  const state = load();
  if (state && (state.sha256 !== hash || state.bytes !== bytes.length || state.mime !== 'text/html')) {
    throw new Error('decoder 已固定内容身份与当前文件不一致');
  }
}

async function verify(state: State): Promise<void> {
  if (!state.arTxId || !txPattern.test(state.arTxId)) throw new Error('decoder 没有可验证 txid');
  const gateways: Array<Record<string, unknown>> = [];
  for (const gateway of ARWEAVE_AUDIO_GATEWAYS) {
    try {
      const response = await fetch(`${gateway}/${state.arTxId}`, {
        signal: AbortSignal.timeout(15_000), headers: { Origin: 'https://pond-ripple.xyz' },
      });
      const body = response.ok ? Buffer.from(await response.arrayBuffer()) : Buffer.alloc(0);
      const actualHash = createHash('sha256').update(body).digest('hex');
      const mime = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
      const ok = response.ok && body.length === state.bytes && actualHash === state.sha256
        && mime === state.mime && body.includes(Buffer.from('ripples.score-package.v3'));
      gateways.push({ gateway, status: response.status, bytes: body.length, sha256: actualHash, mime, ok });
    } catch (error) {
      gateways.push({ gateway, ok: false, error: error instanceof Error ? error.message : 'unknown' });
    }
    if (gateways.filter((item) => item.ok).length >= 2) break;
  }
  if (gateways.filter((item) => item.ok).length < 2) {
    save({ ...state, gateways, lastError: 'decoder 尚未达到双网关 quorum' });
    throw new Error('decoder 尚未达到双网关 quorum；只可重跑 verify，不得重传');
  }
  save({ ...state, state: 'verified', verifiedAt: new Date().toISOString(), lastError: null, gateways });
  console.log(`✅ decoder verified → ${state.arTxId}`);
}

async function main(): Promise<void> {
  if (!mode) throw new Error('用法：--audit|--preflight|--upload|--verify');
  assertSource();
  const existing = load();
  if (mode === '--audit') return console.log(`✅ decoder 审计通过：${bytes.length} bytes / ${hash}`);
  if (mode === '--preflight') {
    const budget = await getTurboUploadBudget([bytes.length, bytes.length]);
    return console.log(`✅ decoder 预算：${budget.requiredWinc} / ${budget.effectiveBalanceWinc} winc`);
  }
  if (mode === '--verify') {
    if (!existing || !['uploaded', 'verified'].includes(existing.state)) throw new Error('decoder 尚未上传');
    return verify(existing);
  }
  if (!confirmed) throw new Error('永久写入必须附加 --confirm-permanent-write');
  if (existing) throw new Error(`decoder 已有 ${existing.state} 账本，禁止再次上传`);
  const state: State = {
    schema: 'ripples.decoder-publication.v1', sha256: hash, bytes: bytes.length,
    mime: 'text/html', state: 'uploading', arTxId: null,
    attemptedAt: new Date().toISOString(), uploadedAt: null, verifiedAt: null,
    lastError: null, gateways: [],
  };
  save(state);
  try {
    const result = await uploadBuffer(bytes, 'text/html', [
      { name: 'App-Name', value: 'Ripples in the Pond' },
      { name: 'P15-Phase', value: 'H3' },
      { name: 'Asset-Kind', value: 'score-decoder-v3' },
      { name: 'Asset-Revision', value: hash.slice(0, 12) },
      { name: 'Content-SHA256', value: hash },
    ]);
    if (!txPattern.test(result.txId)) throw new Error('Turbo 返回非法 txid');
    save({ ...state, state: 'uploaded', arTxId: result.txId,
      uploadedAt: new Date().toISOString(), lastError: null });
    console.log(`uploaded decoder → ${result.txId}`);
  } catch (error) {
    save({ ...state, state: 'upload_result_unknown',
      lastError: error instanceof Error ? error.message.slice(0, 500) : 'unknown' });
    throw new Error('decoder 上传结果未知，已熔断；禁止自动重传');
  }
}

main().catch((error) => { console.error('[P15-H3 decoder]', error.message); process.exit(1); });
