import { scheduleAudioSegment, stopAudioNode, type ActiveAudioNode } from './audio-schedule';
import { ProgressiveRecipeResources } from './progressive-resources';
import type { WalletRecipeTimeline } from './timeline';

const START_DELAY_SECONDS = 0.06;

/** 只由 AudioContext 时钟驱动；晚到的已校验 buffer 会接入尚未结束的时间线。 */
export class RecipePlaybackClock {
  private nodes = new Set<ActiveAudioNode>();
  private scheduledIndices = new Set<number>();
  private frame = 0;
  private anchorTime = 0;
  private startPositionMs = 0;
  private lastUiPositionMs = -Infinity;
  private running = false;

  constructor(
    private readonly context: AudioContext,
    private readonly timeline: WalletRecipeTimeline,
    private readonly resources: ProgressiveRecipeResources,
    private readonly requestFrame: (callback: FrameRequestCallback) => number,
    private readonly cancelFrame: (handle: number) => void,
    private readonly onPosition: (
      positionMs: number,
      state: 'playing' | 'paused' | 'ended',
    ) => void,
  ) {}

  start(positionMs: number): number {
    this.stop();
    this.running = true;
    this.startPositionMs = positionMs;
    this.anchorTime = this.context.currentTime + START_DELAY_SECONDS;
    this.scheduleAvailable(positionMs);
    this.lastUiPositionMs = -Infinity;
    this.onPosition(positionMs, 'playing');
    this.frame = this.requestFrame(this.tick);
    return START_DELAY_SECONDS * 1000;
  }

  addAvailable(): void {
    if (this.running) this.scheduleAvailable(this.currentPositionMs());
  }

  pause(): number {
    const positionMs = this.currentPositionMs();
    this.stop();
    this.onPosition(positionMs, 'paused');
    return positionMs;
  }

  stop(): void {
    this.running = false;
    if (this.frame) this.cancelFrame(this.frame);
    this.frame = 0;
    this.nodes.forEach(stopAudioNode);
    this.nodes.clear();
    this.scheduledIndices.clear();
  }

  private scheduleAvailable(positionMs: number): void {
    for (const segment of this.timeline.segments) {
      if (this.scheduledIndices.has(segment.index)) continue;
      const buffer = this.resources.buffer(segment.key);
      if (!buffer) continue;
      const node = scheduleAudioSegment(
        this.context, buffer, segment, positionMs, this.anchorTime,
        (ended) => this.releaseEndedNode(ended),
      );
      this.scheduledIndices.add(segment.index);
      if (node) this.nodes.add(node);
    }
  }

  private currentPositionMs(): number {
    const elapsedMs = Math.max(0, (this.context.currentTime - this.anchorTime) * 1000);
    return Math.min(this.timeline.durationMs, this.startPositionMs + elapsedMs);
  }

  private tick = (): void => {
    const positionMs = this.currentPositionMs();
    if (positionMs - this.lastUiPositionMs >= 50 || positionMs >= this.timeline.durationMs) {
      this.onPosition(positionMs, positionMs >= this.timeline.durationMs ? 'ended' : 'playing');
      this.lastUiPositionMs = positionMs;
    }
    if (positionMs >= this.timeline.durationMs) {
      this.stop();
      return;
    }
    this.frame = this.requestFrame(this.tick);
  };

  private releaseEndedNode(node: ActiveAudioNode): void {
    this.nodes.delete(node);
    node.source.disconnect();
    node.gain.disconnect();
  }
}

