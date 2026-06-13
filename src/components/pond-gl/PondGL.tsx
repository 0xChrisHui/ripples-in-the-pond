'use client';

import { Canvas } from '@react-three/fiber';
import { Component, useMemo, type ReactNode } from 'react';
import type { GLFlags } from './gl-flags';
import { baseToneVertexShader, baseToneFragmentShader } from './base-tone-shader';

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
}

export default function PondGL({ flags }: PondGLProps) {
  if (!flags.glBase) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-0">
      <GLErrorBoundary>
        <Canvas
          orthographic
          frameloop="demand" // G3 基调静止：只渲一次后休眠，不每帧抢 SVG 的帧（G5 有水面动画再切回 always）
          dpr={[1, 2]} // DPR cap 2（性能预算）
          gl={{ antialias: false, alpha: false }} // 基调是全屏渐变，无边缘可抗锯齿 → 关 AA 省开销（G4 球再开回）
          // 正交相机：G4 起把世界坐标锁成屏幕像素 1:1；G3 基调层走裁剪空间不依赖相机
          camera={{ position: [0, 0, 100], near: 0.1, far: 1000 }}
        >
          <BaseTone artDir={flags.artDir} />
        </Canvas>
      </GLErrorBoundary>
    </div>
  );
}
