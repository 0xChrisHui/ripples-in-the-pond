import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isSoundKey, type SoundKey } from '../../../src/lib/sound-set';
import type { CompatibilitySource, PermanentSoundIdentity } from './types';

const TX = /^[A-Za-z0-9_-]{43}$/;
const HASH = /^[0-9a-f]{64}$/;
type Evidence = { ok?: boolean; gateway?: string; bytes?: number; sha256?: string; contentType?: string };
type H0Entry = { key?: unknown; txId?: unknown; gateways?: Evidence[] };
type H0Score = {
  tokenId?: unknown; tokenUri?: unknown; lifecycle?: unknown; usedKeys?: unknown;
  refs?: { eventsTxId?: unknown; baseTxId?: unknown; soundsTxId?: unknown };
};

function json(path: string): unknown {
  return JSON.parse(readFileSync(join(process.cwd(), path), 'utf8')) as unknown;
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} 不是对象`);
  return value as Record<string, unknown>;
}

function ar(value: unknown, label: string): `ar://${string}` {
  if (typeof value !== 'string' || !value.startsWith('ar://') || !TX.test(value.slice(5))) {
    throw new Error(`${label} 不是 ar:// txid`);
  }
  return value as `ar://${string}`;
}

function quorum(entry: H0Entry, label: string): PermanentSoundIdentity {
  if (!isSoundKey(entry.key) || typeof entry.txId !== 'string' || !TX.test(entry.txId)) {
    throw new Error(`${label} 身份无效`);
  }
  const groups = new Map<string, Evidence[]>();
  for (const item of entry.gateways ?? []) {
    if (!item.ok || !item.bytes || !HASH.test(item.sha256 ?? '')
      || item.contentType?.split(';')[0].toLowerCase() !== 'audio/mpeg') continue;
    const id = `${item.bytes}:${item.sha256}`;
    groups.set(id, [...(groups.get(id) ?? []), item]);
  }
  const winner = [...groups.values()].find((items) => (
    new Set(items.map(({ gateway }) => gateway)).size >= 2
  ));
  if (!winner) throw new Error(`${label} 缺少双网关同字节证据`);
  return {
    arTxId: entry.txId,
    bytes: winner[0].bytes!,
    sha256: winner[0].sha256!,
    mime: 'audio/mpeg',
  };
}

function currentSounds(value: unknown): Map<SoundKey, PermanentSoundIdentity> {
  const root = record(value, 'current-33');
  if (root.schema !== 'ripples.sound-set.v1' || root.id !== 'current-33-v1'
    || root.publicationStatus !== 'published' || !Array.isArray(root.entries)) {
    throw new Error('current-33 尚未发布');
  }
  const map = new Map<SoundKey, PermanentSoundIdentity>();
  for (const raw of root.entries) {
    const entry = record(raw, 'current-33 entry');
    if (!isSoundKey(entry.key) || typeof entry.arTxId !== 'string' || !TX.test(entry.arTxId)
      || typeof entry.sha256 !== 'string' || !HASH.test(entry.sha256)
      || !Number.isSafeInteger(entry.bytes) || (entry.bytes as number) <= 0
      || entry.mime !== 'audio/mpeg') throw new Error('current-33 永久 identity 不完整');
    map.set(entry.key, {
      arTxId: entry.arTxId, sha256: entry.sha256,
      bytes: entry.bytes as number, mime: 'audio/mpeg',
    });
  }
  if (map.size !== 33) throw new Error('current-33 必须有 33 个唯一键');
  return map;
}

function scoreRefs(score: H0Score, tokenId: number) {
  const refs = score.refs ?? {};
  for (const [name, value] of Object.entries(refs)) {
    if (!TX.test(String(value))) throw new Error(`#${tokenId} ${name} 非法`);
  }
  if (!refs.eventsTxId || !refs.baseTxId || !refs.soundsTxId) throw new Error(`#${tokenId} 引用不完整`);
  return { events: refs.eventsTxId, base: refs.baseTxId, sounds: refs.soundsTxId } as {
    events: string; base: string; sounds: string;
  };
}

export function loadCompatibilitySources(): CompatibilitySource[] {
  const h0 = record(json('reviews/evidence/p15-h/h0-permanent-core.json'), 'H0');
  const scoreNft = record(h0.scoreNft, 'H0 scoreNft');
  if (scoreNft.chainId !== 10 || !/^0x[0-9a-fA-F]{40}$/.test(String(scoreNft.contract))) {
    throw new Error('H0 ScoreNFT 主网身份无效');
  }
  const legacyRoot = record(h0.legacySoundSet, 'legacy sound set');
  if (!Array.isArray(legacyRoot.entries)) throw new Error('H0 legacy entries 缺失');
  const legacy = new Map(legacyRoot.entries.map((item, index) => {
    const entry = item as H0Entry;
    const identity = quorum(entry, `legacy[${index}]`);
    return [entry.key as SoundKey, identity];
  }));
  const current = currentSounds(json('data/sound-sets/current-33.json'));
  if (!Array.isArray(h0.scores)) throw new Error('H0 scores 缺失');
  const scores = (h0.scores as H0Score[]).filter((score) => [1, 2, 3, 4].includes(Number(score.tokenId)));
  if (scores.length !== 4 || new Set(scores.map(({ tokenId }) => Number(tokenId))).size !== 4) {
    throw new Error('H0 必须精确覆盖 Score #1–#4');
  }
  return scores.sort((a, b) => Number(a.tokenId) - Number(b.tokenId)).map((score) => {
    const tokenId = Number(score.tokenId);
    if (score.lifecycle !== 'ready' || !Array.isArray(score.usedKeys)) throw new Error(`#${tokenId} 未 ready`);
    const usedKeys = score.usedKeys.map((key) => {
      if (!isSoundKey(key)) throw new Error(`#${tokenId} 含非法键 ${String(key)}`);
      return key;
    });
    if (new Set(usedKeys).size !== usedKeys.length) throw new Error(`#${tokenId} usedKeys 重复`);
    const selected = tokenId === 1 ? legacy : current;
    const effectiveSounds: Partial<Record<SoundKey, PermanentSoundIdentity>> = {};
    const changes = usedKeys.map((key) => {
      const target = selected.get(key);
      if (!target) throw new Error(`#${tokenId} 缺少 effective sound：${key}`);
      effectiveSounds[key] = target;
      const prior = legacy.get(key);
      return {
        key, mode: tokenId === 1 ? 'retained' as const : prior ? 'override' as const : 'addition' as const,
        fromArTxId: prior?.arTxId ?? null, toArTxId: target.arTxId,
      };
    });
    return {
      tokenId, tokenUri: ar(score.tokenUri, `#${tokenId} tokenURI`), refs: scoreRefs(score, tokenId),
      usedKeys, effectiveSounds, soundSet: tokenId === 1 ? 'legacy-26' : 'current-33-v1', changes,
    };
  });
}

export function loadCompatibilityIdentity(): { chainId: 10; scoreContract: `0x${string}`; generatedAt: string } {
  const h0 = record(json('reviews/evidence/p15-h/h0-permanent-core.json'), 'H0');
  const scoreNft = record(h0.scoreNft, 'H0 scoreNft');
  if (typeof h0.generatedAt !== 'string' || scoreNft.chainId !== 10
    || !/^0x[0-9a-fA-F]{40}$/.test(String(scoreNft.contract))) throw new Error('H0 identity 无效');
  return { chainId: 10, scoreContract: scoreNft.contract as `0x${string}`, generatedAt: h0.generatedAt };
}
