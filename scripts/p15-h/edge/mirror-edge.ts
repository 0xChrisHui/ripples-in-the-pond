import '../../_env';
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SoundSetLedger } from '../sound-set-ledger';
import { loadInventory } from './inventory';
import { runMirror, type MirrorResult } from './mirror-runner';
import { createVercelBlobWriter, normalizeMirrorBase } from './vercel-blob';

const ROOT = process.cwd();
const LEDGER_PATH = join(ROOT, 'data/sound-sets/current-33.json');
const EVIDENCE_PATH = join(ROOT, 'reviews/evidence/p15-h/h4-edge-mirror.json');

function parseMode(args: string[]): boolean {
  const unknown = args.filter((arg) => arg !== '--execute');
  if (unknown.length) throw new Error(`未知参数：${unknown.join(', ')}`);
  return args.includes('--execute');
}

function atomicJson(path: string, value: unknown): void {
  const temporary = `${path}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'w' });
  renameSync(temporary, path);
}

function freezeLedger(results: MirrorResult[]): void {
  const ledger = JSON.parse(readFileSync(LEDGER_PATH, 'utf8')) as SoundSetLedger;
  const verified = new Map(results.map((item) => [item.arTxId, item.blobKey]));
  const entries = ledger.entries.map((entry) => {
    if (!entry.arTxId) throw new Error(`${entry.key}: 缺少 AR 交易 ID`);
    const blobKey = verified.get(entry.arTxId);
    if (!blobKey) throw new Error(`${entry.key}: 缺少 Blob Gate 证据`);
    if (entry.blobKey && entry.blobKey !== blobKey) throw new Error(`${entry.key}: Blob 路径发生冲突`);
    return { ...entry, blobKey };
  });
  atomicJson(LEDGER_PATH, { ...ledger, publicationStatus: 'edge-mirrored', entries });
}

async function main(): Promise<void> {
  const execute = parseMode(process.argv.slice(2));
  const mirrorBase = normalizeMirrorBase(process.env.NEXT_PUBLIC_MEDIA_MIRROR_BASE_URL);
  const assets = loadInventory(ROOT);
  const results = await runMirror({
    assets,
    execute,
    mirrorBase,
    writer: createVercelBlobWriter(),
  });
  if (execute) freezeLedger(results);
  const counts = results.reduce<Record<string, number>>((all, item) => {
    all[item.state] = (all[item.state] ?? 0) + 1;
    return all;
  }, {});
  atomicJson(EVIDENCE_PATH, {
    schema: 'p15-h4.edge-mirror.v1',
    generatedAt: new Date().toISOString(),
    mode: execute ? 'execute' : 'dry-run',
    mirrorBase,
    inventoryCount: assets.length,
    counts,
    results,
  });
  console.log(`H4 ${execute ? '执行' : '演练'}完成：${assets.length} 个唯一音频；证据 ${EVIDENCE_PATH}`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
