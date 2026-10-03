import type { ResidentEchoFrameInput, ResidentEchoLayout } from '../../src/types/echo-resident';

// 这里只构造纯运动与状态输入，不核验 NFT 或媒体可用性。
export const layout: ResidentEchoLayout = {
  width: 1440, height: 900, baseRadiusPx: 24, maxProjectionScale: 1.5,
  haloRatio: 1.16, surface: 0.525, controls: [{ x: 0, y: 0, width: 1440, height: 80 }],
  safeArea: { top: 0, right: 0, bottom: 0, left: 0 },
  projection: { cx: 720, cy: 450, mx: 0, my: 0, focusZ: 0.525,
    perspective: false, parallax: false, dof: false },
};
export const input: ResidentEchoFrameInput = {
  layout, available: true, healthy: true, sceneReady: true,
  scenePresence: 1, sceneRestored: true, reducedMotion: false,
  playback: 'idle', otherPlaybackActive: false,
};
