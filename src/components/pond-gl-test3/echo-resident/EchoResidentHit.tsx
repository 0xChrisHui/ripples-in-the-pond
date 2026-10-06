'use client';

import { useEffect, useRef } from 'react';
import type { ResidentEchoCommand, ResidentEchoPlayback, ResidentEchoRuntime } from '../../../types/echo-resident';
import { createResidentGesture } from './state/gesture';

const PLAY_PATH = 'M-4.5,-6 L7,0 L-4.5,6 Z';
const PAUSE_PATH = 'M-5.5,-6 L-2,-6 L-2,6 L-5.5,6 Z M0.5,-6 L4,-6 L4,6 L0.5,6 Z';

type Props = {
  runtime: ResidentEchoRuntime;
  getPlayback: () => ResidentEchoPlayback;
  execute: (command: ResidentEchoCommand) => void | Promise<void>;
};
/** 命中层沿用普通圆的8px拖动阈值与播放提示；几何全部来自同一runtime。 */
export function EchoResidentHit({ runtime, getPlayback, execute }: Props) {
  const button = useRef<HTMLButtonElement>(null);
  const feedback = useRef<HTMLSpanElement>(null);
  const icon = useRef<SVGSVGElement>(null), iconPath = useRef<SVGPathElement>(null);
  const gesture = useRef<ReturnType<typeof createResidentGesture> | null>(null);
  useEffect(() => {
    const activeGesture = createResidentGesture(runtime, getPlayback, execute);
    gesture.current = activeGesture;
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
      el.setAttribute('aria-pressed', String(state === 'playing'));
      el.setAttribute('aria-label', `${state === 'playing' ? '暂停' : state === 'paused' ? '继续播放' : state === 'error' || snapshot.commandError ? '重试播放' : '播放'} ECHO #1（第36枚音乐圆圈）`);
      if (icon.current) icon.current.style.opacity = String(
        snapshot.interaction.hovered || state === 'playing' ? p.effectivePresence : 0);
      iconPath.current?.setAttribute('d', state === 'playing' ? PAUSE_PATH : PLAY_PATH);
      if (!p.interactive) activeGesture.cancel();
      if (feedback.current && feedback.current.textContent !== (snapshot.commandError ?? '')) {
        feedback.current.textContent = snapshot.commandError ?? '';
      }
    };
    sync();
    const unsubscribe = runtime.subscribe(sync);
    return () => { unsubscribe(); activeGesture.cancel(); gesture.current = null; };
  }, [runtime, getPlayback, execute]);
  return <>
    <button ref={button} type="button" aria-label="播放 ECHO #1（第36枚音乐圆圈）"
      aria-hidden="true" tabIndex={-1}
      className="fixed z-20 rounded-full border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
      style={{ pointerEvents: 'none', visibility: 'hidden', touchAction: 'none', cursor: 'pointer' }}
      onPointerEnter={(event) => { if (event.pointerType !== 'touch') runtime.setInteraction({ hovered: true }); }}
      onPointerLeave={() => runtime.setInteraction({ hovered: false })}
      onFocus={(event) => runtime.setInteraction({ focused: event.currentTarget.matches(':focus-visible') })}
      onBlur={() => { gesture.current?.cancel(); runtime.setInteraction({ focused: false }); }}
      onPointerDown={(event) => {
        if (event.button === 0 && gesture.current?.begin(event.pointerId, { x: event.clientX, y: event.clientY })) {
          event.currentTarget.setPointerCapture(event.pointerId);
        }
      }}
      onPointerMove={(event) => gesture.current?.move(event.pointerId, { x: event.clientX, y: event.clientY })}
      onPointerUp={(event) => {
        const activated = gesture.current?.end(event.pointerId);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        if (activated) event.currentTarget.blur();
      }}
      onPointerCancel={() => gesture.current?.cancel()} onLostPointerCapture={() => gesture.current?.cancel()}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        if (!event.repeat) gesture.current?.activate();
      }}
      onClick={(event) => { if (event.detail === 0) gesture.current?.activate(); }}>
      <svg ref={icon} width={26} height={26} viewBox="-13 -13 26 26" aria-hidden="true"
        style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
          opacity: 0, pointerEvents: 'none', transition: 'opacity 0.2s ease' }}>
        <circle r={13} fill="rgba(0,0,0,0.55)" stroke="rgba(255,255,255,0.22)" strokeWidth={1} />
        <path ref={iconPath} d={PLAY_PATH} fill="white" />
      </svg>
    </button>
    <span ref={feedback} className="sr-only" role="status" aria-live="polite" />
  </>;
}
