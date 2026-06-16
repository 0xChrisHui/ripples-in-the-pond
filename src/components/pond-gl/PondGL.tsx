'use client';

import { Canvas } from '@react-three/fiber';
import { Component, Suspense, useMemo, useState, type ReactNode } from 'react';
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

export interface PondGLProps {
  flags: GLFlags;
  glSim?: GlSim;
}

export default function PondGL({ flags, glSim }: PondGLProps) {
  // 基调 / 球 / 水面 / 背景图 / RTT / 扭曲水面 任一开启都需要 Canvas；都关 = 卸载（回纯 SVG）
  const active = flags.glBase || flags.glSpheres || flags.water || flags.bgImage || flags.rtt || flags.waterFx;
  // 球开启时才开 AA（基调/水面是全屏无硬边）；useMemo 稳定 gl 对象，避免 Canvas 频繁重建
  const gl = useMemo(() => ({ antialias: flags.glSpheres, alpha: false }), [flags.glSpheres]);
  const [lost, setLost] = useState(false); // J1：context lost 期间盖兜底，restored 后撤
  if (!active) return null;
  // J1：WebGL 不可用 / 强制兜底（测试）→ 直接铺夜塘兜底，不挂 Canvas、不白屏
  if (!isWebGLAvailable() || flags.forceFallback) {
    return (
      <div className="pointer-events-none fixed inset-0 z-0">
        <GlFallback artDir={flags.artDir} />
      </div>
    );
  }
  return (
    <div className="pointer-events-none fixed inset-0 z-0">
      <GLErrorBoundary fallback={<GlFallback artDir={flags.artDir} />}>
        <Canvas
          // 切 glSpheres 时重挂 Canvas，让 gl(antialias) 干净生效（R3F 该 prop 非热更新）
          key={flags.glSpheres ? 'gl-spheres' : 'gl-base'}
          orthographic
          // 球 / 水面 / RTT / 扭曲 需逐帧动画 → always；仅基调 / 背景图时 demand（只渲一次省帧）
          frameloop={flags.glSpheres || flags.water || flags.rtt || flags.waterFx ? 'always' : 'demand'}
          dpr={[1, 2]} // DPR cap 2（性能预算）
          gl={gl}
          // 球开启时 manual:true —— 让 SphereInstances 自己把正交相机配成屏幕像素 1:1，
          // 阻止 R3F 的 resize 处理器覆盖我的 frustum；基调/水面走裁剪空间不依赖相机
          camera={{ manual: flags.glSpheres, position: [0, 0, 10], near: -1000, far: 1000 }}
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
        </Canvas>
      </GLErrorBoundary>
      {/* J1：context lost 期间盖兜底夜塘，three 恢复后自动撤 */}
      {lost && <GlFallback artDir={flags.artDir} />}
    </div>
  );
}
