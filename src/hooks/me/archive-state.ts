import type { ArchiveRecording } from './archive-data';
import type { OwnedScoreNFT } from '@/src/types/jam';
import type { OwnedNFT } from '@/src/types/tracks';

export type ArchivePhase = 'idle' | 'loading' | 'refreshing' | 'ready' | 'error';
export type ArchiveSlice<T> = {
  items: T[];
  phase: ArchivePhase;
  error: string | null;
  resolved: boolean;
  cached?: boolean;
};

export const emptyScores: ArchiveSlice<OwnedScoreNFT> = {
  items: [], phase: 'idle', error: null, resolved: false,
};

export const emptyRecordings: ArchiveSlice<ArchiveRecording> = {
  items: [], phase: 'idle', error: null, resolved: false,
};

export const emptyMaterials: ArchiveSlice<OwnedNFT> = {
  items: [], phase: 'idle', error: null, resolved: false,
};

export function loadingPhase<T>(slice: ArchiveSlice<T>): ArchivePhase {
  return slice.items.length || slice.resolved ? 'refreshing' : 'loading';
}

export function archiveCount<T>(slice: ArchiveSlice<T>): number | null {
  return slice.resolved || slice.phase === 'error' || slice.items.length > 0
    ? slice.items.length : null;
}

export function archiveLoading<T>(slice: ArchiveSlice<T>): boolean {
  return slice.phase === 'idle' || slice.phase === 'loading';
}

export function archivePageCount(count: number | null, size: number): number {
  return Math.max(1, Math.ceil((count ?? 0) / size));
}

