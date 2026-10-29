'use client';

import { useEffect, useRef, useState } from 'react';
import { stayDuration, toDisplayLines } from './note-display';
import { getBubbleTuning } from '../bubble-tuning';
import type { NoteLang } from './snippet-split';

/**
 * 一条手记的时间线：逐行淡入 → 停留（paused 时冻结，离开后至少再停 3 秒）→ 淡出 → onDone。
 * 计时全部在 effect / 定时器回调里推进，渲染本身不读时钟、不取随机数。
 */
export function usePondNoteTimeline(text: string, lang: NoteLang, paused: boolean, onDone: () => void) {
  const lines = toDisplayLines(text);
  const [phase, setPhase] = useState<'in' | 'out'>('in');
  const [shown, setShown] = useState(0);
  const stay = useRef<{ left: number; since: number } | null>(null);
  const doneRef = useRef(onDone);
  useEffect(() => { doneRef.current = onDone; }, [onDone]);

  useEffect(() => {
    const ids = lines.map((_, i) => window.setTimeout(() => setShown(i + 1), 200 + i * getBubbleTuning().revealStep));
    return () => ids.forEach(window.clearTimeout);
    // lines 由 text 决定；text 变化 = 新的一条（宿主用 key 重挂），这里只在挂载时排一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase === 'out' || paused) return;
    const s = (stay.current ??= { left: stayDuration(text, lang, lines.length, Math.random(), getBubbleTuning()), since: 0 });
    s.since = performance.now();
    const id = window.setTimeout(() => setPhase('out'), s.left);
    return () => {
      window.clearTimeout(id);
      s.left = Math.max(s.left - (performance.now() - s.since), getBubbleTuning().resumeFloor);
    };
  }, [paused, phase, text, lang, lines.length]);

  useEffect(() => {
    if (phase !== 'out') return;
    const id = window.setTimeout(() => doneRef.current(), getBubbleTuning().fadeMs);
    return () => window.clearTimeout(id);
  }, [phase]);

  return { lines, shown, phase, dismiss: () => setPhase('out') };
}
