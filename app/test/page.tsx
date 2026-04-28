import Archipelago from '@/src/components/archipelago/Archipelago';
import LoginButton from '@/src/components/auth/LoginButton';
import TestJam from '@/src/components/jam/TestJam';
import SvgAnimationLayer from '@/src/components/animations-svg/SvgAnimationLayer';

/**
 * /test — 沙箱页（Phase 6 B2 探索）
 *
 * z-stack（从底到顶）：
 *  z-0   Archipelago fullscreen — 全屏可拖动 + 可点击的岛屿网络
 *  z-30  Archipelago tabs nav（A/B/C 切组）
 *  z-40  SvgAnimationLayer — 按键动画（pointer-events:none）
 *  z-[55] EclipseLayer（在 SphereCanvas 内）— 日食覆盖，不可被动画遮
 *  z-50  TestJam UI（底部键盘提示 + 录制 toast）
 *  z-60  顶栏（标题 + LoginButton），最上层可点
 */
export default function TestPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-black">
      <Archipelago fullscreen />

      <SvgAnimationLayer paletteKey="grey" />

      {/* 顶栏：标题 + 登录（最上层，可点）*/}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex items-start justify-between px-6 py-5">
        <h1 className="text-lg font-light tracking-[0.3em] text-white/80">
          Ripples in the Pond <span className="text-white/30">— /test sandbox</span>
        </h1>
        <div className="pointer-events-auto">
          <LoginButton />
        </div>
      </div>

      {/* 底部 jam UI（键盘提示 + 录制 toast）*/}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center pb-6">
        <div className="pointer-events-auto">
          <TestJam />
        </div>
      </div>
    </main>
  );
}
