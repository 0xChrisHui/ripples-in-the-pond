'use client';
// v54-v86 彗星 (C2)：拖尾 + 推球 + 点击日食 + perspective 联动 + focus
import { useEffect, useRef } from 'react';
import type { SimNode } from '../../sphere-config';
import { spawnComet, SIZE_BASE, TRAIL_HISTORY, PUSH_RADIUS, Z_REACH, PUSH_FORCE, HOVER_RADIUS, type Comet } from './comet-spawn';
import { makeCometTrailPools, renderCometTrail, type CometTrailPools } from '../../render/render-comet-trail';

interface Props {
  simNodes: SimNode[];
  zMap: Map<string, number>;
  svgRef: React.RefObject<SVGSVGElement | null>;
  zoomKRef: React.RefObject<number>;
  vanishRef: React.RefObject<{ x: number; y: number }>;
  perspective: boolean;
  anyEclipse: boolean;
  playingId: string | null;
  focus: boolean;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

function mkCircle(cx: number, cy: number, r: number, attrs: Record<string, string> = {}): SVGCircleElement {
  const el = document.createElementNS(SVG_NS, 'circle');
  el.setAttribute('cx', String(cx)); el.setAttribute('cy', String(cy)); el.setAttribute('r', String(r));
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); return el;
}

