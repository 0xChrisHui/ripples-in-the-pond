'use client';

import { useEffect, useMemo, useRef } from 'react';
import { ShaderMaterial, Vector2, Vector4 } from 'three';
import { fullscreenVertexShader, waterFragmentShader } from './ripple-shaders';
import { addRipple, MAX_RIPPLES } from './use-ripple-fbo';

/**
 * G5 — 程序化水面（球之下、基调之上）。背景常驻微波 + 鼠标/切组涟漪，纯 fragment shader。
 *
 * 关键（2026-06-13 踩坑）：R3F 把 uniforms prop 拷贝进 material，改外部那个对象到不了 shader。
 * 必须拿 material 的 ref，直接改 matRef.current.uniforms.X.value。命令式写入走模块级函数（避 lint）。
 */
const MOON_ANCHOR = { x: 0.35, y: -0.1 };

interface WaterUniforms {
  uTime: { value: number };
  uArtDir: { value: number };
  uMoonDir: { value: Vector2 };
  uRefract: { value: number };
  uMoon: { value: number };
  uRipples: { value: Vector4[] };
  [key: string]: { value: unknown };
}

function setNum(mat: ShaderMaterial | null, key: string, v: number): void {
  if (mat) mat.uniforms[key].value = v;
}
function pushRipple(mat: ShaderMaterial | null, x: number, y: number, t0: number, s: number): void {
  if (mat) addRipple(mat.uniforms.uRipples.value as Vector4[], x, y, t0, s);
}

export default function WaterSurface({ artDir }: { artDir: 'deep' | 'black' }) {
  const matRef = useRef<ShaderMaterial>(null);
  const ripples = useMemo(() => Array.from({ length: MAX_RIPPLES }, () => new Vector4(0, 0, -1, 0)), []);
  const uniforms = useMemo<WaterUniforms>(() => ({
    uTime: { value: 0 },
    uArtDir: { value: artDir === 'black' ? 1 : 0 },
    uMoonDir: { value: new Vector2(MOON_ANCHOR.x, -MOON_ANCHOR.y) },
    uRefract: { value: 0.06 },
    uMoon: { value: 1.6 },
    uRipples: { value: ripples },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  // artDir 动态 → 直接改 material 真身的 uniforms
  useEffect(() => { setNum(matRef.current, 'uArtDir', artDir === 'black' ? 1 : 0); }, [artDir]);

  // uTime 由原生 rAF 持续推进（直接写 material 真身）
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      setNum(matRef.current, 'uTime', performance.now() / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // 指针移动 → 涟漪（节流 ~0.05s）；y 翻转到 uv
  const lastMouse = useRef(0);
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const now = performance.now() / 1000;
      if (now - lastMouse.current < 0.05) return;
      lastMouse.current = now;
      pushRipple(matRef.current, e.clientX / window.innerWidth, 1 - e.clientY / window.innerHeight, now, 0.5);
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  // bg-ripple:wave 事件桥（切组 / hover 涟漪自动进水面）
  useEffect(() => {
    const onWave = (e: Event) => {
      const ce = e as CustomEvent<{ x: number; y: number }>;
      pushRipple(matRef.current, ce.detail.x / window.innerWidth, 1 - ce.detail.y / window.innerHeight, performance.now() / 1000, 0.8);
    };
    window.addEventListener('bg-ripple:wave', onWave);
    return () => window.removeEventListener('bg-ripple:wave', onWave);
  }, []);

  return (
    <mesh frustumCulled={false} renderOrder={-0.5}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={fullscreenVertexShader}
        fragmentShader={waterFragmentShader}
        uniforms={uniforms}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  );
}
