import '../../_env';
import { readFileSync, readdirSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { canonicalizeJson, sha256Hex, type JsonValue } from '../../../src/lib/score-package';
import { validateCompatibilityManifest } from '../compat/contract';
import { verifyManifestSignature } from '../compat/admin';
import type { CompatibilityManifest } from '../compat/types';

const ROOT = process.cwd();
const OUTPUT = join(ROOT, 'reviews/evidence/p15-h/h7-snapshot-plan.json');
const GATEWAYS = ['https://ardrive.net', 'https://arweave.tokyo', 'https://arweave.net'];

type Proof = { gateway: string; ok: boolean; bytes: number; sha256: string; contentType: string };
type Dependency = { txId: string; kind: string; gateways: Proof[] };
type H0Score = {
  tokenId: string; tokenUri: string; metadataTxId: string; metadataGateways: Proof[];
  refs: { decoderTxId: string; eventsTxId: string; baseTxId: string; soundsTxId: string };
  eventsGateways: Proof[]; dependencies: Dependency[]; usedKeys: string[];
};
type Identity = { arTxId: string; sha256: string; bytes: number; mime: string; level: 'attested' };

function json<T>(path: string): T {
  return JSON.parse(readFileSync(join(ROOT, path), 'utf8')) as T;
}

function identity(txId: string, proofs: Proof[], mime: string): Identity {
  const groups = new Map<string, Proof[]>();
  for (const proof of proofs.filter((item) => item.ok)) {
    const normalized = proof.contentType.split(';')[0].trim().toLowerCase();
    const key = `${proof.bytes}:${proof.sha256}:${normalized}`;
    groups.set(key, [...(groups.get(key) ?? []), proof]);
  }
  const group = [...groups.values()].find((items) => items.length >= 2
    && items[0].contentType.split(';')[0].trim().toLowerCase() === mime);
  if (!group) throw new Error(`${txId}: 缺少 ${mime} 双网关身份共识`);
  return { arTxId: txId, bytes: group[0].bytes, sha256: group[0].sha256, mime, level: 'attested' };
}

async function fetchJson(id: Identity): Promise<unknown> {
  for (const gateway of GATEWAYS) {
    try {
      const response = await fetch(`${gateway}/${id.arTxId}`, { signal: AbortSignal.timeout(20_000) });
      if (!response.ok) continue;
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length !== id.bytes || await sha256Hex(bytes) !== id.sha256) continue;
      return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    } catch { /* 继续下一个永久网关 */ }
  }
  throw new Error(`${id.arTxId}: 无法按固定身份读取 JSON`);
}

function dependency(score: H0Score, txId: string, kind: string, mime: string): Identity {
  const found = score.dependencies.find((item) => item.txId === txId && item.kind === kind);
  if (!found) throw new Error(`Score #${score.tokenId}: 缺少 ${kind} 依赖证据`);
  return identity(txId, found.gateways, mime);
}

function decoderIdentity(): Identity {
  const directory = join(ROOT, 'data/score-decoder/v3-publications');
  const states = readdirSync(directory).filter((name) => name.endsWith('.json'))
    .map((name) => json<Record<string, unknown>>(`data/score-decoder/v3-publications/${name}`))
    .filter((state) => state.state === 'verified');
  if (states.length !== 1) throw new Error(`修正版 decoder verified revision 必须唯一；实际 ${states.length}`);
  const state = states[0];
  return {
    arTxId: String(state.arTxId), sha256: String(state.sha256), bytes: Number(state.bytes),
    mime: 'text/html', level: 'attested',
  };
}

async function main(): Promise<void> {
  const h0 = json<{ scoreNft: { chainId: number; contract: string }; scores: H0Score[] }>(
    'reviews/evidence/p15-h/h0-permanent-core.json',
  );
  const production = json<{ queue: Array<{ id: string; token_id: number }> }>(
    'reviews/evidence/p15-h/h0-production-state.json',
  );
  const ledger = json<{ assets: Record<string, {
    state: string; arweaveTxId: string; contentSha256: string; bytes: number;
  }> }>('data/compatibility/upload-ledger.json');
  const decoder = decoderIdentity();
  const snapshots = [];
  for (const score of h0.scores) {
    const tokenId = Number(score.tokenId);
    const compat = json<CompatibilityManifest>(`data/compatibility/score-${tokenId}.json`);
    await validateCompatibilityManifest(compat);
    await verifyManifestSignature(compat);
    if (compat.tokenId !== tokenId || compat.originalTokenURI !== score.tokenUri) {
      throw new Error(`Score #${tokenId}: compatibility 身份不一致`);
    }
    const publication = ledger.assets[String(tokenId)];
    if (publication?.state !== 'verified') throw new Error(`Score #${tokenId}: compat 尚未 verified`);
    const metadataId = identity(score.metadataTxId, score.metadataGateways, 'application/json');
    const eventsId = identity(score.refs.eventsTxId, score.eventsGateways, 'application/json');
    const soundSet = dependency(score, score.refs.soundsTxId, 'json', 'application/json');
    const attestations = {
      metadata: metadataId, events: eventsId,
      base: dependency(score, score.refs.baseTxId, 'audio', 'audio/mpeg'), soundSet,
      originalDecoder: dependency(score, score.refs.decoderTxId, 'html', 'text/html'),
      decoder,
      compatibility: {
        arTxId: publication.arweaveTxId, sha256: publication.contentSha256,
        bytes: publication.bytes, mime: 'application/json', level: 'attested',
      },
    };
    const metadata = await fetchJson(metadataId);
    const events = await fetchJson(eventsId);
    const sounds = await fetchJson(soundSet);
    const digestInput = {
      schemaId: 'ripples.score-snapshot.v1', originalTokenUri: score.tokenUri,
      metadata, events, sounds, resourceAttestations: attestations, compatibility: compat,
    };
    snapshots.push({
      tokenId, queueId: production.queue.find((row) => row.token_id === tokenId)?.id ?? null,
      ...digestInput, contentSha256: await sha256Hex(canonicalizeJson(digestInput as JsonValue)),
    });
  }
  if (snapshots.length !== 4) throw new Error(`ready snapshot 必须精确为 4；实际 ${snapshots.length}`);
  const temporary = `${OUTPUT}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify({
    schema: 'p15-h7.snapshot-plan.v1', generatedAt: new Date().toISOString(),
    environment: 'production', chainId: h0.scoreNft.chainId,
    contract: h0.scoreNft.contract.toLowerCase(), snapshots,
  }, null, 2)}\n`);
  renameSync(temporary, OUTPUT);
  console.log(`H7 四枚历史 snapshot 计划通过：${OUTPUT}`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
