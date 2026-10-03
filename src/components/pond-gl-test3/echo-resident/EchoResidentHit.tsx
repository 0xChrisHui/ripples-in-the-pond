'use client';

import { useEffect, useRef } from 'react';
import type { ResidentEchoCommand, ResidentEchoPlayback, ResidentEchoRuntime } from '../../../types/echo-resident';

type Props = {
  runtime: ResidentEchoRuntime;
  getPlayback: () => ResidentEchoPlayback;
  execute: (command: ResidentEchoCommand) => void | Promise<void>;
};
/** 原生按钮负责 click/Enter/Space；不绑定第二份 keydown，也不引入 d3 拖拽。 */
export function EchoResidentHit({ runtime, getPlayback, execute }: Props) {
  const button = useRef<HTMLButtonElement>(null);
  const feedback = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const sync = () => {
      const el = button.current;
      if (!el) return;
      const snapshot = runtime.getSnapshot(), p = snapshot.pose;
      el.dataset.instanceId = p.instanceId; el.dataset.frameId = String(p.frameId);
      el.dataset.phase = snapshot.phase; el.dataset.presence = String(p.effectivePresence);
      el.dataset.sizeClamped = String(p.sizeClamped);
      el.style.left = `${p.sx - p.bodyRadiusPx}px`;
      el.style.top = `${p.sy - p.bodyRadiusPx}px`;
      el.style.width = `${p.bodyRadiusPx * 2}px`;
      el.style.height = `${p.bodyRadiusPx * 2}px`;
      el.style.pointerEvents = p.interactive ? 'auto' : 'none';
      el.style.visibility = p.interactive ? 'visible' : 'hidden';
      el.tabIndex = p.tabbable ? 0 : -1;
      // 当前主动焦点不设 aria-hidden；浏览器在失效/卸载后按原生行为移除焦点。
      el.setAttribute('aria-hidden', String(!p.interactive && document.activeElement !== el));
      el.setAttribute('aria-busy', String(snapshot.commandPending));
      el.setAttribute('aria-disabled', String(snapshot.commandPending));
      const state = getPlayback();
      el.setAttribute('aria-label', `${state === 'playing' ? '暂停' : state === 'paused' ? '继续播放' : state === 'error' || snapshot.commandError ? '重试播放' : '播放'} ECHO #1（第36枚音乐圆圈）`);
      if (feedback.current && feedback.current.textContent !== (snapshot.commandError ?? '')) {
        feedback.current.textContent = snapshot.commandError ?? '';
      }
    };
    sync(); return runtime.subscribe(sync);
  }, [runtime, getPlayback]);
  const releasePointer = () => runtime.setInteraction({ pointerDown: false });
  return <>
    <button ref={button} type="button" aria-label="播放 ECHO #1（第36枚音乐圆圈）"
      aria-hidden="true" tabIndex={-1}
      className="fixed z-20 rounded-full border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
      style={{ pointerEvents: 'none', visibility: 'hidden', touchAction: 'manipulation' }}
      onPointerEnter={() => runtime.setInteraction({ hovered: true })}
      onPointerLeave={() => runtime.setInteraction({ hovered: false, pointerDown: false })}
      onFocus={() => runtime.setInteraction({ focused: true })}
      onBlur={() => runtime.setInteraction({ focused: false, pointerDown: false })}
      onPointerDown={(event) => {
        runtime.setInteraction({ pointerDown: true });
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerUp={releasePointer} onPointerCancel={releasePointer} onLostPointerCapture={releasePointer}
      onClick={() => {
        const state = getPlayback();
        const command = state === 'playing' ? 'pause' : state === 'paused' ? 'resume'
          : state === 'error' || runtime.getSnapshot().commandError ? 'retry' : 'play';
        void runtime.request(command, execute);
      }} />
    <span ref={feedback} className="sr-only" role="status" aria-live="polite" />
  </>;
}
