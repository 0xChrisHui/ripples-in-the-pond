import type { ArchiveRecording } from './archive-data';
import type { OwnedScoreNFT, ScoreMintStatus } from '@/src/types/jam';
import type { OwnedNFT } from '@/src/types/tracks';

export type ArchiveAuthSource = 'privy' | 'semi';
export type ArchiveSectionName = 'scores' | 'recordings' | 'materials';

const SCHEMA_VERSION = 1;
const PREFIX = 'ripples_archive';
const FRESH_MS = 5 * 60_000;
const MAX_AGE_MS = 7 * 24 * 60 * 60_000;
const SOURCE_BY_SECTION: Record<ArchiveSectionName, string> = {
  scores: '/api/me/score-nfts',
  recordings: '/api/me/scores?light=1',
  materials: '/api/me/nfts',
};
const SCORE_STATES = new Set<ScoreMintStatus>([
  'pending', 'uploading_events', 'minting_onchain', 'uploading_metadata',
  'setting_uri', 'success', 'failed',
]);

type Identity = { authSource: ArchiveAuthSource; userId: string };
type Envelope<T> = {
  schemaVersion: number;
  environment: string;
  authSource: ArchiveAuthSource;
  userId: string;
  section: ArchiveSectionName;
  source: string;
  savedAt: string;
  items: T[];
};

function environmentOf(): string {
  const origin = typeof location === 'undefined' ? 'unknown-origin' : location.origin;
  const chain = process.env.NEXT_PUBLIC_CHAIN_ID ?? 'unknown-chain';
  const material = process.env.NEXT_PUBLIC_MATERIAL_NFT_ADDRESS ?? 'unknown-material';
  const score = process.env.NEXT_PUBLIC_SCORE_NFT_ADDRESS ?? 'unknown-score';
  return [origin, chain, material.toLowerCase(), score.toLowerCase()].join('|');
}

function keyOf(identity: Identity, section: ArchiveSectionName): string {
  return [PREFIX, SCHEMA_VERSION, encodeURIComponent(environmentOf()),
    identity.authSource, encodeURIComponent(identity.userId), section].join(':');
}

function object(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : null;
}

export function validCachedScore(value: unknown): value is OwnedScoreNFT {
  const item = object(value);
  return Boolean(item
    && typeof item.id === 'string'
    && typeof item.queueId === 'string'
    && typeof item.trackTitle === 'string'
    && typeof item.status === 'string'
    && SCORE_STATES.has(item.status as ScoreMintStatus)
    && typeof item.submittedAt === 'string');
}

export function validCachedRecording(value: unknown): value is ArchiveRecording {
  const item = object(value);
  const track = object(item?.track);
  return Boolean(item
    && typeof item.key === 'string'
    && typeof item.title === 'string'
    && typeof item.createdAt === 'string'
    && typeof item.pendingScoreId === 'string'
    && Number.isFinite(item.eventCount)
    && track
    && typeof track.id === 'string'
    && typeof track.title === 'string'
    && typeof track.audio_url === 'string');
}

export function validCachedMaterial(value: unknown): value is OwnedNFT {
  const item = object(value);
  const track = object(item?.track);
  return Boolean(item
    && Number.isFinite(item.token_id)
    && typeof item.tx_hash === 'string'
    && typeof item.minted_at === 'string'
    && track
    && typeof track.title === 'string'
    && typeof track.island === 'string');
}

export function readArchiveCache<T>(
  identity: Identity,
  section: ArchiveSectionName,
  validator: (value: unknown) => value is T,
): { items: T[]; savedAt: string; fresh: boolean } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(keyOf(identity, section));
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<Envelope<unknown>>;
    if (value.schemaVersion !== SCHEMA_VERSION
      || value.environment !== environmentOf()
      || value.authSource !== identity.authSource
      || value.userId !== identity.userId
      || value.section !== section
      || value.source !== SOURCE_BY_SECTION[section]
      || typeof value.savedAt !== 'string'
      || !Number.isFinite(Date.parse(value.savedAt))
      || !Array.isArray(value.items)
      || !value.items.every(validator)) return null;
    const age = Date.now() - Date.parse(value.savedAt);
    if (age < -FRESH_MS || age > MAX_AGE_MS) {
      localStorage.removeItem(keyOf(identity, section));
      return null;
    }
    return { items: value.items, savedAt: value.savedAt, fresh: age <= FRESH_MS };
  } catch {
    return null;
  }
}

export function writeArchiveCache<T>(
  identity: Identity,
  section: ArchiveSectionName,
  source: string,
  items: readonly T[],
): void {
  if (typeof window === 'undefined') return;
  const value: Envelope<T> = {
    schemaVersion: SCHEMA_VERSION,
    environment: environmentOf(),
    authSource: identity.authSource,
    userId: identity.userId,
    section,
    source,
    savedAt: new Date().toISOString(),
    items: [...items],
  };
  try {
    localStorage.setItem(keyOf(identity, section), JSON.stringify(value));
  } catch (error) {
    console.warn(`档案缓存写入失败（${section}）:`, error);
  }
}

export function clearArchiveCache(identity: Identity): void {
  if (typeof window === 'undefined') return;
  for (const section of Object.keys(SOURCE_BY_SECTION) as ArchiveSectionName[]) {
    localStorage.removeItem(keyOf(identity, section));
  }
}
