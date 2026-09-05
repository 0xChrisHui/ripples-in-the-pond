import type { Draft } from '@/src/lib/draft-store';
import type { KeyEvent, MyScoresResponse, SaveScoreResponse } from '@/src/types/jam';
import type { OwnedNFT, Track } from '@/src/types/tracks';

export type ArchiveRecording = {
  key: string;
  title: string;
  createdAt: string;
  pendingScoreId?: string;
  track?: Track;
  events?: KeyEvent[];
  eventCount: number;
  uploadFailed?: boolean;
  awaitingRefresh?: boolean;
};

export function uploadedRecording(
  draft: Draft,
  result: SaveScoreResponse,
): ArchiveRecording {
  return {
    key: `server-${result.scoreId}`,
    title: '已上传录音',
    createdAt: draft.createdAt,
    pendingScoreId: result.scoreId,
    events: draft.eventsData,
    eventCount: draft.eventsData.length,
    awaitingRefresh: true,
  };
}

export function recordingsFrom(
  server: MyScoresResponse['scores'],
  drafts: Draft[],
  failedUploads = new Set<string>(),
  uploaded: ArchiveRecording[] = [],
): ArchiveRecording[] {
  const remote = server.map((score) => ({
    key: `server-${score.id}`,
    title: `${score.track.title} · 第 ${score.seq} 次录音`,
    createdAt: score.createdAt,
    pendingScoreId: score.id,
    track: score.track,
    events: score.events,
    eventCount: score.eventCount,
  }));
  const remoteIds = new Set(server.map((score) => score.id));
  const waiting = uploaded.filter((row) => (
    row.pendingScoreId && !remoteIds.has(row.pendingScoreId)
  ));
  const local = drafts.map((draft, index) => ({
    key: `local-${draft.trackId}`,
    title: `本机录音 · ${String(index + 1).padStart(2, '0')}`,
    createdAt: draft.createdAt,
    eventCount: draft.eventsData.length,
    uploadFailed: failedUploads.has(draft.trackId),
  }));
  return [...remote, ...waiting, ...local];
}

function validDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function validCachedMaterial(value: unknown): value is OwnedNFT {
  if (typeof value !== 'object' || value === null) return false;
  const nft = value as Record<string, unknown>;
  const track = nft.track as Record<string, unknown> | null;
  const validTrack = track === null || (
    typeof track === 'object' &&
    typeof track.title === 'string' &&
    typeof track.island === 'string'
  );
  return (
    Number.isFinite(nft.token_id) &&
    typeof nft.tx_hash === 'string' &&
    validDate(nft.minted_at) &&
    validTrack
  );
}

/** 缓存只作为秒开提示；任一条结构损坏就放弃整批并继续读取远端。 */
export function validCachedMaterials(value: unknown): OwnedNFT[] {
  return Array.isArray(value) && value.every(validCachedMaterial) ? value : [];
}
