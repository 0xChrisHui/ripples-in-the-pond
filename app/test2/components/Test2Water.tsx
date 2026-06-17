'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, useLoader } from '@react-three/fiber';
import {
  DataTexture,
  RedFormat,
  UnsignedByteType,
  LinearFilter,
  ClampToEdgeWrapping,
  TextureLoader,
  Texture,
  ShaderMaterial,
  Vector2,
} from 'three';
import {
  allocSim, drop, stepWater, packSim, pixelToGrid, type SimState,
} from './test2-water-sim';

/**
 * K7 /test2 — 参考水实验背景（移植自 references/flower-water-ripples）。
 *
 * 纯实验、不入生产：CPU 粗网格涟漪 sim（test2-water-sim.ts）每帧推进 → 打包进单通道
 * DataTexture（高度场）→ 全屏 shader 用「水照片 + 折射 + 阳光漫反射/高光/光带/光池」合成
 * （FSH 里花瓣 / 花朵 swirl 段剔除，只留水面光影）。指针划过 / 点击在水面落滴，背景常驻微波。
 * 仅 /test2 用，不碰 /test1 任何文件。
 */

/** 全屏裁剪空间平面 vertex（position∈[-1,1] → vUv，y 翻转匹配参考 uv 约定） */
const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = vec2(position.x * 0.5 + 0.5, 0.5 - position.y * 0.5);
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// 折射 + 阳光合成 fragment：1:1 移植参考 FSH 的 grad/refr/light/spec/band/pool（去花朵 swirl 段）。
const FRAG = /* glsl */ `
  precision mediump float;
  varying vec2 vUv;
  uniform sampler2D uPhoto;
  uniform sampler2D uSim;
  uniform vec2  uTexel;  // sim texel size
  uniform vec2  uFrac;   // cover-crop fractions
  uniform float uRefr;
  uniform float uTime;

  float h(vec2 p) { return texture2D(uSim, p).r - 0.5019608; }

  void main() {
    vec2 e = uTexel;
    float hl = h(vUv - vec2(e.x, 0.0));
    float hr = h(vUv + vec2(e.x, 0.0));
    float ht = h(vUv - vec2(0.0, e.y));
    float hb = h(vUv + vec2(0.0, e.y));
    vec2 grad = vec2(hr - hl, hb - ht);

    // cover-crop 居中裁剪到屏幕 + 高度场梯度折射位移
    vec2 puv = (vUv - 0.5) * uFrac + 0.5;
    puv += grad * uRefr;
    puv = clamp(puv, 0.002, 0.998);
    vec3 col = texture2D(uPhoto, puv).rgb;

    // 漫反射涟漪光照（阳光来自左上）
    float light = (grad.x + grad.y) * 2.4;
    col += light * vec3(1.0, 0.98, 0.92);

    // 波峰镜面高光
    float spec = max(0.0, light - 0.045) * 5.5;
    col += spec * vec3(1.0, 1.0, 0.96);

    // 缓慢飘移的阳光光带
    float band = sin(dot(vUv, vec2(1.3, 1.0)) * 2.6 - uTime * 0.2);
    col += smoothstep(0.78, 1.0, band) * 0.065;

    // 游走的阳光池
    vec2 sc = vec2(0.5 + 0.22 * cos(uTime * 0.07), 0.36 + 0.18 * sin(uTime * 0.09));
    float pool = 1.0 - smoothstep(0.0, 0.55, distance(vUv * vec2(1.0, 1.35), sc * vec2(1.0, 1.35)));
    col += pool * 0.055;

    gl_FragColor = vec4(col, 1.0);
  }
`;

/** cover-crop fraction：照片等比放大铺满屏幕、居中裁剪（参考 updateCover）。模块级 mutate 走 helper。 */
function applyCover(mat: ShaderMaterial, w: number, h: number, pw: number, ph: number): void {
  const scale = Math.max(w / pw, h / ph);
  mat.uniforms.uFrac.value.set(w / (scale * pw), h / (scale * ph));
}

