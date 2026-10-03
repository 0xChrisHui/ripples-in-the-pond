export type ScoreVisualPhase = 'idle' | 'entering' | 'active' | 'exiting';
export const SCORE_ENTER_MS = 450;
export const SCORE_EXIT_MS = 650;
type Scheduler = { later: (callback: () => void, ms: number) => unknown; cancel: (handle: unknown) => void };

/** 展示生命周期独立于音频；序号防止已取消的退出回调清掉重播。 */
export function createScoreVisualTransition(scheduler: Scheduler = {
  later: (callback, ms) => setTimeout(callback, ms),
  cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}) {
  let phase: ScoreVisualPhase = 'idle';
  let timer: unknown;
  let generation = 0;
  let durationMs = SCORE_ENTER_MS;
  const listeners = new Set<() => void>();
  const publish = (next: ScoreVisualPhase) => {
    phase = next;
    listeners.forEach((listener) => listener());
  };
  const cancel = () => {
    generation += 1;
    scheduler.cancel(timer);
    timer = undefined;
  };
  const complete = (expected: ScoreVisualPhase) => {
    if (phase !== expected || (expected !== 'entering' && expected !== 'exiting')) return;
    cancel();
    publish(expected === 'exiting' ? 'idle' : 'active');
  };
  return {
    getSnapshot: () => phase,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    setPlaying(playing: boolean, reduced = false) {
      if (playing === (phase === 'entering' || phase === 'active')) {
        if (!reduced || phase === 'idle' || phase === 'active') return;
      }
      cancel();
      if (!playing && phase === 'idle') return;
      durationMs = reduced ? 0 : playing ? SCORE_ENTER_MS : SCORE_EXIT_MS;
      if (reduced) { publish(playing ? 'active' : 'idle'); return; }
      const next = playing ? 'entering' : 'exiting';
      publish(next);
      const token = generation;
      timer = scheduler.later(() => { if (token === generation) complete(next); }, durationMs + 80);
    },
    onOpacityEnd(expected: ScoreVisualPhase) { complete(expected); },
    getDurationMs: () => durationMs,
    dispose() { cancel(); phase = 'idle'; },
  };
}

export function scoreVisualPresence(from: number, target: number, elapsedMs: number, durationMs: number): number {
  if (durationMs <= 0) return target;
  const progress = Math.min(1, Math.max(0, elapsedMs / durationMs));
  return from + (target - from) * (1 - (1 - progress) ** 3);
}
