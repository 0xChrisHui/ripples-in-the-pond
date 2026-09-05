import {
  decodeWalletRecipeAudio,
  loadWalletRecipeAudio,
  playbackLoadWindows,
} from './media-loader';
import type { WalletRecipeTimeline } from './timeline';
import type { WalletRecipePlayerInput } from './types';

/** 先取前四段所需唯一音频，剩余资源继续在播放窗口之前滚动加载。 */
export class ProgressiveRecipeResources {
  private readonly initialKeys: string[];
  private readonly remainingKeys: string[];
  private compressed = new Map<string, ArrayBuffer>();
  private decoded = new Map<string, AudioBuffer>();

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

  async loadRemaining(onLoaded: (count: number) => void): Promise<void> {
    if (!this.remainingKeys.length) return;
    const initialCount = this.compressed.size;
    const remaining = await loadWalletRecipeAudio(
      this.input, this.remainingKeys, this.fetcher, this.signal,
      (count) => onLoaded(initialCount + count),
    );
    remaining.forEach((bytes, key) => this.compressed.set(key, bytes));
  }

  async decodeMissing(context: AudioContext): Promise<number> {
    const pending = new Map([...this.compressed].filter(([key]) => !this.decoded.has(key)));
    if (!pending.size) return 0;
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

