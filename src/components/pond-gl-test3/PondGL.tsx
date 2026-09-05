'use client';

import { Canvas, useThree } from '@react-three/fiber';
import { Component, Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { isWebGLAvailable, pickLifeFlags, type GLFlags } from './gl-flags';
import { useWakeField } from './life/wake-field';
import { baseToneVertexShader, baseToneFragmentShader } from './base-tone-shader';
import SphereInstances from './spheres/SphereInstances';
import WaterSurface from './water/WaterSurface';
import WaterDistort from './water/WaterDistort';
import RttSpike from './water/spike/RttSpike';
import FloatingMotes from './decor/FloatingMotes';
import WaterPlants from './decor/WaterPlants';
import WaterColumns from './decor/WaterColumns';
import BgImage from './BgImage';
import WaterPetals from './decor/WaterPetals';
import type { GlSim } from './spheres/use-gl-sim';
import AutoDpr from './auto-dpr';

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
export type GlHealth = 'unavailable' | 'healthy' | 'lost' | 'error' | 'forced';

class GLErrorBoundary extends Component<{
  children: ReactNode;
  fallback: ReactNode;
  onError: () => void;
}, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    // 不吞错误：留一条日志，便于排查 WebGL 不可用环境
    console.error('[PondGL] WebGL 渲染失败，回退兜底：', error);
    this.props.onError();
  }
  render() {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}

/** Canvas 不重挂；只把 context 生命周期同步给内外两层 UI。 */
function GlHealthReporter({ report }: { report: (health: GlHealth) => void }) {
  const renderer = useThree((s) => s.gl);
  useEffect(() => {
    const canvas = renderer.domElement;
    const onLost = (event: Event) => { event.preventDefault(); report('lost'); };
    const onRestored = () => report('healthy');
    canvas.addEventListener('webglcontextlost', onLost, false);
    canvas.addEventListener('webglcontextrestored', onRestored, false);
    report('healthy');
    return () => {
      canvas.removeEventListener('webglcontextlost', onLost, false);
      canvas.removeEventListener('webglcontextrestored', onRestored, false);
    };
  }, [renderer, report]);
  return null;
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
  pointerInteractive?: boolean;
  onPerformanceChange?: (degraded: boolean) => void;
  onHealthChange: (health: GlHealth) => void;
}

