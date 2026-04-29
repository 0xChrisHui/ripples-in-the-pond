import Archipelago from '@/src/components/archipelago/Archipelago';
import BackgroundRipples from '@/src/components/BackgroundRipples';
import LoginButton from '@/src/components/auth/LoginButton';
import TestJam from '@/src/components/jam/TestJam';
import DraftSavedToast from '@/src/components/jam/DraftSavedToast';
import SvgAnimationLayer from '@/src/components/animations-svg/SvgAnimationLayer';

/**
 * /test — 沙箱页（v35 同步主页 + 3D 实验场）
 *
 * 与 / 同 z-stack：BackgroundRipples + Archipelago fullscreen + SvgAnimationLayer
 *                  + 左侧 TestJam + 顶栏 + DraftSavedToast。
 * 用作主页之外的 3D / 视觉新尝试入口。
 */
export default function TestPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-black">
      <BackgroundRipples />

      <Archipelago fullscreen />

      <SvgAnimationLayer paletteKey="grey" />

      {/* 左侧 Jam UI（同主页布局：top-14rem，ABC tabs 下方）*/}
      <div className="pointer-events-none fixed left-6 z-30" style={{ top: '14rem' }}>
        <div className="pointer-events-auto">
          <TestJam />
        </div>
      </div>

      {/* 顶栏：标题 + 登录（保留 sandbox 标识）*/}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex items-start justify-between px-6 py-5">
        <h1 className="text-lg font-light tracking-[0.3em] text-white/80">
          Ripples in the Pond <span className="text-white/30">— /test sandbox</span>
        </h1>
        <div className="pointer-events-auto">
          <LoginButton />
        </div>
      </div>

      <DraftSavedToast />
    </main>
  );
}
