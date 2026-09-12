// P14 永久资源入口：严格区分本地审计、付费上传与多网关 quorum 验证。
import '../../_env';
import { readFileSync, renameSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getTurboUploadBudget, uploadBuffer } from '../../../src/lib/arweave/core';
import type { ClipManifestV1, P14ClipV1 } from '../../../src/types/wallet-recipe';
import { parseClipManifestV1 } from '../../../src/lib/wallet-recipe/clip-manifest';
import {
  buildManifest, clipAssets, collectionAsset, inspectClips, MANIFEST_PATH,
  staticAsset, TX_ID, type P14Asset, type P14CliKind,
} from './upload-assets';
import {
  beginUpload, blockInterruptedUploads, loadP14Ledger, readEntry, updateEntry,
  withP14UploadLock,
} from './upload-state';
import { verifyAssetOnGateways } from './upload-verification';
import { hasWalletRecipeGatewayQuorum } from '../../../src/lib/wallet-recipe/gateways';

const ROOT = process.cwd();
type Mode = 'audit' | 'upload' | 'verify';

function safeError(error: unknown): string {
  let message = error instanceof Error ? error.message : 'unknown';
  for (const name of ['TURBO_WALLET_JWK', 'OPERATOR_PRIVATE_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
    const secret = process.env[name];
    if (secret) message = message.replaceAll(secret, '[redacted]');
  }
  return message.slice(0, 500);
}

function parseArgs(): { kind: P14CliKind; mode: Mode; writeManifest: boolean } {
  const args = process.argv.slice(2);
  const kinds = args.filter((arg): arg is P14CliKind =>
    ['clips', 'decoder', 'image', 'collection'].includes(arg));
  const modes = args.filter((arg): arg is `--${Mode}` =>
    ['--audit', '--upload', '--verify'].includes(arg));
  const allowed = new Set([...kinds, ...modes, '--write-manifest']);
  if (args.some((arg) => !allowed.has(arg)) || kinds.length !== 1 || modes.length !== 1) {
    throw new Error('用法：<clips|decoder|image|collection> <--audit|--upload|--verify>');
  }
  const writeManifest = args.includes('--write-manifest');
  if (writeManifest && (kinds[0] !== 'clips' || modes[0] !== '--audit')) {
    throw new Error('--write-manifest 只允许 clips --audit 使用');
  }
  return { kind: kinds[0], mode: modes[0].slice(2) as Mode, writeManifest };
}

function readManifest(): ClipManifestV1 {
  return parseClipManifestV1(JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as unknown);
}

function resolveAssets(
  kind: P14CliKind,
  manifest: ClipManifestV1,
  clips: P14ClipV1[],
): P14Asset[] {
  if (kind === 'clips') return clipAssets(manifest, clips);
  if (kind === 'decoder' || kind === 'image') return [staticAsset(kind)];
  const image = staticAsset('image');
  const imageEntry = readEntry(loadP14Ledger(), 'image', image.sha256);
  if (imageEntry?.state !== 'verified' || !imageEntry.arweaveTxId) {
    throw new Error('collection metadata 必须等待 image 多网关 quorum verified');
  }
  return [collectionAsset(imageEntry.arweaveTxId)];
}

function assertUploadGates(): void {
  for (const file of ['rights-confirmation.md', 'listening-confirmation.md']) {
    if (!existsSync(join(ROOT, 'reviews/evidence/p14-f0', file))) {
      throw new Error(`${file} 不存在，永久上传保持关闭`);
    }
  }
  if (!existsSync(join(ROOT, 'reviews/evidence/p14-e-foundation/README.md'))) {
    throw new Error('E Foundation 证据不存在，静态永久资源上传保持关闭');
  }
}

function uploadTags(asset: P14Asset) {
  return [
    { name: 'App-Name', value: 'Ripples in the Pond' },
    { name: 'P14-Version', value: '1' },
    { name: 'P14-Asset-Kind', value: asset.kind },
    { name: 'P14-Content-SHA256', value: asset.sha256 },
    ...(asset.kind === 'clip' ? [{ name: 'P14-Clip-Key', value: asset.key }] : []),
  ];
}

async function uploadAssets(assets: P14Asset[], anticipatedBytes: number[] = []): Promise<void> {
  const ledger = loadP14Ledger();
  blockInterruptedUploads(ledger);
  const blocked = assets.filter((asset) => {
    const entry = readEntry(ledger, asset.kind, asset.sha256);
    return entry?.state === 'upload_result_unknown' || entry?.state === 'uploading';
  });
  if (blocked.length) throw new Error(`${blocked.length} 个上传结果未知，须人工对账，禁止重传`);
  const pending = assets.filter((asset) => !readEntry(ledger, asset.kind, asset.sha256));
  if (!pending.length) return console.log('没有可安全新传的对象；请运行 --verify 或处理 unknown');
  const reserve = Math.max(...assets.map((asset) => asset.buffer.length));
  const budget = await getTurboUploadBudget([
    ...pending.map((item) => item.buffer.length), ...anticipatedBytes, reserve,
  ]);
  console.log(`Turbo 预算通过：需要 ${budget.requiredWinc} / 可用 ${budget.effectiveBalanceWinc} winc`);
  for (const asset of assets) {
    const known = readEntry(ledger, asset.kind, asset.sha256);
    if (known?.state === 'verified' || known?.state === 'uploaded') continue;
    const entry = beginUpload(ledger, {
      kind: asset.kind, key: asset.key, fileName: asset.fileName, bytes: asset.buffer.length,
      contentType: asset.contentType, contentSha256: asset.sha256,
    });
    try {
      const result = await uploadBuffer(asset.buffer, asset.contentType, uploadTags(asset));
      if (!TX_ID.test(result.txId)) throw new Error('Turbo 返回了非法 txid');
      updateEntry(ledger, entry, { state: 'uploaded', arweaveTxId: result.txId,
        uploaderAddress: result.uploaderAddress, costWinc: result.costWinc,
        uploadedAt: new Date().toISOString(), lastError: null });
      console.log(`uploaded ${asset.kind}/${asset.key} → ${result.txId}`);
    } catch (error) {
      updateEntry(ledger, entry, { state: 'upload_result_unknown',
        lastError: safeError(error) });
      throw new Error(`${asset.kind}/${asset.key} 上传结果未知，已停止；禁止自动重传`);
    }
  }
}

async function verifyAssets(assets: P14Asset[]): Promise<boolean> {
  const ledger = loadP14Ledger();
  blockInterruptedUploads(ledger);
  let allVerified = true;
  for (const asset of assets) {
    const entry = readEntry(ledger, asset.kind, asset.sha256);
    if ((entry?.state !== 'uploaded' && entry?.state !== 'verified') || !entry.arweaveTxId) {
      throw new Error(`${asset.kind}/${asset.key} 没有可验证的 uploaded txid`);
    }
    const evidence = await verifyAssetOnGateways({ txId: entry.arweaveTxId,
      expectedBytes: asset.buffer.length, expectedSha256: asset.sha256,
      expectedContentType: asset.contentType });
    const ok = hasWalletRecipeGatewayQuorum(evidence);
    updateEntry(ledger, entry, { state: ok ? 'verified' : 'uploaded', gatewayEvidence: evidence,
      verifiedAt: ok ? new Date().toISOString() : null,
      lastError: ok ? null : '独立网关 quorum 尚未完成字节、类型与 CORS 一致验证' });
    allVerified &&= ok;
    console.log(`${ok ? 'verified' : 'waiting'} ${asset.kind}/${asset.key}`);
  }
  return allVerified;
}

function freezeClipTxIds(manifest: ClipManifestV1, clips: P14ClipV1[]): void {
  const ledger = loadP14Ledger();
  const frozen = clips.map((clip) => {
    const entry = readEntry(ledger, 'clip', clip.sha256);
    if (entry?.state !== 'verified' || !entry.arweaveTxId) throw new Error(`${clip.key} 尚未 verified`);
    return { ...clip, arweaveTxId: entry.arweaveTxId };
  });
  const temp = `${MANIFEST_PATH}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify(buildManifest(manifest, frozen), null, 2)}\n`, 'utf8');
  renameSync(temp, MANIFEST_PATH);
}

