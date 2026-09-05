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

