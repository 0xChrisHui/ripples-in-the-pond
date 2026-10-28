'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, type Points, type ShaderMaterial } from 'three';
import type { GlSim } from '../../spheres/use-gl-sim';
import { getEffectiveWaterLevel } from '../../water/water-level';
import { prefersReducedMotion } from '../../reduced-motion';
import { collectDiscs, type Disc } from './bubble-env';
import { createBubbleSim, stepBubbles, type BubbleView } from './bubble-sim';
import { getBubbleTuning } from './bubble-tuning';
import { bubbleFragment, bubbleVertex } from './bubble-shaders';

/**
 * P20 池塘气泡。R3F 对象，挂在 <Canvas> 里、画在背景层 → 进背景 FBO，被水面折射与涟漪一起扭曲。
 * flag 关时父组件不挂载本组件（零分配、零监听）。
 * 峰值亮度：BASE_OPACITY 0.4 低于微光 0.6，也低于球高光（红线：装饰不抢球）。
 */
const MAX_BUBBLES = 8;
const BASE_OPACITY = 0.4;
const MIN_SPRITE_PX = 6;      // 光环半径只占精灵的 0.3，再小边缘会被截
const COLOR = new Color('#cce5ff');
// 破水：只要极小水纹，不推球——size/duration 为 0 时 use-gl-sim 的推球波下一帧就被过滤掉，不会产生 NaN。
const POP_STRENGTH = 0.04;    // 对比点击滴水 0.1
const POP_RADIUS = 0.006;     // 对比点击滴水 0.01（占屏比）
function popRipple(x: number, y: number): void {
  window.dispatchEvent(new CustomEvent('bg-ripple:wave', {
    detail: { x, y, strength: POP_STRENGTH * getBubbleTuning().opacity, radius: POP_RADIUS, size: 0, duration: 0 },
  }));
}

export default function PondBubbles({ glSim }: { glSim?: GlSim }) {
  const pointsRef = useRef<Points>(null);
  const matRef = useRef<ShaderMaterial>(null);
  const sim = useMemo(() => createBubbleSim(Math.random), []);
  const discs = useMemo<Disc[]>(() => [], []);
  const views = useMemo<BubbleView[]>(() => [], []);
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(MAX_BUBBLES * 3), 3));
    g.setAttribute('aSize', new BufferAttribute(new Float32Array(MAX_BUBBLES), 1));
    g.setAttribute('aAlpha', new BufferAttribute(new Float32Array(MAX_BUBBLES), 1));
    g.setAttribute('aDepth', new BufferAttribute(new Float32Array(MAX_BUBBLES), 1));
    g.setDrawRange(0, 0);
    return g;
  }, []);
  const uniforms = useMemo(() => ({ uColor: { value: COLOR }, uOpacity: { value: BASE_OPACITY } }), []);

  useFrame((state, delta) => {
    const pts = pointsRef.current;
    const mat = matRef.current;
    if (!pts || !mat) return;
    const w = Math.max(1, glSim?.sizeRef.current.w || window.innerWidth);
    const h = Math.max(1, glSim?.sizeRef.current.h || window.innerHeight);
    const tuning = getBubbleTuning();
    const discCount = collectDiscs(glSim, w, h, discs);
    const n = Math.min(MAX_BUBBLES, stepBubbles(sim, Math.min(delta, 0.1), {
      w, h, discs, discCount, surfaceD: getEffectiveWaterLevel(),
      playing: glSim?.playingIdRef.current != null, reduced: prefersReducedMotion(), tuning, onPop: popRipple,
    }, Math.random, views));
    const pos = geometry.getAttribute('position') as BufferAttribute;
    const size = geometry.getAttribute('aSize') as BufferAttribute;
    const alpha = geometry.getAttribute('aAlpha') as BufferAttribute;
    const depth = geometry.getAttribute('aDepth') as BufferAttribute;
    const dpr = state.gl.getPixelRatio();
    for (let i = 0; i < n; i++) {
      const v = views[i];
      pos.setXYZ(i, (v.x / w) * 2 - 1, 1 - (v.y / h) * 2, 0);
      size.setX(i, Math.max(MIN_SPRITE_PX, (v.radius / 0.3) * dpr));
      alpha.setX(i, v.alpha);
      depth.setX(i, v.depth);
    }
    pos.needsUpdate = size.needsUpdate = alpha.needsUpdate = depth.needsUpdate = true;
    geometry.setDrawRange(0, n);
    mat.uniforms.uOpacity.value = BASE_OPACITY * tuning.opacity;
  });

  return (
    <points ref={pointsRef} geometry={geometry} frustumCulled={false}>
      <shaderMaterial ref={matRef} vertexShader={bubbleVertex} fragmentShader={bubbleFragment}
        uniforms={uniforms} transparent depthTest={false} depthWrite={false} blending={AdditiveBlending} />
    </points>
  );
}
