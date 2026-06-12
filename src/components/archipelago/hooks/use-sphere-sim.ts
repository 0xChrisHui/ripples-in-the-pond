'use client';

import { useEffect, useRef } from 'react';
import { type Simulation } from 'd3-force';
import {
  setupSimulation,
  attachDrag,
  pushSpheresByWaves,
  type BgWave,
} from '../sphere-sim-setup';
import { applyFocusBlur, focusZOf, focusDecay } from './use-sphere-zoom';
import { lerpMouseSmooth } from './use-mouse-tilt';
import { fLayer, NUM_LAYERS, type SimNode, type SimLink } from '../sphere-config';
import { getAudioEnv } from './pond/use-audio-energy';
import { isAudioPulseEnabled } from './pond/use-play-sphere-pos';
import type { EffectsConfig } from '../effects-config';
import { useLayerWave } from './use-layer-wave';
import { TILT_PX, tiltCoef, persp, getLastActivityTime, initActivityTracking } from '../render/render-helpers';
import { renderLinks } from '../render/render-links';
import { renderEclipseMoon } from '../render/render-eclipse-moon';

const IDLE_THRESHOLD_MS = 5000; // v87 G3 — 5s 无输入进入 idle 半频模式

interface Args {
  svgRef: React.RefObject<SVGSVGElement | null>;
  simNodes: SimNode[];
  simLinks: SimLink[];
  assignment: Map<string, number>;
  clusterCount: number;
  zMap: Map<string, number>;
  nodeRefMap: React.RefObject<Map<string, SVGGElement>>;
  lineRefs: React.RefObject<(SVGElement | null)[]>;
  eclipseGRef: React.RefObject<SVGGElement | null>;
  ghostRefMap: React.RefObject<Map<string, SVGCircleElement>>;
  wavesRef: React.RefObject<BgWave[]>;
  mouseRef: React.RefObject<{ x: number; y: number }>;
  mouseInsideRef: React.RefObject<boolean>;
  zoomKRef: React.RefObject<number>;
  vanishRef: React.RefObject<{ x: number; y: number }>;
  playingIdRef: React.RefObject<string | null>;
  effects: EffectsConfig;
  simRef: React.RefObject<Simulation<SimNode, SimLink> | null>;
}

