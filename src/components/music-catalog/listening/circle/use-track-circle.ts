'use client';
import { useLayoutEffect, useRef, type RefObject } from 'react';
import { advanceEclipseMix, blendEclipseMix, clearPlaybackFocus, resetEclipseMix,
  setPlaybackFocus } from '../../../pond-gl-test3/focus/playback-focus';
import { circlePlayback, circlePose, type CircleFrame } from './circle-state';
import { advanceCircleSpring, createCircleMotion, stepCircleMotion, type CircleMotion } from './circle-motion';

const rgb = (color: string): [number, number, number] => [1, 3, 5].map(offset =>
  parseInt(color.slice(offset, offset + 2), 16) / 255) as [number, number, number];

/** DOM锚点只在布局变化时测量；逐帧更新共用pose，不用React刷新动画。 */
export function useTrackCircle(anchor: RefObject<HTMLElement | null>, trackId: string, phase: string,
  owns: boolean, degraded: boolean, color: string) {
  const frame = useRef<CircleFrame>({ x: 0, y: 0, radius: 0, diameter: 0, dx: 0, dy: 0,
    mix: 0, time: 0, visible: false, width: 1, height: 1, reduced: false, color: rgb(color) });
  const movement = useRef<CircleMotion | null>(null);
  const centre = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const syncLayout = useRef<(() => void) | null>(null);
  const inputs = useRef({ phase, degraded, trackId, color: rgb(color) });
  useLayoutEffect(() => {
    inputs.current = { phase, degraded, trackId, color: rgb(color) };
    syncLayout.current?.();
  }, [color, degraded, phase, trackId]);
  useLayoutEffect(() => {
    const root = anchor.current;
    if (!root) return;
    const frameState = frame.current;
    if (!owns) { frameState.visible = false; return; }
    let rect = root.getBoundingClientRect();
    if (!movement.current) {
      const seed = crypto.getRandomValues(new Uint32Array(1))[0];
      movement.current = createCircleMotion(seed); root.setAttribute('data-circle-session', String(seed));
    }
    const motion = movement.current;
    centre.current = { x: rect.left + rect.width / 2 + scrollX,
      y: rect.top + rect.height / 2 + scrollY, vx: 0, vy: 0 };
    const anchorCentre = centre.current;
    let state = { trackId: inputs.current.trackId, eclipse: false }; let raf = 0; let last = performance.now();
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const eclipse = root.querySelector<SVGGElement>('[data-circle-eclipse]');
    const measure = () => { rect = root.getBoundingClientRect(); };
    const writePosition = (x: number, y: number, radius: number) => {
      const dx = x - rect.left - rect.width / 2; const dy = y - rect.top - rect.height / 2;
      root.style.setProperty('--circle-dx', `${dx}px`); root.style.setProperty('--circle-dy', `${dy}px`);
      if (rect.width > 0) eclipse?.setAttribute('transform',
        `translate(${320 + dx * 640 / rect.width} ${320 + dy * 640 / rect.width}) scale(${radius * 640 / rect.width / 50})`);
    };
    // 换曲布局提交后、浏览器绘制前补偿位置，日食SVG也不能先跳一帧。
    syncLayout.current = () => { measure(); if (frameState.diameter > 0) writePosition(frameState.x, frameState.y, frameState.radius); };
    const resetClock = () => { last = performance.now(); };
    const observer = new ResizeObserver(measure); observer.observe(root);
    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    document.addEventListener('visibilitychange', resetClock);
    const tick = (now: number) => {
      if (inputs.current.degraded && now - last < 33) { raf = requestAnimationFrame(tick); return; }
      const elapsed = Math.max(0, now - last); const delta = Math.min(64, elapsed); last = now;
      const reduced = media.matches;
      const { trackId: currentTrackId, phase: currentPhase, color: targetColor } = inputs.current;
      state = circlePlayback(state, currentTrackId, currentPhase, owns);
      const mix = owns ? advanceEclipseMix(state.eclipse ? 1 : 0, delta, reduced)
        : blendEclipseMix(frame.current.mix, 0, delta, reduced);
      // 过渡仍限步长，位移按真实秒数推进，低帧率不能让圆几乎静止。
      const visible = !document.hidden && rect.width > 0 && rect.bottom > 0 && rect.top < innerHeight;
      if (visible) {
        frameState.time += elapsed / 1000;
        if (!reduced) stepCircleMotion(motion, elapsed / 1000);
      }
      // 布局因文字变长而移动时，也保留屏幕位置和速度；滚动仍直接随页面移动。
      const cx = advanceCircleSpring(anchorCentre.x, anchorCentre.vx, rect.left + rect.width / 2 + scrollX, elapsed / 1000, 4);
      const cy = advanceCircleSpring(anchorCentre.y, anchorCentre.vy, rect.top + rect.height / 2 + scrollY, elapsed / 1000, 4);
      anchorCentre.x = reduced ? rect.left + rect.width / 2 + scrollX : cx.position;
      anchorCentre.y = reduced ? rect.top + rect.height / 2 + scrollY : cy.position;
      anchorCentre.vx = reduced ? 0 : cx.velocity; anchorCentre.vy = reduced ? 0 : cy.velocity;
      const pose = circlePose(rect.width, innerHeight, frameState.time, reduced, motion);
      const x = anchorCentre.x - scrollX + pose.dx; const y = anchorCentre.y - scrollY + pose.dy;
      const amount = reduced ? 1 : 1 - Math.exp(-elapsed / 550);
      frameState.color = frameState.color.map((value, i) => value + (targetColor[i] - value) * amount) as [number, number, number];
      Object.assign(frame.current, pose, { x, y, mix, visible, reduced, width: innerWidth, height: innerHeight });
      if (owns) {
        if (state.eclipse) setPlaybackFocus({ active: true, trackId: currentTrackId, x: x / innerWidth, y: y / innerHeight, scale: pose.radius / 50 });
        else clearPlaybackFocus();
        document.body.style.setProperty('--pond-eclipse-mix', mix.toFixed(4));
      }
      writePosition(x, y, pose.radius);
      root.style.setProperty('--circle-diameter', `${pose.diameter}px`);
      root.style.setProperty('--circle-mix', String(mix));
      root.style.setProperty('--circle-color', `rgb(${frameState.color.map(value => value * 255).join(' ')})`);
      root.dataset.circleMix = mix.toFixed(3); root.dataset.circleDx = pose.dx.toFixed(3);
      root.dataset.circleDy = pose.dy.toFixed(3); root.dataset.circleDiameter = pose.diameter.toFixed(3);
      root.dataset.circleReduced = String(reduced); root.dataset.circleVisible = String(visible);
      root.dataset.circleTime = frame.current.time.toFixed(3);
      root.dataset.circleAnchorX = (anchorCentre.x - scrollX).toFixed(3);
      root.dataset.circleAnchorY = (anchorCentre.y - scrollY).toFixed(3);
      root.dataset.circleColor = frameState.color.map(value => value.toFixed(5)).join(',');
      raf = requestAnimationFrame(tick);
    };
    // 回到页面时在绘制前恢复原来的位置、颜色和运动进度，备用圆也复用同一帧。
    tick(performance.now());
    return () => {
      cancelAnimationFrame(raf); observer.disconnect();
      window.removeEventListener('scroll', measure); window.removeEventListener('resize', measure);
      document.removeEventListener('visibilitychange', resetClock);
      frameState.visible = false;
      syncLayout.current = null;
      if (owns) { clearPlaybackFocus(); resetEclipseMix(); document.body.style.removeProperty('--pond-eclipse-mix'); }
    };
  }, [anchor, owns]);
  return frame;
}
