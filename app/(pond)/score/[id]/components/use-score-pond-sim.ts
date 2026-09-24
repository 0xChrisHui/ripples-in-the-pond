'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ForceCenter, Simulation } from 'd3-force';
import type { GroupId, SimLink, SimNode } from '@/src/components/archipelago/sphere-config';
import { resetDepthShift } from '@/src/components/pond-gl-test3/pointer-fx';
import type { GlSim } from '@/src/components/pond-gl-test3/spheres/use-gl-sim';
import {
  buildGlNodes,
  setupGlSimulation,
  type GlPhysNode,
} from '@/src/components/pond-gl-test3/spheres/gl-sim-setup';
import type { BgWave } from '@/src/components/pond-gl-test3/spheres/gl-sim-waves';
import { prefersReducedMotion } from '@/src/components/pond-gl-test3/reduced-motion';
import type { Track } from '@/src/types/tracks';

const RETURN_DURATION_MS = 1050;

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

function recordCenter(width: number, height: number): { x: number; y: number } {
  const record = document.querySelector<HTMLElement>(
    '.score-pond-page__anchor .record-anchor__visual',
  );
  const bounds = record?.getBoundingClientRect();
  return {
    x: bounds?.width ? bounds.left + bounds.width / 2 : width / 2,
    y: bounds?.height ? bounds.top + bounds.height / 2 : height / 2,
  };
}

function easeInOutCubic(value: number): number {
  return value < 0.5 ? 4 * value ** 3 : 1 - (-2 * value + 2) ** 3 / 2;
}

function releaseToFlow(node: GlPhysNode): void {
  node.fx = null; node.fy = null; node.vx = 0; node.vy = 0; node._dragLoose = true;
}

function placeOnReturnPath(node: GlPhysNode, fromX: number, fromY: number,
  center: { x: number; y: number }, progress: number): void {
  node.x = node.fx = fromX + (center.x - fromX) * progress;
  node.y = node.fy = fromY + (center.y - fromY) * progress;
}

function stopNode(node: GlPhysNode): void {
  node.vx = 0; node.vy = 0; node._dragLoose = false;
}

function setCenterStrength(sim: Simulation<SimNode, SimLink> | null, strength: number): void {
  (sim?.force('center') as ForceCenter<SimNode> | undefined)?.strength(strength);
}
export type ScorePondMotion = { glSim: GlSim | null; visualActive: boolean; returning: boolean };

/** 一枚真实 Track 建一枚水面球；播放时交给首页力场，停止后缓动归位。 */
export function useScorePondSim(track: Track | null, playing: boolean): ScorePondMotion {
  const [nodes, setNodes] = useState<GlPhysNode[]>([]);
  const [generation, setGeneration] = useState(0);
  const [atRest, setAtRest] = useState(true);
  const simRef = useRef<Simulation<SimNode, SimLink> | null>(null);
  const wavesRef = useRef<BgWave[]>([]);
  const playingIdRef = useRef<string | null>(null);
  const hoverIdRef = useRef<string | null>(null);
  const sizeRef = useRef({ w: 0, h: 0 });
  const wasPlayingRef = useRef(false);

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
    const node = nodes[0];
    if (!node) return;
    if (playing) {
      wasPlayingRef.current = true;
      queueMicrotask(() => setAtRest(false));
      releaseToFlow(node);
      setCenterStrength(simRef.current, 0);
      simRef.current?.alpha(0.12).restart();
      return;
    }
    if (!wasPlayingRef.current) return;
    wasPlayingRef.current = false;
    setCenterStrength(simRef.current, 0.03);
    if (prefersReducedMotion()) {
      pinToRecord(node, window.innerWidth, window.innerHeight);
      queueMicrotask(() => setAtRest(true));
      return;
    }
    const start = performance.now();
    const fromX = node.x ?? window.innerWidth / 2;
    const fromY = node.y ?? window.innerHeight / 2;
    let raf = 0;
    const returnHome = (now: number) => {
      const progress = Math.min(1, (now - start) / RETURN_DURATION_MS);
      const eased = easeInOutCubic(progress);
      const center = recordCenter(window.innerWidth, window.innerHeight);
      placeOnReturnPath(node, fromX, fromY, center, eased);
      if (progress < 1) raf = requestAnimationFrame(returnHome);
      else {
        stopNode(node);
        queueMicrotask(() => setAtRest(true));
      }
    };
    raf = requestAnimationFrame(returnHome);
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
  }, []);

  const retry = useCallback(() => setGeneration((value) => value + 1), []);
  const setHover = useCallback((id: string | null) => { hoverIdRef.current = id; }, []);
  const setGroup = useCallback(() => undefined, []) as (id: GroupId) => void;
  const toggle = useCallback(async () => undefined, []) as (track: Track) => Promise<void>;

  const glSim = useMemo<GlSim>(() => ({
    ready: nodes.length === 1, loading: nodes.length === 0, error: false,
    retry, groupId: 'A', nodes, simRef, wavesRef, playingIdRef, hoverIdRef,
    sizeRef, setHover, setGroup, toggle,
  }), [nodes, retry, setGroup, setHover, toggle]);
  if (!track) return { glSim: null, visualActive: false, returning: false };
  return {
    glSim,
    visualActive: playing || !atRest,
    returning: !playing && !atRest,
  };
}