export default function PondGL({ flags, glSim, pointerInteractive = true, onPerformanceChange, onHealthChange }: PondGLProps) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' && flags.rtt && flags.waterFx) {
      console.warn('[PondGL] rtt 与 waterFx 同时开启：两个 priority-1 渲染器会互相覆盖，请关闭其中一个。');
    }
  }, [flags.rtt, flags.waterFx]);
  // 基调 / 球 / 水面 / 背景图 / RTT / 扭曲水面 / 漂浮微光 / 水生植物 任一开启都需要 Canvas；都关 = 卸载（回纯 SVG）
  const active = flags.glBase || flags.glSpheres || flags.water || flags.bgImage || flags.rtt || flags.waterFx || flags.floatMotes || flags.waterPlants || flags.reefStones || flags.crystalPillars;
  // J1：gl 对象恒定（AA 固定开）——不再随 glSpheres 变。原本为换 AA 用 key 重挂 Canvas，
  // 但重挂会新建/泄漏 WebGL context（多次切球 → context 累积被浏览器丢弃 → 球闪一下就没）。
  const gl = useMemo(() => ({ antialias: true, alpha: false }), []);
  const [runtimeHealth, setRuntimeHealth] = useState<GlHealth>('unavailable');
  const reportHealth = useCallback((health: GlHealth) => {
    setRuntimeHealth(health);
    onHealthChange(health);
  }, [onHealthChange]);
  const webGlAvailable = useMemo(() => isWebGLAvailable(), []);
  useWakeField(flags.wakeSpheres && flags.glSpheres && !!glSim); // L4：尾波扰球开 → 挂涟漪场（与花瓣层 refcount 共享）
  if (!active) return null;
  // J1：真没 WebGL → 不挂 Canvas，直接铺夜塘兜底（不白屏）
  if (!webGlAvailable) {
    return (
      <div className="pointer-events-none fixed inset-0 z-0">
        <GlFallback artDir={flags.artDir} />
      </div>
    );
  }
  // context lost（GPU 重置）或 forceFallback（测试）→ 盖兜底在 Canvas 之上（**不卸载 Canvas**，
  // 避免重挂丢球：早先 forceFallback 走 early-return 卸 Canvas，关掉后重挂 GL 球不回来）
  const showFallback = runtimeHealth !== 'healthy' || flags.forceFallback;
  return (
    <div className="pointer-events-none fixed inset-0 z-0">
      <GLErrorBoundary fallback={<GlFallback artDir={flags.artDir} />} onError={() => reportHealth('error')}>
        <Canvas
          orthographic
          // 球 / 水面 / RTT / 扭曲 需逐帧动画 → always；仅基调 / 背景图时 demand（只渲一次省帧）
          frameloop={flags.glSpheres || flags.water || flags.rtt || flags.waterFx || flags.floatMotes || flags.waterPlants || flags.reefStones || flags.crystalPillars ? 'always' : 'demand'}
          dpr={[1, 2]} // DPR cap 2（性能预算）
          gl={gl}
          // manual:true 恒定——base/水面走裁剪空间不用相机；球开时 SphereInstances 自己配像素相机。
          // 不再随 glSpheres 改 key 重挂 Canvas（重挂泄漏 context），切球只挂/卸 SphereInstances 这个 mesh
          camera={{ manual: true, position: [0, 0, 10], near: -1000, far: 1000 }}
        >
          <GlHealthReporter report={reportHealth} />
          {/* 背景图（renderOrder -2，最底）与纯色基调互斥：bgImage 开时不画 BaseTone */}
          {flags.bgImage && (
            <Suspense fallback={null}>
              <BgImage url="/test1-bg.png" />
            </Suspense>
          )}
          {flags.glBase && !flags.bgImage && <BaseTone artDir={flags.artDir} />}
          {/* 旧程序化水面（renderOrder -0.5）；waterFx 开时退役、由 WaterDistort 全屏扭曲取代 */}
          {flags.water && !flags.waterFx && <WaterSurface artDir={flags.artDir} />}
          {/* K8 + P9：常驻零绘制以接按键临时编舞；开关只决定静息态是否可见，不改用户保存参数。 */}
          <FloatingMotes enabled={flags.floatMotes} waterZoom={flags.waterZoom} />
          {/* K9：水生植物层（俯视睡莲叶 + 边缘芦苇；进 realScene 被合成扭曲；绕中心随 K6 缩放当强参照 + 涟漪轻晃）。OFF=不挂载=现状 */}
          {flags.waterPlants && <WaterPlants waterZoom={flags.waterZoom} />}
          {/* K12：水位标尺柱（礁石/水晶簇）——钉死、水从其身上漫过=水位/深度参照 + 中心一点透视。OFF=不挂载=现状 */}
          {(flags.reefStones || flags.crystalPillars) && <WaterColumns reefStones={flags.reefStones} crystalPillars={flags.crystalPillars} />}
          {/* waterOn 只认旧「水面」(G6 没入淡到全透明=水波盖住球)。扭曲水面(waterFx)下球**不淡出**：
              红线「水下不压黑/不虚化」→ 水下球保持可见、靠合成 pass 的深度折射(K3 d^a)体现浮沉，不消失。 */}
          {flags.glSpheres && glSim && <SphereInstances glSim={glSim} waterOn={flags.water} motionOn={flags.sphereMotion} sphereDrift={flags.sphereDrift} separatePass={flags.waterFx} colorGrade={flags.colorGrade} life={pickLifeFlags(flags)} />}
          {/* H1 spike：RTT 验证全屏盖在最上（renderOrder 10），隔离实验、默认关 */}
          {flags.rtt && <RttSpike />}
          {/* H2/H3：扭曲水面——渲真场景进 FBO 全屏折射扭曲 + 水位遮罩（接管渲染循环，返回 null） */}
          {flags.waterFx && <WaterDistort debug={flags.waterDbg} glSim={glSim} glSpheres={flags.glSpheres} sphereDrift={flags.sphereDrift} depthModel={flags.depthModel} sphereShadow={flags.sphereShadow} shadowOcclude={flags.shadowOcclude} shadowGlow={flags.shadowGlow} shadowContact={flags.shadowContact} caustics={flags.caustics} waterZoom={flags.waterZoom} pondFloor={flags.pondFloor} moonReflect={flags.moonReflect} pointerInteractive={pointerInteractive} />}
          {/* J3：低 FPS 自动降 DPR 保流畅（仅测时长 + setDpr，不渲染） */}
          {flags.autoDegrade && <AutoDpr onPerformanceChange={onPerformanceChange} />}
        </Canvas>
      </GLErrorBoundary>
      {/* 水面花瓣层（2D overlay，z-10 在 GL 之上）：出水球用 project() 抠洞 → 球盖花瓣。headless 跟随同源涟漪 */}
      {runtimeHealth === 'healthy' && !flags.forceFallback && flags.flowerPetals && <WaterPetals glSim={glSim} />}
      {/* J1：context lost / forceFallback → 盖兜底夜塘（Canvas 仍在底下跑，撤掉即恢复） */}
      {showFallback && <GlFallback artDir={flags.artDir} />}
    </div>
  );
}
