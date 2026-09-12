import {
  closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import type { GatewayEvidence } from './upload-verification';
import { hasWalletRecipeGatewayQuorum } from '../../../src/lib/wallet-recipe/gateways';

export type P14AssetKind =
  | 'clip' | 'clip_manifest' | 'decoder' | 'image' | 'collection_metadata';
export type P14UploadState = 'uploading' | 'uploaded' | 'verified' | 'upload_result_unknown';

export type P14UploadEntry = {
  kind: P14AssetKind;
  key: string;
  fileName: string;
  bytes: number;
  contentType: string;
  contentSha256: string;
  state: P14UploadState;
  arweaveTxId: string | null;
  uploaderAddress: string | null;
  costWinc: string | null;
  attemptedAt: string;
  uploadedAt: string | null;
  verifiedAt: string | null;
  lastError: string | null;
  gatewayEvidence: GatewayEvidence[];
};

type P14UploadLedger = {
  version: 1;
  assets: Record<string, P14UploadEntry>;
};

export const P14_LEDGER_PATH = join(
  process.cwd(), 'data', 'p14-arweave-upload-ledger.json',
);
const LOCK_PATH = join(process.cwd(), 'data', 'p14-arweave-upload-ledger.lock');
const TX_ID = /^[A-Za-z0-9_-]{43}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const KINDS = new Set<P14AssetKind>([
  'clip', 'clip_manifest', 'decoder', 'image', 'collection_metadata',
]);
const STATES = new Set<P14UploadState>([
  'uploading', 'uploaded', 'verified', 'upload_result_unknown',
]);

function emptyLedger(): P14UploadLedger {
  return { version: 1, assets: {} };
}

export function ledgerId(kind: P14AssetKind, contentSha256: string): string {
  return `${kind}:${contentSha256}`;
}

export function loadP14Ledger(): P14UploadLedger {
  if (!existsSync(P14_LEDGER_PATH)) return emptyLedger();
  const parsed = JSON.parse(readFileSync(P14_LEDGER_PATH, 'utf8')) as P14UploadLedger;
  if (parsed.version !== 1 || !parsed.assets || typeof parsed.assets !== 'object') {
    throw new Error('P14 上传账本结构不合法');
  }
  for (const [id, entry] of Object.entries(parsed.assets)) {
    const valid = KINDS.has(entry.kind) && STATES.has(entry.state)
      && SHA256.test(entry.contentSha256) && id === ledgerId(entry.kind, entry.contentSha256)
      && typeof entry.key === 'string' && typeof entry.fileName === 'string'
      && Number.isInteger(entry.bytes) && entry.bytes > 0 && typeof entry.contentType === 'string'
      && typeof entry.attemptedAt === 'string' && Array.isArray(entry.gatewayEvidence)
      && (entry.arweaveTxId === null || TX_ID.test(entry.arweaveTxId))
      && (entry.uploaderAddress === null || typeof entry.uploaderAddress === 'string')
      && (entry.costWinc === null || /^\d+$/.test(entry.costWinc));
    if (!valid) throw new Error(`P14 上传账本条目不合法：${id}`);
    if ((entry.state === 'uploaded' || entry.state === 'verified') && !entry.arweaveTxId) {
      throw new Error(`P14 上传账本 ${id} 缺少 txid`);
    }
    if (entry.state === 'verified'
      && (!entry.verifiedAt || !hasWalletRecipeGatewayQuorum(entry.gatewayEvidence))) {
      throw new Error(`P14 上传账本 ${id} 的 verified 证据不完整`);
    }
  }
  return parsed;
}

export function saveP14Ledger(ledger: P14UploadLedger): void {
  mkdirSync(dirname(P14_LEDGER_PATH), { recursive: true });
  const tempPath = `${P14_LEDGER_PATH}.${process.pid}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
  renameSync(tempPath, P14_LEDGER_PATH);
}

export function readEntry(
  ledger: P14UploadLedger,
  kind: P14AssetKind,
  contentSha256: string,
): P14UploadEntry | null {
  return ledger.assets[ledgerId(kind, contentSha256)] ?? null;
}

export function beginUpload(
  ledger: P14UploadLedger,
  input: Omit<P14UploadEntry, 'state' | 'arweaveTxId' | 'attemptedAt' |
    'uploaderAddress' | 'costWinc' | 'uploadedAt' | 'verifiedAt' |
    'lastError' | 'gatewayEvidence'>,
): P14UploadEntry {
  const id = ledgerId(input.kind, input.contentSha256);
  const previous = ledger.assets[id];
  if (previous) {
    for (const field of ['kind', 'key', 'fileName', 'bytes', 'contentType', 'contentSha256'] as const) {
      if (previous[field] !== input[field]) throw new Error(`${id} 与既有账本的 ${field} 冲突`);
    }
  }
  if (previous?.state === 'uploading' || previous?.state === 'upload_result_unknown') {
    throw new Error(`${input.kind}/${input.key} 上次结果未知，须先人工对账，禁止重传`);
  }
  if (previous?.state === 'uploaded' || previous?.state === 'verified') return previous;
  const entry: P14UploadEntry = {
    ...input,
    state: 'uploading',
    arweaveTxId: null,
    uploaderAddress: null,
    costWinc: null,
    attemptedAt: new Date().toISOString(),
    uploadedAt: null,
    verifiedAt: null,
    lastError: null,
    gatewayEvidence: [],
  };
  ledger.assets[id] = entry;
  saveP14Ledger(ledger);
  return entry;
}

export async function withP14UploadLock<T>(operation: () => Promise<T>): Promise<T> {
  mkdirSync(dirname(LOCK_PATH), { recursive: true });
  let descriptor: number;
  try {
    descriptor = openSync(LOCK_PATH, 'wx');
    writeFileSync(descriptor, `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })}\n`);
  } catch {
    throw new Error(`P14 上传锁已存在：${LOCK_PATH}；确认无进程后人工核对账本并清锁`);
  }
  try {
    return await operation();
  } finally {
    closeSync(descriptor);
    unlinkSync(LOCK_PATH);
  }
}

export function updateEntry(
  ledger: P14UploadLedger,
  entry: P14UploadEntry,
  patch: Partial<P14UploadEntry>,
): P14UploadEntry {
  const next = { ...entry, ...patch };
  ledger.assets[ledgerId(next.kind, next.contentSha256)] = next;
  saveP14Ledger(ledger);
  return next;
}

export function blockInterruptedUploads(ledger: P14UploadLedger): void {
  const interrupted = Object.values(ledger.assets).filter((item) => item.state === 'uploading');
  if (!interrupted.length) return;
  for (const item of interrupted) {
    item.state = 'upload_result_unknown';
    item.lastError = '进程在上传响应原子落盘前中断；必须按 tags/内容 hash 人工对账';
  }
  saveP14Ledger(ledger);
  throw new Error(`发现 ${interrupted.length} 个中断上传，已转 upload_result_unknown，禁止自动重传`);
}
