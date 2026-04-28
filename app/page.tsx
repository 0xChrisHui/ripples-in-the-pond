import Archipelago from '@/src/components/archipelago/Archipelago';
import LoginButton from '@/src/components/auth/LoginButton';
import TestJam from '@/src/components/jam/TestJam';
import SvgAnimationLayer from '@/src/components/animations-svg/SvgAnimationLayer';

/**
 * 主页 — Phase 6 B2 v13 后采用 /test 设计
 *
 * z-stack：
 *  z-0    Archipelago fullscreen — 全屏可拖动 + 可点击的岛屿网络
 *  z-30   Archipelago tabs nav（A/B/C 切组）
 *  z-40   SvgAnimationLayer — 按键动画（pointer-events:none）
 *  z-9999 EclipseLayer（在 SphereCanvas 内 + Portal 到 body）— 日食最上层
 *  z-50   TestJam UI（底部键盘提示 + 录制 toast）
 *  z-60   顶栏（标题 + LoginButton "我的音乐"）
 */
export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-black">
      <Archipelago fullscreen />

      <SvgAnimationLayer paletteKey="grey" />

      <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex items-start justify-between px-6 py-5">
        <h1 className="text-lg font-light tracking-[0.3em] text-white/80">
          Ripples in the Pond
        </h1>
        <div className="pointer-events-auto">
          <LoginButton />
        </div>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center pb-6">
        <div className="pointer-events-auto">
          <TestJam />
        </div>
      </div>
    </main>
  );
}
