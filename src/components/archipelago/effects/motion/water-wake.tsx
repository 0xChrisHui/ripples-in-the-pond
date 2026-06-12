'use client';
// Phase 8-B §2.9 waterWake + §2.16 dragWake
// 抽象掠水扰动：观者只看到痕迹（一串微椭圆涟漪沿路径次第绽开）+ 途经球被推开，
// 看不到任何具象物。dragWake 复用同一个微涟漪对象池——池独立于两 flag，谁开谁用。
import { useEffect, useRef } from 'react';
import type { SimNode } from '../../sphere-config';
import { getPondTilt } from '../../hooks/pond/use-pond-tilt';

interface Props {
  simNodes: SimNode[];
  zMap: Map<string, number>;
  svgRef: React.RefObject<SVGSVGElement | null>;
  waterWake: boolean;
  dragWake: boolean;
  playingId: string | null;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const PUSH_RADIUS = 80;   // 同 comet PUSH_RADIUS
const Z_REACH = 0.4;
const PUSH_FORCE = 1.0;   // 比 comet 略弱（无实体头部，仅扰动）
const HOVER_RADIUS = 120; // 鼠标靠近触发逃散的半径
const STEP_MIN = 30;      // 每行进 30-50px spawn 一个微椭圆
const MAX_RIPPLES = 8;    // 同屏微涟漪上限（dragWake 兜底，§2.16）

interface Wake {
  // 二次贝塞尔路径（抄 comet）但用累积 progress 推进
  sx: number; sy: number; cx: number; cy: number; ex: number; ey: number;
  z0: number; z1: number;
  progress: number; phase: number; base: number;
  lastSpawnX: number; lastSpawnY: number;
}

/** 在 layer 上画一个一次性微椭圆涟漪（.ripple-once 自带淡出），超量即丢最老。 */
function spawnRipple(layer: SVGGElement, x: number, y: number): void {
  while (layer.children.length >= MAX_RIPPLES && layer.firstChild) {
    layer.removeChild(layer.firstChild);
  }
  const tilt = getPondTilt();
  const rx = 6 + Math.random() * 6; // 6-12px
  const el = document.createElementNS(SVG_NS, 'ellipse');
  el.setAttribute('cx', String(x));
  el.setAttribute('cy', String(y));
  el.setAttribute('rx', String(rx));
  el.setAttribute('ry', String(rx * tilt));
  el.setAttribute('fill', 'none');
  el.setAttribute('stroke-width', '1.2');
  el.setAttribute('class', 'ripple-once');
  el.style.stroke = 'var(--pond-ripple)';
  el.style.strokeOpacity = '0.5';
  el.style.animationDuration = '2.4s';
  layer.appendChild(el);
  window.setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 2600);
}

function makeWake(svg: SVGSVGElement): Wake {
  const W = svg.clientWidth || 800, H = svg.clientHeight || 600, M = 80;
  const side = Math.floor(Math.random() * 4);
  let sx = 0, sy = 0, ex = 0, ey = 0;
  if (side === 0) { sx = -M; sy = Math.random() * H; ex = W + M; ey = Math.random() * H; }
  else if (side === 1) { sx = W + M; sy = Math.random() * H; ex = -M; ey = Math.random() * H; }
  else if (side === 2) { sx = Math.random() * W; sy = -M; ex = Math.random() * W; ey = H + M; }
  else { sx = Math.random() * W; sy = H + M; ex = Math.random() * W; ey = -M; }
  const dx = ex - sx, dy = ey - sy, len = Math.hypot(dx, dy) || 1;
  const arc = (Math.random() - 0.5) * 1200;
  const cx = (sx + ex) / 2 + (-dy / len) * arc;
  const cy = (sy + ey) / 2 + (dx / len) * arc;
  const reverse = Math.random() < 0.5;
  return {
    sx, sy, cx, cy, ex, ey,
    z0: reverse ? 1 : 0, z1: reverse ? 0 : 1,
    progress: 0, phase: Math.random() * 6.283, base: 0.00055 + Math.random() * 0.0004,
    lastSpawnX: sx, lastSpawnY: sy,
  };
}

function bezier(w: Wake): { x: number; y: number; z: number } {
  const t = Math.min(1, w.progress), u = 1 - t;
  return {
    x: u * u * w.sx + 2 * u * t * w.cx + t * t * w.ex,
    y: u * u * w.sy + 2 * u * t * w.cy + t * t * w.ey,
    z: w.z0 + (w.z1 - w.z0) * t,
  };
}

