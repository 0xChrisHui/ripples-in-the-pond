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

function pinToRecord(node: GlPhysNode, width: number, height: number): void {
  const record = document.querySelector<HTMLElement>(
    '.score-pond-page__anchor .record-anchor__visual',
  );
  const bounds = record?.getBoundingClientRect();
  const x = bounds?.width ? bounds.left + bounds.width / 2 : width / 2;
  const y = bounds?.height ? bounds.top + bounds.height / 2 : height / 2;
  node.x = node.fx = x;
  node.y = node.fy = y;
}

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
      pinToRecord(node, w, h);
      node.radius = 70;
    }
    simRef.current = sim;
    wavesRef.current = [];
    queueMicrotask(() => setNodes(built.nodes));
    return () => { sim.stop(); };
  }, [generation, track]);

  useEffect(() => {
    if (!track) return;
    let raf = 0;
    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      sizeRef.current = { w, h };
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const node = nodes[0];
        if (!node) return;
        pinToRecord(node, w, h);
        simRef.current?.alpha(0.08).restart();
      });
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, [nodes, track]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const node = nodes[0];
      if (node) pinToRecord(node, window.innerWidth, window.innerHeight);
    });
    return () => cancelAnimationFrame(raf);
  }, [nodes, playing]);

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
