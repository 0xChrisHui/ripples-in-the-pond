'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Simulation } from 'd3-force';
import { usePlayer } from '@/src/components/player/PlayerProvider';
import type { GroupId, SimLink, SimNode } from '@/src/components/archipelago/sphere-config';
import type { Track } from '@/src/types/tracks';
import type { BgWave } from '@/src/components/pond-gl-test3/spheres/gl-sim-waves';
import {
  buildGlNodes,
  resizeGlSim,
  setupGlSimulation,
  type GlPhysNode,
} from '@/src/components/pond-gl-test3/spheres/gl-sim-setup';
import type { GlSim } from '@/src/components/pond-gl-test3/spheres/use-gl-sim';
import { resetDepthShift } from '@/src/components/pond-gl-test3/pointer-fx';
import { resetWaterLine } from '@/src/components/pond-gl-test3/water/water-level';

export function useSingleSphereSim(track: Track): GlSim {
  const { playing, currentTrack, toggle } = usePlayer();
  const [nodes, setNodes] = useState<GlPhysNode[]>([]);
  const [generation, setGeneration] = useState(0);
  const simRef = useRef<Simulation<SimNode, SimLink> | null>(null);
  const wavesRef = useRef<BgWave[]>([]);
  const playingIdRef = useRef<string | null>(null);
  const hoverIdRef = useRef<string | null>(null);
  const sizeRef = useRef({ w: 0, h: 0 });
  const anchorsRef = useRef<Map<string, { x: number; y: number; strength: number }> | null>(null);

  useEffect(() => {
    playingIdRef.current = playing && currentTrack?.id === track.id ? track.id : null;
  }, [currentTrack, playing, track.id]);

  useEffect(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const built = buildGlNodes([track], 'A');
    resetWaterLine();
    resetDepthShift();
    sizeRef.current = { w, h };
    const { sim, anchors } = setupGlSimulation(built.nodes, built.links, built.assignment, w, h);
    const anchor = built.nodes[0];
    if (anchor) {
      anchor.x = w >= 768 ? w * 0.56 : w / 2;
      anchor.y = h * 0.54;
      anchor.fx = anchor.x;
      anchor.fy = anchor.y;
      anchor.radius = 70; // 同一锚点：日食直径对齐 124–152px 唱片，不在切态时骤缩。
    }
    simRef.current = sim;
    anchorsRef.current = anchors;
    wavesRef.current = [];
    queueMicrotask(() => setNodes(built.nodes));
    return () => {
      sim.stop();
      if (simRef.current === sim) simRef.current = null;
    };
  }, [generation, track]);

  useEffect(() => {
    const onWave = (event: Event) => {
      const wave = event as CustomEvent<{ x: number; y: number; size: number; duration: number }>;
      wavesRef.current.push({
        x: wave.detail.x,
        y: wave.detail.y,
        size: wave.detail.size,
        spawnTime: performance.now(),
        duration: wave.detail.duration * 1000,
      });
    };
    window.addEventListener('bg-ripple:wave', onWave);
    return () => window.removeEventListener('bg-ripple:wave', onWave);
  }, []);

  useEffect(() => {
    const onResize = () => {
      const old = sizeRef.current;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const sim = simRef.current;
      const anchors = anchorsRef.current;
      if (old.w && old.h && sim && anchors) {
        resizeGlSim(sim, nodes, anchors, w / old.w, h / old.h, w, h);
      }
      sizeRef.current = { w, h };
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, [nodes]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) simRef.current?.stop();
      else simRef.current?.alphaTarget(0.008).restart();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const retry = useCallback(() => setGeneration((value) => value + 1), []);
  const setHover = useCallback((id: string | null) => { hoverIdRef.current = id; }, []);
  const setGroup = useCallback((id: GroupId) => {
    if (id === 'A') retry();
  }, [retry]);

  return {
    ready: nodes.length === 1,
    loading: nodes.length === 0,
    error: false,
    retry,
    groupId: 'A',
    nodes,
    simRef,
    wavesRef,
    playingIdRef,
    hoverIdRef,
    sizeRef,
    setHover,
    setGroup,
    toggle,
  };
}