export default function WaterWake({ simNodes, zMap, svgRef, waterWake, dragWake, playingId }: Props) {
  const layerRef = useRef<SVGGElement>(null);
  const wakesRef = useRef<Wake[]>([]);
  const mouseRef = useRef<{ x: number; y: number } | null>(null);
  const lastTickRef = useRef(0);
  const cfgRef = useRef({ waterWake, dragWake });
  useEffect(() => { cfgRef.current = { waterWake, dragWake }; }, [waterWake, dragWake]);

  // dragWake — SphereCanvas 拖拽时按 SVG 本地坐标喂点（§2.16，不 dispatch bg-ripple:wave）
  useEffect(() => {
    const onDrag = (e: Event) => {
      if (!cfgRef.current.dragWake) return;
      const layer = layerRef.current;
      if (!layer) return;
      const d = (e as CustomEvent).detail ?? {};
      if (typeof d.x === 'number' && typeof d.y === 'number') spawnRipple(layer, d.x, d.y);
    };
    window.addEventListener('water-wake:drag', onDrag);
    return () => window.removeEventListener('water-wake:drag', onDrag);
  }, []);

  // 鼠标位置（用于逃散加速）
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onMove = (e: MouseEvent) => {
      const r = svg.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onLeave = () => { mouseRef.current = null; };
    svg.addEventListener('mousemove', onMove);
    svg.addEventListener('mouseleave', onLeave);
    return () => { svg.removeEventListener('mousemove', onMove); svg.removeEventListener('mouseleave', onLeave); };
  }, [svgRef]);

  // waterWake spawn 调度：35-70s 一道，≤2 道同屏；playingId 存在时停（沿用 comet 节奏）
  useEffect(() => {
    if (!waterWake || playingId) return;
    let cancelled = false;
    let timer: number;
    const spawn = () => {
      const svg = svgRef.current;
      if (svg && wakesRef.current.length < 2) wakesRef.current.push(makeWake(svg));
    };
    const schedule = () => {
      if (cancelled) return;
      timer = window.setTimeout(() => { spawn(); schedule(); }, 35000 + Math.random() * 35000);
    };
    timer = window.setTimeout(() => { spawn(); schedule(); }, 3000 + Math.random() * 3000);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [waterWake, playingId, svgRef]);

  // rAF：推进 wake、spawn 微涟漪、推球（waterWake 专属；dragWake 走事件不进此循环）
  useEffect(() => {
    if (!waterWake) return;
    let raf = 0, cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const layer = layerRef.current;
      if (!layer) { raf = requestAnimationFrame(tick); return; }
      const now = performance.now();
      const dt = lastTickRef.current ? now - lastTickRef.current : 16;
      lastTickRef.current = now;
      const mp = mouseRef.current;
      for (const w of wakesRef.current) {
        // 冲刺-滑行-停：speed 脉冲 = max(0,sin())^3 * base
        let speed = Math.pow(Math.max(0, Math.sin(now * 0.0008 + w.phase)), 3) * w.base;
        const pos = bezier(w);
        if (mp) {
          const dm = Math.hypot(mp.x - pos.x, mp.y - pos.y);
          if (dm < HOVER_RADIUS) speed *= 1 + 2.5 * (1 - dm / HOVER_RADIUS); // 鼠标靠近 → 加速逃散
        }
        w.progress += dt * speed;
        // 冲刺期每行进 30-50px spawn 一个微椭圆
        const moved = Math.hypot(pos.x - w.lastSpawnX, pos.y - w.lastSpawnY);
        if (speed > w.base * 0.15 && moved >= STEP_MIN + Math.random() * 20) {
          spawnRipple(layer, pos.x, pos.y);
          w.lastSpawnX = pos.x; w.lastSpawnY = pos.y;
        }
        // 推球（搬 comet PUSH 逻辑）
        for (const n of simNodes) {
          if (n.id === playingId || n.x == null || n.y == null) continue;
          if (n.fx != null || n.fy != null) continue;
          const nz = zMap.get(n.id) ?? 0.5;
          const zDiff = Math.abs(nz - pos.z);
          if (zDiff > Z_REACH) continue;
          const dx = n.x - pos.x, dy = n.y - pos.y, d = Math.hypot(dx, dy) || 1;
          if (d > PUSH_RADIUS) continue;
          const f = PUSH_FORCE * (1 - d / PUSH_RADIUS) * (1 - zDiff / Z_REACH);
          n.vx = (n.vx ?? 0) + (dx / d) * f;
          n.vy = (n.vy ?? 0) + (dy / d) * f;
        }
      }
      wakesRef.current = wakesRef.current.filter((w) => w.progress < 1);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelled = true; cancelAnimationFrame(raf); };
  }, [waterWake, simNodes, zMap, playingId]);

  return <g ref={layerRef} aria-hidden="true" />;
}
