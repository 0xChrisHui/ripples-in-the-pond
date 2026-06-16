'use client';

import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { Component, Suspense, useMemo, useRef, useState, type ReactNode } from 'react';
import { isWebGLAvailable, type GLFlags } from './gl-flags';
import { baseToneVertexShader, baseToneFragmentShader } from './base-tone-shader';
import SphereInstances from './spheres/SphereInstances';
import WaterSurface from './water/WaterSurface';
import WaterDistort from './water/WaterDistort';
import RttSpike from './water/spike/RttSpike';
import BgImage from './BgImage';
import type { GlSim } from './spheres/use-gl-sim';

/**
 * GL 渲染层入口 — P8-G G3。
 *
 * 仅 /test1 经 next/dynamic(ssr:false) 挂载，垫在最底层（z-0）。
 * 都关 → 渲染 null；WebGL 不可用 / 渲染崩了 / context lost → 渲染 GlFallback 夜塘兜底（不白屏，J1）。
 * 包体纪律：本组件及其依赖（three/R3F）只进 /test1 的异步 chunk，首页 bundle 零增量。
 */

// 基调层：全屏裁剪空间平面，按 artDir 输出深色水体基调或纯黑。
function BaseTone({ artDir }: { artDir: GLFlags['artDir'] }) {
  const uniforms = useMemo(
    () => ({ uMode: { value: artDir === 'black' ? 1 : 0 } }),
    [artDir],
  );
  return (
    <mesh frustumCulled={false} renderOrder={-1}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        key={artDir}
        vertexShader={baseToneVertexShader}
        fragmentShader={baseToneFragmentShader}
        uniforms={uniforms}
        depthWrite={false}
      />
    </mesh>
  );
}

// React 错误边界：WebGL 创建失败 / 渲染抛错时渲染 fallback（J1 起 = GlFallback 夜塘，不再 null/白屏）。
// class 是 React 唯一支持错误边界的形式（CONVENTIONS §4.2 的合理例外）。
class GLErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    // 不吞错误：留一条日志，便于排查 WebGL 不可用环境
    console.error('[PondGL] WebGL 渲染失败，回退兜底：', error);
  }
  render() {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}

// J1 — 兜底夜塘（纯 CSS 径向渐晕，色值对齐 base-tone-shader 的 deep/black）。无 WebGL / 崩了 / context lost 时铺上，不白屏。
function GlFallback({ artDir }: { artDir: GLFlags['artDir'] }) {
  const bg = artDir === 'black'
    ? '#000'
    : 'radial-gradient(ellipse at 50% 50%, #030a09 0%, #010303 82%)';
  return <div className="absolute inset-0" style={{ background: bg }} aria-hidden="true" />;
}

// J3 — 低 FPS 自动降 DPR（最广的降配杠杆：DPR 减半 = 全管线像素减半，含水面 FBO）。
// 每 1s 窗口测 FPS；持续 <40 → 降 0.5（到 1 为底），持续 >55 → 升回（到初始 DPR 为顶）。
// 滞回：跌得快(2 窗)、回得慢(4 窗)，防来回抖。DPR-1 屏无 headroom → 不动（水面 RES 降配挂后续）。
function AutoDpr() {
  const gl = useThree((s) => s.gl);
  const setDpr = useThree((s) => s.setDpr);
  const s = useRef({ frames: 0, winStart: 0, last: 0, low: 0, high: 0, dpr: 0, maxDpr: 0 });
  useFrame(() => {
    const now = performance.now();
    const st = s.current;
    if (st.maxDpr === 0) { st.maxDpr = gl.getPixelRatio(); st.dpr = st.maxDpr; st.winStart = now; st.last = now; }
    const dt = now - st.last;
    st.last = now;
    if (dt > 100) { st.winStart = now; st.frames = 0; return; } // tab 恢复跳过（rAF 暂停过）
    st.frames++;
    if (now - st.winStart < 1000) return;
    const fps = (st.frames * 1000) / (now - st.winStart);
    st.frames = 0;
    st.winStart = now;
    if (fps < 40) { st.low++; st.high = 0; } else if (fps > 55) { st.high++; st.low = 0; } else { st.low = 0; st.high = 0; }
    if (st.low >= 2 && st.dpr > 1) { st.dpr = Math.max(1, st.dpr - 0.5); setDpr(st.dpr); st.low = 0; }
    else if (st.high >= 4 && st.dpr < st.maxDpr) { st.dpr = Math.min(st.maxDpr, st.dpr + 0.5); setDpr(st.dpr); st.high = 0; }
  });
  return null;
}

