import Archipelago from '@/src/components/archipelago/Archipelago';
import BackgroundRipples from '@/src/components/BackgroundRipples';
import LoginButton from '@/src/components/auth/LoginButton';
import TestJam from '@/src/components/jam/TestJam';
import DraftSavedToast from '@/src/components/jam/DraftSavedToast';
import SvgAnimationLayer from '@/src/components/animations-svg/SvgAnimationLayer';

/**
 * 主页 — Phase 6 B2 v14
 *
 * z-stack：
 *  z-0    BackgroundRipples（背景随机白涟漪）+ Archipelago fullscreen 岛屿
 *  z-30   Archipelago tabs（左侧 vertical）+ TestJam UI（左侧 ABC 下方）
 *  z-40   SvgAnimationLayer 按键动画（pointer-events:none）
 *  z-9999 EclipseLayer（Portal 到 body）— 日食最上层
 *  z-60   顶栏（标题 + LoginButton "我的音乐"）
 */
export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-black">
      <BackgroundRipples />

      <Archipelago fullscreen />

      <SvgAnimationLayer paletteKey="grey" />

      {/* 左侧 Jam UI（在 Archipelago tabs 下方，top-24 + 3 tabs ≈ top-[200px]）*/}
      <div className="pointer-events-none fixed left-6 z-30" style={{ top: '14rem' }}>
        <div className="pointer-events-auto">
          <TestJam />
        </div>
      </div>

      {/* 顶栏：标题 + 登录 */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex items-start justify-between px-6 py-5">
        <h1 className="text-lg font-light tracking-[0.3em] text-white/80">
          Ripples in the Pond
        </h1>
        <div className="pointer-events-auto">
          <LoginButton />
        </div>
      </div>

      <DraftSavedToast />
    </main>
  );
}
