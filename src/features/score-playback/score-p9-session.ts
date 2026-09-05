import type { KeyEvent } from '@/src/types/jam';
import { findP9Effect } from '@/src/components/pond-gl-test3/p9/registry';
import {
  resetP9Runtime,
  triggerP9Effect,
} from '@/src/components/pond-gl-test3/p9/runtime/p9-state';
import { loadP9Tuning } from '@/src/components/pond-gl-test3/p9/tuning/p9-tuning-store';

export type ScoreP9Coverage = Readonly<{
  eventCount: number;
  keyCount: number;
  unmappedCount: number;
}>;

function mappedTimeline(events: readonly KeyEvent[]): KeyEvent[] {
  return events
    .filter((event) => findP9Effect(event.key) !== null)
    .sort((a, b) => a.time - b.time);
}

export function getScoreP9Coverage(events: readonly KeyEvent[]): ScoreP9Coverage {
  const mapped = mappedTimeline(events);
  return {
    eventCount: mapped.length,
    keyCount: new Set(mapped.map((event) => event.key.toLowerCase())).size,
    unmappedCount: events.length - mapped.length,
  };
}

/** 画面保持 playing，直到最后一个 P9 行为家族完成自己的余韵。 */
export function getScoreP9EndMs(events: readonly KeyEvent[]): number {
  return mappedTimeline(events).reduce((end, event) => {
    const effect = findP9Effect(event.key);
    return effect ? Math.max(end, event.time + effect.duration * 1000) : end;
  }, 0);
}

export class ScoreP9Session {
  private timeline: KeyEvent[] = [];
  private resumePending: KeyEvent[] = [];
  private cursor = 0;
  private running = false;
  private destroyed = false;

  start(events: readonly KeyEvent[], offsetMs: number): void {
    loadP9Tuning();
    this.timeline = mappedTimeline(events);
    this.resumePending = this.timeline.filter((event) => {
      const effect = findP9Effect(event.key);
      return offsetMs > event.time && effect !== null && offsetMs < event.time + effect.duration * 1000;
    });
    this.cursor = this.timeline.findIndex((event) => (
      offsetMs <= 0 ? event.time >= 0 : event.time > offsetMs
    ));
    if (this.cursor < 0) this.cursor = this.timeline.length;
    this.running = true;
    this.destroyed = false;
  }

  advance(positionMs: number): void {
    if (!this.running || this.destroyed) return;
    this.resumePending = this.resumePending.filter((event) => (
      triggerP9Effect(event.key, (positionMs - event.time) / 1000)?.reason === 'no-eclipse'
    ));
    while (this.cursor < this.timeline.length && this.timeline[this.cursor].time <= positionMs) {
      triggerP9Effect(this.timeline[this.cursor].key);
      this.cursor += 1;
    }
  }

  /** pause/replay/路由卸载都销毁旧 session；resume 会建立新 session 和新游标。 */
  destroy(): void {
    if (this.destroyed) return;
    this.running = false;
    this.timeline = [];
    this.resumePending = [];
    this.cursor = 0;
    this.destroyed = true;
    resetP9Runtime();
  }
}
