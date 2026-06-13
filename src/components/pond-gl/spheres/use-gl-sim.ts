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
import { buildGlNodes, setupGlSimulation, type GlPhysNode, type BgWave } from './gl-sim-setup';

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
  groupId: GroupId;
  nodes: GlPhysNode[];
  simRef: React.RefObject<Simulation<SimNode, SimLink> | null>;
  wavesRef: React.RefObject<BgWave[]>;
  playingIdRef: React.RefObject<string | null>;
  hoverIdRef: React.RefObject<string | null>;
  sizeRef: React.RefObject<{ w: number; h: number }>;
  setHover: (id: string | null) => void;
  toggle: (t: Track) => Promise<void>;
}

export function useGlSim(active: boolean): GlSim {
  const { playing, currentTrack, toggle } = usePlayer();
  const playingId = playing && currentTrack ? currentTrack.id : null;
  const playingIdRef = useRef<string | null>(null);
  useEffect(() => { playingIdRef.current = playingId; }, [playingId]);

  const [groupId, setGroupId] = useState<GroupId>('A');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [nodes, setNodes] = useState<GlPhysNode[]>([]);
  const simRef = useRef<Simulation<SimNode, SimLink> | null>(null);
  const wavesRef = useRef<BgWave[]>([]);
  const hoverIdRef = useRef<string | null>(null);
  const sizeRef = useRef({ w: 0, h: 0 });
  const setHover = useCallback((id: string | null) => { hoverIdRef.current = id; }, []);

  // 取数（仅 active；与 Archipelago 各取一次，/api/tracks 有 ISR 缓存，重复成本低）
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    fetch('/api/tracks')
      .then((r) => r.json())
      .then((d: TracksListResponse) => { if (!cancelled) setTracks(d.tracks); })
      .catch((e) => console.error('[GLSim] tracks 加载失败:', e));
    return () => { cancelled = true; };
  }, [active]);

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
    simRef.current?.stop();
    simRef.current = setupGlSimulation(built, links, assignment, w, h);
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

  return {
    ready: nodes.length > 0,
    groupId, nodes, simRef, wavesRef, playingIdRef, hoverIdRef, sizeRef, setHover, toggle,
  };
}