export default function CometSystem({
  simNodes, zMap, svgRef, zoomKRef, vanishRef, perspective, anyEclipse, playingId, focus,
}: Props) {
  const cometsRef = useRef<Comet[]>([]);
  const trailLayerRef = useRef<SVGGElement>(null);
  const headLayerRef = useRef<SVGGElement>(null);
  // v87 K — trail dot/line 对象池，省每帧 createElement+appendChild
  const trailPoolsRef = useRef<CometTrailPools | null>(null);
  const trailHistRef = useRef<Map<number, Array<{ x: number; y: number; lifeRate: number; spawnTime: number; lifetime: number; persistent: boolean; driftX: number; driftY: number }>>>(new Map());
  const mousePosRef = useRef<{ x: number; y: number } | null>(null);
  const lastTickRef = useRef(0);
  const cfgRef = useRef({ perspective, anyEclipse, focus });
  useEffect(() => {
    cfgRef.current = { perspective, anyEclipse, focus };
  }, [perspective, anyEclipse, focus]);

  useEffect(() => {
    if (playingId) return;
    let cancelled = false;
    let timer: number;
    const schedule = () => {
      if (cancelled) return;
      const delay = 35000 + Math.random() * 35000;
      timer = window.setTimeout(() => { spawnComet(svgRef, cometsRef); schedule(); }, delay);
    };
    timer = window.setTimeout(() => { spawnComet(svgRef, cometsRef); schedule(); }, 4000 + Math.random() * 4000);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [playingId, svgRef]);

  useEffect(() => {
    const onManual = () => spawnComet(svgRef, cometsRef);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '.') return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || t?.isContentEditable) return;
      spawnComet(svgRef, cometsRef);
    };
    window.addEventListener('comet:manual-spawn', onManual);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('comet:manual-spawn', onManual);
      document.removeEventListener('keydown', onKey);
    };
  }, [svgRef]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onMove = (e: MouseEvent) => {
      const rect = svg.getBoundingClientRect();
      mousePosRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onLeave = () => { mousePosRef.current = null; };
    svg.addEventListener('mousemove', onMove);
    svg.addEventListener('mouseleave', onLeave);
    return () => {
      svg.removeEventListener('mousemove', onMove);
      svg.removeEventListener('mouseleave', onLeave);
    };
  }, [svgRef]);

  useEffect(() => {
    let raf = 0;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const tLayer = trailLayerRef.current, hLayer = headLayerRef.current;
      if (!tLayer || !hLayer) { raf = requestAnimationFrame(tick); return; }
      const now = performance.now();
      const dt = lastTickRef.current ? now - lastTickRef.current : 16;
      lastTickRef.current = now;

      cometsRef.current = cometsRef.current.filter((c) => c.frozen || (now - c.spawnTime) < c.duration + 12000); // v86 +12s 让 trail fade
      const cfg = cfgRef.current;
      const k = zoomKRef.current ?? 1;
      const vp = vanishRef.current ?? { x: 0, y: 0 };
      const positions: Array<{ c: Comet; x: number; y: number; z: number; dispX: number; dispY: number; dispScale: number }> = [];
      const mp = mousePosRef.current;
      const sphereMinScale = cfg.perspective ? Math.pow(k, 0.6) : 1;
      for (const c of cometsRef.current) {
        const t = c.frozen ? c.frozenT : Math.min(1, (now - c.spawnTime) / c.duration);
        const u = 1 - t;
        const x = u * u * c.sx + 2 * u * t * c.cx + t * t * c.ex;
        const y = u * u * c.sy + 2 * u * t * c.cy + t * t * c.ey;
        const z = c.z0 + (c.z1 - c.z0) * t;
        const dispScale = sphereMinScale * c.sizeFactor;
        positions.push({ c, x, y, z, dispX: x, dispY: y, dispScale });
        if (mp && !c.frozen) {
          const d = Math.hypot(mp.x - x, mp.y - y);
          if (d < HOVER_RADIUS) c.spawnTime += dt * (1 - (0.08 + 0.92 * (d / HOVER_RADIUS)));
        }
        let hist = trailHistRef.current.get(c.id);
        if (!hist) { hist = []; trailHistRef.current.set(c.id, hist); }
        if (!c.frozen && (now - c.spawnTime) <= c.duration) {
          const seq = ++c.trailSpawnCount;
          const small = Math.sin(seq * 0.32) * 0.35 + Math.cos(seq * 0.85) * 0.2;
          const big = Math.sin(seq * 0.08) * 0.35;
          const noise = (Math.random() - 0.5) * 0.12;
          const lifeRate = 1.0 + small + big + noise, persistent = lifeRate > 1.55; // v69 top 5-8% 留下散点
          const lifetime = persistent ? 6200 + Math.random() * 5000 : 1200;
          hist.unshift({ x, y, lifeRate, spawnTime: now, lifetime, persistent, driftX: persistent ? (Math.random() - 0.5) * 14 : 0, driftY: persistent ? (Math.random() - 0.5) * 14 : 0 });
        }
        hist = hist.filter((p) => now - p.spawnTime < p.lifetime);
        trailHistRef.current.set(c.id, hist);
      }
      for (const { x, y, z } of positions) {
        for (const n of simNodes) {
          if (n.x == null || n.y == null) continue;
          const nz = zMap.get(n.id) ?? 0.5;
          const zDiff = Math.abs(nz - z);
          if (zDiff > Z_REACH) continue;
          const dx = n.x - x, dy = n.y - y;
          const d = Math.hypot(dx, dy) || 1;
          if (d > PUSH_RADIUS) continue;
          const f = PUSH_FORCE * (1 - d / PUSH_RADIUS) * (1 - zDiff / Z_REACH);
          n.vx = (n.vx ?? 0) + (dx / d) * f;
          n.vy = (n.vy ?? 0) + (dy / d) * f;
        }
      }
      const alive = new Set(cometsRef.current.map((c) => c.id));
      trailHistRef.current.forEach((_, kk) => { if (!alive.has(kk)) trailHistRef.current.delete(kk); });

      // v87 K — trail 走 pool（reset 隐藏上帧未用）；heads 数量少（1-6 个），保留每帧重建
      if (!trailPoolsRef.current) trailPoolsRef.current = makeCometTrailPools(tLayer);
      const pools = trailPoolsRef.current;
      pools.d.reset();
      pools.l.reset();
      while (hLayer.firstChild) hLayer.removeChild(hLayer.firstChild);
      const focusZ = cfg.focus ? Math.max(0.7, 1 - (k - 1) * 0.1) : 0, focusDk = cfg.focus ? Math.max(0, 1 - (k - 1) * 0.5) : 0;
      for (const { c, z, dispX, dispY, dispScale } of positions) {
        if (cfg.anyEclipse && !c.eclipse) continue;
        const hist = trailHistRef.current.get(c.id) ?? [];
        const focusFilter = cfg.focus ? `blur(${Math.abs(z - focusZ) * 0.6 * focusDk}px) brightness(${1 - Math.abs(z - focusZ) * 0.15 * focusDk})` : '';
        // v72 — c.eclipse 时跳过 trail（避免 frozen 后残留长条）；v87 K — trail 走 pool
        if (!c.eclipse) renderCometTrail(pools, hist, now, dispScale, SIZE_BASE);
        const onClickHead = (e: MouseEvent) => {
          e.stopPropagation(); e.preventDefault();
          if (c.eclipse) {
            c.eclipse = false; c.frozen = false;
            c.spawnTime = performance.now() - c.frozenT * c.duration;
          } else {
            c.eclipse = true; c.frozen = true;
            c.frozenT = Math.min(1, (now - c.spawnTime) / c.duration);
          }
          window.dispatchEvent(new CustomEvent('comet:eclipse-changed', {
            detail: { active: cometsRef.current.some((cc) => cc.eclipse) },
          }));
        };
        if (c.eclipse) {
          const moonR = SIZE_BASE * dispScale * 1.35;
          hLayer.appendChild(mkCircle(dispX, dispY, moonR * 4.4, { fill: 'url(#comet-halo)' }));
          hLayer.appendChild(mkCircle(dispX, dispY, moonR + 1, { fill: 'none', stroke: 'white', 'stroke-opacity': '0.92', 'stroke-width': '1.2' }));
          const moon = mkCircle(dispX, dispY, moonR, { fill: '#000' });
          moon.style.cursor = 'pointer'; moon.style.pointerEvents = 'auto'; moon.style.filter = focusFilter;
          moon.addEventListener('mousedown', onClickHead);
          hLayer.appendChild(moon);
        } else if ((now - c.spawnTime) <= c.duration) {
          const head = mkCircle(dispX, dispY, SIZE_BASE * dispScale, { fill: 'white', 'fill-opacity': '1' });
          head.style.cursor = 'pointer'; head.style.pointerEvents = 'auto'; head.style.filter = focusFilter;
          head.addEventListener('mousedown', onClickHead);
          hLayer.appendChild(head);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelled = true; cancelAnimationFrame(raf); };
  }, [simNodes, zMap, svgRef, zoomKRef, vanishRef]);

  return (
    <g aria-hidden="true">
      <g ref={trailLayerRef} style={{ filter: 'blur(1.2px)' }} />
      <g ref={headLayerRef} style={{ filter: 'blur(0.4px)' }} />
    </g>
  );
}
