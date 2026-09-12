import {
  decodeWalletRecipeAudio,
  loadWalletRecipeAudio,
  playbackLoadWindows,
} from './media-loader';
import type { WalletRecipeTimeline } from './timeline';
import type { WalletRecipePlayerInput } from './types';

const REMAINING_BATCH_SIZE = 4;

/** 先取前四段所需唯一音频，剩余资源继续在播放窗口之前滚动加载。 */
export class ProgressiveRecipeResources {
  private readonly initialKeys: string[];
  private readonly remainingKeys: string[];
  private compressed = new Map<string, ArrayBuffer>();
  private decoded = new Map<string, AudioBuffer>();
  private decodeFlight: Promise<number> | null = null;

  constructor(
    private readonly input: WalletRecipePlayerInput,
    timeline: WalletRecipeTimeline,
    private readonly fetcher: typeof fetch,
    private readonly signal: AbortSignal,
  ) {
    const windows = playbackLoadWindows(timeline);
    this.initialKeys = windows.initial;
    this.remainingKeys = windows.remaining;
  }

  async loadInitial(onLoaded: (count: number) => void): Promise<void> {
    this.compressed = await loadWalletRecipeAudio(
      this.input, this.initialKeys, this.fetcher, this.signal, onLoaded,
    );
  }

  async loadRemaining(
    onLoaded: (count: number) => void,
    onBatch: () => Promise<void>,
  ): Promise<void> {
    for (let offset = 0; offset < this.remainingKeys.length; offset += REMAINING_BATCH_SIZE) {
      const keys = this.remainingKeys.slice(offset, offset + REMAINING_BATCH_SIZE);
      const loadedBefore = this.compressed.size;
      const batch = await loadWalletRecipeAudio(
        this.input, keys, this.fetcher, this.signal,
        (count) => onLoaded(loadedBefore + count),
      );
      batch.forEach((bytes, key) => this.compressed.set(key, bytes));
      await onBatch();
    }
  }

  async decodeMissing(context: AudioContext): Promise<number> {
    while (this.decodeFlight) await this.decodeFlight;
    const pending = new Map([...this.compressed].filter(([key]) => !this.decoded.has(key)));
    if (!pending.size) return 0;
    const flight = this.decodePending(context, pending);
    this.decodeFlight = flight;
    try {
      return await flight;
    } finally {
      if (this.decodeFlight === flight) this.decodeFlight = null;
    }
  }

  async decodeInitial(context: AudioContext): Promise<number> {
    while (this.decodeFlight) await this.decodeFlight;
    const initial = new Set(this.initialKeys);
    const pending = new Map([...this.compressed].filter(
      ([key]) => initial.has(key) && !this.decoded.has(key),
    ));
    if (!pending.size) return 0;
    const flight = this.decodePending(context, pending);
    this.decodeFlight = flight;
    try {
      return await flight;
    } finally {
      if (this.decodeFlight === flight) this.decodeFlight = null;
    }
  }

  private async decodePending(
    context: AudioContext, pending: Map<string, ArrayBuffer>,
  ): Promise<number> {
    const startedAt = performance.now();
    const decoded = await decodeWalletRecipeAudio(context, this.input, pending);
    decoded.forEach((buffer, key) => this.decoded.set(key, buffer));
    return Math.round(performance.now() - startedAt);
  }

  buffer(key: string): AudioBuffer | undefined {
    return this.decoded.get(key);
  }

  clearDecoded(): void {
    this.decoded.clear();
  }
}
