import type { ArchiveRecording } from './archive-data';
import type { EchoArchiveItem } from '@/src/data/echo/types';
import type { OwnedScoreNFT, ScoreMintStatus } from '@/src/types/jam';
import type { OwnedNFT } from '@/src/types/tracks';
import { isExposedTrack } from '@/src/lib/track-contract';

export type ArchiveAuthSource = 'privy' | 'semi';
export type ArchiveSectionName = 'scores' | 'echoes' | 'recordings' | 'materials';

const SCHEMA_VERSION = 1;
const PREFIX = 'ripples_archive';
const FRESH_MS = 5 * 60_000;
const MAX_AGE_MS = 7 * 24 * 60 * 60_000;
const SOURCE_BY_SECTION: Record<ArchiveSectionName, string> = {
  scores: '/api/me/score-nfts',
  echoes: '/api/me/pond-echoes',
  recordings: '/api/me/scores?light=1',
  materials: '/api/me/nfts',
};
const SCORE_STATES = new Set<ScoreMintStatus>([
  'pending', 'uploading_events', 'minting_onchain', 'uploading_metadata',
  'setting_uri', 'success', 'failed',
]);

export type ArchiveIdentity = {
  authSource: ArchiveAuthSource; userId: string; evmAddress?: string | null;
};
type Envelope<T> = {
  schemaVersion: number;
  environment: string;
  authSource: ArchiveAuthSource;
  userId: string;
  evmAddress?: string;
  section: ArchiveSectionName;
  source: string;
  savedAt: string;
  items: T[];
};

function environmentOf(section: ArchiveSectionName): string {
  const origin = typeof location === 'undefined' ? 'unknown-origin' : location.origin;
  const chain = process.env.NEXT_PUBLIC_CHAIN_ID ?? 'unknown-chain';
  if (section === 'echoes') {
    const echo = process.env.NEXT_PUBLIC_WALLET_RECIPE_NFT_ADDRESS ?? 'unknown-pond-echo';
    return [origin, chain, echo.toLowerCase()].join('|');
  }
  const material = process.env.NEXT_PUBLIC_MATERIAL_NFT_ADDRESS ?? 'unknown-material';
  const score = process.env.NEXT_PUBLIC_SCORE_NFT_ADDRESS ?? 'unknown-score';
  return [origin, chain, material.toLowerCase(), score.toLowerCase()].join('|');
}

export function normalizeArchiveAddress(value?: string | null): string | null {
  const normalized = value?.trim().toLowerCase() ?? '';
  return /^0x[0-9a-f]{40}$/.test(normalized) ? normalized : null;
}

export function archiveIdentityKey(identity: ArchiveIdentity): string {
  return `${identity.authSource}:${encodeURIComponent(identity.userId)}`;
}

export function archiveCacheKey(identity: ArchiveIdentity, section: ArchiveSectionName): string | null {
  const owner = section === 'echoes' ? normalizeArchiveAddress(identity.evmAddress) : null;
  if (section === 'echoes' && !owner) return null;
  return [PREFIX, SCHEMA_VERSION, encodeURIComponent(environmentOf(section)),
    archiveIdentityKey(identity), ...(owner ? [owner] : []), section].join(':');
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
    && isExposedTrack(track));
}

export function validCachedMaterial(value: unknown): value is OwnedNFT {
  const item = object(value);
  const track = item?.track;
  return Boolean(item
    && Number.isFinite(item.token_id)
    && typeof item.tx_hash === 'string'
    && typeof item.minted_at === 'string'
    && (track === null || isExposedTrack(track)));
}

const ECHO_STATES = new Set([
  'owned', 'excluded_prelaunch', 'pending', 'preparing_media', 'uploading_metadata',
  'minting_onchain', 'confirming_onchain', 'safe_retry', 'manual_review', 'success',
]);

export function validCachedEcho(value: unknown): value is EchoArchiveItem {
  const item = object(value);
  return Boolean(item
    && typeof item.key === 'string'
    && (item.tokenId === null || typeof item.tokenId === 'string')
    && typeof item.name === 'string'
    && typeof item.originWallet === 'string'
    && (item.currentOwner === null || typeof item.currentOwner === 'string')
    && (item.tokenUri === null || typeof item.tokenUri === 'string')
    && typeof item.status === 'string' && ECHO_STATES.has(item.status)
    && (item.relation === 'current-owner' || item.relation === 'origin-history')
    && typeof item.hasError === 'boolean');
}

export function readArchiveCache<T>(
  identity: ArchiveIdentity,
  section: ArchiveSectionName,
  validator: (value: unknown) => value is T,
): { items: T[]; savedAt: string; fresh: boolean } | null {
  if (typeof window === 'undefined') return null;
  try {
    const key = archiveCacheKey(identity, section);
    if (!key) return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<Envelope<unknown>>;
    const address = normalizeArchiveAddress(identity.evmAddress);
    if (value.schemaVersion !== SCHEMA_VERSION
      || value.environment !== environmentOf(section)
      || value.authSource !== identity.authSource
      || value.userId !== identity.userId
      || (section === 'echoes' && value.evmAddress !== address)
      || value.section !== section
      || value.source !== SOURCE_BY_SECTION[section]
      || typeof value.savedAt !== 'string'
      || !Number.isFinite(Date.parse(value.savedAt))
      || !Array.isArray(value.items)
      || !value.items.every(validator)) return null;
    const age = Date.now() - Date.parse(value.savedAt);
    if (age < -FRESH_MS || age > MAX_AGE_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return { items: value.items, savedAt: value.savedAt, fresh: age <= FRESH_MS };
  } catch {
    return null;
  }
}

export function writeArchiveCache<T>(
  identity: ArchiveIdentity,
  section: ArchiveSectionName,
  source: string,
  items: readonly T[],
): void {
  if (typeof window === 'undefined') return;
  const key = archiveCacheKey(identity, section);
  if (!key) return;
  const value: Envelope<T> = {
    schemaVersion: SCHEMA_VERSION,
    environment: environmentOf(section),
    authSource: identity.authSource,
    userId: identity.userId,
    ...(section === 'echoes' ? { evmAddress: normalizeArchiveAddress(identity.evmAddress)! } : {}),
    section,
    source,
    savedAt: new Date().toISOString(),
    items: [...items],
  };
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`档案缓存写入失败（${section}）:`, error);
  }
}

export function clearArchiveCache(identity: ArchiveIdentity): void {
  if (typeof window === 'undefined') return;
  for (const section of Object.keys(SOURCE_BY_SECTION) as ArchiveSectionName[]) {
    const key = archiveCacheKey(identity, section);
    if (key) localStorage.removeItem(key);
  }
}