/** D3 sim setup + tick callback：tilt → perspective → layerWave2 → focus blur → viewport cull */
export function useSphereSim(a: Args): void {
  const effectsRef = useRef(a.effects);
  effectsRef.current = a.effects;
  const layerWaveMapRef = useLayerWave(a.simNodes, a.effects.layerWave2);
  const mouseSmoothRef = useRef({ smooth: { x: 0, y: 0 }, middle: { x: 0, y: 0 } });

  useEffect(() => {
    if (!a.svgRef.current || a.simNodes.length === 0) return;
    window.dispatchEvent(new Event('archipelago:reset'));
    a.wavesRef.current = [];
    initActivityTracking();
    let idleFrame = 0; // v87 G3 — idle 半频计数器

    // v87 perf — tick 闭包共享状态
    // - filterFrame: focus filter 节流计数器（每 4 帧重算一次 ≈ 15Hz）
    // - filterCache: 每球的上次 filter 字符串，差异时才 setAttribute
    // - lastFilterEnabled: 跟踪 focus+layerWave2 开关，关闭时清残留 filter
    // - visibleCache: viewport cull 状态缓存，状态变化时才动 display
    // - lastViewportCullEnabled: 关闭 cull 时一次性恢复全部 display
    let filterFrame = 0;
    const FILTER_THROTTLE = 4;
    const filterCache = new Map<string, string>();
    let lastFilterEnabled = false;
    const visibleCache = new Map<string, boolean>();
    let lastViewportCullEnabled = false;
    const VIEWPORT_MARGIN = 50; // 视口外 50px 仍算可见，避免边缘 pop-in

    const sim = setupSimulation(a.simNodes, a.simLinks,
      a.svgRef.current.clientWidth || 800, a.svgRef.current.clientHeight || 600,
      a.assignment, a.clusterCount, () => {
      const e = effectsRef.current;
      const m = lerpMouseSmooth(mouseSmoothRef.current, a.mouseRef.current, a.mouseInsideRef.current);
      const now = performance.now();
      const tiltX = e.tilt ? m.x * TILT_PX : 0;
      const tiltY = e.tilt ? m.y * TILT_PX : 0;
      const k = a.zoomKRef.current;
      const cx = a.vanishRef.current.x;
      const cy = a.vanishRef.current.y;

      // v87 G3 — waves 移到最前（每帧跑保状态），然后 idle 5s 无输入 → 半频 DOM
      a.wavesRef.current = a.wavesRef.current.filter((w) => now - w.spawnTime < w.duration);
      pushSpheresByWaves(a.simNodes, a.wavesRef.current, a.playingIdRef.current, now);
      if ((now - getLastActivityTime()) > IDLE_THRESHOLD_MS && (idleFrame++ % 2 !== 0)) return;

      // v87 perf — 日食模式：35 个非播放球 opacity 0 不可见，跳过 transform 写入
      const playingId = a.playingIdRef.current;
      const isEclipse = playingId !== null;

      // v87 perf — focus filter 节流 + 关闭时清缓存
      const filterEnabled = e.focus;
      const updateFilter = filterEnabled && (filterFrame++ % FILTER_THROTTLE) === 0;
      if (!filterEnabled && lastFilterEnabled) {
        a.simNodes.forEach((n) => {
          const el = a.nodeRefMap.current.get(n.id);
          if (el) el.style.filter = '';
        });
        filterCache.clear();
      }
      lastFilterEnabled = filterEnabled;

      // v87 perf — viewport cull：缩放放大时屏幕外的球设 display:none，省合成成本
      const svg = a.svgRef.current;
      const vw = svg?.clientWidth ?? 0;
      const vh = svg?.clientHeight ?? 0;
      if (!e.viewportCull && lastViewportCullEnabled) {
        a.simNodes.forEach((n) => {
          const el = a.nodeRefMap.current.get(n.id);
          if (el) el.style.display = '';
        });
        visibleCache.clear();
      }
      lastViewportCullEnabled = e.viewportCull;

      a.simNodes.forEach((n) => {
        const el = a.nodeRefMap.current.get(n.id);
        if (!el || n.x == null || n.y == null) return;
        // v87 perf — 日食时仅播放球可见，其它跳过（D3 sim 内部 n.x/n.y 仍演化，
        // 退出日食时下一帧 setAttribute 会一次性同步到当前位置）
        if (isEclipse && n.id !== playingId) return;
        // v87 Z1 — 删 z 抖动：sin 漂移 ±0.05 让球"呼吸"，但导致每球 scale 每帧微变 →
        // SVG <filter> 必须每帧重栅格化（即使我们的 cache 命中，浏览器 GPU 层还在重做）。
        // z 恒定后浏览器内部 filter 缓存命中，idle 时 GPU 几乎不再跑 feGaussianBlur
        const z = a.zMap.get(n.id) ?? 0.5;
        const tc = tiltCoef(z);
        let x = n.x + tiltX * tc;
        let y = n.y + tiltY * tc;
        let scale = 1;
        // v86 layerWave2 — 事件驱动：仅 active wave 的球计算钟形偏移
        let effectiveLayer = n.baseLayer;
        if (e.layerWave2) {
          const wave = layerWaveMapRef.current.get(n.id);
          if (wave) {
            const progress = (now - wave.startTime) / wave.duration;
            if (progress > 0 && progress < 1) {
              effectiveLayer = n.baseLayer + (wave.targetLayer - n.baseLayer) * Math.sin(progress * Math.PI);
              scale *= fLayer(effectiveLayer) / fLayer(n.baseLayer);
            }
          }
        }
        // v87 — focus filter：15Hz 节流 + 值 cache 跳过重复 setAttribute
        // 圆值 0.1px / 0.01 brightness 精度，浏览器渲染上无肉眼差异；
        // 同时把 SphereCanvas 那边删掉的 transition: filter 副作用一并消除
        if (updateFilter) {
          const focusZ = focusZOf(k);
          const decay = focusDecay(k);
          const zEff = 1 - (effectiveLayer - 1) / (NUM_LAYERS - 1);
          const dist = Math.abs(zEff - focusZ);
          const blur = Math.round(dist * 0.6 * decay * 10) / 10;
          const bright = Math.round((1 - dist * 0.15 * decay) * 100) / 100;
          // P8-B §2.4 — focus 叠 saturate：失焦球去饱和（水下偏灰）；同字符串/节流/cache，零额外开销
          const sat = Math.round((1 - dist * 0.35 * decay) * 100) / 100;
          const fStr = blur === 0 ? '' : `blur(${blur}px) brightness(${bright}) saturate(${sat})`;
          if (filterCache.get(n.id) !== fStr) {
            el.style.filter = fStr;
            filterCache.set(n.id, fStr);
          }
        }
        if (e.perspective) {
          const p = persp(x, y, z, cx, cy, k);
          x = p.x; y = p.y; scale *= p.factor;
        }
        // v87 perf — viewport cull：球边界完全在视口外则隐藏，跳过 transform 写入
        if (e.viewportCull && vw > 0 && vh > 0) {
          const screenR = n.radius * scale * 1.16;
          const visible =
            x + screenR > -VIEWPORT_MARGIN &&
            x - screenR < vw + VIEWPORT_MARGIN &&
            y + screenR > -VIEWPORT_MARGIN &&
            y - screenR < vh + VIEWPORT_MARGIN;
          if (visibleCache.get(n.id) !== visible) {
            el.style.display = visible ? '' : 'none';
            visibleCache.set(n.id, visible);
          }
          if (!visible) return;
        }
        if (n.id === playingId && isAudioPulseEnabled()) scale *= 1 + getAudioEnv() * 0.07; // P8-C1 audioPulse 播放球呼吸
        const t = scale === 1
          ? `translate(${x},${y})`
          : `translate(${x},${y}) scale(${scale})`;
        el.setAttribute('transform', t);
      });

      // v87 perf — 日食时 link 父 group opacity 0，整段循环跳过
      if (!isEclipse) {
        renderLinks({
          simLinks: a.simLinks,
          lineRefs: a.lineRefs,
          zMap: a.zMap,
          tiltX, tiltY,
          perspective: e.perspective,
          cx, cy, k,
        });
      }

      renderEclipseMoon({
        eclipseEl: a.eclipseGRef.current,
        simNodes: a.simNodes,
        playingId,
        zMap: a.zMap,
        layerWaveMap: layerWaveMapRef.current,
        tiltX, tiltY, cx, cy, k, now,
        layerWave2: e.layerWave2,
        perspective: e.perspective,
      });
    });

    a.simRef.current = sim;
    attachDrag(a.nodeRefMap.current, a.simNodes, sim);
    if (a.effects.focus) applyFocusBlur(a.nodeRefMap.current, 1);

    return () => { sim.stop(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.simNodes, a.simLinks]);
}
