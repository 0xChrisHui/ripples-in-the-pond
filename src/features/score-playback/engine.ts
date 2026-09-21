import type { ScorePlaybackManifest } from '@/src/types/jam';
import { decodeScoreAudio, decodeScoreEffects, decodeScoreSounds } from './audio-decode';
import { loadScoreResources, scoreStreamingBaseUrl } from './resource-loader';
import { HtmlScoreBaseStream, type ScoreBaseStream } from './streaming/stream-base';
import { ScoreTimelineSession } from './timeline-session';
import type { ScorePlaybackController, ScorePlaybackListener, ScorePlaybackResources, ScorePlaybackSnapshot } from './types';
const INITIAL_SNAPSHOT: ScorePlaybackSnapshot = Object.freeze({
  state: 'loading', positionMs: 0, durationMs: 0, activeKeys: [], errorMessage: null, playRequested: false, resourceLoadMs: null, decodeMs: null, firstSoundExpectedMs: null,
});
type StreamFactory = (url: string, onFailure: () => void) => ScoreBaseStream;
type EngineOptions = { fetcher?: typeof fetch; createAudioContext?: () => AudioContext; createBaseStream?: StreamFactory };
const safeMessage = (error: unknown): string => error instanceof Error ? error.message : 'Score 播放资源暂时不可用';
export class ScorePlaybackEngine implements ScorePlaybackController {
  private readonly fetcher: typeof fetch;
  private readonly createContext: () => AudioContext;
  private readonly createStream: StreamFactory;
  private snapshot = INITIAL_SNAPSHOT;
  private listeners = new Set<ScorePlaybackListener>();
  private resources: ScorePlaybackResources | null = null;
  private context: AudioContext | null = null;
  private baseBuffer: AudioBuffer | null = null;
  private soundBuffers: Record<string, AudioBuffer> = {};
  private stream: ScoreBaseStream | null = null;
  private streamingUrl: string | null = null;
  private decoded = false;
  private timeline: ScoreTimelineSession | null = null;
  private abortController: AbortController | null = null;
  private generation = 0;
  private startOffsetMs = 0;
  private pendingIntentAt: number | null = null;
  constructor(options: EngineOptions = {}) {
    this.fetcher = options.fetcher ?? fetch;
    this.createContext = options.createAudioContext ?? (() => new AudioContext());
    this.createStream = options.createBaseStream ?? ((url, onFailure) => new HtmlScoreBaseStream(url, onFailure));
  }
  getSnapshot = (): ScorePlaybackSnapshot => this.snapshot;
  subscribe = (listener: ScorePlaybackListener): (() => void) => {
    this.listeners.add(listener); return () => this.listeners.delete(listener);
  };
  private update(patch: Partial<ScorePlaybackSnapshot>): void {
    this.snapshot = Object.freeze({ ...this.snapshot, ...patch });
    this.listeners.forEach((listener) => listener());
  }
  async load(manifest: ScorePlaybackManifest): Promise<void> {
    const loadStartedAt = performance.now(); const generation = ++this.generation;
    this.abortController?.abort(); this.abortController = new AbortController();
    const released = this.releaseAudio();
    this.resources = null; this.streamingUrl = scoreStreamingBaseUrl(manifest);
    this.ensureStream()?.prime();
    this.update({ ...INITIAL_SNAPSHOT }); await released;
    try {
      const resources = await loadScoreResources(manifest, this.fetcher, this.abortController.signal);
      if (generation !== this.generation) return;
      this.resources = resources; void this.hydrateBackground(resources, generation);
      this.update({ state: this.pendingIntentAt == null ? 'ready' : 'loading',
        resourceLoadMs: Math.round(performance.now() - loadStartedAt) });
      performance.mark('p15:score-resources-ready');
      if (this.pendingIntentAt != null) await this.beginPlayback(this.pendingIntentAt, generation);
    } catch (error) {
      if (generation !== this.generation || this.abortController.signal.aborted) return;
      this.failPlayback(error);
    }
  }
  private async hydrateBackground(resources: ScorePlaybackResources, generation: number): Promise<void> {
    if (!resources.backgroundSoundBytes) return;
    try {
      const bytes = await resources.backgroundSoundBytes;
      if (generation !== this.generation) return;
      this.resources = { ...resources, soundBytes: { ...resources.soundBytes, ...bytes },
        backgroundSoundBytes: undefined };
      performance.mark('p15:score-all-resources-ready');
      if (!this.context || !this.decoded) return;
      const decoded = await decodeScoreSounds(this.context, bytes);
      if (generation !== this.generation) return;
      Object.assign(this.soundBuffers, decoded); this.timeline?.addSoundBuffers(decoded);
      if (this.pendingIntentAt != null && this.snapshot.positionMs > 0) {
        await this.beginPlayback(this.pendingIntentAt, generation);
      }
    } catch (error) {
      if (generation === this.generation && !this.abortController?.signal.aborted) this.failPlayback(error);
    }
  }
  private async ensureDecoded(): Promise<void> {
    if (!this.resources) throw new Error('Score 播放资源尚未就绪');
    if (!this.stream && !this.resources.baseBytes) await this.fallbackToVerifiedBase();
    const context = await this.resumeContext(); const decodeStartedAt = performance.now();
    if (!this.decoded) {
      if (this.stream) {
        const decoded = await decodeScoreEffects(context, this.resources);
        this.soundBuffers = decoded.sounds; this.update({ durationMs: decoded.durationMs });
      } else {
        const decoded = await decodeScoreAudio(context, this.resources);
        this.baseBuffer = decoded.base; this.soundBuffers = decoded.sounds;
        this.update({ durationMs: decoded.durationMs });
      }
      this.decoded = true;
    }
    const missing = Object.fromEntries(Object.entries(this.resources.soundBytes)
      .filter(([key]) => !this.soundBuffers[key]));
    Object.assign(this.soundBuffers, await decodeScoreSounds(context, missing));
    this.update({ decodeMs: Math.round(performance.now() - decodeStartedAt) });
    performance.mark('p15:score-decoded');
  }
  private async resumeContext(): Promise<AudioContext> {
    const context = this.context ?? this.createContext(); this.context = context;
    if (context.state !== 'running') await context.resume(); return context;
  }
  private ensureStream(): ScoreBaseStream | null {
    if (!this.stream && this.streamingUrl) {
      this.stream = this.createStream(this.streamingUrl, () => { void this.recoverStream(); });
    }
    return this.stream;
  }
  async play(): Promise<void> {
    if (['playing', 'error'].includes(this.snapshot.state)) return;
    const previousState = this.snapshot.state; const intentAt = performance.now();
    performance.mark('p15:audio-intent'); this.pendingIntentAt = intentAt;
    this.update({ state: 'loading', playRequested: true, errorMessage: null });
    this.ensureStream()?.prime();
    try { await this.resumeContext(); } catch (error) { this.failPlayback(error); return; }
    if (!this.resources) return;
    this.startOffsetMs = previousState === 'ended' ? 0 : this.snapshot.positionMs;
    await this.beginPlayback(intentAt, this.generation);
  }
  private async beginPlayback(intentAt: number, generation: number): Promise<void> {
    try {
      await this.ensureDecoded();
      if (generation !== this.generation || this.pendingIntentAt !== intentAt) return;
      if (this.stream) {
        try { await this.stream.start(this.startOffsetMs); }
        catch {
          if (generation !== this.generation || this.pendingIntentAt !== intentAt) return;
          await this.fallbackToVerifiedBase(); await this.ensureDecoded();
        }
        const durationMs = Math.max(this.snapshot.durationMs, this.stream?.durationMs() ?? 0);
        this.update({ durationMs: Math.round(durationMs) });
      }
      if (generation !== this.generation || this.pendingIntentAt !== intentAt) return;
      if (!this.context || (!this.baseBuffer && !this.stream)) throw new Error('浏览器无法建立音频会话');
      if (this.context.state !== 'running') await this.context.resume();
      this.schedule(this.startOffsetMs, intentAt);
    } catch (error) { this.failPlayback(error); }
  }
  private async fallbackToVerifiedBase(): Promise<void> {
    const failed = this.stream; this.stream = null; failed?.destroy(); this.streamingUrl = null;
    if (!this.resources?.baseBytes) {
      if (!this.resources?.loadBaseBytes) throw new Error('Score 底曲回退不可用');
      const baseBytes = await this.resources.loadBaseBytes();
      this.resources = { ...this.resources, baseBytes };
    }
    this.baseBuffer = null; this.decoded = false;
  }
  private async recoverStream(): Promise<void> {
    if (this.snapshot.state !== 'playing' || !this.resources || !this.stream) return;
    const generation = this.generation;
    this.startOffsetMs = this.timeline?.pause() ?? this.snapshot.positionMs; this.timeline = null;
    this.pendingIntentAt = performance.now();
    this.update({ state: 'loading', playRequested: true, positionMs: Math.round(this.startOffsetMs) });
    try {
      await this.fallbackToVerifiedBase(); await this.ensureDecoded();
      if (generation === this.generation && this.pendingIntentAt != null) {
        this.schedule(this.startOffsetMs, this.pendingIntentAt);
      }
    } catch (error) { this.failPlayback(error); }
  }
  private failPlayback(error: unknown): void {
    this.timeline?.destroy(); this.timeline = null; const stream = this.stream; this.stream = null;
    stream?.destroy(); this.pendingIntentAt = null;
    this.update({ state: 'error', playRequested: false, activeKeys: [], errorMessage: safeMessage(error) });
  }
  private schedule(offsetMs: number, intentAt: number): void {
    this.timeline?.destroy();
    this.timeline = new ScoreTimelineSession({
      context: this.context!, resources: this.resources!, baseBuffer: this.baseBuffer,
      baseStream: this.stream, soundBuffers: this.soundBuffers, durationMs: this.snapshot.durationMs,
      onProgress: (positionMs, activeKeys) => this.update({ positionMs, activeKeys }),
      onBuffering: (positionMs) => this.waitForBackground(positionMs),
      onEnded: () => this.update({ state: 'ended', positionMs: this.snapshot.durationMs, activeKeys: [] }),
    });
    this.timeline.start(offsetMs); this.startOffsetMs = offsetMs;
    this.update({ state: 'playing', playRequested: false, positionMs: offsetMs, activeKeys: [],
      firstSoundExpectedMs: Math.round(performance.now() - intentAt + (this.stream ? 0 : 60)) });
    this.pendingIntentAt = null; performance.mark('p15:first-sound-scheduled');
  }
  private waitForBackground(positionMs: number): void {
    const frozenAt = this.timeline?.pause() ?? positionMs; this.timeline = null;
    this.startOffsetMs = frozenAt; this.pendingIntentAt = performance.now();
    this.update({ state: 'loading', playRequested: true,
      positionMs: Math.round(frozenAt), activeKeys: [] });
  }
  pause(): void {
    if (this.snapshot.state !== 'playing') return;
    const positionMs = this.timeline?.pause() ?? this.snapshot.positionMs; this.timeline = null;
    this.update({ state: 'paused', positionMs: Math.round(positionMs), activeKeys: [] });
  }
  async toggle(): Promise<void> {
    if (this.snapshot.state === 'playing') this.pause();
    else if (this.snapshot.state === 'loading' && this.snapshot.playRequested) {
      this.pendingIntentAt = null; this.stream?.pause();
      this.update({ state: this.resources ? 'ready' : 'loading', playRequested: false });
      if (this.context?.state === 'running') await this.context.suspend();
    } else await this.play();
  }
  async replay(): Promise<void> {
    if (!this.resources) return;
    this.timeline?.destroy(); this.timeline = null;
    this.update({ state: 'ready', playRequested: false, positionMs: 0, activeKeys: [], errorMessage: null });
    await this.play();
  }
  private async releaseAudio(): Promise<void> {
    this.timeline?.destroy(); this.timeline = null; const stream = this.stream; this.stream = null;
    stream?.destroy(); const context = this.context; this.context = null; this.pendingIntentAt = null;
    this.baseBuffer = null; this.soundBuffers = {}; this.decoded = false;
    if (context && context.state !== 'closed') await context.close();
  }
  async destroy(): Promise<void> {
    ++this.generation; this.abortController?.abort(); this.abortController = null; this.resources = null;
    await this.releaseAudio(); this.update({ ...INITIAL_SNAPSHOT });
  }
}
