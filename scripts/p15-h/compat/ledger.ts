import {
  closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import type { CompatUploadEntry, CompatUploadLedger, CompatUploadState } from './types';

export const COMPAT_LEDGER_PATH = join(
  process.cwd(), 'data', 'compatibility', 'upload-ledger.json',
);
const LOCK_PATH = join(process.cwd(), 'data', 'compatibility', 'upload-ledger.lock');
const HASH = /^[0-9a-f]{64}$/;
const TX = /^[A-Za-z0-9_-]{43}$/;
const STATES = new Set<CompatUploadState>([
  'uploading', 'uploaded', 'verified', 'upload_result_unknown',
]);

function emptyLedger(): CompatUploadLedger {
  return { schema: 'ripples.compat-upload-ledger.v1', assets: {} };
}

function validateEntry(id: string, entry: CompatUploadEntry): void {
  const valid = id === String(entry.tokenId) && Number.isSafeInteger(entry.tokenId) && entry.tokenId > 0
    && Number.isSafeInteger(entry.bytes) && entry.bytes > 0 && HASH.test(entry.contentSha256)
    && STATES.has(entry.state) && (entry.arweaveTxId === null || TX.test(entry.arweaveTxId))
    && (entry.costWinc === null || /^\d+$/.test(entry.costWinc))
    && Array.isArray(entry.gatewayEvidence);
  if (!valid) throw new Error(`compat 上传账本条目非法：${id}`);
  if (['uploaded', 'verified'].includes(entry.state) && !entry.arweaveTxId) {
    throw new Error(`compat 上传账本缺少 txid：${id}`);
  }
  const quorum = new Set(entry.gatewayEvidence.filter(({ ok }) => ok).map(({ gateway }) => gateway)).size;
  if (entry.state === 'verified' && quorum < 2) throw new Error(`compat verified 缺少双网关证据：${id}`);
}

export function loadCompatLedger(path = COMPAT_LEDGER_PATH): CompatUploadLedger {
  if (!existsSync(path)) return emptyLedger();
  const value = JSON.parse(readFileSync(path, 'utf8')) as CompatUploadLedger;
  if (value.schema !== 'ripples.compat-upload-ledger.v1'
    || !value.assets || typeof value.assets !== 'object') throw new Error('compat 上传账本结构非法');
  for (const [id, entry] of Object.entries(value.assets)) validateEntry(id, entry);
  return value;
}

export function saveCompatLedger(
  ledger: CompatUploadLedger,
  path = COMPAT_LEDGER_PATH,
): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
  renameSync(temporary, path);
}

export function beginCompatUpload(
  ledger: CompatUploadLedger,
  input: { tokenId: number; bytes: number; contentSha256: string },
  path = COMPAT_LEDGER_PATH,
): CompatUploadEntry {
  const id = String(input.tokenId);
  const previous = ledger.assets[id];
  if (previous) {
    if (previous.bytes !== input.bytes || previous.contentSha256 !== input.contentSha256) {
      throw new Error(`Score #${id} 内容与 durable ledger 冲突`);
    }
    if (previous.state === 'uploading' || previous.state === 'upload_result_unknown') {
      throw new Error(`Score #${id} 上次上传结果未知，必须先人工对账，禁止重传`);
    }
    return previous;
  }
  const entry: CompatUploadEntry = {
    ...input, state: 'uploading', arweaveTxId: null, uploaderAddress: null,
    costWinc: null, attemptedAt: new Date().toISOString(), uploadedAt: null,
    verifiedAt: null, lastError: null, gatewayEvidence: [],
  };
  ledger.assets[id] = entry;
  saveCompatLedger(ledger, path);
  return entry;
}

export function updateCompatEntry(
  ledger: CompatUploadLedger,
  entry: CompatUploadEntry,
  patch: Partial<CompatUploadEntry>,
  path = COMPAT_LEDGER_PATH,
): CompatUploadEntry {
  const next = { ...entry, ...patch };
  validateEntry(String(next.tokenId), next);
  ledger.assets[String(next.tokenId)] = next;
  saveCompatLedger(ledger, path);
  return next;
}

export function blockInterruptedCompatUploads(
  ledger: CompatUploadLedger,
  path = COMPAT_LEDGER_PATH,
): void {
  const interrupted = Object.values(ledger.assets).filter(({ state }) => state === 'uploading');
  if (!interrupted.length) return;
  for (const entry of interrupted) {
    entry.state = 'upload_result_unknown';
    entry.lastError = '上传响应未原子落盘；必须按 tags 与 hash 对账，禁止自动重传';
  }
  saveCompatLedger(ledger, path);
  throw new Error(`发现 ${interrupted.length} 个中断 compat 上传，已熔断`);
}

export async function withCompatUploadLock<T>(operation: () => Promise<T>): Promise<T> {
  mkdirSync(dirname(LOCK_PATH), { recursive: true });
  let descriptor: number;
  try {
    descriptor = openSync(LOCK_PATH, 'wx');
    writeFileSync(descriptor, `${JSON.stringify({ pid: process.pid, at: new Date().toISOString() })}\n`);
  } catch {
    throw new Error(`compat 上传锁已存在：${LOCK_PATH}`);
  }
  try {
    return await operation();
  } finally {
    closeSync(descriptor);
    unlinkSync(LOCK_PATH);
  }
}

