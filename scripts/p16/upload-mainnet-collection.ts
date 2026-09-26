import '../_env';

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getTurboUploadBudget, uploadBuffer } from '../../src/lib/arweave/core';

const root = process.cwd();
const evidenceDir = join(root, 'reviews/evidence/p16-mainnet');
const collectionPath = join(evidenceDir, 'collection.json');
const statePath = join(evidenceDir, 'collection-upload.json');
const txIdPattern = /^[A-Za-z0-9_-]{43}$/;
const gateways = [
  'https://arweave.net',
  'https://ardrive.net',
  'https://arweave.tokyo',
] as const;

type UploadState = {
  state: 'uploading' | 'uploaded' | 'verified' | 'upload_result_unknown';
  contentSha256: string;
  bytes: number;
  arweaveTxId: string | null;
  uploaderAddress: string | null;
  costWinc: string | null;
  gatewayEvidence: Array<Record<string, string | number | boolean | null>>;
  updatedAt: string;
};

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function readState(): UploadState | null {
  return existsSync(statePath)
    ? JSON.parse(readFileSync(statePath, 'utf8')) as UploadState
    : null;
}

function writeState(state: UploadState): void {
  const temp = `${statePath}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  renameSync(temp, statePath);
}

async function upload(): Promise<void> {
  const bytes = readFileSync(collectionPath);
  const digest = sha256(bytes);
  const existing = readState();
  if (existing?.state === 'uploaded' || existing?.state === 'verified') {
    console.log(`已有上传记录：${existing.arweaveTxId}`);
    return;
  }
  if (existing) throw new Error(`当前状态 ${existing.state}，禁止自动重传`);

  const budget = await getTurboUploadBudget([bytes.length, bytes.length]);
  console.log(`Turbo 预算通过：需要 ${budget.requiredWinc} / 可用 ${budget.effectiveBalanceWinc} winc`);
  const base: UploadState = {
    state: 'uploading', contentSha256: digest, bytes: bytes.length,
    arweaveTxId: null, uploaderAddress: null, costWinc: null,
    gatewayEvidence: [], updatedAt: new Date().toISOString(),
  };
  writeState(base);
  try {
    const result = await uploadBuffer(bytes, 'application/json', [
      { name: 'App-Name', value: 'Ripples in the Pond' },
      { name: 'P16-Asset-Kind', value: 'ethereum-mainnet-collection' },
      { name: 'P16-Content-SHA256', value: digest },
    ]);
    if (!txIdPattern.test(result.txId)) throw new Error('Turbo 返回非法 txid');
    writeState({
      ...base, state: 'uploaded', arweaveTxId: result.txId,
      uploaderAddress: result.uploaderAddress, costWinc: result.costWinc,
      updatedAt: new Date().toISOString(),
    });
    console.log(`uploaded ${result.txId}`);
  } catch (error) {
    writeState({ ...base, state: 'upload_result_unknown', updatedAt: new Date().toISOString() });
    throw error;
  }
}

async function verify(): Promise<void> {
  const bytes = readFileSync(collectionPath);
  const digest = sha256(bytes);
  const state = readState();
  if (!state?.arweaveTxId || !['uploaded', 'verified'].includes(state.state)) {
    throw new Error('没有可验证的已知上传 txid');
  }
  const evidence = [];
  for (const gateway of gateways) {
    try {
      const response = await fetch(`${gateway}/${state.arweaveTxId}`, {
        signal: AbortSignal.timeout(20_000),
      });
      const body = Buffer.from(await response.arrayBuffer());
      evidence.push({
        gateway, status: response.status, bytes: body.length,
        contentType: response.headers.get('content-type'),
        cors: response.headers.get('access-control-allow-origin'),
        sha256: sha256(body),
        exact: response.ok && body.length === bytes.length && sha256(body) === digest,
      });
    } catch {
      evidence.push({ gateway, status: 0, bytes: 0, contentType: null,
        cors: null, sha256: '', exact: false });
    }
  }
  const exactCount = evidence.filter((item) => item.exact).length;
  writeState({ ...state, state: exactCount >= 2 ? 'verified' : 'uploaded',
    gatewayEvidence: evidence, updatedAt: new Date().toISOString() });
  console.log(JSON.stringify({ txId: state.arweaveTxId, exactCount, evidence }, null, 2));
  if (exactCount < 2) throw new Error('永久 metadata 尚未达到双网关逐字节一致');
}

async function main(): Promise<void> {
  const mode = process.argv[2];
  if (mode === '--upload') await upload();
  else if (mode === '--verify') await verify();
  else throw new Error('用法：upload-mainnet-collection.ts <--upload|--verify>');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : '主网 collection 操作失败');
  process.exitCode = 1;
});
