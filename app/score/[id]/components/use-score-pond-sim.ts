'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Simulation } from 'd3-force';
import type { GroupId, SimLink, SimNode } from '@/src/components/archipelago/sphere-config';
import { resetDepthShift } from '@/src/components/pond-gl-test3/pointer-fx';
import type { GlSim } from '@/src/components/pond-gl-test3/spheres/use-gl-sim';
import {
  buildGlNodes,
  setupGlSimulation,
  type GlPhysNode,
} from '@/src/components/pond-gl-test3/spheres/gl-sim-setup';
import type { BgWave } from '@/src/components/pond-gl-test3/spheres/gl-sim-waves';
import { resetWaterLine } from '@/src/components/pond-gl-test3/water/water-level';
import type { Track } from '@/src/types/tracks';

/** 一枚真实 Track 建一枚固定水面球；播放状态只写 ref，不建立第二套时钟。 */
export function useScorePondSim(track: Track | null, playing: boolean): GlSim | null {
  const [nodes, setNodes] = useState<GlPhysNode[]>([]);
  const [generation, setGeneration] = useState(0);
  const simRef = useRef<Simulation<SimNode, SimLink> | null>(null);
  const wavesRef = useRef<BgWave[]>([]);
  const playingIdRef = useRef<string | null>(null);
  const hoverIdRef = useRef<string | null>(null);
  const sizeRef = useRef({ w: 0, h: 0 });

  useEffect(() => {
    playingIdRef.current = playing && track ? track.id : null;
  }, [playing, track]);

  useEffect(() => {
    if (!track) {
      simRef.current?.stop();
      simRef.current = null;
      queueMicrotask(() => setNodes([]));
      return;
    }
    const w = window.innerWidth;
    const h = window.innerHeight;
    const built = buildGlNodes([track], 'A');
    resetWaterLine();
    resetDepthShift();
    sizeRef.current = { w, h };
    const { sim } = setupGlSimulation(built.nodes, built.links, built.assignment, w, h);
    const node = built.nodes[0];
    if (node) {
      node.x = w >= 768 ? w * 0.56 : w / 2;
      node.y = h * 0.55;
      node.fx = node.x;
      node.fy = node.y;
      node.radius = 70;
    }
    simRef.current = sim;
    wavesRef.current = [];
    queueMicrotask(() => setNodes(built.nodes));
    return () => { sim.stop(); };
  }, [generation, track]);

  useEffect(() => {
    if (!track) return;
    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      sizeRef.current = { w, h };
      const node = nodes[0];
      if (!node) return;
      node.x = node.fx = w >= 768 ? w * 0.56 : w / 2;
      node.y = node.fy = h * 0.55;
      simRef.current?.alpha(0.08).restart();
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, [nodes, track]);

  useEffect(() => {
    const onWave = (event: Event) => {
      const detail = (event as CustomEvent<BgWave & { duration: number }>).detail;
      wavesRef.current.push({ ...detail, spawnTime: performance.now(), duration: detail.duration * 1000 });
    };
    window.addEventListener('bg-ripple:wave', onWave);
    return () => window.removeEventListener('bg-ripple:wave', onWave);
  }, []);

  useEffect(() => () => {
    simRef.current?.stop();
    wavesRef.current = [];
    resetDepthShift();
    resetWaterLine();
  }, []);

  const retry = useCallback(() => setGeneration((value) => value + 1), []);
  const setHover = useCallback((id: string | null) => { hoverIdRef.current = id; }, []);
  const setGroup = useCallback(() => undefined, []) as (id: GroupId) => void;
  const toggle = useCallback(async () => undefined, []) as (track: Track) => Promise<void>;

  if (!track) return null;
  return {
    ready: nodes.length === 1, loading: nodes.length === 0, error: false,
    retry, groupId: 'A', nodes, simRef, wavesRef, playingIdRef, hoverIdRef,
    sizeRef, setHover, setGroup, toggle,
  };
}
