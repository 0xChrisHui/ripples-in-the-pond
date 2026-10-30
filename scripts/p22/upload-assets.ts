/**
 * P22-B：把素材图片与 metadata 上传 Arweave（Turbo）。可续传：账本已记录的条目跳过；
 * 账本里状态为 pending（上传结果未知）时熔断，禁止自动重传，需人工核对。
 * 用法：tsx --env-file=.env.local scripts/p22/upload-assets.ts
 * 产出：data/p22/upload-ledger.json（逐项）、data/p22/asset-uris.json（登记脚本用）。
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { getTurboUploadBudget, uploadBuffer } from '../../src/lib/arweave/core';

type Entry = { state: 'pending' | 'uploaded'; txId?: string; sha256: string; bytes: number; contentType: string };
const LEDGER = path.resolve('data/p22/upload-ledger.json');
const URIS = path.resolve('data/p22/asset-uris.json');
const TX = /^[A-Za-z0-9_-]{43}$/;
const ledger: Record<string, Entry> = existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, 'utf8')) : {};
const save = () => writeFileSync(LEDGER, `${JSON.stringify(ledger, null, 2)}\n`);

async function put(key: string, buffer: Buffer, contentType: string): Promise<string> {
  const known = ledger[key];
  if (known?.state === 'uploaded' && known.txId) return known.txId;
  if (known?.state === 'pending') throw new Error(`${key} 上一次上传结果未知，已熔断，请先人工核对`);
  const sha256 = createHash('sha256').update(buffer).digest('hex');
  ledger[key] = { state: 'pending', sha256, bytes: buffer.length, contentType };
  save();
  const result = await uploadBuffer(buffer, contentType, [{ name: 'App-Name', value: 'ripples-p22' }]);
  if (!TX.test(result.txId)) throw new Error('Turbo 返回非法 txid');
  ledger[key] = { ...ledger[key], state: 'uploaded', txId: result.txId };
  save();
  console.log(`uploaded ${key} → ${result.txId} (${buffer.length} B)`);
  return result.txId;
}

async function main() {
  const soundImg = readFileSync(path.resolve('data/p22/images/sound.png'));
  const trackImg = readFileSync(path.resolve('data/p22/images/track.png'));
  const budget = await getTurboUploadBudget([soundImg.length, trackImg.length, 700, 700, ...Array(70).fill(700)]);
  console.log(`预算通过：需要 ${budget.requiredWinc} / 可用 ${budget.effectiveBalanceWinc} winc`);

  const soundImage = `ar://${await put('image:sound', soundImg, 'image/png')}`;
  const trackImage = `ar://${await put('image:track', trackImg, 'image/png')}`;

  const work = mkdtempSync(path.join(tmpdir(), 'p22-up-'));
  execFileSync('npx', ['tsx', 'scripts/p22/build-asset-metadata.ts', work, '--sound-image', soundImage, '--track-image', trackImage],
    { stdio: 'inherit', shell: true });

  const uris: { sounds: Record<string, string>; tracks: Record<string, string>; collections: Record<string, string> } =
    { sounds: {}, tracks: {}, collections: {} };
  for (const kind of ['sounds', 'tracks'] as const) {
    const dir = path.join(work, kind);
    const files = readdirSync(dir).sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10));
    for (const file of files) {
      const id = String(Number.parseInt(file, 10));
      const txId = await put(`${kind}:${id}`, readFileSync(path.join(dir, file)), 'application/json');
      uris[kind][id] = `ar://${txId}`;
    }
  }
  for (const [kind, image, label] of [['sounds', soundImage, 'Sound'], ['tracks', trackImage, 'Track']] as const) {
    const body = Buffer.from(JSON.stringify({
      name: `Ripples Pond ${label}`,
      description: `Soulbound ${label.toLowerCase()} assets that live inside a Ripples in the Pond Score's token-bound account.`,
      image,
    }, null, 2));
    uris.collections[kind] = `ar://${await put(`collection:${kind}`, body, 'application/json')}`;
  }
  writeFileSync(URIS, `${JSON.stringify(uris, null, 2)}\n`);
  console.log(`完成：音效 ${Object.keys(uris.sounds).length}、背景音乐 ${Object.keys(uris.tracks).length} → ${URIS}`);
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
