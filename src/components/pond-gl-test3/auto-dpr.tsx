'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';

interface DprState {
  frames: number;
  winStart: number;
  last: number;
  low: number;
  high: number;
  dpr: number;
  maxDpr: number;
}

const clampDpr = (value: number) => Math.min(2, Math.max(1, value));

function createDprState(dpr: number): DprState {
  return { frames: 0, winStart: 0, last: 0, low: 0, high: 0, dpr, maxDpr: dpr };
}

function resetDprState(state: DprState, dpr: number): void {
  Object.assign(state, createDprState(dpr));
}

/** 低 FPS 自动降 DPR；卸载或 context 恢复时回到挂载基准，避免低清状态泄漏到下一次启用。 */
export default function AutoDpr() {
  const gl = useThree((state) => state.gl);
  const setDpr = useThree((state) => state.setDpr);
  const stateRef = useRef(createDprState(clampDpr(gl.getPixelRatio())));

  useEffect(() => {
    const state = stateRef.current;
    const baselineDpr = state.maxDpr;
    const restoreBaseline = () => {
      resetDprState(state, baselineDpr);
      setDpr(baselineDpr);
    };
    const canvas = gl.domElement;
    canvas.addEventListener('webglcontextrestored', restoreBaseline, false);
    return () => {
      canvas.removeEventListener('webglcontextrestored', restoreBaseline, false);
      restoreBaseline();
    };
  }, [gl, setDpr]);

  useFrame(() => {
    const now = performance.now();
    const state = stateRef.current;
    if (state.winStart === 0) { state.winStart = now; state.last = now; return; }
    const dt = now - state.last;
    state.last = now;
    if (dt > 100) { state.winStart = now; state.frames = 0; return; }
    state.frames++;
    if (now - state.winStart < 1000) return;
    const fps = (state.frames * 1000) / (now - state.winStart);
    state.frames = 0;
    state.winStart = now;
    if (fps < 40) { state.low++; state.high = 0; }
    else if (fps > 55) { state.high++; state.low = 0; }
    else { state.low = 0; state.high = 0; }
    if (state.low >= 2 && state.dpr > 1) {
      state.dpr = Math.max(1, state.dpr - 0.5); setDpr(state.dpr); state.low = 0;
      console.info(`[AutoDpr] 低 FPS(${Math.round(fps)}) → 降 DPR 到 ${state.dpr}`);
    } else if (state.high >= 4 && state.dpr < state.maxDpr) {
      state.dpr = Math.min(state.maxDpr, state.dpr + 0.5); setDpr(state.dpr); state.high = 0;
      console.info(`[AutoDpr] FPS 回升(${Math.round(fps)}) → 升 DPR 到 ${state.dpr}`);
    }
  });
  return null;
}
