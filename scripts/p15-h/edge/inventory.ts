import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SoundSetLedger } from '../sound-set-ledger';

export type MirrorAsset = {
  arTxId: string;
  blobKey: `media/${string}`;
  bytes: number;
  sha256: string;
  mime: 'audio/mpeg';
  sources: string[];
};

type GatewayProof = {
  ok?: boolean;
  bytes?: number;
  sha256?: string;
  contentType?: string;
};

type CoreEvidence = {
  scores?: Array<{
    tokenId?: string;
    lifecycle?: string;
    refs?: { baseTxId?: string };
    dependencies?: Array<{
      txId?: string;
      kind?: string;
      gateways?: GatewayProof[];
    }>;
  }>;
};

const TX_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const HASH_PATTERN = /^[a-f0-9]{64}$/;

function assertIdentity(
  value: { arTxId?: string; bytes?: number; sha256?: string; mime?: string },
): asserts value is { arTxId: string; bytes: number; sha256: string; mime: 'audio/mpeg' } {
  if (!value.arTxId || !TX_PATTERN.test(value.arTxId)) throw new Error('永久音频缺少合法 AR 交易 ID');
  if (!Number.isInteger(value.bytes) || (value.bytes ?? 0) <= 0) throw new Error(`${value.arTxId}: bytes 非法`);
  if (!value.sha256 || !HASH_PATTERN.test(value.sha256)) throw new Error(`${value.arTxId}: sha256 非法`);
  if (value.mime !== 'audio/mpeg') throw new Error(`${value.arTxId}: MIME 必须为 audio/mpeg`);
}

function soundAssets(ledger: SoundSetLedger): MirrorAsset[] {
  if (!['published', 'edge-mirrored'].includes(ledger.publicationStatus) || !ledger.manifest) {
    throw new Error('H3 33 键永久清单尚未发布，H4 禁止开始');
  }
  if (ledger.entries.length !== 33) throw new Error(`H3 清单必须精确包含 33 键；实际 ${ledger.entries.length}`);
  return ledger.entries.map((entry) => {
    const identity = { ...entry, arTxId: entry.arTxId ?? undefined };
    assertIdentity(identity);
    return {
      arTxId: identity.arTxId,
      blobKey: `media/${identity.arTxId}`,
      bytes: identity.bytes,
      sha256: identity.sha256,
      mime: identity.mime,
      sources: [`sound:${entry.key}`],
    };
  });
}

function baseAssets(evidence: CoreEvidence): MirrorAsset[] {
  const scores = evidence.scores ?? [];
  return scores.flatMap((score) => {
    const txId = score.refs?.baseTxId;
    if (!txId || score.lifecycle !== 'ready') return [];
    const dependency = score.dependencies?.find((item) => item.txId === txId && item.kind === 'audio');
    if (!dependency) throw new Error(`Score #${score.tokenId}: 找不到 base 音频核验证据`);
    const groups = new Map<string, GatewayProof[]>();
    for (const proof of dependency.gateways ?? []) {
      if (!proof.ok || proof.contentType !== 'audio/mpeg') continue;
      const key = `${proof.bytes}:${proof.sha256}`;
      groups.set(key, [...(groups.get(key) ?? []), proof]);
    }
    const quorum = [...groups.values()].find((items) => items.length >= 2)?.[0];
    const identity = { arTxId: txId, bytes: quorum?.bytes, sha256: quorum?.sha256, mime: quorum?.contentType };
    assertIdentity(identity);
    return [{ ...identity, blobKey: `media/${txId}` as const, sources: [`score:${score.tokenId}:base`] }];
  });
}

export function buildInventory(ledger: SoundSetLedger, evidence: CoreEvidence): MirrorAsset[] {
  const unique = new Map<string, MirrorAsset>();
  for (const asset of [...soundAssets(ledger), ...baseAssets(evidence)]) {
    const previous = unique.get(asset.arTxId);
    if (previous) {
      if (previous.bytes !== asset.bytes || previous.sha256 !== asset.sha256 || previous.mime !== asset.mime) {
        throw new Error(`${asset.arTxId}: 数据身份发生冲突`);
      }
      previous.sources.push(...asset.sources);
    } else unique.set(asset.arTxId, asset);
  }
  return [...unique.values()];
}

export function loadInventory(root: string): MirrorAsset[] {
  const ledger = JSON.parse(readFileSync(join(root, 'data/sound-sets/current-33.json'), 'utf8')) as SoundSetLedger;
  const evidence = JSON.parse(
    readFileSync(join(root, 'reviews/evidence/p15-h/h0-permanent-core.json'), 'utf8'),
  ) as CoreEvidence;
  return buildInventory(ledger, evidence);
}
