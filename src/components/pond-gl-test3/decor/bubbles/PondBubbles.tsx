'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, Vector2, Vector3, type Points, type ShaderMaterial } from 'three';
import type { GlSim } from '../../spheres/use-gl-sim';
import { getEffectiveWaterLevel } from '../../water/water-level';
import { prefersReducedMotion } from '../../reduced-motion';
import { collectDiscs, type Disc } from './bubble-env';
import { createBubbleSim, stepBubbles, type BubbleView } from './bubble-sim';
import { getBubbleTuning, takeBurst } from './bubble-tuning';
import { hasNoteHost, makeCarrierPort, setSuppressed } from './bubble-bridge';
import { bubbleFragment, bubbleVertex } from './bubble-shaders';

/**
 * P20 池塘气泡。R3F 对象，挂在 <Canvas> 里、画在背景层 → 进背景 FBO，被水面折射与涟漪一起扭曲。
 * flag 关时父组件不挂载本组件（零分配、零监听）。全部数值来自调参表（bubble-tuning）。
 * 默认峰值亮度 0.4：低于微光 0.6，也低于球高光（红线：装饰不抢球）。
 */
const MAX_BUBBLES = 8;
// 破水：只要极小水纹，不推球——size/duration 为 0 时 use-gl-sim 的推球波下一帧就被过滤掉，不会产生 NaN。
function popRipple(x: number, y: number): void {
  const t = getBubbleTuning();
  window.dispatchEvent(new CustomEvent('bg-ripple:wave', {
    detail: { x, y, strength: t.popStrength, radius: t.popRadius, size: 0, duration: 0 },
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
  const port = useMemo(() => makeCarrierPort(() => ({ w: glSim?.sizeRef.current.w || window.innerWidth, h: glSim?.sizeRef.current.h || window.innerHeight })), [glSim]);
  const uniforms = useMemo(() => ({
    uColor: { value: new Color('#cce5ff') }, uOpacity: { value: 0.4 }, uDepthDim: { value: 0.45 }, uRingR: { value: 0.3 },
    uRingSoft: { value: new Vector2(0.16, 0.05) }, uRingStrength: { value: 0.55 }, uInner: { value: 0.06 },
    uGlint: { value: new Vector2(0.25, 0.6) }, uGlintPos: { value: new Vector3(-0.13, -0.13, 0.0016) },
  }), []);

  useFrame((state, delta) => {
    const pts = pointsRef.current;
    const mat = matRef.current;
    if (!pts || !mat) return;
    const w = Math.max(1, glSim?.sizeRef.current.w || window.innerWidth);
    const h = Math.max(1, glSim?.sizeRef.current.h || window.innerHeight);
    const tuning = getBubbleTuning();
    const discCount = collectDiscs(glSim, w, h, discs, tuning);
    const playing = glSim?.playingIdRef.current != null;
    const reduced = prefersReducedMotion();
    setSuppressed((playing && tuning.suppressPlaying === 1) || reduced || tuning.notesEnabled === 0); // 日蚀 / 减弱动效期间撤下手记（D4）
    const n = Math.min(MAX_BUBBLES, stepBubbles(sim, Math.min(delta, 0.1), {
      w, h, discs, discCount, surfaceD: getEffectiveWaterLevel(), playing, reduced, tuning,
      carrier: hasNoteHost() && tuning.notesEnabled ? port : undefined, burst: takeBurst(), onPop: popRipple,
    }, Math.random, views));
    const pos = geometry.getAttribute('position') as BufferAttribute;
    const size = geometry.getAttribute('aSize') as BufferAttribute;
    const alpha = geometry.getAttribute('aAlpha') as BufferAttribute;
    const depth = geometry.getAttribute('aDepth') as BufferAttribute;
    const dpr = state.gl.getPixelRatio();
    for (let i = 0; i < n; i++) {
      const v = views[i];
      pos.setXYZ(i, (v.x / w) * 2 - 1, 1 - (v.y / h) * 2, 0);
      size.setX(i, Math.max(tuning.minSpritePx, (v.radius / tuning.ringRadius) * dpr));
      alpha.setX(i, v.alpha);
      depth.setX(i, v.depth);
    }
    pos.needsUpdate = size.needsUpdate = alpha.needsUpdate = depth.needsUpdate = true;
    geometry.setDrawRange(0, n);
    const u = mat.uniforms;
    (u.uColor.value as Color).set(tuning.colorHex);
    u.uOpacity.value = tuning.opacity; u.uDepthDim.value = tuning.depthDim; u.uRingR.value = tuning.ringRadius;
    (u.uRingSoft.value as Vector2).set(tuning.ringSoftDeep, tuning.ringSoftSurface); u.uRingStrength.value = tuning.ringStrength;
    u.uInner.value = tuning.innerFill; (u.uGlint.value as Vector2).set(tuning.glintDeep, tuning.glintSurface);
    (u.uGlintPos.value as Vector3).set(tuning.glintX, tuning.glintY, tuning.glintSize);
  });

  return (
    <points ref={pointsRef} geometry={geometry} frustumCulled={false}>
      <shaderMaterial ref={matRef} vertexShader={bubbleVertex} fragmentShader={bubbleFragment}
        uniforms={uniforms} transparent depthTest={false} depthWrite={false} blending={AdditiveBlending} />
    </points>
  );
}
