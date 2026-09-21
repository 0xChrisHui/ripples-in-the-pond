import { ScoreP9Session } from './score-p9-session';
import type { ScorePlaybackResources } from './types';

type Options = Readonly<{
  context: AudioContext;
  resources: ScorePlaybackResources;
  baseBuffer: AudioBuffer;
  soundBuffers: Readonly<Record<string, AudioBuffer>>;
  durationMs: number;
  onProgress: (positionMs: number, activeKeys: readonly string[]) => void;
  onBuffering: (positionMs: number) => void;
  onEnded: () => void;
}>;

/** 单次播放时钟与所有 AudioBufferSource 共生，暂停/离页时统一销毁。 */
export class ScoreTimelineSession {
  private readonly sources = new Set<AudioBufferSourceNode>();
  private p9 = new ScoreP9Session();
  private raf = 0;
  private startedAt = 0;
  private startOffsetMs = 0;
  private lastSnapshotAt = 0;
  private readonly buffers: Record<string, AudioBuffer>;
  private readonly scheduledEvents = new Set<number>();
  constructor(private readonly options: Options) {
    this.buffers = { ...options.soundBuffers };
  }

  start(offsetMs: number): void {
    const { context, resources, baseBuffer } = this.options;
    const when = context.currentTime + 0.06;
    this.stopSources();
    this.p9.destroy();
    this.p9 = new ScoreP9Session();
    this.p9.start(resources.events, offsetMs);
    if (offsetMs < baseBuffer.duration * 1000) this.startSource(baseBuffer, when, offsetMs / 1000);
    this.scheduleEvents(offsetMs, when);
    this.startedAt = when;
    this.startOffsetMs = offsetMs;
    this.lastSnapshotAt = 0;
    this.raf = requestAnimationFrame(this.tick);
  }

  private scheduleEvents(positionMs: number, when: number): void {
    this.options.resources.events.forEach((event, index) => {
      if (this.scheduledEvents.has(index)) return;
      const buffer = this.buffers[event.key];
      if (!buffer || event.time + buffer.duration * 1000 <= positionMs) return;
      const tailOffset = Math.max(0, (positionMs - event.time) / 1000);
      this.startSource(buffer, when + Math.max(0, event.time - positionMs) / 1000, tailOffset);
      this.scheduledEvents.add(index);
    });
  }

  addSoundBuffers(buffers: Readonly<Record<string, AudioBuffer>>): void {
    Object.assign(this.buffers, buffers);
    this.scheduleEvents(this.position(), this.options.context.currentTime);
  }

  private startSource(buffer: AudioBuffer, when: number, offset = 0): void {
    const source = this.options.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.options.context.destination);
    source.addEventListener('ended', () => this.sources.delete(source), { once: true });
    source.start(when, offset);
    this.sources.add(source);
  }

  position(): number {
    return Math.min(this.options.durationMs, Math.max(
      this.startOffsetMs,
      this.startOffsetMs + (this.options.context.currentTime - this.startedAt) * 1000,
    ));
  }

  private tick = (): void => {
    const positionMs = this.position();
    const blocked = this.options.resources.events.some((event, index) => (
      !this.scheduledEvents.has(index) && !this.buffers[event.key]
      && event.time >= positionMs && event.time - positionMs <= 250
    ));
    if (blocked) {
      this.options.onBuffering(positionMs);
      return;
    }
    this.p9.advance(positionMs);
    if (positionMs - this.lastSnapshotAt >= 50 || positionMs >= this.options.durationMs) {
      const activeKeys = this.options.resources.events
        .filter((event) => event.time <= positionMs && event.time + event.duration > positionMs)
        .map((event) => event.key);
      this.lastSnapshotAt = positionMs;
      this.options.onProgress(Math.round(positionMs), [...new Set(activeKeys)]);
    }
    if (positionMs >= this.options.durationMs) {
      this.destroy();
      this.options.onEnded();
      return;
    }
    this.raf = requestAnimationFrame(this.tick);
  };

  pause(): number {
    const position = this.position();
    this.destroy();
    return position;
  }

  private stopSources(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.sources.forEach((source) => { try { source.stop(); } catch { /* 已自然结束 */ } });
    this.sources.clear();
  }

  destroy(): void {
    this.stopSources();
    this.p9.destroy();
  }
}