async function main(): Promise<void> {
  const args = parseArgs();
  const manifest = readManifest();
  const clips = inspectClips(manifest);
  if (buildManifest(manifest, clips).manifestSha256 !== manifest.manifestSha256) {
    throw new Error('manifestSha256 与冻结内容不一致');
  }
  const assets = resolveAssets(args.kind, manifest, clips);
  if (args.mode === 'audit') {
    const output = buildManifest(manifest, clips);
    if (args.writeManifest) writeFileSync(MANIFEST_PATH, `${JSON.stringify(output, null, 2)}\n`);
    console.log(JSON.stringify(args.kind === 'clips' ? output : assets.map(({ buffer, ...item }) => ({ ...item, bytes: buffer.length })), null, 2));
    return;
  }
  await withP14UploadLock(async () => {
    if (args.mode === 'upload') {
      assertUploadGates();
      const anticipated = args.kind === 'clips'
        && !assets.some((asset) => asset.kind === 'clip_manifest')
        ? [Buffer.byteLength(`${JSON.stringify(buildManifest(manifest,
          clips.map((clip) => ({ ...clip, arweaveTxId: 'A'.repeat(43) }))), null, 2)}\n`)]
        : [];
      await uploadAssets(assets, anticipated);
      return;
    }
    const complete = await verifyAssets(assets);
    if (!complete) throw new Error('传播尚未达到 2 个独立网关 quorum；按 15s/30s/60s/2m/5m/15m 有界重跑，不得重传');
    if (args.kind === 'clips' && !assets.some((asset) => asset.kind === 'clip_manifest')) {
      freezeClipTxIds(manifest, clips);
      console.log('36/36 已冻结 txid；再次运行 clips --upload 上传 manifest');
    }
  });
}

main().catch((error) => { console.error('[P14-A] 失败：', safeError(error)); process.exit(1); });
