import type { ScorePlaybackManifest } from '@/src/types/jam';
import { ScoreP9Session, getScoreP9EndMs } from './score-p9-session';
import { fetchPermanentBytes, fetchPermanentJson, parseSoundsMap } from './sounds-map';
import type {
  ScorePlaybackController,
  ScorePlaybackListener,
  ScorePlaybackResources,
  ScorePlaybackSnapshot,
} from './types';
import { normalizeScoreEvents } from './types';
const INITIAL_SNAPSHOT: ScorePlaybackSnapshot = Object.freeze({
  state: 'loading', positionMs: 0, durationMs: 0, activeKeys: [], errorMessage: null,
});
type EngineOptions = {
  fetcher?: typeof fetch;
  createAudioContext?: () => AudioContext;
};
function safeMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Score 播放资源暂时不可用';
}
export class ScorePlaybackEngine implements ScorePlaybackController {
  private readonly fetcher: typeof fetch;
  private readonly createContext: () => AudioContext;
  private snapshot = INITIAL_SNAPSHOT;
  private listeners = new Set<ScorePlaybackListener>();
  private resources: ScorePlaybackResources | null = null;
  private context: AudioContext | null = null;
  private baseBuffer: AudioBuffer | null = null;
  private soundBuffers: Record<string, AudioBuffer> = {};
  private sources = new Set<AudioBufferSourceNode>();
  private p9 = new ScoreP9Session();
  private abortController: AbortController | null = null;
  private generation = 0;
  private raf = 0;
  private startedAt = 0;
  private startOffsetMs = 0;
  private lastSnapshotAt = 0;
  constructor(options: EngineOptions = {}) {
    this.fetcher = options.fetcher ?? fetch;
    this.createContext = options.createAudioContext ?? (() => new AudioContext());
  }
  getSnapshot = (): ScorePlaybackSnapshot => this.snapshot;
  subscribe = (listener: ScorePlaybackListener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private update(patch: Partial<ScorePlaybackSnapshot>): void {
    this.snapshot = Object.freeze({ ...this.snapshot, ...patch });
    this.listeners.forEach((listener) => listener());
  }
  async load(manifest: ScorePlaybackManifest): Promise<void> {
    const generation = ++this.generation;
    this.abortController?.abort();
    this.abortController = new AbortController();
    await this.releaseAudio();
    this.resources = null;
    this.update({ state: 'loading', positionMs: 0, durationMs: 0, activeKeys: [], errorMessage: null });
    try {
      const signal = this.abortController.signal;
      const [eventsRaw, soundsRaw, baseBytes] = await Promise.all([
        fetchPermanentJson(manifest.eventsRef, this.fetcher, signal),
        fetchPermanentJson(manifest.soundsMapRef, this.fetcher, signal),
        fetchPermanentBytes(manifest.baseAudioRef, this.fetcher, signal),
      ]);
      const events = normalizeScoreEvents(eventsRaw);
      const sounds = parseSoundsMap(soundsRaw);
      const usedKeys = [...new Set(events.map((event) => event.key))];
      const missing = usedKeys.filter((key) => !sounds[key]);
      if (missing.length) throw new Error(`永久音效表缺少事件键：${missing.join('、')}`);
      const soundEntries = await Promise.all(usedKeys.map(async (key) => [
        key,
        await fetchPermanentBytes(`ar://${sounds[key].txId}`, this.fetcher, signal),
      ] as const));
      if (generation !== this.generation) return;
      this.resources = { manifest, events, baseBytes, soundBytes: Object.fromEntries(soundEntries) };
      this.update({ state: 'ready' });
    } catch (error) {
      if (generation !== this.generation || this.abortController.signal.aborted) return;
      this.update({ state: 'error', errorMessage: safeMessage(error) });
    }
  }
  private async ensureDecoded(): Promise<void> {
    if (this.context && this.baseBuffer) return;
    if (!this.resources) throw new Error('Score 播放资源尚未就绪');
    const context = this.context ?? this.createContext();
    this.context = context;
    await context.resume();
    const base = await context.decodeAudioData(this.resources.baseBytes.slice(0));
    const sounds = await Promise.all(Object.entries(this.resources.soundBytes).map(async ([key, bytes]) => [
      key, await context.decodeAudioData(bytes.slice(0)),
    ] as const));
    this.baseBuffer = base;
    this.soundBuffers = Object.fromEntries(sounds);
    const soundEnd = this.resources.events.reduce((end, event) => {
      const duration = this.soundBuffers[event.key]?.duration ?? 0;
      return Math.max(end, event.time + duration * 1000);
    }, 0);
    const durationMs = Math.max(base.duration * 1000, soundEnd, getScoreP9EndMs(this.resources.events));
    this.update({ durationMs: Math.round(durationMs) });
  }
  async play(): Promise<void> {
    if (!this.resources || !['ready', 'paused', 'ended'].includes(this.snapshot.state)) return;
    const generation = this.generation;
    if (this.snapshot.state === 'ended') this.startOffsetMs = 0;
    else this.startOffsetMs = this.snapshot.positionMs;
    this.update({ state: 'loading', errorMessage: null });
    try {
      await this.ensureDecoded();
      if (generation !== this.generation) return;
      if (!this.context || !this.baseBuffer) throw new Error('浏览器无法建立音频会话');
      if (this.context.state !== 'running') await this.context.resume();
      this.schedule(this.startOffsetMs);
    } catch (error) {
      this.update({ state: 'error', activeKeys: [], errorMessage: safeMessage(error) });
    }
  }
  private schedule(offsetMs: number): void {
    const context = this.context!;
    const when = context.currentTime + 0.06;
    this.stopSources();
    this.p9.destroy();
    this.p9 = new ScoreP9Session();
    this.p9.start(this.resources!.events, offsetMs);
    if (offsetMs < this.baseBuffer!.duration * 1000) {
      this.startSource(this.baseBuffer!, when, offsetMs / 1000);
    }
    for (const event of this.resources!.events) {
      const buffer = this.soundBuffers[event.key]; if (!buffer || event.time + buffer.duration * 1000 <= offsetMs) continue;
      const tailOffset = Math.max(0, (offsetMs - event.time) / 1000);
      this.startSource(buffer, when + Math.max(0, event.time - offsetMs) / 1000, tailOffset);
    }
    this.startedAt = when;
    this.startOffsetMs = offsetMs;
    this.lastSnapshotAt = 0;
    this.update({ state: 'playing', positionMs: offsetMs, activeKeys: [] });
    this.raf = requestAnimationFrame(this.tick);
  }
  private startSource(buffer: AudioBuffer, when: number, offset = 0): void {
    const source = this.context!.createBufferSource();
    source.buffer = buffer;
    source.connect(this.context!.destination);
    source.addEventListener('ended', () => this.sources.delete(source), { once: true });
    source.start(when, offset);
    this.sources.add(source);
  }
  private currentPosition(): number {
    if (!this.context) return this.snapshot.positionMs;
    return Math.min(this.snapshot.durationMs, Math.max(
      this.startOffsetMs,
      this.startOffsetMs + (this.context.currentTime - this.startedAt) * 1000,
    ));
  }
  private tick = (): void => {
    const positionMs = this.currentPosition();
    this.p9.advance(positionMs);
    if (positionMs - this.lastSnapshotAt >= 50 || positionMs >= this.snapshot.durationMs) {
      const activeKeys = this.resources!.events
        .filter((event) => event.time <= positionMs && event.time + event.duration > positionMs)
        .map((event) => event.key);
      this.lastSnapshotAt = positionMs;
      this.update({ positionMs: Math.round(positionMs), activeKeys: [...new Set(activeKeys)] });
    }
    if (positionMs >= this.snapshot.durationMs) {
      this.stopSources();
      this.p9.destroy();
      this.update({ state: 'ended', positionMs: this.snapshot.durationMs, activeKeys: [] });
      return;
    }
    this.raf = requestAnimationFrame(this.tick);
  };
  pause(): void {
    if (this.snapshot.state !== 'playing') return;
    const positionMs = this.currentPosition();
    this.stopSources();
    this.p9.destroy();
    this.p9 = new ScoreP9Session();
    this.update({ state: 'paused', positionMs: Math.round(positionMs), activeKeys: [] });
  }

  async toggle(): Promise<void> {
    if (this.snapshot.state === 'playing') this.pause();
    else await this.play();
  }

  async replay(): Promise<void> {
    if (!this.resources) return;
    this.stopSources();
    this.p9.destroy();
    this.p9 = new ScoreP9Session();
    this.update({ state: 'ready', positionMs: 0, activeKeys: [], errorMessage: null });
    await this.play();
  }

  private stopSources(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.sources.forEach((source) => { try { source.stop(); } catch { /* 已自然结束 */ } });
    this.sources.clear();
  }

  private async releaseAudio(): Promise<void> {
    this.stopSources();
    this.p9.destroy();
    this.p9 = new ScoreP9Session();
    const context = this.context;
    this.context = null;
    this.baseBuffer = null;
    this.soundBuffers = {};
    if (context && context.state !== 'closed') await context.close();
  }

  async destroy(): Promise<void> {
    ++this.generation;
    this.abortController?.abort();
    this.abortController = null;
    this.resources = null;
    await this.releaseAudio();
    this.update({ ...INITIAL_SNAPSHOT });
  }
}