export interface PondGLProps {
  flags: GLFlags;
  glSim?: GlSim;
}

export default function PondGL({ flags, glSim }: PondGLProps) {
  // 基调 / 球 / 水面 / 背景图 / RTT / 扭曲水面 任一开启都需要 Canvas；都关 = 卸载（回纯 SVG）
  const active = flags.glBase || flags.glSpheres || flags.water || flags.bgImage || flags.rtt || flags.waterFx;
  // J1：gl 对象恒定（AA 固定开）——不再随 glSpheres 变。原本为换 AA 用 key 重挂 Canvas，
  // 但重挂会新建/泄漏 WebGL context（多次切球 → context 累积被浏览器丢弃 → 球闪一下就没）。
  const gl = useMemo(() => ({ antialias: true, alpha: false }), []);
  const [lost, setLost] = useState(false); // J1：context lost 期间盖兜底，restored 后撤
  if (!active) return null;
  // J1：真没 WebGL → 不挂 Canvas，直接铺夜塘兜底（不白屏）
  if (!isWebGLAvailable()) {
    return (
      <div className="pointer-events-none fixed inset-0 z-0">
        <GlFallback artDir={flags.artDir} />
      </div>
    );
  }
  // context lost（GPU 重置）或 forceFallback（测试）→ 盖兜底在 Canvas 之上（**不卸载 Canvas**，
  // 避免重挂丢球：早先 forceFallback 走 early-return 卸 Canvas，关掉后重挂 GL 球不回来）
  const showFallback = lost || flags.forceFallback;
  return (
    <div className="pointer-events-none fixed inset-0 z-0">
      <GLErrorBoundary fallback={<GlFallback artDir={flags.artDir} />}>
        <Canvas
          orthographic
          // 球 / 水面 / RTT / 扭曲 需逐帧动画 → always；仅基调 / 背景图时 demand（只渲一次省帧）
          frameloop={flags.glSpheres || flags.water || flags.rtt || flags.waterFx ? 'always' : 'demand'}
          dpr={[1, 2]} // DPR cap 2（性能预算）
          gl={gl}
          // manual:true 恒定——base/水面走裁剪空间不用相机；球开时 SphereInstances 自己配像素相机。
          // 不再随 glSpheres 改 key 重挂 Canvas（重挂泄漏 context），切球只挂/卸 SphereInstances 这个 mesh
          camera={{ manual: true, position: [0, 0, 10], near: -1000, far: 1000 }}
          // J1：GPU 重置丢 context → 盖兜底 + preventDefault 允许浏览器恢复；restored → 撤兜底
          onCreated={({ gl: renderer }) => {
            const c = renderer.domElement;
            c.addEventListener('webglcontextlost', (e) => { e.preventDefault(); setLost(true); }, false);
            c.addEventListener('webglcontextrestored', () => setLost(false), false);
          }}
        >
          {/* 背景图（renderOrder -2，最底）与纯色基调互斥：bgImage 开时不画 BaseTone */}
          {flags.bgImage && (
            <Suspense fallback={null}>
              <BgImage url="/test1-bg.png" />
            </Suspense>
          )}
          {flags.glBase && !flags.bgImage && <BaseTone artDir={flags.artDir} />}
          {/* 旧程序化水面（renderOrder -0.5）；waterFx 开时退役、由 WaterDistort 全屏扭曲取代 */}
          {flags.water && !flags.waterFx && <WaterSurface artDir={flags.artDir} />}
          {flags.glSpheres && glSim && <SphereInstances glSim={glSim} waterOn={flags.water} motionOn={flags.sphereMotion} />}
          {/* H1 spike：RTT 验证全屏盖在最上（renderOrder 10），隔离实验、默认关 */}
          {flags.rtt && <RttSpike />}
          {/* H2/H3：扭曲水面——渲真场景进 FBO 全屏折射扭曲 + 水位遮罩（接管渲染循环，返回 null） */}
          {flags.waterFx && <WaterDistort debug={flags.waterDbg} glSim={glSim} />}
          {/* J3：低 FPS 自动降 DPR 保流畅（仅测时长 + setDpr，不渲染） */}
          {flags.autoDegrade && <AutoDpr />}
        </Canvas>
      </GLErrorBoundary>
      {/* J1：context lost / forceFallback → 盖兜底夜塘（Canvas 仍在底下跑，撤掉即恢复） */}
      {showFallback && <GlFallback artDir={flags.artDir} />}
    </div>
  );
}
