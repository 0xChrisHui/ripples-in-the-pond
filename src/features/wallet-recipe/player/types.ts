import type { WalletRecipeMetadataClipV1 } from '@/src/types/wallet-recipe';

export type WalletRecipePlayerState =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'ended'
  | 'error';

export type WalletRecipePlayerErrorKind =
  | 'invalid_input'
  | 'network'
  | 'integrity'
  | 'decode'
  | 'audio';

export type WalletRecipePlayerInput = {
  recipe: string;
  clips: Record<string, WalletRecipeMetadataClipV1>;
};

export type WalletRecipePlayerSnapshot = {
  state: WalletRecipePlayerState;
  positionMs: number;
  durationMs: number;
  currentIndex: number | null;
  currentKey: string | null;
  loadedUniqueCount: number;
  totalUniqueCount: number;
  initialLoadMs: number | null;
  decodeMs: number | null;
  firstSoundExpectedMs: number | null;
  errorKind: WalletRecipePlayerErrorKind | null;
  errorMessage: string | null;
};

export type WalletRecipePlayerListener = () => void;

export type WalletRecipePlayerEngineOptions = {
  fetcher?: typeof fetch;
  createAudioContext?: () => AudioContext;
  requestFrame?: (callback: FrameRequestCallback) => number;
  cancelFrame?: (handle: number) => void;
};

export type WalletRecipePlayerController = {
  getSnapshot: () => WalletRecipePlayerSnapshot;
  subscribe: (listener: WalletRecipePlayerListener) => () => void;
  load: (input: WalletRecipePlayerInput) => Promise<void>;
  play: () => Promise<void>;
  pause: () => void;
  resume: () => Promise<void>;
  seek: (positionMs: number) => void;
  replay: () => Promise<void>;
  destroy: () => Promise<void>;
};

export type PlayerError = Error & { kind: WalletRecipePlayerErrorKind };

export const IDLE_WALLET_RECIPE_SNAPSHOT: WalletRecipePlayerSnapshot = Object.freeze({
  state: 'idle', positionMs: 0, durationMs: 0, currentIndex: null, currentKey: null,
  loadedUniqueCount: 0, totalUniqueCount: 0, errorKind: null, errorMessage: null,
  initialLoadMs: null, decodeMs: null, firstSoundExpectedMs: null,
});

export function toPlayerError(
  error: unknown,
  fallback: WalletRecipePlayerErrorKind,
): PlayerError {
  if (error instanceof Error && 'kind' in error) return error as PlayerError;
  const message = error instanceof Error ? error.message : 'Pond Echo 播放器发生未知错误';
  return Object.assign(new Error(message), { kind: fallback });
}
