import { canonicalizeJson, sha256Hex, type JsonValue } from '@/src/lib/score-package';
import { isSoundKey } from '@/src/lib/sound-set';
import type { KeyEvent, ScorePlaybackManifest } from '@/src/types/jam';
import type {
  ScoreAudioIdentity, ScorePlaybackBootstrap, ScoreSnapshotReceipt,
} from '@/src/features/score-playback/types';

const TX_RE = /^[A-Za-z0-9_-]{43}$/;
const SHA_RE = /^[0-9a-f]{64}$/;
const AR_HOSTS = new Set(['arweave.net', 'ardrive.net', 'arweave.tokyo', 'ario.permagate.io']);

export type ScoreSnapshotRow = Readonly<{
  revision: number; queue_id: string | null; schema_id: string; original_token_uri: string;
  metadata: unknown; events: unknown; sounds: unknown; resource_attestations: unknown;
  compatibility: unknown; content_sha256: string; verified_at: string;
}>;

export type ParsedScoreSnapshot = Readonly<{
  queueId: string | null;
  metadataRef: `ar://${string}`;
  name: string | null;
  trackTitle: string | null;
  coverUrl: string;
  mintedAt: string | null;
  manifest: ScorePlaybackManifest;
  playbackBootstrap: ScorePlaybackBootstrap;
  receipt: ScoreSnapshotReceipt;
}>;

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} 不是对象`);
  return value as Record<string, unknown>;
}

function txId(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new Error(`${label} 缺少 txid`);
  let candidate = value.startsWith('ar://') ? value.slice(5) : value;
  if (value.startsWith('https://')) {
    const url = new URL(value);
    const parts = url.pathname.split('/').filter(Boolean);
    if (!AR_HOSTS.has(url.host) || parts.length !== 1 || url.search || url.hash
      || url.username || url.password) throw new Error(`${label} URL 无效`);
    candidate = parts[0];
  }
  if (!TX_RE.test(candidate)) throw new Error(`${label} txid 无效`);
  return candidate;
}

function identity(
  value: unknown, label: string, fallbackIntegrity: ScoreAudioIdentity['integrity'],
): ScoreAudioIdentity {
  const item = object(value, label);
  const id = txId(item.arTxId ?? item.txId ?? item.ref ?? item.uri, label);
  const integrity = item.level === 'canonical' || item.integrity === 'canonical'
    ? 'canonical' : item.level === 'attested' || item.integrity === 'attested'
      ? 'attested' : fallbackIntegrity;
  if (typeof item.sha256 !== 'string' || !SHA_RE.test(item.sha256)
    || typeof item.bytes !== 'number' || !Number.isSafeInteger(item.bytes) || item.bytes < 1
    || item.mime !== 'audio/mpeg') throw new Error(`${label} 音频身份无效`);
  return { ref: `ar://${id}`, sha256: item.sha256, bytes: item.bytes, mime: 'audio/mpeg', integrity };
}

function eventList(value: unknown): KeyEvent[] {
  if (!Array.isArray(value)) throw new Error('snapshot events 不是数组');
  return value.map((raw, index) => {
    const item = object(raw, `event ${index + 1}`);
    const key = typeof item.key === 'string' ? item.key.trim().toLowerCase() : '';
    if (!isSoundKey(key) || typeof item.time !== 'number' || !Number.isFinite(item.time)
      || item.time < 0 || typeof item.duration !== 'number' || !Number.isFinite(item.duration)
      || item.duration < 0) throw new Error(`event ${index + 1} 无效`);
    return { key, time: item.time, duration: item.duration };
  }).sort((left, right) => left.time - right.time);
}

function soundsTable(value: unknown): Record<string, unknown> {
  const root = object(value, 'snapshot sounds');
  if (Array.isArray(root.entries)) {
    return Object.fromEntries(root.entries.map((raw, index) => {
      const item = object(raw, `sound entry ${index + 1}`);
      if (!isSoundKey(item.key)) throw new Error(`sound entry ${index + 1} 键无效`);
      return [item.key, item];
    }));
  }
  return root.sounds && typeof root.sounds === 'object' && !Array.isArray(root.sounds)
    ? root.sounds as Record<string, unknown> : root;
}

