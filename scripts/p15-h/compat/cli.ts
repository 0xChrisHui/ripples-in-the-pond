import '../../_env';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getTurboUploadBudget, uploadBuffer } from '../../../src/lib/arweave/core';
import { canonicalizeJson, type JsonValue } from '../../../src/lib/score-package';
import {
  assertCurrentAdmin, loadAdminAccount, signPayloadWithAccount, verifyManifestSignature,
} from './admin';
import {
  buildPayload, serializeCompatibilityManifest, validateCompatibilityManifest,
} from './contract';
import { hasCompatibilityQuorum, verifyCompatibilityQuorum, type CompatibilityAsset } from './gateway';
import {
  beginCompatUpload, blockInterruptedCompatUploads, loadCompatLedger,
  updateCompatEntry, withCompatUploadLock,
} from './ledger';
import { loadCompatibilityIdentity, loadCompatibilitySources } from './source';
import type { CompatibilityManifest, CompatibilityPayload } from './types';

type Mode = 'audit' | 'sign' | 'preflight' | 'upload' | 'verify';
const ARTIFACT_DIR = join(process.cwd(), 'data', 'compatibility');
const sha256 = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');
const artifactPath = (tokenId: number): string => join(ARTIFACT_DIR, `score-${tokenId}.json`);

function args(): Mode {
  const values = process.argv.slice(2);
  const modes = values.filter((value): value is `--${Mode}` => (
    ['--audit', '--sign', '--preflight', '--upload', '--verify'].includes(value)
  ));
  const allowed = new Set([...modes, '--confirm-permanent-write']);
  if (values.some((value) => !allowed.has(value)) || modes.length !== 1) {
    throw new Error('用法：<--audit|--sign|--preflight|--upload|--verify>');
  }
  const mode = modes[0].slice(2) as Mode;
  if (mode === 'upload' && !values.includes('--confirm-permanent-write')) {
    throw new Error('compat 永久上传必须显式附加 --confirm-permanent-write');
  }
  if (mode !== 'upload' && values.includes('--confirm-permanent-write')) {
    throw new Error('--confirm-permanent-write 只允许与 --upload 同用');
  }
  return mode;
}

function payloads(publishedAt: string): CompatibilityPayload[] {
  const identity = loadCompatibilityIdentity();
  return loadCompatibilitySources().map((source) => buildPayload(source, identity, publishedAt));
}

async function audit(): Promise<void> {
  const identity = loadCompatibilityIdentity();
  const drafts = payloads(identity.generatedAt);
  if (drafts.length !== 4) throw new Error('compat audit 必须生成 Score #1–#4');
  console.log(JSON.stringify({
    gate: 'PASS', externalWrites: false, chainId: identity.chainId,
    scoreContract: identity.scoreContract,
    scores: drafts.map((draft) => ({
      tokenId: draft.tokenId, soundSet: draft.resolution.soundSet,
      usedKeys: draft.resolution.usedKeys, bytes: Buffer.byteLength(canonicalizeJson(draft as JsonValue)),
    })),
    adminConfigured: Boolean(process.env.ADMIN_WALLET_PATH),
  }, null, 2));
}

async function readSignedAssets(): Promise<Array<CompatibilityAsset & { manifest: CompatibilityManifest }>> {
  const result = [];
  for (const tokenId of [1, 2, 3, 4]) {
    const path = artifactPath(tokenId);
    if (!existsSync(path)) throw new Error(`缺少已签名 compat artifact：${path}`);
    const buffer = readFileSync(path);
    const manifest = JSON.parse(buffer.toString('utf8')) as CompatibilityManifest;
    await validateCompatibilityManifest(manifest);
    await verifyManifestSignature(manifest);
    if (manifest.tokenId !== tokenId
      || !buffer.equals(serializeCompatibilityManifest(manifest))) {
      throw new Error(`Score #${tokenId} artifact 不是规范签名字节`);
    }
    result.push({ tokenId, buffer, sha256: sha256(buffer), manifest });
  }
  return result;
}

async function sign(): Promise<void> {
  const existing = [1, 2, 3, 4].filter((tokenId) => existsSync(artifactPath(tokenId)));
  if (existing.length) {
    if (existing.length !== 4) throw new Error('compat artifacts 部分存在，拒绝覆盖或补写');
    await readSignedAssets();
    console.log('4 个 compat artifacts 已存在且签名有效；未覆盖');
    return;
  }
  const identity = loadCompatibilityIdentity();
  const account = loadAdminAccount();
  const { blockNumber } = await assertCurrentAdmin(account.address, identity.scoreContract);
  const drafts = payloads(new Date().toISOString());
  const manifests = [];
  for (const draft of drafts) manifests.push(await signPayloadWithAccount(draft, account, blockNumber));
  mkdirSync(ARTIFACT_DIR, { recursive: true });
  for (const manifest of manifests) {
    writeFileSync(artifactPath(manifest.tokenId), serializeCompatibilityManifest(manifest));
  }
  console.log(`已生成 4 个签名 artifact；signer=${account.address} roleBlock=${blockNumber}`);
}

