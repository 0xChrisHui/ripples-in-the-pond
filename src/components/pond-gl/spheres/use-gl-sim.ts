'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Simulation } from 'd3-force';
import { usePlayer } from '@/src/components/player/PlayerProvider';
import {
  GROUPS,
  getGroupTracks,
  getGroupTargetCount,
  padTracksToTarget,
  type GroupId,
  type SimNode,
  type SimLink,
} from '@/src/components/archipelago/sphere-config';
import type { Track, TracksListResponse } from '@/src/types/tracks';
import { buildGlNodes, setupGlSimulation, resizeGlSim, type GlPhysNode } from './gl-sim-setup';
import type { BgWave } from './gl-sim-waves';
import { alignWaterLineTo } from '../water/water-level';

/** 数组中位数（空→0.5）：建点后把默认水线对齐到球深度中位数用（零死区：任一方向滚轮即穿越水面）。 */
function medianOf(vals: number[]): number {
  if (vals.length === 0) return 0.5;
  const s = [...vals].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * G4 — GL 球 sim 编排 hook（无 three 依赖，可在 page 层调用）。
 *
 * 负责：取数（/api/tracks）→ 键盘 ←→ 切组 → 建 d3 sim → 暴露给 SphereInstances（Canvas 内）
 * 与 SphereOverlay（DOM 命中层）共享。playingId 走 ref（R3F Canvas 拿不到外部 context）。
 *
 * 已知限制：切组只跟键盘（与首页 Archipelago 并行，初始同为 A）；nav 点击 GL 不跟随
 * —— 这是"不碰 Archipelago"红线的固有代价（详见 phase-8-g-gl-water.md G4 段）。
 */
export interface GlSim {
  ready: boolean;
  loading: boolean;      // J4：取数中（还没球、也没出错）
  error: boolean;        // J4：取数失败（显示"加载失败，点击重试"）
  retry: () => void;     // J4：重新取数
  groupId: GroupId;
  nodes: GlPhysNode[];
  simRef: React.RefObject<Simulation<SimNode, SimLink> | null>;
  wavesRef: React.RefObject<BgWave[]>;
  playingIdRef: React.RefObject<string | null>;
  hoverIdRef: React.RefObject<string | null>;
  sizeRef: React.RefObject<{ w: number; h: number }>;
  setHover: (id: string | null) => void;
  setGroup: (id: GroupId) => void;
  toggle: (t: Track) => Promise<void>;
}

export function useGlSim(active: boolean): GlSim {
  const { playing, currentTrack, toggle } = usePlayer();
  const playingId = playing && currentTrack ? currentTrack.id : null;
  const playingIdRef = useRef<string | null>(null);
  useEffect(() => { playingIdRef.current = playingId; }, [playingId]);

  const [groupId, setGroupId] = useState<GroupId>('A');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [tracksError, setTracksError] = useState(false);
  const [nodes, setNodes] = useState<GlPhysNode[]>([]);
  const simRef = useRef<Simulation<SimNode, SimLink> | null>(null);
  const wavesRef = useRef<BgWave[]>([]);
  const hoverIdRef = useRef<string | null>(null);
  const sizeRef = useRef({ w: 0, h: 0 });
  const anchorsRef = useRef<Map<string, { x: number; y: number; strength: number }> | null>(null);
  const setHover = useCallback((id: string | null) => { hoverIdRef.current = id; }, []);
  // I1 — GL nav 点击切组（取代旧 Archipelago nav；直接驱动 GL 组、修 G4"nav 点击 GL 不跟随"）
  const setGroup = useCallback((id: GroupId) => setGroupId(id), []);

  // 取数（仅 active；与 Archipelago 各取一次，/api/tracks 有 ISR 缓存，重复成本低）。
  // J4：加 res.ok 判定 + error 态 + retry（失败不再静默 console.error、无 UI）。
  const loadTracks = useCallback(async () => {
    setTracksError(false);
    try {
      const r = await fetch('/api/tracks');
      if (!r.ok) throw new Error(`tracks HTTP ${r.status}`);
      const d = (await r.json()) as TracksListResponse;
      setTracks(d.tracks);
    } catch (e) {
      console.error('[GLSim] tracks 加载失败:', e);
      setTracksError(true);
    }
  }, []);
  useEffect(() => { if (active) void loadTracks(); }, [active, loadTracks]);

  // 键盘 ←→ 切组（复刻 Archipelago.tsx:135-149 的并行逻辑，初始同为 A → 同步）
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const idx = GROUPS.findIndex((g) => g.id === groupId);
      if (e.key === 'ArrowRight') setGroupId(GROUPS[(idx + 1) % GROUPS.length].id);
      if (e.key === 'ArrowLeft') setGroupId(GROUPS[(idx - 1 + GROUPS.length) % GROUPS.length].id);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active, groupId]);

  // 涟漪事件桥：订阅 bg-ripple:wave → wavesRef（duration 秒→ms，复刻 use-wave-events.ts）
  useEffect(() => {
    if (!active) return;
    const onWave = (e: Event) => {
      const ce = e as CustomEvent<{ x: number; y: number; size: number; duration: number }>;
      wavesRef.current.push({
        x: ce.detail.x, y: ce.detail.y, size: ce.detail.size,
        spawnTime: performance.now(), duration: ce.detail.duration * 1000,
      });
    };
    window.addEventListener('bg-ripple:wave', onWave);
    return () => window.removeEventListener('bg-ripple:wave', onWave);
  }, [active]);

  // 建 sim（tracks/group 变 → 重建）；尺寸取 window（正交相机像素 1:1）
  useEffect(() => {
    // queueMicrotask 包 setState：避 React 19 react-hooks/set-state-in-effect lint（同 SphereCanvas pattern）
    if (!active || tracks.length === 0) {
      simRef.current?.stop();
      simRef.current = null;
      queueMicrotask(() => setNodes([]));
      return;
    }
    const w = window.innerWidth, h = window.innerHeight;
    sizeRef.current = { w, h };
    const show = padTracksToTarget(getGroupTracks(groupId, tracks), getGroupTargetCount(groupId));
    const { nodes: built, links, assignment } = buildGlNodes(show, groupId);
    alignWaterLineTo(medianOf(built.map((n) => n.z))); // 默认水线对齐球深度中位数 → 滚轮任一方向即穿越水面(零死区)
    simRef.current?.stop();
    const { sim, anchors } = setupGlSimulation(built, links, assignment, w, h);
    simRef.current = sim;
    anchorsRef.current = anchors;
    wavesRef.current = [];
    queueMicrotask(() => setNodes(built));
    return () => { simRef.current?.stop(); };
  }, [active, tracks, groupId]);

  // document.hidden 时暂停 sim（性能预算：后台标签不跑物理）
  useEffect(() => {
    if (!active) return;
    const onVis = () => {
      const sim = simRef.current;
      if (!sim) return;
      if (document.hidden) sim.stop();
      else sim.alphaTarget(0.008).restart();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [active]);

  // J2 — 窗口/转屏后把 sim + cluster 锚点等比缩放到新尺寸（配合 SphereInstances 相机跟随 sizeRef）→
  // GL 球与 DOM 命中层不错位、球随尺寸重适配。sizeRef 始终同步当前窗口（相机/水面/overlay 都读它）。
  useEffect(() => {
    if (!active) return;
    const onResize = () => {
      const old = sizeRef.current;
      const w = window.innerWidth, h = window.innerHeight;
      if ((w === old.w && h === old.h) || !old.w || !old.h) { sizeRef.current = { w, h }; return; }
      const sim = simRef.current, anchors = anchorsRef.current;
      if (sim && anchors) resizeGlSim(sim, nodes, anchors, w / old.w, h / old.h, w, h);
      sizeRef.current = { w, h };
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, [active, nodes]);

  // J4 — 音频预热：当前组曲目各拉前 300KB（6 worker 并发），点播放更跟手（移植 Archipelago）。
  useEffect(() => {
    if (!active || tracks.length === 0) return;
    const padded = padTracksToTarget(getGroupTracks(groupId, tracks), getGroupTargetCount(groupId));
    let cancelled = false;
    const queue = padded.filter((t) => t.audio_url);
    const workers = Array.from({ length: 6 }, async () => {
      while (queue.length > 0 && !cancelled) {
        const t = queue.shift();
        if (!t?.audio_url) continue;
        try { await fetch(t.audio_url, { headers: { Range: 'bytes=0-307199' } }); } catch { /* 预热失败不影响主流程 */ }
      }
    });
    void Promise.all(workers);
    return () => { cancelled = true; };
  }, [active, tracks, groupId]);

  return {
    ready: nodes.length > 0,
    loading: nodes.length === 0 && !tracksError,
    error: tracksError,
    retry: loadTracks,
    groupId, nodes, simRef, wavesRef, playingIdRef, hoverIdRef, sizeRef, setHover, setGroup, toggle,
  };
}
