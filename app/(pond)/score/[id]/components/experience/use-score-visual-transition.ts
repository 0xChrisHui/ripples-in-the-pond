import { useEffect, useRef, useState, useSyncExternalStore, type TransitionEvent } from 'react';
import { createScoreVisualTransition, scoreVisualPresence, SCORE_ENTER_MS, SCORE_EXIT_MS } from './visual-transition';

/** 视觉 ref 与 opacity 接受同一播放事件；不创建音频或改写全局播放焦点。 */
export function useScoreVisualTransition(playing: boolean, reduced: boolean) {
  const [transition] = useState(createScoreVisualTransition);
  const phase = useSyncExternalStore(transition.subscribe, transition.getSnapshot, () => 'idle' as const);
  const presence = useRef(0);
  const durationMs = reduced ? 0 : playing ? SCORE_ENTER_MS : SCORE_EXIT_MS;
  useEffect(() => {
    transition.setPlaying(playing, reduced);
    const from = presence.current;
    const target = playing ? 1 : 0;
    if (durationMs === 0) { presence.current = target; return; }
    const startedAt = performance.now();
    let frame = 0;
    const advance = (now: number) => {
      presence.current = scoreVisualPresence(from, target, now - startedAt, durationMs);
      if (now - startedAt < durationMs) frame = requestAnimationFrame(advance);
    };
    frame = requestAnimationFrame(advance);
    return () => cancelAnimationFrame(frame);
  }, [playing, reduced, durationMs, transition]);
  useEffect(() => () => { transition.dispose(); presence.current = 0; }, [transition]);
  return {
    phase, presence, durationMs,
    onTransitionEnd(event: TransitionEvent<HTMLElement>) {
      if (event.propertyName === 'opacity' && event.target === event.currentTarget.firstElementChild) transition.onOpacityEnd(phase);
    },
  };
}
