'use client';

import type { HomeTracksSnapshot } from '@/src/types/home-pond';
import type { Track } from '@/src/types/tracks';

export const HOME_TRACKS_CACHE_KEY = 'ripples:home-tracks:v1';
export const HOME_TRACKS_MAX_AGE_MS = 24 * 60 * 60 * 1000;

type CacheStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function resolveStorage(storage?: CacheStorage): CacheStorage | undefined {
  if (storage) return storage;
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

function isTrack(value: unknown): value is Track {
  if (!value || typeof value !== 'object') return false;
  const track = value as Record<string, unknown>;
  return typeof track.id === 'string' && track.id.length > 0
    && typeof track.title === 'string'
    && typeof track.week === 'number' && Number.isFinite(track.week)
    && typeof track.audio_url === 'string'
    && typeof track.cover === 'string'
    && typeof track.island === 'string'
    && typeof track.created_at === 'string'
    && typeof track.published === 'boolean';
}

function validTracks(value: unknown): value is Track[] {
  if (!Array.isArray(value) || value.length === 0 || !value.every(isTrack)) return false;
  return new Set(value.map((track) => track.id)).size === value.length;
}

function versionHash(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** 顺序不参与版本，避免 API 顺序抖动把同一份真实数据误判成新版本。 */
export function deriveTracksDataVersion(tracks: Track[]): string {
  const canonical = [...tracks]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((track) => [
      track.id, track.title, track.week, track.audio_url, track.cover,
      track.island, track.created_at, track.published,
    ]);
  return `tracks-v1-${versionHash(JSON.stringify(canonical))}`;
}

export function getHomeTracksEnvironment(): string {
  if (typeof window === 'undefined') return 'server';
  const chainId = process.env.NEXT_PUBLIC_CHAIN_ID ?? 'unknown-chain';
  const contract = process.env.NEXT_PUBLIC_MATERIAL_NFT_ADDRESS ?? 'unknown-contract';
  return `${window.location.origin}|${chainId}|${contract.toLowerCase()}`;
}

export function snapshotFromResponse(
  input: unknown,
  environment: string,
  writtenAt = Date.now(),
): HomeTracksSnapshot | null {
  if (!input || typeof input !== 'object') return null;
  const tracks = (input as { tracks?: unknown }).tracks;
  if (!validTracks(tracks)) return null;
  return {
    schemaVersion: 1,
    dataVersion: deriveTracksDataVersion(tracks),
    environment,
    writtenAt,
    source: 'tracks-api',
    tracks,
  };
}

export function validateHomeTracksSnapshot(
  input: unknown,
  environment: string,
  now = Date.now(),
): HomeTracksSnapshot | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as Partial<HomeTracksSnapshot>;
  if (value.schemaVersion !== 1 || value.source !== 'tracks-api') return null;
  if (value.environment !== environment || !validTracks(value.tracks)) return null;
  if (typeof value.writtenAt !== 'number' || value.writtenAt > now + 60_000) return null;
  if (now - value.writtenAt > HOME_TRACKS_MAX_AGE_MS) return null;
  if (value.dataVersion !== deriveTracksDataVersion(value.tracks)) return null;
  return value as HomeTracksSnapshot;
}

export function readHomeTracksSnapshot(
  storage?: CacheStorage,
  environment = getHomeTracksEnvironment(),
  now = Date.now(),
): HomeTracksSnapshot | null {
  const target = resolveStorage(storage);
  if (!target) return null;
  try {
    const raw = target.getItem(HOME_TRACKS_CACHE_KEY);
    if (!raw) return null;
    const snapshot = validateHomeTracksSnapshot(JSON.parse(raw) as unknown, environment, now);
    if (!snapshot) target.removeItem(HOME_TRACKS_CACHE_KEY);
    return snapshot;
  } catch (error) {
    console.warn('[home-tracks] 读取缓存失败，已忽略：', error);
    return null;
  }
}

/** 先完整校验再写入，因此坏响应和空响应不会覆盖最后成功快照。 */
export function cacheHomeTracksResponse(
  input: unknown,
  storage?: CacheStorage,
  environment = getHomeTracksEnvironment(),
  writtenAt = Date.now(),
): HomeTracksSnapshot | null {
  const snapshot = snapshotFromResponse(input, environment, writtenAt);
  const target = resolveStorage(storage);
  if (!snapshot || !target) return null;
  try {
    target.setItem(HOME_TRACKS_CACHE_KEY, JSON.stringify(snapshot));
    return snapshot;
  } catch (error) {
    console.warn('[home-tracks] 写入缓存失败，本次仍使用在线数据：', error);
    return snapshot;
  }
}
