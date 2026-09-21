import {
  closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';

export type H3Kind = 'sound' | 'manifest';
export type H3State = 'uploading' | 'uploaded' | 'verified' | 'upload_result_unknown';
export type H3GatewayEvidence = {
  gateway: string;
  status: number | null;
  bytes: number | null;
  sha256: string | null;
  contentType: string | null;
  decoded: boolean;
  ok: boolean;
  error: string | null;
};
export type H3UploadEntry = {
  kind: H3Kind;
  key: string;
  fileName: string;
  bytes: number;
  contentType: 'audio/mpeg' | 'application/json';
  contentSha256: string;
  state: H3State;
  arweaveTxId: string | null;
  uploaderAddress: string | null;
  costWinc: string | null;
  attemptedAt: string;
  uploadedAt: string | null;
  verifiedAt: string | null;
  lastError: string | null;
  gatewayEvidence: H3GatewayEvidence[];
};
export type H3UploadLedger = {
  schema: 'ripples.p15-h3-upload-ledger.v1';
  soundSetId: 'current-33-v1';
  assets: Record<string, H3UploadEntry>;
};

const ROOT = process.cwd();
export const H3_LEDGER_PATH = join(ROOT, 'data', 'sound-sets', 'current-33-upload-ledger.json');
const LOCK_PATH = join(ROOT, 'data', 'sound-sets', 'current-33-upload-ledger.lock');
const TX_ID = /^[A-Za-z0-9_-]{43}$/;
const HASH = /^[0-9a-f]{64}$/;
const STATES = new Set<H3State>(['uploading', 'uploaded', 'verified', 'upload_result_unknown']);

export const entryId = (kind: H3Kind, key: string): string => `${kind}:${key}`;

export function loadH3Ledger(): H3UploadLedger {
  if (!existsSync(H3_LEDGER_PATH)) {
    return { schema: 'ripples.p15-h3-upload-ledger.v1', soundSetId: 'current-33-v1', assets: {} };
  }
  const ledger = JSON.parse(readFileSync(H3_LEDGER_PATH, 'utf8')) as H3UploadLedger;
  if (ledger.schema !== 'ripples.p15-h3-upload-ledger.v1'
    || ledger.soundSetId !== 'current-33-v1' || typeof ledger.assets !== 'object') {
    throw new Error('H3 上传账本结构非法');
  }
  for (const [id, item] of Object.entries(ledger.assets)) {
    const valid = id === entryId(item.kind, item.key) && ['sound', 'manifest'].includes(item.kind)
      && STATES.has(item.state) && HASH.test(item.contentSha256) && item.bytes > 0
      && (item.arweaveTxId === null || TX_ID.test(item.arweaveTxId))
      && (item.costWinc === null || /^\d+$/.test(item.costWinc))
      && Array.isArray(item.gatewayEvidence);
    if (!valid) throw new Error(`H3 上传账本条目非法：${id}`);
    if (['uploaded', 'verified'].includes(item.state) && !item.arweaveTxId) {
      throw new Error(`H3 上传账本条目缺少 txid：${id}`);
    }
    if (item.state === 'verified'
      && new Set(item.gatewayEvidence.filter(({ ok }) => ok).map(({ gateway }) => gateway)).size < 2) {
      throw new Error(`H3 上传账本条目缺少双网关证据：${id}`);
    }
  }
  return ledger;
}

export function saveH3Ledger(ledger: H3UploadLedger): void {
  mkdirSync(dirname(H3_LEDGER_PATH), { recursive: true });
  const temporary = `${H3_LEDGER_PATH}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
  renameSync(temporary, H3_LEDGER_PATH);
}

export function readH3Entry(
  ledger: H3UploadLedger,
  kind: H3Kind,
  key: string,
): H3UploadEntry | null {
  return ledger.assets[entryId(kind, key)] ?? null;
}

type NewEntry = Pick<H3UploadEntry,
  'kind' | 'key' | 'fileName' | 'bytes' | 'contentType' | 'contentSha256'>;

export function beginH3Upload(ledger: H3UploadLedger, input: NewEntry): H3UploadEntry {
  const id = entryId(input.kind, input.key);
  const previous = ledger.assets[id];
  if (previous) {
    for (const field of ['fileName', 'bytes', 'contentType', 'contentSha256'] as const) {
      if (previous[field] !== input[field]) throw new Error(`${id} 的 ${field} 与账本冲突`);
    }
    if (previous.state === 'uploading' || previous.state === 'upload_result_unknown') {
      throw new Error(`${id} 上次上传结果未知，必须先人工对账，禁止重传`);
    }
    return previous;
  }
  const entry: H3UploadEntry = {
    ...input, state: 'uploading', arweaveTxId: null, uploaderAddress: null,
    costWinc: null, attemptedAt: new Date().toISOString(), uploadedAt: null,
    verifiedAt: null, lastError: null, gatewayEvidence: [],
  };
  ledger.assets[id] = entry;
  saveH3Ledger(ledger);
  return entry;
}

export function updateH3Entry(
  ledger: H3UploadLedger,
  entry: H3UploadEntry,
  patch: Partial<H3UploadEntry>,
): H3UploadEntry {
  const next = { ...entry, ...patch };
  ledger.assets[entryId(next.kind, next.key)] = next;
  saveH3Ledger(ledger);
  return next;
}

export function blockInterruptedH3Uploads(ledger: H3UploadLedger): void {
  const interrupted = Object.values(ledger.assets).filter(({ state }) => state === 'uploading');
  if (!interrupted.length) return;
  for (const item of interrupted) {
    item.state = 'upload_result_unknown';
    item.lastError = '上传响应未能原子落盘；必须按 tags 与 hash 对账，禁止自动重传';
  }
  saveH3Ledger(ledger);
  throw new Error(`发现 ${interrupted.length} 个中断上传，已熔断为 upload_result_unknown`);
}

export async function withH3UploadLock<T>(operation: () => Promise<T>): Promise<T> {
  mkdirSync(dirname(LOCK_PATH), { recursive: true });
  let descriptor: number;
  try {
    descriptor = openSync(LOCK_PATH, 'wx');
    writeFileSync(descriptor, `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })}\n`);
  } catch {
    throw new Error(`H3 上传锁已存在：${LOCK_PATH}`);
  }
  try { return await operation(); } finally {
    closeSync(descriptor);
    unlinkSync(LOCK_PATH);
  }
}
