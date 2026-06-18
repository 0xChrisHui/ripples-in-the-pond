'use client';

import { Canvas } from '@react-three/fiber';
import { Suspense, useMemo } from 'react';
import Test2Water from './Test2Water';
import SphereInstances from '@/src/components/pond-gl/spheres/SphereInstances';
import type { GlSim } from '@/src/components/pond-gl/spheres/use-gl-sim';

/**
 * K7 /test2 — 实验页 GL 入口（抄 /test1 的 PondGL Canvas 配置，但只挂参考水背景 + 球）。
 *
 * 参考水（Test2Water，renderOrder -1，最底）+ 复用 /test1 的 SphereInstances（同一 InstancedMesh
 * 球系统、像素相机自配）。waterOn=true → 球被水位盖住时淡出（露出下方参考水），实现 50/50 观感；
 * motionOn=false → 球深度静止（实验只看"球嵌在明亮水里"的静态观感，不引入浮沉动画）。
 * 纯实验、不入生产；不碰 /test1 任何文件。
 */
export default function Test2Canvas({ glSim }: { glSim: GlSim }) {
  const gl = useMemo(() => ({ antialias: true, alpha: false }), []);
  return (
    <div className="pointer-events-none fixed inset-0 z-0">
      <Canvas
        orthographic
        frameloop="always"
        dpr={[1, 2]}
        gl={gl}
        camera={{ manual: true, position: [0, 0, 10], near: -1000, far: 1000 }}
      >
        <Suspense fallback={null}>
          <Test2Water />
        </Suspense>
        {/* waterOn=false：球不随水位"没入淡出"。/test2 参考水是背景、不折射球，若 true 则水下半数球
            会淡到不可见="显示不全面"。关掉后 35 颗球全显示、叠在明亮参考水上感受"嵌在水里"。 */}
        {glSim.ready && <SphereInstances glSim={glSim} waterOn={false} motionOn={false} />}
      </Canvas>
    </div>
  );
}