// 命令式写 DataTexture（mutate 走模块级 helper，避开 react-hooks/immutability：禁止在 render/effect/
// useFrame 体内直接改 useMemo 返回值；改值放进接收它作参数的模块级函数）。
/** 屏幕比例变 → 把纹理的 image 换成新尺寸的高度场缓冲并标脏 */
function resizeSimTexture(tex: DataTexture, s: SimState): void {
  tex.image = { data: s.bytes, width: s.nx, height: s.ny };
  tex.needsUpdate = true;
}
/** 每帧 sim 推进后标纹理脏 → GPU 重传当前高度场字节 */
function flagSimTexture(tex: DataTexture): void {
  tex.needsUpdate = true;
}

export default function Test2Water() {
  const size = useThree((st) => st.size);
  const photo = useLoader(TextureLoader, '/test2-water.jpg') as Texture;
  const matRef = useRef<ShaderMaterial>(null);
  const breathT = useRef(0);
  const lastPtr = useRef({ x: -1, y: -1 });

  // 初始 sim 网格：用中性 16:9 建一次（不读 size → 满足 React Compiler 的 memo 依赖一致性，
  // 也不在 render 期读 ref）。挂载后第一帧前的 size effect 会按真实屏幕比例重建并写回 ref。
  const initSim = useMemo(() => allocSim(16, 9), []);
  const sim = useRef<SimState>(initSim);

  // 高度场单通道 DataTexture（Linear 采样让折射梯度平滑）；屏幕比例变时复用同一对象重设 image
  const simTex = useMemo(() => {
    const tex = new DataTexture(initSim.bytes, initSim.nx, initSim.ny, RedFormat, UnsignedByteType);
    tex.minFilter = LinearFilter;
    tex.magFilter = LinearFilter;
    tex.wrapS = ClampToEdgeWrapping;
    tex.wrapT = ClampToEdgeWrapping;
    tex.needsUpdate = true;
    return tex;
  }, [initSim]);

  const uniforms = useMemo(() => ({
    uPhoto: { value: photo },
    uSim: { value: simTex },
    uTexel: { value: new Vector2(1 / initSim.nx, 1 / initSim.ny) },
    uFrac: { value: new Vector2(1, 1) },
    uRefr: { value: 0.42 },
    uTime: { value: 0 },
  }), [photo, simTex, initSim]);

  // 屏幕尺寸变 → 重建 sim 网格 + 重设纹理尺寸（参考 layout→allocSim），并刷 texel/cover
  useEffect(() => {
    sim.current = allocSim(size.width, size.height);
    resizeSimTexture(simTex, sim.current);
    const mat = matRef.current;
    const img = photo.image as { width: number; height: number } | undefined;
    if (mat) {
      mat.uniforms.uTexel.value.set(1 / sim.current.nx, 1 / sim.current.ny);
      if (img) applyCover(mat, size.width, size.height, img.width, img.height);
    }
  }, [size.width, size.height, simTex, photo]);

  // 指针落滴：划过(小滴) / 按下(大滴)。视口坐标 → 粗网格格点；常驻微波在 useFrame 里随机落点。
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const s = sim.current, last = lastPtr.current;
      if (last.x >= 0 && Math.hypot(e.clientX - last.x, e.clientY - last.y) > 2) {
        const [gx, gy] = pixelToGrid(s, e.clientX, e.clientY, window.innerWidth, window.innerHeight);
        drop(s, gx, gy, 2.4, 0.45);
      }
      lastPtr.current = { x: e.clientX, y: e.clientY };
    };
    const down = (e: PointerEvent) => {
      const s = sim.current;
      const [gx, gy] = pixelToGrid(s, e.clientX, e.clientY, window.innerWidth, window.innerHeight);
      drop(s, gx, gy, 6, 2.2);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerdown', down);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerdown', down);
    };
  }, []);

  // 每帧：常驻微波 → 推进波动方程 → 打包上传纹理 → 刷新阳光的时间 uniform。
  useFrame((state, dt) => {
    const mat = matRef.current;
    if (!mat) return;
    const s = sim.current;
    // 参考 frame：随机间隔在水面落极小滴（静止也有生命感）
    breathT.current -= Math.min(0.05, dt);
    if (breathT.current <= 0) {
      breathT.current = 0.4 + Math.random() * 1.3;
      drop(s, 2 + Math.random() * (s.nx - 4), 2 + Math.random() * (s.ny - 4), 2, 0.14);
    }
    stepWater(s);
    packSim(s);
    flagSimTexture(simTex);
    mat.uniforms.uTime.value = state.clock.getElapsedTime();
  });

  return (
    <mesh frustumCulled={false} renderOrder={-1}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  );
}
