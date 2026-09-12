import { RecipePlaybackClock } from './playback-clock';
import { ProgressiveRecipeResources } from './progressive-resources';
import {
  createWalletRecipeTimeline,
  segmentAtPosition,
  type WalletRecipeTimeline,
} from './timeline';
import {
  IDLE_WALLET_RECIPE_SNAPSHOT,
  toPlayerError,
  type WalletRecipePlayerEngineOptions,
  type PlayerError,
  type WalletRecipePlayerController,
  type WalletRecipePlayerInput,
  type WalletRecipePlayerListener,
  type WalletRecipePlayerSnapshot,
} from './types';
export class WalletRecipePlayerEngine implements WalletRecipePlayerController {
  private readonly fetcher: typeof fetch;
  private readonly createContext: () => AudioContext;
  private readonly requestFrame: (callback: FrameRequestCallback) => number;
  private readonly cancelFrame: (handle: number) => void;
  private snapshot = IDLE_WALLET_RECIPE_SNAPSHOT;
  private listeners = new Set<WalletRecipePlayerListener>();
  private input: WalletRecipePlayerInput | null = null;
  private timeline: WalletRecipeTimeline | null = null;
  private resources: ProgressiveRecipeResources | null = null;
  private context: AudioContext | null = null;
  private clock: RecipePlaybackClock | null = null;
  private abortController: AbortController | null = null;
  private generation = 0;
  constructor(options: WalletRecipePlayerEngineOptions = {}) {
    this.fetcher = options.fetcher ?? fetch;
    this.createContext = options.createAudioContext ?? (() => new AudioContext());
    this.requestFrame = options.requestFrame ?? ((callback) => window.requestAnimationFrame(callback));
    this.cancelFrame = options.cancelFrame ?? ((handle) => window.cancelAnimationFrame(handle));
  }
  getSnapshot = (): WalletRecipePlayerSnapshot => this.snapshot;
  getServerSnapshot = (): WalletRecipePlayerSnapshot => IDLE_WALLET_RECIPE_SNAPSHOT;
  subscribe = (listener: WalletRecipePlayerListener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private update(patch: Partial<WalletRecipePlayerSnapshot>): void {
    this.snapshot = Object.freeze({ ...this.snapshot, ...patch });
    this.listeners.forEach((listener) => listener());
  }

  async load(input: WalletRecipePlayerInput): Promise<void> {
    const loadStartedAt = performance.now();
    const generation = ++this.generation;
    this.abortController?.abort();
    await this.releaseAudio();
    this.abortController = new AbortController();
    this.input = null;
    this.timeline = null;
    this.resources = null;
    let timeline: WalletRecipeTimeline;
    try {
      timeline = createWalletRecipeTimeline(input);
    } catch (error) {
      this.fail(toPlayerError(error, 'invalid_input'));
      return;
    }
    this.update({ ...IDLE_WALLET_RECIPE_SNAPSHOT, state: 'loading', durationMs: timeline.durationMs,
      currentIndex: 0, currentKey: input.recipe[0], totalUniqueCount: timeline.uniqueKeys.length });
    try {
      const resources = new ProgressiveRecipeResources(
        input, timeline, this.fetcher, this.abortController.signal,
      );
      await resources.loadInitial(
        (loadedUniqueCount) => {
          if (generation === this.generation) this.update({ loadedUniqueCount });
        },
      );
      if (generation !== this.generation) return;
      this.resources = resources;
      this.input = input;
      this.timeline = timeline;
      this.update({
        state: 'ready', errorKind: null, errorMessage: null,
        initialLoadMs: Math.round(performance.now() - loadStartedAt),
      });
      performance.mark('p15:recipe-initial-window-ready');
      void this.loadRemaining(resources, generation);
    } catch (error) {
      if (generation !== this.generation || this.abortController.signal.aborted) return;
      this.fail(toPlayerError(error, 'network'));
    }
  }

  private async loadRemaining(
    resources: ProgressiveRecipeResources, generation: number,
  ): Promise<void> {
    try {
      await resources.loadRemaining(
        (loaded) => {
          if (generation === this.generation) this.update({ loadedUniqueCount: loaded });
        },
        async () => {
          if (generation !== this.generation || !this.context || !this.clock) return;
          await this.decodeMissing(resources, generation);
        },
      );
      if (generation !== this.generation) return;
      performance.mark('p15:recipe-all-resources-ready');
    } catch (error) {
      if (generation !== this.generation || this.abortController?.signal.aborted) return;
      this.fail(toPlayerError(error, 'network'));
    }
  }

  private async decodeMissing(resources: ProgressiveRecipeResources,
    generation: number): Promise<void> {
    if (!this.context) return;
    await resources.decodeMissing(this.context, (elapsed) => {
      if (generation !== this.generation) return;
      this.update({ decodeMs: (this.snapshot.decodeMs ?? 0) + elapsed });
      this.clock?.addAvailable();
    });
  }
  async play(): Promise<void> {
    if (!this.timeline || !this.input || !['ready', 'paused', 'ended', 'error'].includes(this.snapshot.state)) return;
    const positionMs = this.snapshot.state === 'ended' ? 0 : this.snapshot.positionMs;
    const generation = this.generation;
    const intentAt = performance.now();
    performance.mark('p15:recipe-audio-intent');
    this.update({ state: 'loading', errorKind: null, errorMessage: null });
    try {
      const context = this.context ?? this.createContext();
      this.context = context;
      const resume = context.state === 'running' ? Promise.resolve() : context.resume();
      await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0));
      const decodeMs = await this.resources!.decodeInitial(context);
      await resume;
      if (generation !== this.generation) return;
      if (decodeMs > 0) this.update({ decodeMs: (this.snapshot.decodeMs ?? 0) + decodeMs });
      this.clock ??= new RecipePlaybackClock(
        context, this.timeline, this.resources!, this.requestFrame, this.cancelFrame,
        (position, state) => this.updatePosition(position, state),
      );
      const startDelayMs = this.clock.start(positionMs);
      this.update({ firstSoundExpectedMs: Math.round(performance.now() - intentAt + startDelayMs) });
      performance.mark('p15:recipe-first-sound-scheduled');
      void this.decodeMissing(this.resources!, generation).catch((error: unknown) => {
        if (generation === this.generation) this.fail(toPlayerError(error, 'decode'));
      });
    } catch (error) {
      if (generation !== this.generation) return;
      this.fail(toPlayerError(error, 'decode'));
    }
  }
  private updatePosition(positionMs: number, state: 'playing' | 'paused' | 'ended'): void {
    const segment = segmentAtPosition(this.timeline!, positionMs);
    this.update({ state, positionMs, currentIndex: segment?.index ?? null,
      currentKey: segment?.key ?? null, errorKind: null, errorMessage: null });
  }

  pause(): void {
    if (this.snapshot.state !== 'playing') return;
    this.clock?.pause();
  }

  async resume(): Promise<void> {
    if (this.snapshot.state === 'paused') await this.play();
  }

  async replay(): Promise<void> {
    if (!this.timeline) return;
    this.clock?.stop();
    this.updatePosition(0, 'paused');
    await this.play();
  }

  private fail(error: PlayerError): void {
    this.clock?.stop();
    this.update({ state: 'error', errorKind: error.kind, errorMessage: error.message });
  }

  private async releaseAudio(): Promise<void> {
    this.clock?.stop();
    this.clock = null;
    const context = this.context;
    this.context = null;
    this.resources?.clearDecoded();
    if (context && context.state !== 'closed') await context.close();
  }

  async destroy(): Promise<void> {
    ++this.generation;
    this.abortController?.abort();
    this.abortController = null;
    this.input = null;
    this.timeline = null;
    this.resources = null;
    await this.releaseAudio();
    this.update({ ...IDLE_WALLET_RECIPE_SNAPSHOT });
  }
}