async function adminGate(assets: Awaited<ReturnType<typeof readSignedAssets>>) {
  const identity = loadCompatibilityIdentity();
  const account = loadAdminAccount();
  await assertCurrentAdmin(account.address, identity.scoreContract);
  if (assets.some(({ manifest }) => (
    manifest.signature.signer.toLowerCase() !== account.address.toLowerCase()
  ))) throw new Error('artifact signer 与当前 ADMIN_WALLET_PATH 不一致');
  return account.address;
}

async function preflight(assets: Awaited<ReturnType<typeof readSignedAssets>>): Promise<void> {
  const admin = await adminGate(assets);
  const ledger = loadCompatLedger();
  const pending = assets.filter(({ tokenId }) => (
    !['uploaded', 'verified'].includes(ledger.assets[String(tokenId)]?.state ?? '')
  ));
  if (!pending.length) return console.log('compat ledger 已覆盖全部对象，无待付费上传');
  const reserve = Math.max(...pending.map(({ buffer }) => buffer.length));
  const budget = await getTurboUploadBudget([...pending.map(({ buffer }) => buffer.length), reserve]);
  console.log(`preflight PASS：admin=${admin} objects=${pending.length} required=${budget.requiredWinc} winc`);
}

async function upload(assets: Awaited<ReturnType<typeof readSignedAssets>>): Promise<void> {
  await adminGate(assets);
  await withCompatUploadLock(async () => {
    const ledger = loadCompatLedger();
    blockInterruptedCompatUploads(ledger);
    if (Object.values(ledger.assets).some(({ state }) => state === 'upload_result_unknown')) {
      throw new Error('存在 upload_result_unknown，必须人工对账，禁止上传');
    }
    await preflight(assets);
    for (const asset of assets) {
      const known = ledger.assets[String(asset.tokenId)];
      if (known && ['uploaded', 'verified'].includes(known.state)) continue;
      const entry = beginCompatUpload(ledger, {
        tokenId: asset.tokenId, bytes: asset.buffer.length, contentSha256: asset.sha256,
      });
      try {
        const result = await uploadBuffer(asset.buffer, 'application/json', [
          { name: 'App-Name', value: 'Ripples in the Pond' },
          { name: 'P15-Phase', value: 'H3' },
          { name: 'Asset-Kind', value: 'score-compatibility' },
          { name: 'Score-Token-ID', value: String(asset.tokenId) },
          { name: 'Content-SHA256', value: asset.sha256 },
        ]);
        updateCompatEntry(ledger, entry, {
          state: 'uploaded', arweaveTxId: result.txId, uploaderAddress: result.uploaderAddress,
          costWinc: result.costWinc, uploadedAt: new Date().toISOString(), lastError: null,
        });
      } catch (error) {
        updateCompatEntry(ledger, entry, {
          state: 'upload_result_unknown',
          lastError: error instanceof Error ? error.message.slice(0, 500) : 'unknown',
        });
        throw new Error(`Score #${asset.tokenId} 上传结果未知，已熔断`);
      }
    }
  });
}

async function verify(assets: Awaited<ReturnType<typeof readSignedAssets>>): Promise<void> {
  const ledger = loadCompatLedger();
  let complete = true;
  for (const asset of assets) {
    let entry = ledger.assets[String(asset.tokenId)];
    if (!entry?.arweaveTxId || !['uploaded', 'verified'].includes(entry.state)) {
      throw new Error(`Score #${asset.tokenId} 没有 uploaded txid`);
    }
    if (entry.state === 'verified') continue;
    const evidence = await verifyCompatibilityQuorum(entry.arweaveTxId, asset);
    const ok = hasCompatibilityQuorum(evidence);
    entry = updateCompatEntry(ledger, entry, {
      state: ok ? 'verified' : 'uploaded', gatewayEvidence: evidence,
      verifiedAt: ok ? new Date().toISOString() : null,
      lastError: ok ? null : '尚未达到两个独立网关同字节/MIME/签名 quorum',
    });
    complete &&= entry.state === 'verified';
  }
  if (!complete) throw new Error('compat 尚未达到双网关 quorum；只重跑 --verify，禁止重传');
}

async function main(): Promise<void> {
  const mode = args();
  if (mode === 'audit') return audit();
  if (mode === 'sign') return sign();
  const assets = await readSignedAssets();
  if (mode === 'preflight') return preflight(assets);
  if (mode === 'upload') return upload(assets);
  return verify(assets);
}

main().catch((error) => { console.error('[P15-H3 compat] 失败：', error); process.exit(1); });

