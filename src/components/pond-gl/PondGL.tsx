'use client';

import { Canvas } from '@react-three/fiber';
import { Component, Suspense, useMemo, type ReactNode } from 'react';
import type { GLFlags } from './gl-flags';
import { baseToneVertexShader, baseToneFragmentShader } from './base-tone-shader';
import SphereInstances from './spheres/SphereInstances';
import WaterSurface from './water/WaterSurface';
import RttSpike from './water/spike/RttSpike';
import BgImage from './BgImage';
import type { GlSim } from './spheres/use-gl-sim';

/**
 * GL 渲染层入口 — P8-G G3。
 *
 * 仅 /test1 经 next/dynamic(ssr:false) 挂载，垫在最底层（z-0）与 SVG 共存。
 * glBase=false 或 WebGL 不可用 → 渲染 null，/test1 的 SVG 全套兜底（视觉 = G2 态）。
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

// React 错误边界：WebGL 创建失败 / context lost 抛错时渲染 null。
// class 是 React 唯一支持错误边界的形式（CONVENTIONS §4.2 的合理例外）。
class GLErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    // 不吞错误：留一条日志，便于排查 WebGL 不可用环境
    console.error('[PondGL] WebGL 渲染失败，回退 SVG：', error);
  }
  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

export interface PondGLProps {
  flags: GLFlags;
  glSim?: GlSim;
}

export default function PondGL({ flags, glSim }: PondGLProps) {
  // 基调 / 球 / 水面 / 背景图 / RTT 实验 任一开启都需要 Canvas；都关 = 卸载（回纯 SVG）
  const active = flags.glBase || flags.glSpheres || flags.water || flags.bgImage || flags.rtt;
  // 球开启时才开 AA（基调/水面是全屏无硬边）；useMemo 稳定 gl 对象，避免 Canvas 频繁重建
  const gl = useMemo(() => ({ antialias: flags.glSpheres, alpha: false }), [flags.glSpheres]);
  if (!active) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-0">
      <GLErrorBoundary>
        <Canvas
          // 切 glSpheres 时重挂 Canvas，让 gl(antialias) 干净生效（R3F 该 prop 非热更新）
          key={flags.glSpheres ? 'gl-spheres' : 'gl-base'}
          orthographic
          // 球 / 水面 / RTT 需逐帧动画 → always；仅基调 / 背景图时 demand（只渲一次省帧）
          frameloop={flags.glSpheres || flags.water || flags.rtt ? 'always' : 'demand'}
          dpr={[1, 2]} // DPR cap 2（性能预算）
          gl={gl}
          // 球开启时 manual:true —— 让 SphereInstances 自己把正交相机配成屏幕像素 1:1，
          // 阻止 R3F 的 resize 处理器覆盖我的 frustum；基调/水面走裁剪空间不依赖相机
          camera={{ manual: flags.glSpheres, position: [0, 0, 10], near: -1000, far: 1000 }}
        >
          {/* 背景图（renderOrder -2，最底）与纯色基调互斥：bgImage 开时不画 BaseTone */}
          {flags.bgImage && (
            <Suspense fallback={null}>
              <BgImage url="/test1-bg.png" />
            </Suspense>
          )}
          {flags.glBase && !flags.bgImage && <BaseTone artDir={flags.artDir} />}
          {/* 水面垫在球之下（renderOrder -0.5），基调/背景图之上 */}
          {flags.water && <WaterSurface artDir={flags.artDir} />}
          {flags.glSpheres && glSim && <SphereInstances glSim={glSim} waterOn={flags.water} />}
          {/* H1 spike：RTT 验证全屏盖在最上（renderOrder 10），隔离实验、默认关 */}
          {flags.rtt && <RttSpike />}
        </Canvas>
      </GLErrorBoundary>
    </div>
  );
}