function effectiveSounds(
  rawSounds: unknown, compatibility: Record<string, unknown> | null,
  events: readonly KeyEvent[], canonical: boolean,
): Record<string, ScoreAudioIdentity> {
  const original = soundsTable(rawSounds);
  const overrides = compatibility?.effectiveSounds
    ? object(compatibility.effectiveSounds, 'compatibility effectiveSounds') : {};
  const result: Record<string, ScoreAudioIdentity> = {};
  for (const key of new Set(events.map((event) => event.key))) {
    const value = overrides[key] ?? original[key];
    if (!value) throw new Error(`verified snapshot 缺少事件键：${key}`);
    result[key] = identity(value, `sound ${key}`, overrides[key] ? 'attested' : canonical ? 'canonical' : 'attested');
  }
  return result;
}

function attribute(metadata: Record<string, unknown>, trait: string): unknown {
  if (!Array.isArray(metadata.attributes)) return null;
  const found = metadata.attributes.find((value) => {
    const item = value && typeof value === 'object' ? value as Record<string, unknown> : null;
    return item?.trait_type === trait;
  });
  return found && typeof found === 'object' ? (found as Record<string, unknown>).value : null;
}

function audioRef(attestations: Record<string, unknown>, role: string): `ar://${string}` {
  const item = object(attestations[role], `${role} attestation`);
  return `ar://${txId(item.arTxId ?? item.txId ?? item.ref, `${role} attestation`)}`;
}

function decoderUrl(attestations: Record<string, unknown>): string {
  const decoder = audioRef(attestations, 'decoder').slice(5);
  const params = new URLSearchParams();
  if (attestations.package) params.set('package', audioRef(attestations, 'package'));
  else {
    params.set('events', audioRef(attestations, 'events'));
    params.set('base', audioRef(attestations, 'base'));
    params.set('sounds', audioRef(attestations, 'soundSet'));
  }
  return `https://arweave.net/${decoder}?${params}`;
}

/** active pointer 指向的 row 仍要复验自身 digest 与播放闭包，损坏时 fail closed。 */
export async function parseScoreSnapshot(row: ScoreSnapshotRow): Promise<ParsedScoreSnapshot> {
  if (row.schema_id !== 'ripples.score-snapshot.v1'
    || !Number.isSafeInteger(row.revision) || row.revision < 1
    || typeof row.verified_at !== 'string' || !Number.isFinite(Date.parse(row.verified_at))) {
    throw new Error('active snapshot 版本或验证时间无效');
  }
  const metadata = object(row.metadata, 'snapshot metadata');
  const attestations = object(row.resource_attestations, 'resource attestations');
  const compatibility = row.compatibility == null ? null : object(row.compatibility, 'compatibility');
  const digestInput = {
    schemaId: row.schema_id, originalTokenUri: row.original_token_uri, metadata: row.metadata,
    events: row.events, sounds: row.sounds, resourceAttestations: row.resource_attestations,
    compatibility: row.compatibility,
  } as JsonValue;
  if (!SHA_RE.test(row.content_sha256)
    || await sha256Hex(canonicalizeJson(digestInput)) !== row.content_sha256) {
    throw new Error('active snapshot 内容哈希不符');
  }
  const metadataId = txId(row.original_token_uri, 'original tokenURI');
  const events = eventList(row.events);
  const canonical = Boolean(attestations.package);
  const base = identity(attestations.base, 'base attestation', canonical ? 'canonical' : 'attested');
  const sounds = effectiveSounds(row.sounds, compatibility, events, canonical);
  const manifest: ScorePlaybackManifest = {
    permanentDecoderUrl: decoderUrl(attestations),
    eventsRef: audioRef(attestations, 'events'), baseAudioRef: base.ref,
    soundsMapRef: audioRef(attestations, 'soundSet'),
  };
  const imageId = (() => { try { return txId(metadata.image, 'metadata image'); } catch { return null; } })();
  const eventsCount = attribute(metadata, 'Events');
  if (eventsCount != null && eventsCount !== events.length) throw new Error('metadata 事件数与 snapshot 不一致');
  return {
    queueId: row.queue_id, metadataRef: `ar://${metadataId}`,
    name: typeof metadata.name === 'string' ? metadata.name : null,
    trackTitle: typeof attribute(metadata, 'Track') === 'string' ? attribute(metadata, 'Track') as string : null,
    coverUrl: imageId ? `https://arweave.net/${imageId}` : '',
    mintedAt: typeof attribute(metadata, 'Minted At') === 'string' ? attribute(metadata, 'Minted At') as string : null,
    manifest,
    playbackBootstrap: { schema: 'ripples.score-bootstrap.v1', ...manifest, events, base, sounds },
    receipt: {
      revision: row.revision, schemaId: row.schema_id, contentSha256: row.content_sha256,
      verifiedAt: row.verified_at, attestations, compatibility,
    },
  };
}
