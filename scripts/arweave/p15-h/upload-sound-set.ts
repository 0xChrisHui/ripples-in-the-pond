// P15-H3：版本化 33 键声音与 manifest 的审计、预算、上传和双网关读回入口。
import '../../_env';
import { readFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { getTurboUploadBudget, uploadBuffer } from '../../../src/lib/arweave/core';
import { isSoundKey } from '../../../src/lib/sound-set';
import {
  estimateManifestBytes, freezeVerifiedManifest, freezeVerifiedSound,
  manifestAsset, readCurrentRegistry, soundAssets, type H3Asset,
} from './sound-set-assets';
import { fullReadbackQuorum, hasFullReadbackQuorum } from './full-readback';
import {
  beginH3Upload, blockInterruptedH3Uploads, loadH3Ledger, readH3Entry,
  updateH3Entry, withH3UploadLock, type H3UploadLedger,
} from './upload-state';

type Kind = 'sounds' | 'manifest';
type Mode = 'audit' | 'preflight' | 'upload' | 'verify';
const TX_ID = /^[A-Za-z0-9_-]{43}$/;

function parseArgs(): { kind: Kind; mode: Mode } {
  const args = process.argv.slice(2);
  const kinds = args.filter((arg): arg is Kind => ['sounds', 'manifest'].includes(arg));
  const modes = args.filter((arg): arg is `--${Mode}` =>
    ['--audit', '--preflight', '--upload', '--verify'].includes(arg));
  const allowed = new Set([...kinds, ...modes, '--confirm-permanent-write']);
  if (args.some((arg) => !allowed.has(arg)) || kinds.length !== 1 || modes.length !== 1) {
    throw new Error('用法：<sounds|manifest> <--audit|--preflight|--upload|--verify>');
  }
  const mode = modes[0].slice(2) as Mode;
  if (mode === 'upload' && !args.includes('--confirm-permanent-write')) {
    throw new Error('永久写入必须显式附加 --confirm-permanent-write');
  }
  if (mode !== 'upload' && args.includes('--confirm-permanent-write')) {
    throw new Error('--confirm-permanent-write 只允许与 --upload 同用');
  }
  return { kind: kinds[0], mode };
}

function safeError(error: unknown): string {
  let message = error instanceof Error ? error.message : 'unknown';
  for (const name of ['TURBO_WALLET_JWK', 'OPERATOR_PRIVATE_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
    const secret = process.env[name];
    if (secret) message = message.replaceAll(secret, '[redacted]');
  }
  return message.slice(0, 500);
}

function walletIdentity(): string {
  const inline = process.env.TURBO_WALLET_JWK;
  const walletPath = process.env.TURBO_WALLET_PATH;
  if (!inline && !walletPath) throw new Error('缺少 TURBO_WALLET_JWK 或 TURBO_WALLET_PATH');
  if (walletPath) {
    if (!isAbsolute(walletPath)) throw new Error('TURBO_WALLET_PATH 必须是绝对路径');
    const resolved = resolve(walletPath);
    const fromRoot = relative(process.cwd(), resolved);
    if (!fromRoot.startsWith('..') && !isAbsolute(fromRoot)) throw new Error('Turbo 钱包必须位于仓库外');
  }
  const payload = inline
    ? inline.replace(/\\r\\n|\\n|\\r/g, '').trim()
    : readFileSync(walletPath!, 'utf8');
  const wallet = JSON.parse(payload) as {
    address?: unknown; privateKey?: unknown; token?: unknown;
  };
  if (typeof wallet.address !== 'string' || !wallet.address
    || typeof wallet.privateKey !== 'string' || !wallet.privateKey
    || typeof wallet.token !== 'string' || !wallet.token) throw new Error('Turbo 钱包结构不完整');
  return `${wallet.address} (${wallet.token})`;
}

function resolveAssets(kind: Kind, ledger: H3UploadLedger): H3Asset[] {
  const registry = readCurrentRegistry();
  return kind === 'sounds' ? soundAssets(registry) : [manifestAsset(registry, ledger)];
}

function uploadTags(asset: H3Asset) {
  return [
    { name: 'App-Name', value: 'Ripples in the Pond' },
    { name: 'P15-Phase', value: 'H3' },
    { name: 'Sound-Set-ID', value: 'current-33-v1' },
    { name: 'Asset-Kind', value: asset.kind },
    { name: 'Content-SHA256', value: asset.sha256 },
    ...(asset.kind === 'sound' ? [{ name: 'Sound-Key', value: asset.key }] : []),
  ];
}

function assertNoUnknown(ledger: H3UploadLedger): void {
  const blocked = Object.values(ledger.assets).filter(({ state }) => state === 'upload_result_unknown');
  if (blocked.length) throw new Error(`${blocked.length} 个上传结果未知，必须先人工对账，禁止重传`);
}

async function preflight(kind: Kind, assets: H3Asset[], ledger: H3UploadLedger): Promise<void> {
  assertNoUnknown(ledger);
  const pending = assets.filter((asset) => {
    const known = readH3Entry(ledger, asset.kind, asset.key);
    return known?.state !== 'uploaded' && known?.state !== 'verified';
  });
  const anticipated = kind === 'sounds' ? [estimateManifestBytes(readCurrentRegistry())] : [];
  const sizes = [...pending.map(({ buffer }) => buffer.length), ...anticipated];
  if (!sizes.length) return console.log('没有待付费对象；账本已包含全部上传结果');
  const reserve = Math.max(...sizes);
  const identity = walletIdentity();
  const budget = await getTurboUploadBudget([...sizes, reserve]);
  console.log(`Turbo 身份：${identity}`);
  console.log(`预算通过：${sizes.length} 个对象 + 1 个失败缓冲，需要 ${budget.requiredWinc} / 可用 ${budget.effectiveBalanceWinc} winc`);
}

async function uploadAssets(kind: Kind, assets: H3Asset[], ledger: H3UploadLedger): Promise<void> {
  await preflight(kind, assets, ledger);
  for (const asset of assets) {
    const known = readH3Entry(ledger, asset.kind, asset.key);
    if (known?.state === 'uploaded' || known?.state === 'verified') continue;
    const entry = beginH3Upload(ledger, {
      kind: asset.kind, key: asset.key, fileName: asset.fileName,
      bytes: asset.buffer.length, contentType: asset.contentType, contentSha256: asset.sha256,
    });
    try {
      const result = await uploadBuffer(asset.buffer, asset.contentType, uploadTags(asset));
      if (!TX_ID.test(result.txId)) throw new Error('Turbo 返回非法 txid');
      updateH3Entry(ledger, entry, {
        state: 'uploaded', arweaveTxId: result.txId, uploaderAddress: result.uploaderAddress,
        costWinc: result.costWinc, uploadedAt: new Date().toISOString(), lastError: null,
      });
      console.log(`uploaded ${asset.kind}/${asset.key} → ${result.txId}`);
    } catch (error) {
      updateH3Entry(ledger, entry, { state: 'upload_result_unknown', lastError: safeError(error) });
      throw new Error(`${asset.kind}/${asset.key} 上传结果未知，已熔断；禁止自动重传`);
    }
  }
}

async function verifyAssets(assets: H3Asset[], ledger: H3UploadLedger): Promise<void> {
  const registry = readCurrentRegistry();
  let complete = true;
  for (const asset of assets) {
    let entry = readH3Entry(ledger, asset.kind, asset.key);
    if (!entry?.arweaveTxId || !['uploaded', 'verified'].includes(entry.state)) {
      throw new Error(`${asset.kind}/${asset.key} 没有可验证的 uploaded txid`);
    }
    if (entry.state !== 'verified') {
      const evidence = await fullReadbackQuorum(entry.arweaveTxId, asset);
      const ok = hasFullReadbackQuorum(evidence);
      entry = updateH3Entry(ledger, entry, {
        state: ok ? 'verified' : 'uploaded', gatewayEvidence: evidence,
        verifiedAt: ok ? new Date().toISOString() : null,
        lastError: ok ? null : '尚未达到两个独立网关完整 GET 的同字节、MIME 与解码 quorum',
      });
      complete &&= ok;
    }
    if (entry.state === 'verified') {
      const txId = entry.arweaveTxId;
      if (!txId) throw new Error(`${asset.kind}/${asset.key} verified 条目缺少 txid`);
      if (asset.kind === 'sound') {
        if (!isSoundKey(asset.key)) throw new Error(`非法声音键：${asset.key}`);
        freezeVerifiedSound(registry, asset.key, txId);
      } else freezeVerifiedManifest(registry, asset, txId);
    }
  }
  if (!complete) throw new Error('传播尚未达到双网关 quorum；有界重跑 --verify，禁止重传');
}

async function main(): Promise<void> {
  const { kind, mode } = parseArgs();
  const ledger = loadH3Ledger();
  if (mode === 'audit') {
    const assets = resolveAssets(kind, ledger);
    console.log(`✅ ${kind} 本地审计通过：${assets.length} 个对象 / ${assets.reduce((n, a) => n + a.buffer.length, 0)} bytes；未连接钱包`);
    return;
  }
  await withH3UploadLock(async () => {
    blockInterruptedH3Uploads(ledger);
    assertNoUnknown(ledger);
    const assets = resolveAssets(kind, ledger);
    if (mode === 'preflight') return preflight(kind, assets, ledger);
    if (mode === 'upload') return uploadAssets(kind, assets, ledger);
    return verifyAssets(assets, ledger);
  });
}

main().catch((error) => { console.error('[P15-H3] 失败：', safeError(error)); process.exit(1); });
