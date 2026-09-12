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
  private decodeFlight: Promise<unknown> | null = null;

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

  async decodeMissing(context: AudioContext, onBatch: (elapsed: number) => void): Promise<void> {
    if (this.decodeFlight) {
      await this.decodeFlight;
      return;
    }
    const flight = this.decodeBatches(context, onBatch);
    this.decodeFlight = flight;
    try {
      await flight;
    } finally {
      if (this.decodeFlight === flight) this.decodeFlight = null;
    }
  }

  private async decodeBatches(
    context: AudioContext, onBatch: (elapsed: number) => void,
  ): Promise<void> {
    while (this.pending().size) {
      const pending = new Map([...this.pending()].slice(0, REMAINING_BATCH_SIZE));
      if (!pending.size) return;
      onBatch(await this.decodePending(context, pending));
      if (this.pending().size) {
        await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0));
      }
    }
  }

  async decodeInitial(context: AudioContext): Promise<number> {
    const initial = new Set(this.initialKeys);
    let pending = this.pending(initial);
    if (!pending.size) return 0;
    if (this.decodeFlight) await this.decodeFlight;
    pending = this.pending(initial);
    if (!pending.size) return 0;
    const flight = this.decodePending(context, pending);
    this.decodeFlight = flight;
    try {
      return await flight;
    } finally {
      if (this.decodeFlight === flight) this.decodeFlight = null;
    }
  }

  private pending(keys?: Set<string>): Map<string, ArrayBuffer> {
    return new Map([...this.compressed].filter(
      ([key]) => !this.decoded.has(key) && (!keys || keys.has(key)),
    ));
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
